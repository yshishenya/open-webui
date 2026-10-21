import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { verifyEmail } from '$lib/apis/auths/email_verification';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));

afterEach(() => {
	vi.unstubAllGlobals();
});

it('exchanges the secret in a POST body with cookies and no cache', async () => {
	const fetch = vi.fn().mockResolvedValue({
		ok: true,
		json: async () => ({
			success: true,
			message: 'verified',
			session: { token: 'synthetic-session' }
		})
	});
	vi.stubGlobal('fetch', fetch);
	const response = await verifyEmail('synthetic-verification');
	expect(response.session.token).toBe('synthetic-session');
	const [url, options] = fetch.mock.calls[0];
	expect(url).not.toContain('synthetic-verification');
	expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store' });
	expect(JSON.parse(options.body)).toEqual({ token: 'synthetic-verification' });
});

it.each(['?token=synthetic-verification', '#token=synthetic-verification'])(
	'opens chat after confirmation from %s, without the password form',
	async (suffix) => {
		const { callback, deps } = await mountHandler(suffix, true);
		await callback();
		expect(deps.verifyEmail).toHaveBeenCalledWith('synthetic-verification');
		expect(deps.window.history.replaceState).toHaveBeenCalledWith(null, '', '/verify-email');
		expect(deps.localStorage.token).toBe('synthetic-session');
		expect(deps.window.location.replace).toHaveBeenCalledWith('/');
	}
);

it('does not sign in or navigate on an invalid link', async () => {
	const { callback, deps } = await mountHandler('#token=expired', false);
	await callback();
	expect(deps.localStorage.token).toBe('');
	expect(deps.window.location.replace).not.toHaveBeenCalled();
	expect(deps.toast.error).toHaveBeenCalled();
});

const mountHandler = async (suffix: string, valid: boolean) => {
	const route = await readFile('src/routes/verify-email/+page.svelte', 'utf8');
	const instance = parse(route).instance;
	if (!instance) throw new Error('Verification script missing');
	const script = route.slice(instance.content.start, instance.content.end);
	const parsed = ts.createSourceFile('verify.ts', script, ts.ScriptTarget.Latest, true);
	const call = parsed.statements
		.filter(ts.isExpressionStatement)
		.map((statement) => statement.expression)
		.find((node) => ts.isCallExpression(node) && node.expression.getText(parsed) === 'onMount');
	if (!call || !ts.isCallExpression(call)) throw new Error('Verification callback missing');
	const compiled = ts.transpileModule(`const callback = ${call.arguments[0].getText(parsed)};`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	const deps = {
		$page: { url: new URL(`https://test.invalid/verify-email${suffix}`) },
		URLSearchParams,
		window: { history: { state: null, replaceState: vi.fn() }, location: { replace: vi.fn() } },
		localStorage: { token: '' },
		verifyEmail: valid
			? vi.fn().mockResolvedValue({ message: 'verified', session: { token: 'synthetic-session' } })
			: vi.fn().mockRejectedValue('Invalid or expired verification token'),
		toast: { success: vi.fn(), error: vi.fn() },
		$i18n: { t: (value: string) => value }
	};
	return { callback: runInNewContext(`${compiled}\ncallback`, deps) as () => Promise<void>, deps };
};
