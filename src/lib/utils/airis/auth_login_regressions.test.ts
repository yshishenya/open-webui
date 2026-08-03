import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readText = async (path: string): Promise<string> => {
	return await readFile(path, 'utf8');
};

describe('Auth Login Regressions', () => {
	it('keeps password reset + email verification routes public', async () => {
		const publicRouteFiles = [
			'src/routes/forgot-password/+page.svelte',
			'src/routes/reset-password/+page.svelte',
			'src/routes/verify-email/+page.svelte'
		];

		const pages = await Promise.all(publicRouteFiles.map((path) => readText(path)));
		for (const page of pages) {
			expect(page.length).toBeGreaterThan(0);
		}

		const protectedLayout = await readText('src/routes/(app)/+layout.svelte');
		expect(protectedLayout).toContain('const gotoAuth');
	});

	it('does not disable VK ID alternative providers (OK.ru, Mail.ru) on /auth', async () => {
		const auth = await readText('src/routes/auth/+page.svelte');

		expect(auth).not.toContain('oauthList={[]}');
		expect(auth).not.toContain('showAlternativeLogin={false}');
	});

	it('does not hide Telegram login when other providers are enabled', async () => {
		const auth = await readText('src/routes/auth/+page.svelte');

		expect(auth).toMatch(/\$:\s*telegramVisible\s*=\s*telegramEnabled\s*;/);
		expect(auth).not.toMatch(/telegramEnabled\s*&&\s*!yandexEnabled/);
	});

	it('generates Telegram widget callback names safe for JS identifiers', async () => {
		const widget = await readText('src/lib/components/auth/TelegramLoginWidget.svelte');

		expect(widget).toContain("replace(/-/g, '_')");
	});
});
