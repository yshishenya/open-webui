// @vitest-environment jsdom
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import Auth from '../src/routes/auth/+page.svelte';
import { config } from '$lib/stores';
import { page as pageStore } from '$app/stores';

const page = pageStore as unknown as Writable<{ url: URL }>;

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/auth') }) };
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		config: writable(undefined),
		user: writable(undefined),
		socket: writable(undefined),
		WEBUI_NAME: writable('AIRIS')
	};
});
vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: '', WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$lib/utils', () => ({ generateInitialsImage: vi.fn(), getUserTimezone: vi.fn() }));
vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));

let instance: ReturnType<typeof createClassComponent> | undefined;
afterEach(() => {
	instance?.$destroy();
	document.body.replaceChildren();
	localStorage.clear();
	page.set({ url: new URL('http://localhost/auth') } as Parameters<typeof page.set>[0]);
});

it('opens sign-in from email, offers account creation and returns to sign-in', async () => {
	config.set({
		features: { enable_login_form: true, enable_signup: true },
		oauth: { providers: { yandex: true } }
	} as unknown as Parameters<typeof config.set>[0]);
	instance = createClassComponent({
		component: Auth,
		target: document.body,
		context: new Map([['i18n', writable({ t: (key: string): string => key })]])
	});
	await vi.waitFor(() => expect(document.querySelector('button')).not.toBeNull());
	const click = async (label: string): Promise<void> => {
		const button = [...document.querySelectorAll('button')].find(
			(element) => element.textContent?.trim() === label
		);
		expect(button, label).toBeDefined();
		button!.click();
		await tick();
	};
	await click('Continue with Email');
	expect(document.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
	expect(document.querySelector('input[autocomplete="name"]')).toBeNull();
	expect(document.querySelector('a[href="/forgot-password"]')).not.toBeNull();
	await click('Create Account');
	expect(document.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
	expect(document.querySelector('input[autocomplete="name"]')).not.toBeNull();
	await click('Sign in');
	expect(document.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
	expect(document.querySelector('input[autocomplete="name"]')).toBeNull();
});

it.each([
	{ login: true, signup: true, ldap: false, query: '?form=signup', field: 'new-password' },
	{ login: true, signup: false, ldap: false, query: '', field: 'current-password' },
	{ login: false, signup: true, ldap: false, query: '', field: 'new-password' },
	{ login: false, signup: false, ldap: true, query: '', field: 'current-password' }
])('preserves supported form configuration: %j', async ({ login, signup, ldap, query, field }) => {
	page.set({ url: new URL(`http://localhost/auth${query}`) } as Parameters<typeof page.set>[0]);
	config.set({
		features: { enable_login_form: login, enable_signup: signup, enable_ldap: ldap },
		oauth: { providers: { yandex: true } }
	} as unknown as Parameters<typeof config.set>[0]);
	instance = createClassComponent({
		component: Auth,
		target: document.body,
		context: new Map([['i18n', writable({ t: (key: string): string => key })]])
	});
	await vi.waitFor(() => expect(document.querySelector('button')).not.toBeNull());
	if (!query) {
		const label = ldap ? 'Continue with LDAP' : 'Continue with Email';
		const button = [...document.querySelectorAll('button')].find(
			(element) => element.textContent?.trim() === label
		);
		expect(button).toBeDefined();
		button!.click();
		await tick();
	}
	expect(document.querySelector(`input[autocomplete="${field}"]`)).not.toBeNull();
	expect(document.querySelector('input[autocomplete="name"]') !== null).toBe(
		field === 'new-password'
	);
	if (!signup) expect(document.body.textContent).not.toContain('Create Account');
	if (ldap) expect(document.querySelector('#username')).not.toBeNull();
});
