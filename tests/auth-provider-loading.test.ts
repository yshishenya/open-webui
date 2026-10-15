// @vitest-environment jsdom
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TelegramLoginWidget from '$lib/components/auth/TelegramLoginWidget.svelte';

const instances: { $destroy(): void }[] = [];
const payload = {
	code: 'fixture-code',
	device_id: 'fixture-device',
	type: 'code',
	state: 'fixture-state',
	expires_in: 600
};
const token = { access_token: 'fixture-token', expires_in: 600, user_id: 1 };
function installSDK(): Pick<typeof window.VKIDSDK, 'Config' | 'Auth'> {
	const sdk = {
		Config: { init: vi.fn() },
		Auth: {
			login: vi.fn().mockResolvedValue(payload),
			exchangeCode: vi.fn().mockResolvedValue(token)
		},
		OAuthName: { VK: 'vkid', OK: 'ok_ru', MAIL: 'mail_ru' },
		ConfigAuthMode: { InNewWindow: 'new_window' },
		ConfigResponseMode: { Callback: 'callback' },
		ConfigSource: { LOWCODE: 'lowcode' }
	};
	Object.assign(window, { VKIDSDK: sdk });
	return sdk;
}
function script(): HTMLScriptElement {
	const element = document.head.querySelector<HTMLScriptElement>('script');
	expect(element).not.toBeNull();
	return element!;
}
beforeEach(() => {
	vi.resetModules();
	Reflect.deleteProperty(window, 'VKIDSDK');
	document.head.querySelectorAll('script').forEach((s) => s.remove());
});
afterEach(() => {
	for (const instance of instances.splice(0)) instance.$destroy();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.head.querySelectorAll('script').forEach((s) => s.remove());
	document.body.replaceChildren();
});

describe('VK ID shared loader', () => {
	it('allows an explicit retry after network failure and removes the failed script', async () => {
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		const first = vkIdLogin('vk', '123', 'https://example.test/');
		const refused = expect(first).rejects.toThrow('Failed to load VK ID SDK');
		const old = script();
		old.dispatchEvent(new Event('error'));
		await refused;
		expect(old.isConnected).toBe(false);
		const retry = vkIdLogin('vk', '123', 'https://example.test/');
		void retry.catch(() => {});
		const next = script();
		expect(next).not.toBe(old);
		installSDK();
		next.dispatchEvent(new Event('load'));
		await expect(retry).resolves.toEqual({ authResponse: payload, authData: token });
	});
	it('rejects a loaded script without the SDK and retries on the next call', async () => {
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		const first = vkIdLogin('vk', '123', 'https://example.test/');
		const refused = expect(first).rejects.toThrow('VK ID SDK is not available');
		const old = script();
		old.dispatchEvent(new Event('load'));
		await refused;
		expect(old.isConnected).toBe(false);
		const retry = vkIdLogin('vk', '123', 'https://example.test/');
		void retry.catch(() => {});
		const next = script();
		expect(next).not.toBe(old);
		installSDK();
		next.dispatchEvent(new Event('load'));
		await expect(retry).resolves.toEqual({ authResponse: payload, authData: token });
	});
	it('stops waiting after 20 seconds without starting an automatic retry', async () => {
		vi.useFakeTimers();
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		const failed = vi.fn();
		const first = vkIdLogin('vk', '123', 'https://example.test/').catch(failed);
		const old = script();
		await vi.advanceTimersByTimeAsync(19_999);
		expect(failed).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(failed).toHaveBeenCalledOnce();
		await first;
		expect(old.isConnected).toBe(false);
		expect(document.head.querySelectorAll('script')).toHaveLength(0);
		const retry = vkIdLogin('vk', '123', 'https://example.test/');
		installSDK();
		script().dispatchEvent(new Event('load'));
		await expect(retry).resolves.toEqual({ authResponse: payload, authData: token });
	});
	it('shares one in-flight script and initializes the same configuration once', async () => {
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		const a = vkIdLogin('vk', '123', 'https://example.test/');
		const b = vkIdLogin('ok', '123', 'https://example.test/');
		expect(document.head.querySelectorAll('script')).toHaveLength(1);
		const sdk = installSDK();
		script().dispatchEvent(new Event('load'));
		await Promise.all([a, b]);
		expect(sdk.Config.init).toHaveBeenCalledOnce();
		expect(sdk.Auth.login).toHaveBeenCalledTimes(2);
	});
	it.each([
		['vk', 'vkid'],
		['ok', 'ok_ru'],
		['mail', 'mail_ru']
	] as const)('preserves the %s provider', async (provider, expected) => {
		const sdk = installSDK();
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		await vkIdLogin(provider, '123', 'https://example.test/');
		expect(sdk.Auth.login).toHaveBeenCalledWith({ provider: expected, scheme: 'dark' });
		expect(sdk.Auth.exchangeCode).toHaveBeenCalledWith(payload.code, payload.device_id);
		expect(document.head.querySelectorAll('script')).toHaveLength(0);
	});
	it('preserves code fallback if SDK exchange fails and does not repeat login', async () => {
		const sdk = installSDK();
		vi.mocked(sdk.Auth.exchangeCode).mockRejectedValueOnce(new Error('refused'));
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		await expect(vkIdLogin('vk', '123', 'https://example.test/')).resolves.toEqual({
			authResponse: payload,
			authData: null
		});
		expect(sdk.Auth.login).toHaveBeenCalledOnce();
		expect(sdk.Auth.exchangeCode).toHaveBeenCalledOnce();
	});
	it('rejects malformed authentication data before code exchange', async () => {
		const sdk = installSDK();
		vi.mocked(sdk.Auth.login).mockResolvedValueOnce({
			...payload,
			device_id: undefined
		} as unknown as VKIDSDK.AuthResponse);
		const { vkIdLogin } = await import('$lib/utils/airis/vkid');
		await expect(vkIdLogin('vk', '123', 'https://example.test/')).rejects.toThrow(
			'VK ID authentication failed'
		);
		expect(sdk.Auth.exchangeCode).not.toHaveBeenCalled();
	});
});

