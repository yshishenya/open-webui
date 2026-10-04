// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import { getMapLocation, normalizeInputVariables } from '../src/lib/utils/airis/input_variables';
import InputVariablesHarness from './fixtures/InputVariablesHarness.svelte';

vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { models: writable([]), config: writable({}) };
});
vi.mock('$lib/utils', () => ({ copyToClipboard: vi.fn() }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));
let component: Record<string, unknown> | null = null;
let target: HTMLDivElement | null = null;
const save = vi.fn();
const settle = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await tick();
};
const render = async (variables: Record<string, Record<string, unknown>>): Promise<void> => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(InputVariablesHarness, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { props: { variables, onSave: save } }
	});
	await settle();
};
const submit = async (): Promise<void> => {
	document
		.querySelector('form')!
		.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
};
const input = <T extends Element>(selector: string): T => {
	const field = document.querySelector<T>(selector);
	if (!field) throw new Error(`Missing ${selector}`);
	return field;
};
beforeEach(() => {
	if (!Element.prototype.animate)
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({
				cancel: vi.fn(),
				finished: Promise.resolve(),
				finish: vi.fn(),
				pause: vi.fn(),
				play: vi.fn()
			}))
		});
});
afterEach(async () => {
	if (component) await unmount(component);
	target?.remove();
	component = null;
	target = null;
	save.mockReset();
});
it('does not check a checkbox when the template parser returns the string false', async () => {
	await render({ enabled: { type: 'checkbox', default: 'false' } });
	expect(input<HTMLInputElement>('input[type="checkbox"]').checked).toBe(false);
});
it('keeps the checkbox consistent when false is typed into its text field', async () => {
	await render({ enabled: { type: 'checkbox', default: true } });
	const text = input<HTMLInputElement>('input[placeholder="Enter value (true/false)"]');
	text.value = 'false';
	text.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	expect(input<HTMLInputElement>('input[type="checkbox"]').checked).toBe(false);
	await submit();
	expect(save).toHaveBeenCalledWith({ enabled: 'false' });
});
it('requires a choice in a required select and accepts a chosen value', async () => {
	await render({ choice: { type: 'select', required: true, options: ['A', 'B'] } });
	const select = input<HTMLSelectElement>('select');
	expect(input<HTMLFormElement>('form').checkValidity()).toBe(false);
	select.value = 'B';
	select.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
	expect(input<HTMLFormElement>('form').checkValidity()).toBe(true);
	await submit();
	expect(save).toHaveBeenCalledWith({ choice: 'B' });
});
it('preserves defaults, normalizes only CRLF and never changes the definitions', async () => {
	const variables = {
		text: { type: 'text', default: 'A\r\nB' },
		number: { type: 'number', default: 0 },
		enabled: { type: 'checkbox', default: false },
		date: { type: 'date', default: '2026-10-04' }
	};
	const before = structuredClone(variables);
	await render(variables);
	await submit();
	expect(save).toHaveBeenCalledWith({
		text: 'A\nB',
		number: 0,
		enabled: false,
		date: '2026-10-04'
	});
	expect(variables).toEqual(before);
});
it('keeps numeric edits numeric, including zero, and represents an empty number as undefined', async () => {
	await render({ count: { type: 'number', default: 5 } });
	const number = input<HTMLInputElement>('input[type="number"]');
	number.value = '0';
	number.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	await submit();
	expect(save).toHaveBeenLastCalledWith({ count: 0 });
});
it('restores current defaults on reopen after a cancelled edit', async () => {
	await render({ name: { type: 'text', default: 'Original' } });
	const text = input<HTMLInputElement>('input[type="text"]');
	text.value = 'Discard';
	text.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	[...document.querySelectorAll('button')]
		.find((button) => button.textContent?.trim() === 'Cancel')!
		.click();
	await settle();
	expect(save).not.toHaveBeenCalled();
	[...document.querySelectorAll('button')]
		.find((button) => button.textContent?.trim() === 'Reopen')!
		.click();
	await settle();
	expect(input<HTMLInputElement>('input[type="text"]').value).toBe('Original');
});

