// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it } from 'vitest';
import Messages from '$lib/components/playground/Chat/Messages.svelte';

it('keeps actual playground roles, literal editing and deletion', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const messages = [
		{ role: 'user', content: 'Задача' },
		{ role: 'assistant', content: 'Ответ' }
	];
	const component = mount(Messages, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { messages }
	});
	try {
		expect(target.querySelectorAll('textarea')).toHaveLength(2);
		expect(target.textContent).toContain('user');
		expect(target.textContent).toContain('assistant');
		const input = target.querySelector<HTMLTextAreaElement>('#user-0-textarea');
		if (!input) throw new Error('Missing actual message editor');
		input.value = '<b>Буквальный текст</b>';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(messages[0].content).toBe('<b>Буквальный текст</b>');
		expect(target.querySelector('b')).toBeNull();
		target.querySelector<HTMLButtonElement>('button[aria-label="Delete"]')?.click();
		await tick();
		expect(target.querySelectorAll('textarea')).toHaveLength(1);
		expect(target.querySelector<HTMLTextAreaElement>('#assistant-0-textarea')?.value).toBe('Ответ');
	} finally {
		await unmount(component);
		target.remove();
	}
});
