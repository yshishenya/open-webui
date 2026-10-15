// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Suggestions from '$lib/components/workspace/Models/PromptSuggestions.svelte';
import type { SuggestionPrompt } from '$lib/utils/airis/model-types';
const mocks = vi.hoisted(() => ({ error: vi.fn(), save: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('file-saver', () => ({ saveAs: mocks.save }));
const NativeReader = FileReader;
let readers: Reader[] = [];
class Reader {
	result: string | null = null;
	onload: ((event: { target: Reader }) => void) | null = null;
	onerror: (() => void) | null = null;
	constructor() {
		readers.push(this);
	}
	readAsText(): void {}
	finish(body: string): void {
		this.result = body;
		this.onload?.({ target: this });
	}
}
beforeEach(() => {
	readers = [];
	vi.clearAllMocks();
	vi.stubGlobal('FileReader', Reader);
});
afterEach(() => {
	vi.unstubAllGlobals();
});
async function setup(
	rows: SuggestionPrompt[] = [{ content: 'Retained', title: ['Title', 'Subtitle'] }]
) {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Suggestions, {
		target,
		props: { promptSuggestions: rows },
		context: new Map([['i18n', writable(i18n)]])
	});
	await tick();
	const select = (): HTMLInputElement => {
		const input = target.querySelector('input[type=file]')! as HTMLInputElement;
		Object.defineProperty(input, 'files', {
			value: [new File(['fixture'], 'suggestions.json', { type: 'application/json' })],
			configurable: true
		});
		input.dispatchEvent(new Event('change', { bubbles: true }));
		return input;
	};
	const contents = (): string[] => [...target.querySelectorAll('textarea')].map((n) => n.value);
	const button = (text: string): HTMLButtonElement => {
		const b = [...target.querySelectorAll('button')].find((n) => n.textContent?.trim() === text);
		if (!b) throw Error('Missing ' + text);
		return b;
	};
	return {
		target,
		select,
		contents,
		button,
		close: async () => {
			await unmount(component);
			target.remove();
		}
	};
}
it.each([
	'[{"content":4,"title":[]}]',
	'[{"title":"Missing content"}]',
	'[{"content":"Good","title":[]},{"content":null,"title":[]}]',
	'[{"content":"Bad title","title":[4]}]'
])('rejects invalid import atomically and retains existing rows: %s', async (body) => {
	const s = await setup();
	try {
		s.select();
		readers[0].finish(body);
		await tick();
		expect(s.contents()).toEqual(['Retained']);
		expect(mocks.error).toHaveBeenCalledOnce();
	} finally {
		await s.close();
	}
});
it('accepts legacy titles and extras, appends once, edits and exports', async () => {
	const s = await setup();
	try {
		const input = s.select();
		readers[0].finish('[{"id":"one","content":"Imported","title":"Legacy","extra":7}]');
		await tick();
		expect(input.value).toBe('');
		expect(s.contents()).toEqual(['Retained', 'Imported']);
		const imported = s.target.querySelectorAll('textarea')[1];
		imported.value = 'Edited';
		imported.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		s.button('Export').click();
		expect(mocks.save).toHaveBeenCalledOnce();
		const blob = mocks.save.mock.calls[0][0] as Blob;
		const body = await new Promise<string>((resolve, reject) => {
			const read = new NativeReader();
			read.onload = () => resolve(String(read.result));
			read.onerror = () => reject(Error('Export read failed'));
			read.readAsText(blob);
		});
		expect(JSON.parse(body)).toEqual([
			{ content: 'Retained', title: ['Title', 'Subtitle'] },
			{ id: 'one', content: 'Edited', title: ['Legacy', ''], extra: 7 }
		]);
		expect(blob.type).toBe('application/json');
		expect(mocks.save.mock.calls[0][1]).toMatch(/^prompt-suggestions-export-\d+\.json$/);
	} finally {
		await s.close();
	}
});
it('reports read failure without replacing rows', async () => {
	const s = await setup();
	try {
		s.select();
		readers[0].onerror?.();
		await tick();
		expect(mocks.error).toHaveBeenCalledOnce();
		expect(s.contents()).toEqual(['Retained']);
	} finally {
		await s.close();
	}
});
it('ignores a completed read after unmount', async () => {
	const s = await setup();
	s.select();
	await s.close();
	readers[0].finish('invalid JSON');
	expect(mocks.error).not.toHaveBeenCalled();
});
it('preserves legacy normalization and add/remove controls', async () => {
	const s = await setup([{ content: 'Legacy task', title: 'Legacy' }]);
	try {
		expect(s.target.querySelector('input[aria-label=Title]')?.getAttribute('type')).not.toBe(
			'file'
		);
		expect((s.target.querySelector('input[aria-label=Title]') as HTMLInputElement).value).toBe(
			'Legacy'
		);
		(
			s.target.querySelector('button[aria-label="Add prompt suggestion"]') as HTMLButtonElement
		).click();
		await tick();
		expect(s.contents()).toEqual(['Legacy task', '']);
		(
			s.target.querySelector('button[aria-label="Remove prompt suggestion"]') as HTMLButtonElement
		).click();
		await tick();
		expect(s.contents()).toEqual(['']);
	} finally {
		await s.close();
	}
});
