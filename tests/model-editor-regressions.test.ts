// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { ModelConfig } from '$lib/apis';
import Knowledge from '$lib/components/workspace/Models/Knowledge.svelte';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('$lib/apis/notes', () => ({ searchNotes: async () => ({ items: [] }) }));
vi.mock('$lib/apis/knowledge', () => ({
	searchKnowledgeBases: async () => ({ items: [] }),
	searchKnowledgeFiles: async () => ({ items: [] })
}));

const editor = readFileSync('src/lib/components/workspace/Models/ModelEditor.svelte', 'utf8');
const script = editor.split('<script lang="ts">')[1].split('</script>')[0];
const source = ts.createSourceFile('editor.ts', script, ts.ScriptTarget.Latest, true);
const declaration = (name: string): string => {
	const node = source.statements.find(
		(node) =>
			ts.isVariableStatement(node) &&
			node.declarationList.declarations.some((d) => d.name.getText(source) === name)
	);
	if (!node) throw new Error(`Actual editor declaration missing: ${name}`);
	return node.getText(source);
};
const javascript = (code: string): string =>
	ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

it('submits actual metadata without deleting null/primitive knowledge or duplicating extracted text', async () => {
	const info: ModelConfig = { id: '', name: '', meta: { description: '  ' }, params: {} };
	const onSubmit = vi.fn();
	const error = vi.fn();
	const sandbox = {
		info,
		id: 'preset',
		name: 'Preset',
		preset: false,
		loading: false,
		knowledge: [
			null,
			'legacy',
			0,
			false,
			{
				id: 'k',
				name: 'Knowledge',
				context: 'full',
				data: { content: 'private text' },
				file: { data: { content: 'private text' } }
			}
		] as unknown[],
		params: { system: '', stop: 'end, ,done', temperature: 0 },
		system: 'Instructions',
		enableDescription: true,
		accessGrants: [],
		capabilities: {},
		toolIds: [],
		skillIds: [],
		filterIds: [],
		defaultFilterIds: [],
		actionIds: [],
		defaultFeatureIds: [],
		builtinTools: {},
		terminalId: '',
		tts: { voice: '' },
		onSubmit,
		toast: { error },
		$i18n: { t: (text: string) => text }
	};
	const run = runInNewContext(
		javascript(
			`${declaration('toModelKnowledgeReference')}\n${declaration('submitHandler')}\nsubmitHandler`
		),
		sandbox
	) as () => Promise<void>;
	await run();
	expect(onSubmit).toHaveBeenCalledOnce();
	expect(error).not.toHaveBeenCalled();
	expect(info.meta.knowledge).toEqual([
		null,
		'legacy',
		0,
		false,
		{ id: 'k', name: 'Knowledge', context: 'full' }
	]);
	expect(info.meta.description).toBeNull();
	expect(info.params).toEqual({ system: 'Instructions', stop: ['end', 'done'], temperature: 0 });
	expect(sandbox.loading).toBe(false);
	sandbox.knowledge.push({ status: 'uploading' });
	await run();
	expect(onSubmit).toHaveBeenCalledOnce();
	expect(error).toHaveBeenCalledWith('Please wait until all files are uploaded.');
	expect(sandbox.loading).toBe(false);
});

it('keeps actual profile upload animation, centered crop and original image without canvas', () => {
	const body = editor.split('on:change={() => {')[1]?.split('\n\t\t\t\t}}\n\t\t\t/>')[0];
	if (!body) throw new Error('Actual profile upload handler missing');
	for (const [type, available, expected] of [
		['image/gif', true, 'data:original'],
		['image/webp', true, 'data:original'],
		['image/png', false, 'data:original'],
		['image/png', true, 'data:compressed']
	] as const) {
		const images: { width: number; height: number; src: string; onload?: () => void }[] = [];
		const drawImage = vi.fn();
		const sandbox = {
			inputFiles: [{ type }] as { type: string }[] | null,
			filesInputElement: { value: 'image.png' },
			info: { meta: { profile_image_url: 'old' } },
			console,
			FileReader: class {
				onload?: (event: { target: { result: string } }) => void;
				readAsDataURL(): void {
					this.onload?.({ target: { result: 'data:original' } });
				}
			},
			Image: class {
				width = 500;
				height = 250;
				src = '';
				onload?: () => void;
				constructor() {
					images.push(this);
				}
			},
			document: {
				createElement: () => ({
					getContext: () => (available ? { drawImage } : null),
					toDataURL: () => 'data:compressed'
				})
			}
		};
		(runInNewContext(javascript(`(() => {${body}\n})`), sandbox) as () => void)();
		images[0]?.onload?.();
		expect(sandbox.info.meta.profile_image_url).toBe(expected);
		expect(sandbox.inputFiles).toBeNull();
		expect(sandbox.filesInputElement.value).toBe('');
		if (type === 'image/png' && available)
			expect(drawImage).toHaveBeenCalledWith(images[0], -125, 0, 500, 250);
		else expect(drawImage).not.toHaveBeenCalled();
	}
});

it('mounts the real knowledge widget with arbitrary values and removes the correct object row', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.appendChild(target);
	let selected: unknown[] = [null, false, 'legacy', { id: 'k', name: 'Knowledge' }];
	const component = mount(Knowledge, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			get selectedItems() {
				return selected;
			},
			set selectedItems(value: unknown[]) {
				selected = value;
			}
		}
	});
	try {
		await tick();
		expect(target.textContent).toContain('Knowledge');
		expect(target.querySelectorAll('[aria-label="Remove File"]')).toHaveLength(1);
		target.querySelector<HTMLButtonElement>('[aria-label="Remove File"]')?.click();
		await tick();
		expect(selected).toEqual([null, false, 'legacy']);
	} finally {
		await unmount(component);
		target.remove();
	}
});
