// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { ChatAttachment } from './chat_history';
import type { FrontendConfig } from './frontend-contracts';
import type { Settings } from '$lib/stores';

function input(
	channel: { id: string } | null,
	settings: Settings = {},
	config: Partial<FrontendConfig> = {}
) {
	const source = readFileSync(
		process.env.AIRIS_CHANNEL_INPUT_SOURCE ?? 'src/lib/components/channel/MessageInput.svelte',
		'utf8'
	);
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing input script');
	const ast = ts.createSourceFile(
		'input.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const names = ['inputFilesHandler', 'uploadFileHandler'];
	const handlers = ast.statements
		.filter(ts.isVariableStatement)
		.filter((s) => s.declarationList.declarations.some((d) => names.includes(d.name.getText(ast))));
	if (handlers.length !== 2) throw new Error('Missing actual file handlers');
	const upload = vi.fn(
		async (): Promise<{
			id: string;
			meta: { content_type: string; collection_name: string };
		} | null> => ({
			id: 'uploaded',
			meta: { content_type: 'text/plain', collection_name: 'collection' }
		})
	);
	const error = vi.fn();
	const compress = vi.fn<[string, number | '' | null, number | '' | null], Promise<string>>(
		async () => 'data:image/png;base64,compressed'
	);
	const fetchImage = vi.fn(async () => ({ blob: async () => new Blob(['image']) }));
	const convert = vi.fn(async (file: File) => file);
	const readers: {
		onload: (event: { target: { result: unknown } | null }) => Promise<void>;
		readAsDataURL: ReturnType<typeof vi.fn>;
	}[] = [];
	const context = {
		channel,
		$settings: settings,
		$config: config,
		$i18n: { t: (text: string) => text },
		toast: { error, warning: vi.fn() },
		console: { info: vi.fn(), error: vi.fn() },
		uuidv4: () => 'temporary',
		localStorage: { token: 'test' },
		uploadFile: upload,
		compressImage: compress,
		fetch: fetchImage,
		convertHeicToJpeg: convert,
		File,
		FileReader: class {
			onload = async (): Promise<void> => {};
			readAsDataURL = vi.fn();
			constructor() {
				readers.push(this);
			}
		}
	};
	const code = ts.transpileModule(
		`let files = []; ${handlers.map((s) => s.getText(ast)).join('\n')} ({prepare: inputFilesHandler, upload: uploadFileHandler, files: () => files});`,
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const actual = runInNewContext(code, context) as {
		prepare: (files: File[]) => Promise<void>;
		upload: (file: File, process?: boolean) => Promise<void | null>;
		files: () => ChatAttachment[];
	};
	return { actual, upload, error, compress, fetchImage, convert, readers };
}

it.each(['missing channel', 'empty', 'success', 'audio', 'rejected', 'null response'])(
	'actual upload handles %s',
	async (mode) => {
		const r = input(mode === 'missing channel' ? null : { id: 'channel' }, {
			audio: { stt: { language: 'ru' } }
		});
		const file = new File(mode === 'empty' ? [] : ['fixture'], 'fixture.txt', {
			type: mode === 'audio' ? 'audio/wav' : 'text/plain'
		});
		if (mode === 'rejected') r.upload.mockRejectedValueOnce(new Error('upload rejected'));
		if (mode === 'null response') r.upload.mockResolvedValueOnce(null);
		const result = await r.actual.upload(file);
		if (mode === 'empty' || mode === 'missing channel') expect(r.upload).not.toHaveBeenCalled();
		else
			expect(r.upload).toHaveBeenCalledWith(
				'test',
				file,
				{ channel_id: 'channel', ...(mode === 'audio' ? { language: 'ru' } : {}) },
				true
			);
		if (mode === 'success' || mode === 'audio') {
			expect(r.actual.files()).toEqual([
				expect.objectContaining({
					id: 'uploaded',
					itemId: 'temporary',
					status: 'uploaded',
					content_type: 'text/plain',
					collection_name: 'collection',
					url: 'uploaded'
				})
			]);
			expect(r.error).not.toHaveBeenCalled();
		} else {
			expect(r.actual.files()).toEqual([]);
			expect(r.error).toHaveBeenCalledTimes(mode === 'null response' ? 0 : 1);
		}
		expect(result).toBe(mode === 'empty' ? null : undefined);
	}
);

it.each([
	'plain',
	'oversize',
	'image',
	'heic',
	'settings only',
	'channel flag disabled',
	'config limit',
	'blank width',
	'zero width',
	'null target',
	'null result',
	'buffer result'
])('actual preparation preserves file behavior: %s', async (mode) => {
	const settings: Settings = {
		imageCompression: true,
		imageCompressionInChannels: mode !== 'channel flag disabled',
		imageCompressionSize: {
			width: mode === 'blank width' ? '' : mode === 'zero width' ? 0 : 800,
			height: 600
		}
	};
	const config = {
		file: {
			max_size: mode === 'oversize' ? 0 : null,
			max_count: null,
			image_compression: {
				width: ['config limit', 'blank width', 'zero width'].includes(mode) ? 400 : null,
				height: null
			}
		}
	};
	const r = input({ id: 'channel' }, mode === 'image' || mode === 'heic' ? {} : settings, config);
	const file = new File(['fixture'], 'fixture', {
		type:
			mode === 'plain' || mode === 'oversize'
				? 'text/plain'
				: mode === 'heic'
					? 'image/heic'
					: 'image/png'
	});
	await r.actual.prepare([file]);
	await Promise.resolve();
	if (mode === 'oversize') {
		expect(r.upload).not.toHaveBeenCalled();
		expect(r.error).toHaveBeenCalledOnce();
		return;
	}
	if (mode === 'plain') {
		expect(r.upload).toHaveBeenCalledWith('test', file, { channel_id: 'channel' }, true);
		return;
	}
	expect(r.upload).not.toHaveBeenCalled();
	expect(r.readers).toHaveLength(1);
	expect(r.readers[0].readAsDataURL).toHaveBeenCalledWith(file);
	expect(r.convert).toHaveBeenCalledTimes(mode === 'heic' ? 1 : 0);
	await r.readers[0].onload({
		target:
			mode === 'null target'
				? null
				: {
						result:
							mode === 'null result'
								? null
								: mode === 'buffer result'
									? new ArrayBuffer(2)
									: 'data:image/png;base64,original'
					}
	});
	if (['null target', 'null result', 'buffer result'].includes(mode)) {
		expect(r.error).toHaveBeenCalledOnce();
		expect(r.fetchImage).not.toHaveBeenCalled();
		expect(r.upload).not.toHaveBeenCalled();
		return;
	}
	if (mode === 'settings only' || mode === 'config limit')
		expect(r.compress).toHaveBeenCalledWith(
			'data:image/png;base64,original',
			mode === 'config limit' ? 400 : 800,
			600
		);
	else if (mode === 'blank width' || mode === 'zero width') {
		expect(r.compress).toHaveBeenCalledOnce();
		expect(r.compress.mock.calls[0][1] || null).toBeNull();
		expect(r.compress.mock.calls[0][2]).toBe(600);
	} else expect(r.compress).not.toHaveBeenCalled();
	expect(r.fetchImage).toHaveBeenCalledWith(
		['settings only', 'config limit', 'blank width', 'zero width'].includes(mode)
			? 'data:image/png;base64,compressed'
			: 'data:image/png;base64,original'
	);
	expect(r.upload).toHaveBeenCalledWith(
		'test',
		expect.objectContaining({ name: 'fixture', type: file.type }),
		{ channel_id: 'channel' },
		false
	);
});

it.each(['1F44B', null])('actual emoji command handles id=%s', (id) => {
	const source = readFileSync(
		process.env.AIRIS_CHANNEL_INPUT_SOURCE ?? 'src/lib/components/channel/MessageInput.svelte',
		'utf8'
	);
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing input script');
	const ast = ts.createSourceFile(
		'input.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	let command: ts.Expression | undefined;
	const visit = (node: ts.Node): void => {
		if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'command')
			command = node.initializer;
		ts.forEachChild(node, visit);
	};
	visit(ast);
	if (!command) throw new Error('Missing actual emoji command');
	const code = ts.transpileModule(`(${command.getText(ast)})`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	const run = vi.fn();
	const insertContent = vi.fn(() => ({ run }));
	const deleteRange = vi.fn(() => ({ insertContent }));
	const focus = vi.fn(() => ({ deleteRange }));
	const range = { from: 0, to: 3 };
	const actual = runInNewContext(code) as (value: {
		editor: { chain: () => { focus: typeof focus } };
		range: typeof range;
		props: { id: string | null };
	}) => void;
	actual({ editor: { chain: () => ({ focus }) }, range, props: { id } });
	if (id === null) expect(focus).not.toHaveBeenCalled();
	else {
		expect(deleteRange).toHaveBeenCalledWith(range);
		expect(insertContent).toHaveBeenCalledWith('👋');
		expect(run).toHaveBeenCalledOnce();
	}
});
