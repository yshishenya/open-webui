import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { sanitizeRedirectPath } from './return_to';

const loadHandler = async (socket: { emit: ReturnType<typeof vi.fn> } | null) => {
	const route = await readFile('src/routes/auth/+page.svelte', 'utf8');
	const instance = parse(route).instance;
	if (!instance) throw new Error('Auth script not found');
	const script = route.slice(instance.content.start, instance.content.end);
	const parsed = ts.createSourceFile('auth.ts', script, ts.ScriptTarget.Latest, true);
	const declaration = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((node) => ts.isIdentifier(node.name) && node.name.text === 'setSessionUser');
	if (!declaration?.initializer) throw new Error('Auth completion handler not found');
	const compiled = ts.transpileModule(
		`const setSessionUser = ${declaration.initializer.getText(parsed)};`,
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const deps = {
		$socket: socket,
		mode: 'signin',
		trackEvent: vi.fn(),
		analyticsSource: () => 'test',
		toast: { success: vi.fn() },
		$i18n: { t: (text: string) => text },
		localStorage: { token: '', removeItem: vi.fn() },
		user: { set: vi.fn() },
		config: { set: vi.fn() },
		getBackendConfig: vi.fn().mockResolvedValue({ status: true }),
		getUserTimezone: () => 'UTC',
		updateUserTimezone: vi.fn(),
		sanitizeRedirectPath,
		$page: { url: new URL('https://example.test/auth?redirect=%2Fbilling%2Fbalance') },
		goto: vi.fn()
	};
	const handler = runInNewContext(`${compiled}\nsetSessionUser`, deps) as (
		session: { token: string } | null,
		redirectPath?: string | null
	) => Promise<void>;
	return { handler, deps };
};

it.each([false, true])('completes HTTP login with socket present=%s', async (present) => {
	const emit = vi.fn();
	const { handler, deps } = await loadHandler(present ? { emit } : null);
	const session = {
		id: 'test-user',
		email: 'user@example.test',
		name: 'Test User',
		role: 'user',
		profile_image_url: '',
		permissions: {},
		token: 'synthetic-test-token'
	};
	await handler(session);
	expect(deps.localStorage.token).toBe(session.token);
	expect(deps.user.set).toHaveBeenCalledWith(session);
	expect(deps.config.set).toHaveBeenCalledWith({ status: true });
	expect(deps.goto).toHaveBeenCalledWith('/billing/balance');
	expect(deps.updateUserTimezone).toHaveBeenCalledWith(session.token, 'UTC');
	expect(deps.localStorage.removeItem).toHaveBeenCalledWith('redirectPath');
	if (present) {
		expect(emit).toHaveBeenCalledTimes(1);
		expect(emit).toHaveBeenCalledWith('user-join', { auth: { token: session.token } });
	} else {
		expect(emit).not.toHaveBeenCalled();
	}
});

it('does not complete or announce a failed login', async () => {
	const { handler, deps } = await loadHandler(null);
	await handler(null);
	expect(deps.user.set).not.toHaveBeenCalled();
	expect(deps.goto).not.toHaveBeenCalled();
	expect(deps.trackEvent).not.toHaveBeenCalled();
	expect(deps.toast.success).not.toHaveBeenCalled();
});
