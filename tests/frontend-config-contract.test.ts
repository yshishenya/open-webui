import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('checks public config, provider objects and concrete store settings with TypeScript', () => {
	const root = fileURLToPath(new URL('../', import.meta.url));
	const filename = `${root}tests/config-contract-fixture.ts`;
	const source = `
import type { FrontendConfig, GenerationParams, UserPermissions } from '../src/lib/utils/airis/frontend-contracts';
import type { config, settings } from '../src/lib/stores';
const publicConfig = {
 status: true, name: 'Airis', version: 'test', default_locale: 'ru', onboarding: true,
 oauth: { providers: { vk: { name: 'VK', app_id: '123', redirect_url: null }, yandex: { name: 'Yandex' } } },
 telegram: { enabled: false, bot_username: '' },
 features: { auth: true, auth_trusted_header: false, enable_signup: true, enable_signup_password_confirmation: true,
 enable_login_form: true, enable_ldap: false, enable_websocket: true, enable_billing_subscriptions: false }
} satisfies FrontendConfig;
const authenticatedConfig = {
 ...publicConfig, default_models: 'model', default_pinned_models: 'alpha,beta',
 default_prompt_suggestions: [{ content: 'Task', title: ['Title', 'Subtitle'] }],
 code: { engine: 'pyodide', interpreter_engine: 'pyodide' },
 audio: { tts: { engine: '', voice: '', split_on: 'punctuation' }, stt: { engine: 'web' } },
 file: { max_size: null, max_count: 10, image_compression: { width: null, height: null } },
 permissions: { chat: { file_upload: true } }, license_metadata: null
} satisfies FrontendConfig;
const emptyPins: FrontendConfig['default_pinned_models'] = null;
// @ts-expect-error backend publishes comma-separated ids, not an array
const invalidPins: FrontendConfig['default_pinned_models'] = [];
const stored: typeof config extends import('svelte/store').Writable<infer Value> ? Value : never = publicConfig;
const provider: string | undefined = stored.oauth.providers.vk.app_id;
// @ts-expect-error Airis providers are objects, not upstream provider labels
const invalidProvider: FrontendConfig['oauth']['providers'] = { vk: 'VK' };
// @ts-expect-error VK client ids are strings
const invalidClient: FrontendConfig['oauth']['providers'] = { vk: { name: 'VK', app_id: 123 } };
const validParams: GenerationParams = { stop: ['END'], temperature: 0.5, reasoning_tags: ['<think>', '</think>'] };
// @ts-expect-error persisted stop sequences are arrays
const invalidParams: GenerationParams = { stop: 'END' };
const permissions: UserPermissions = { chat: { file_upload: true }, features: { calendar: false } };
// @ts-expect-error permissions are booleans
const invalidPermissions: UserPermissions = { chat: { file_upload: 'true' } };
type StoredSettings = typeof settings extends import('svelte/store').Writable<infer Value> ? Value : never;
const validSettings: StoredSettings = { splitLargeChunks: true, responseAutoCopy: false, params: validParams };
// @ts-expect-error splitLargeChunks is a switch, not a callback
const invalidSettings: StoredSettings = { splitLargeChunks: () => true };
`;
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		resolveJsonModule: true,
		allowSyntheticDefaultImports: true,
		baseUrl: root,
		paths: { '$lib/*': ['src/lib/*'] }
	};
	const host = ts.createCompilerHost(options);
	const readFile = host.readFile.bind(host);
	const contractPath = `${root}src/lib/utils/airis/frontend-contracts.ts`;
	host.readFile = (path) => (path === filename ? source : readFile(path));
	const program = ts.createProgram([filename], options, host);
	// Dependencies have existing strict-check debt; this fixture tests the actual exported contracts.
	const diagnostics = ts
		.getPreEmitDiagnostics(program)
		.filter((d) => d.file?.fileName === filename || d.file?.fileName === contractPath);
	expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
	// Simulate the former upstream string contract: the same fixture must reject it.
	host.readFile = (path) => {
		if (path === filename) return source;
		const contents = readFile(path);
		return path === contractPath
			? contents?.replace('Record<string, OAuthProvider>', 'Record<string, string>')
			: contents;
	};
	const broken = ts.createProgram([filename], options, host);
	const brokenDiagnostics = ts
		.getPreEmitDiagnostics(broken)
		.filter((d) => d.file?.fileName === filename);
	expect(brokenDiagnostics.length).toBeGreaterThan(0);
	expect(
		brokenDiagnostics.some((d) =>
			ts.flattenDiagnosticMessageText(d.messageText, '\n').includes('app_id')
		)
	).toBe(true);
});
