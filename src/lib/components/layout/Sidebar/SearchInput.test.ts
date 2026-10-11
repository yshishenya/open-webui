// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { readable } from 'svelte/store';
import SearchInput from './SearchInput.svelte';

vi.mock('$lib/apis/chats', () => ({
	getAllTags: vi.fn(async () => [{ id: 'work', name: 'Work' }])
}));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { tags: writable([{ id: 'work', name: 'Work' }]), folders: writable([]) };
});
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));

let mounted: ReturnType<typeof createClassComponent>;
let errors: string[];
const parentKeydown = vi.fn();
const captureError = (event: ErrorEvent): void => {
	errors.push(event.message);
	event.preventDefault();
};
beforeEach(() => {
	vi.clearAllMocks();
	document.body.innerHTML = '';
	errors = [];
	window.addEventListener('error', captureError);
	mounted = createClassComponent({
		component: SearchInput,
		target: document.body,
		context: new Map([['i18n', readable({ t: (key: string) => key })]]),
		props: { onKeydown: parentKeydown }
	});
});
afterEach(() => {
	mounted.$destroy();
	window.removeEventListener('error', captureError);
	document.body.innerHTML = '';
});
const input = (): HTMLInputElement => {
	const node = document.querySelector<HTMLInputElement>('#search-input');
	if (!node) throw new Error('Missing search input');
	return node;
};
const setValue = async (value: string): Promise<void> => {
	input().value = value;
	input().dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
};
const key = async (name: string, isComposing = false): Promise<void> => {
	input().dispatchEvent(new KeyboardEvent('keydown', { key: name, isComposing, bubbles: true }));
	await tick();
};
const open = async (): Promise<void> => {
	input().click();
	await tick();
};
const hover = async (): Promise<void> => {
	document.querySelector('#search-options-container')?.dispatchEvent(new MouseEvent('mouseenter'));
	await tick();
};

it('selects the first option with Enter after pointer hover clears keyboard selection', async () => {
	await open();
	await hover();
	await key('Enter');
	expect(errors).toEqual([]);
	expect(input().value).toBe('tag:');
});
it('selects a matching tag with Enter after hover', async () => {
	await setValue('tag:w');
	await open();
	await vi.waitFor(() => expect(document.querySelector('#search-item-0')).not.toBeNull());
	await hover();
	await key('Enter');
	expect(errors).toEqual([]);
	expect(input().value).toBe('tag:work ');
});
it('clamps selection when filtering leaves fewer options', async () => {
	await open();
	await key('ArrowDown');
	await key('ArrowDown');
	await setValue('ta');
	await key('Enter');
	expect(errors).toEqual([]);
	expect(input().value).toBe('tag:');
});
it('selects the first tag after ArrowDown on a search with no suggestions', async () => {
	await setValue('hello');
	await open();
	await key('ArrowDown');
	await setValue('tag:w');
	await vi.waitFor(() => expect(document.querySelector('#search-item-0')).not.toBeNull());
	await key('Enter');
	expect(errors).toEqual([]);
	expect(input().value).toBe('tag:work ');
});
it('forwards Enter to the parent when the suggestion list is hidden', async () => {
	await open();
	input().dispatchEvent(new FocusEvent('blur'));
	await tick();
	await key('Enter');
	expect(errors).toEqual([]);
	expect(parentKeydown).toHaveBeenCalledOnce();
	expect(input().value).toBe('');
});
it('preserves ArrowDown selection and does not forward an accepted suggestion', async () => {
	await open();
	await key('ArrowDown');
	await key('Enter');
	expect(errors).toEqual([]);
	expect(input().value).toBe('folder:');
	expect(parentKeydown).not.toHaveBeenCalled();
});
it('ignores Enter during IME composition', async () => {
	await open();
	await key('Enter', true);
	expect(errors).toEqual([]);
	expect(input().value).toBe('');
	expect(parentKeydown).not.toHaveBeenCalled();
});
it('forwards keys for ordinary search without suggestions', async () => {
	await setValue('hello');
	await open();
	await key('Enter');
	expect(errors).toEqual([]);
	expect(parentKeydown).toHaveBeenCalledOnce();
	expect(input().value).toBe('hello');
});
it('restores keyboard selection with ArrowUp after hover', async () => {
	await open();
	await hover();
	await key('ArrowUp');
	await key('Enter');
	expect(errors).toEqual([]);
	expect(input().value).toBe('tag:');
});
