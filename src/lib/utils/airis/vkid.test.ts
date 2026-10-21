import { afterEach, expect, it, vi } from 'vitest';
import { vkIdLogin } from './vkid';

afterEach(() => {
	vi.unstubAllGlobals();
});

it('requests email consent only for an explicit retry and clears it for normal login', async () => {
	const init = vi.fn();
	const login = vi.fn().mockResolvedValue({ code: 'test-code', device_id: 'test-device' });
	vi.stubGlobal('window', {
		location: { origin: 'https://airis.example' },
		VKIDSDK: {
			Config: { init },
			Auth: {
				login,
				exchangeCode: vi.fn().mockResolvedValue({ access_token: 'test-only-access' })
			},
			OAuthName: { VK: 'vkid', OK: 'ok_ru', MAIL: 'mail_ru' },
			ConfigAuthMode: { InNewWindow: 'new_window' },
			ConfigResponseMode: { Callback: 'callback' },
			ConfigSource: { LOWCODE: 'lowcode' }
		}
	});
	await vkIdLogin('mail', '42', '');
	await vkIdLogin('mail', '42', '');
	expect(init).toHaveBeenCalledTimes(1);
	expect(init.mock.lastCall?.[0]).toMatchObject({ scope: 'email', prompt: [] });
	await vkIdLogin('mail', '42', '', true);
	expect(init).toHaveBeenCalledTimes(2);
	expect(init.mock.lastCall?.[0]).toMatchObject({ scope: 'email', prompt: ['consent'] });
	expect(login.mock.lastCall?.[0].provider).toBe('mail_ru');
	await vkIdLogin('vk', '42', '');
	expect(init).toHaveBeenCalledTimes(3);
	expect(init.mock.lastCall?.[0].prompt).toEqual([]);
	expect(login.mock.lastCall?.[0].provider).toBe('vkid');
});
