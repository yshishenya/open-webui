// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import Collapsible from '../src/lib/components/common/Collapsible.svelte';
import russian from '../src/lib/i18n/locales/ru-RU/translation.json';

it.each([
	{ duration: '70', label: 'Thought for a minute' },
	{ duration: 70, label: 'Thought for a minute' },
	{ duration: '120', label: 'Thought for 2 minutes' },
	{ duration: 120, label: 'Thought for 2 minutes' },
	{ duration: '60', label: 'Thought for a minute' },
	{ duration: '59', label: 'Thought for 59 seconds' },
	{ duration: '1', label: 'Thought for 1 seconds' },
	{ duration: '0.5', label: 'Thought for less than a second' },
	{ duration: '0', label: 'Thought for less than a second' },
	{ duration: 0, label: 'Thought' },
	{ duration: undefined, label: 'Thought' },
	{ duration: '', label: 'Thought' },
	{ duration: 'invalid', label: 'Thought' },
	{ duration: '-2', label: 'Thought' },
	{ duration: 'Infinity', label: 'Thought' },
	{ duration: Number.NaN, label: 'Thought' },
	{ duration: Number.MAX_VALUE, label: 'Thought' },
	{ duration: '70', done: 'false', label: 'Thinking...' },
	{ duration: '70', done: 'false', messageDone: true, label: 'Thought for a minute' },
	{ type: 'code_interpreter', done: 'false', label: 'Analyzing...' },
	{ type: 'code_interpreter', label: 'Analyzed' },
	{ type: 'other', label: 'Details' },
	{ duration: '120', lng: 'ru', label: 'Рассуждаю 2 минуты' }
])(
	'displays truthful detail label $label',
	async ({ duration, label, type, done, messageDone, lng }) => {
		const i18n = createInstance();
		await i18n.init({
			lng: lng ?? 'en',
			resources: { ru: { translation: russian } },
			initImmediate: false
		});
		const target = document.createElement('div');
		document.body.append(target);
		const attributes = Object.freeze({ type: type ?? 'reasoning', done: done ?? 'true', duration });
		const component = mount(Collapsible, {
			target,
			context: new Map([['i18n', writable(i18n)]]),
			props: { title: 'Details', attributes, messageDone }
		});
		try {
			await tick();
			const button = target.querySelector('button')?.cloneNode(true) as HTMLButtonElement;
			button.querySelectorAll('style').forEach((style) => style.remove());
			expect(button.textContent?.trim()).toBe(label);
			expect(attributes.duration).toBe(duration);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it.each([false, true])(
	'preserves native button state and callbacks, disabled=%s',
	async (disabled) => {
		const i18n = createInstance();
		await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
		const target = document.createElement('div');
		document.body.append(target);
		const onChange = vi.fn();
		const component = mount(Collapsible, {
			target,
			context: new Map([['i18n', writable(i18n)]]),
			props: { title: 'Files', disabled, onChange, hide: true }
		});
		try {
			await tick();
			const button = target.querySelector<HTMLButtonElement>('button');
			expect(button?.disabled).toBe(disabled);
			expect(button?.getAttribute('aria-expanded')).toBe('false');
			button?.click();
			await tick();
			expect(button?.getAttribute('aria-expanded')).toBe(disabled ? 'false' : 'true');
			button?.click();
			await tick();
			expect(button?.getAttribute('aria-expanded')).toBe('false');
			expect(onChange.mock.calls).toEqual(disabled ? [] : [[true], [false]]);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
