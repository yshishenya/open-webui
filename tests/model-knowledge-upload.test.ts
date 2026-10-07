// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { get, writable } from 'svelte/store';
import { settings, user, type SessionUser } from '$lib/stores';
import Knowledge from '$lib/components/workspace/Models/Knowledge.svelte';

const { upload } = vi.hoisted(() => {
	Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' });
	return { upload: vi.fn() };
});
vi.mock('$lib/apis/files', () => ({ uploadFile: upload }));
vi.mock('$lib/apis/notes', () => ({ searchNotes: async () => ({ items: [] }) }));
vi.mock('$lib/apis/knowledge', () => ({
	searchKnowledgeBases: async () => ({ items: [] }),
	searchKnowledgeFiles: async () => ({ items: [] })
}));

it('uploads through the real input, removes only failed temporary files and preserves opaque knowledge', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const priorUser = get(user);
	const priorSettings = get(settings);
	const fixtureUser: SessionUser = {
		id: 'fixture-user',
		email: 'fixture@example.invalid',
		name: 'Fixture',
		role: 'user',
		profile_image_url: '/user.png',
		permissions: { chat: { file_upload: true } }
	};
	user.set(fixtureUser);
	settings.set({ ...priorSettings, audio: { stt: { language: 'ru' } } });
	const priorToken = localStorage.getItem('token');
	localStorage.setItem('token', 'fixture-token');
	const target = document.createElement('div');
	document.body.appendChild(target);
	const original: unknown[] = [null, false, 'legacy', [], { id: 'existing', name: 'Existing' }];
	let selected = [...original];
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
		const input = target.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error('Real upload input missing');
		const choose = (file: File): void => {
			Object.defineProperty(input, 'files', { configurable: true, writable: true, value: [file] });
			input.dispatchEvent(new Event('change', { bubbles: true }));
		};
		upload.mockRejectedValueOnce(new Error('Fixture upload unavailable'));
		choose(new File(['data'], 'failed.txt', { type: 'text/plain' }));
		await vi.waitFor(() => expect(selected).toEqual(original));
		expect(upload).toHaveBeenCalledOnce();
		expect(input.value).toBe('');
		const audio = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
		const stored = { id: 'uploaded', meta: { collection_name: 'collection' } };
		upload.mockResolvedValueOnce(stored);
		choose(audio);
		await vi.waitFor(() =>
			expect(selected.at(-1)).toMatchObject({
				id: 'uploaded',
				name: 'voice.wav',
				status: 'uploaded',
				collection_name: 'collection',
				file: stored
			})
		);
		expect(selected.slice(0, original.length)).toEqual(original);
		expect(upload).toHaveBeenLastCalledWith('fixture-token', audio, { language: 'ru' });
		choose(new File(['image'], 'photo.png', { type: 'image/png' }));
		await tick();
		expect(upload).toHaveBeenCalledTimes(2);
		user.set({ ...fixtureUser, permissions: { chat: { file_upload: false } } });
		choose(new File(['data'], 'denied.txt', { type: 'text/plain' }));
		await tick();
		expect(upload).toHaveBeenCalledTimes(2);
		expect(selected.slice(0, original.length)).toEqual(original);
	} finally {
		await unmount(component);
		target.remove();
		user.set(priorUser);
		settings.set(priorSettings);
		if (priorToken === null) localStorage.removeItem('token');
		else localStorage.setItem('token', priorToken);
	}
});
