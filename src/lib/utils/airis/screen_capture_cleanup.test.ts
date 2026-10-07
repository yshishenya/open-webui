// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it.each(['denied', 'play', 'context', 'draw', 'conversion', 'fetch', 'handoff', 'success'])(
	'screen capture releases its resources before downstream work: %s',
	async (mode) => {
		const source = readFileSync('src/lib/components/chat/MessageInput.svelte', 'utf8');
		const instance = parse(source).instance;
		if (!instance) throw new Error('Missing component script');
		const parsed = ts.createSourceFile(
			'capture.ts',
			source.slice(instance.content.start, instance.content.end),
			ts.ScriptTarget.Latest,
			true
		);
		const declaration = parsed.statements
			.filter(ts.isVariableStatement)
			.flatMap((s) => [...s.declarationList.declarations])
			.find((d) => d.name.getText(parsed) === 'screenCaptureHandler');
		if (!declaration?.initializer) throw new Error('Missing actual capture handler');
		const stops = [vi.fn(), vi.fn()];
		const stream = { getTracks: () => stops.map((stop) => ({ stop })) };
		const video = {
			srcObject: null as typeof stream | null,
			videoWidth: 640,
			videoHeight: 480,
			play: vi.fn(async (): Promise<void> => {
				if (mode === 'play') throw new Error('play failed');
			})
		};
		const assertReleased = (): void => {
			stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
			expect(video.srcObject).toBeNull();
		};
		const drawImage = vi.fn((): void => {
			if (mode === 'draw') throw new Error('draw failed');
		});
		const canvas = {
			width: 0,
			height: 0,
			getContext: () => (mode === 'context' ? null : { drawImage }),
			toDataURL: vi.fn((): string => {
				assertReleased();
				if (mode === 'conversion') throw new Error('conversion failed');
				return 'data:image/png;base64,fixture';
			})
		};
		const getDisplayMedia = vi.fn(async () => {
			if (mode === 'denied') throw new DOMException('denied', 'NotAllowedError');
			return stream;
		});
		const handoff = vi.fn((files: { name: string; options: { type: string } }[]): void => {
			assertReleased();
			expect(files).toHaveLength(1);
			expect(files[0].name).toMatch(/^screen-capture-\d+\.png$/);
			expect(files[0].options.type).toBe('image/png');
			if (mode === 'handoff') throw new Error('handoff failed');
		});
		const context = {
			navigator: { mediaDevices: { getDisplayMedia } },
			document: { createElement: (tag: string) => (tag === 'video' ? video : canvas) },
			window: { focus: vi.fn() },
			console: { error: vi.fn() },
			fetch: vi.fn(async () => {
				assertReleased();
				if (mode === 'fetch') throw new Error('fetch failed');
				return { blob: async (): Promise<Blob> => new Blob(['fixture']) };
			}),
			File: class {
				constructor(
					public parts: Blob[],
					public name: string,
					public options: { type: string }
				) {}
			},
			Date,
			inputFilesHandler: handoff
		};
		const code = ts.transpileModule(`(${declaration.initializer.getText(parsed)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText;
		await (runInNewContext(code, context) as () => Promise<void>)();
		expect(getDisplayMedia).toHaveBeenCalledWith({ video: { cursor: 'never' }, audio: false });
		if (mode === 'denied') stops.forEach((stop) => expect(stop).not.toHaveBeenCalled());
		else assertReleased();
		expect(video.srcObject).toBeNull();
		if (['denied', 'play', 'context', 'draw'].includes(mode)) {
			expect(canvas.toDataURL).not.toHaveBeenCalled();
			expect(context.fetch).not.toHaveBeenCalled();
		}
		if (mode === 'success' || mode === 'handoff') expect(handoff).toHaveBeenCalledTimes(1);
		else expect(handoff).not.toHaveBeenCalled();
		if (mode === 'success') {
			expect(context.console.error).not.toHaveBeenCalled();
			expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
			expect(handoff.mock.calls[0][0]).toHaveLength(1);
		} else expect(context.console.error).toHaveBeenCalledTimes(1);
	}
);