async function mountWidget(): Promise<{
	instance: ReturnType<typeof createClassComponent>;
	target: HTMLDivElement;
	element: HTMLScriptElement;
	name: string;
}> {
	const target = document.createElement('div');
	document.body.append(target);
	const instance = createClassComponent({
		component: TelegramLoginWidget,
		target,
		props: { botUsername: '@fixture_bot', size: 'small', radius: 18 }
	});
	instances.push(instance);
	await tick();
	const element = target.querySelector<HTMLScriptElement>('script')!;
	expect(element).not.toBeNull();
	const name = element.getAttribute('data-onauth')!.replace('(user)', '');
	return { instance, target, element, name };
}
function callback(name: string): (value: Record<string, unknown>) => void {
	const value = (window as Window & Record<string, unknown>)[name];
	expect(typeof value).toBe('function');
	return value as (data: Record<string, unknown>) => void;
}
describe('Telegram widget lifecycle', () => {
	it('preserves official attributes, safe callback names and auth payload', async () => {
		const { instance, element, name } = await mountWidget();
		const auth = vi.fn();
		instance.$on('auth', (event) => auth(event.detail));
		expect(name).toMatch(/^__owuiTelegramAuth_[a-zA-Z0-9_]+$/);
		expect(element.src).toBe('https://telegram.org/js/telegram-widget.js?22');
		expect(element.getAttribute('data-telegram-login')).toBe('fixture_bot');
		expect(element.getAttribute('data-size')).toBe('small');
		expect(element.getAttribute('data-radius')).toBe('18');
		expect(element.getAttribute('data-userpic')).toBe('false');
		const value = { id: 1, auth_date: 100, hash: 'fixture-hash' };
		callback(name)(value);
		expect(auth).toHaveBeenCalledWith(value);
	});
	it('discards captured auth callbacks after destruction and removes globals', async () => {
		const { instance, element, name } = await mountWidget();
		const auth = vi.fn();
		instance.$on('auth', (event) => auth(event.detail));
		const old = callback(name);
		instance.$destroy();
		old({ id: 1 });
		expect(auth).not.toHaveBeenCalled();
		expect(element.isConnected).toBe(false);
		expect(Reflect.has(window, name)).toBe(false);
	});
	it('discards auth and error from the old script after widget replacement', async () => {
		const { instance, target, element, name } = await mountWidget();
		const old = callback(name);
		const auth = vi.fn();
		instance.$on('auth', (event) => auth(event.detail));
		instance.$set({ botUsername: 'replacement_bot' });
		await tick();
		const next = target.querySelector<HTMLScriptElement>('script')!;
		expect(next).not.toBe(element);
		old({ id: 1 });
		element.dispatchEvent(new Event('error'));
		await tick();
		expect(auth).not.toHaveBeenCalled();
		expect(target.textContent).not.toContain('Telegram widget failed to load.');
		const nextName = next.getAttribute('data-onauth')!.replace('(user)', '');
		callback(nextName)({ id: 2 });
		expect(auth).toHaveBeenCalledWith({ id: 2 });
		next.dispatchEvent(new Event('error'));
		await tick();
		expect(target.textContent).toContain('Telegram widget failed to load.');
	});
	it('removes the widget when the bot name becomes empty', async () => {
		const { instance, target, name } = await mountWidget();
		instance.$set({ botUsername: '' });
		await tick();
		expect(target.querySelector('script')).toBeNull();
		expect(Reflect.has(window, name)).toBe(false);
	});
});