it.each<[string, string]>([
	['text', 'New text'],
	['date', '2026-11-09'],
	['datetime-local', '2026-11-09T12:15'],
	['email', 'test@example.com'],
	['month', '2026-11'],
	['tel', '+123456789'],
	['time', '12:15'],
	['url', 'https://example.com/'],
	['textarea', 'Two\nlines']
])('saves actual %s field edits', async (type, value) => {
	await render({ field: { type } });
	const field = input<HTMLInputElement | HTMLTextAreaElement>('#input-variable-0');
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	await submit();
	expect(save).toHaveBeenCalledWith({ field: value });
});
it('saves an emptied optional number as undefined', async () => {
	await render({ count: { type: 'number', default: 5 } });
	const field = input<HTMLInputElement>('input[type="number"]');
	field.value = '';
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	await submit();
	expect(save).toHaveBeenCalledWith({ count: undefined });
});
it('changes a checkbox to a boolean and updates its paired text', async () => {
	await render({ enabled: { type: 'checkbox', default: 'false' } });
	input<HTMLInputElement>('input[type="checkbox"]').click();
	await settle();
	expect(input<HTMLInputElement>('input[type="text"]').value).toBe('true');
	await submit();
	expect(save).toHaveBeenCalledWith({ enabled: true });
});
it('preserves numeric select options instead of changing them to strings', async () => {
	await render({ field: { type: 'select', options: [0, 7] } });
	const field = input<HTMLSelectElement>('select');
	field.selectedIndex = 1;
	field.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
	await submit();
	expect(save).toHaveBeenCalledWith({ field: 0 });
});
it('preserves range numeric changes, bounds and the paired text', async () => {
	await render({ field: { type: 'range', min: 0, max: 10, step: 1, default: 3 } });
	const field = input<HTMLInputElement>('input[type="range"]');
	field.value = '7';
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	expect(input<HTMLInputElement>('input[type="text"]').value).toBe('7');
	await submit();
	expect(save).toHaveBeenCalledWith({ field: 7 });
});
it('uppercases a selected color and updates its paired text', async () => {
	await render({ field: { type: 'color', default: '#FF0000' } });
	const field = input<HTMLInputElement>('input[type="color"]');
	field.value = '#abcdef';
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	expect(input<HTMLInputElement>('input[type="text"]').value).toBe('#ABCDEF');
	await submit();
	expect(save).toHaveBeenCalledWith({ field: '#ABCDEF' });
});
it('retains native validation attributes', async () => {
	await render({ count: { type: 'number', min: 2, max: 4, step: 1, required: true } });
	const field = input<HTMLInputElement>('input[type="number"]');
	field.value = '6';
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	expect(input<HTMLFormElement>('form').checkValidity()).toBe(false);
	field.value = '3';
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	expect(input<HTMLFormElement>('form').checkValidity()).toBe(true);
});
it.each<[unknown, [number, number] | null]>([
	['51.505, -0.09', [51.505, -0.09]],
	['0,0', [0, 0]],
	['-90,180', [-90, 180]],
	[false, null],
	[12, null],
	[null, null],
	[{ lat: 1 }, null],
	['', null],
	[',', null],
	['1,2,3', null],
	['NaN,2', null],
	['Infinity,0', null],
	['91,0', null],
	['0,-181', null]
])('validates map coordinates %j', (value, expected) => {
	expect(getMapLocation(value)).toEqual(expected);
});
it('normalizes malformed descriptions while preserving defaults and unknown attributes', () => {
	const definitions = {
		field: {
			type: 'select',
			label: 4,
			placeholder: false,
			options: { a: 1 },
			default: false,
			min: 3,
			future: 'keep'
		},
		empty: null,
		options: { options: ['A', 0, false, null, { a: 1 }] }
	};
	const before = structuredClone(definitions);
	const normalized = normalizeInputVariables(definitions);
	expect(normalized.field).toMatchObject({
		options: [],
		default: false,
		min: 3,
		future: 'keep',
		required: false
	});
	expect(normalized.field.label).toBeUndefined();
	expect(normalized.field.placeholder).toBeUndefined();
	expect(normalized.options.options).toEqual(definitions.options.options);
	expect(definitions).toEqual(before);
});
