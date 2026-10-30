import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { LegalApiError } from '../src/lib/apis/legal';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));

function store<T>(initial: T) {
	let value = initial;
	const subscribers = new Set<(value: T) => void>();
	return {
		set: vi.fn((next: T): void => {
			value = next;
			subscribers.forEach((run) => run(value));
		}),
		subscribe: (run: (value: T) => void): (() => void) => {
			subscribers.add(run);
			run(value);
			return () => subscribers.delete(run);
		},
		active: (): number => subscribers.size
	};
}

function rig(
	document = Object.assign(new EventTarget(), {
		activeElement: null,
		getElementsByClassName: () => [],
		getElementById: () => null
	})
) {
	const source = readFileSync(
		process.env.AIRIS_LAYOUT_SOURCE ?? 'src/routes/(app)/+layout.svelte',
		'utf8'
	);
	const script = parse(source).instance;
	if (!script) throw new Error('Actual application script missing');
	const ast = ts.createSourceFile(
		'layout.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const code = ast.statements
		.filter((item) => !ts.isImportDeclaration(item) && !ts.isLabeledStatement(item))
		.map((item) => item.getText(ast))
		.join('\n');
	const destroy: (() => void)[] = [];
	const localStorage = {
		token: 'fixture',
		showControls: 'false',
		selectedTerminalId: 'terminal',
		'chat-input-new': 'draft',
		getItem: () => '{}',
		removeItem: (key: string): void => {
			Reflect.deleteProperty(localStorage, key);
		}
	};
	const context = {
		document,
		localStorage,
		fileSaver: { saveAs: vi.fn() },
		Object,
		Date,
		URLSearchParams,
		setTimeout,
		getContext: () => ({}),
		onMount: vi.fn((fn: () => Promise<void>): void => {
			void fn;
		}),
		LegalApiError,
		getLegalStatus: vi.fn(async () => ({ docs: [], needs_accept: false, server_time: 1 })),
		getLegalRequirements: vi.fn(async () => ({ docs: [], server_time: 1 })),
		user: store<unknown>({ id: 'fixture' }),
		onDestroy: (fn: () => void): void => {
			destroy.push(fn);
		},
		tick: async (): Promise<void> => {},
		$page: { url: new URL('http://localhost/') },
		$user: { id: 'fixture', role: 'user', permissions: {} },
		$config: { version: 'fixture', features: {} },
		$settings: { keyboardShortcuts: true, showChangelog: false, textScale: 1 },
		$selectedTerminalId: 'terminal',
		$mobile: false,
		$showSidebar: false,
		$showControls: false,
		$i18n: { t: (value: string): string => value },
		openDB: vi.fn(async () => {
			throw new Error('No legacy database');
		}),
		deleteDB: vi.fn(),
		getBanners: vi.fn(async (): Promise<unknown[]> => []),
		getTools: vi.fn(async (): Promise<unknown[]> => []),
		getUserSettings: vi.fn(async () => ({
			ui: { keyboardShortcuts: true, showChangelog: false, textScale: 1 }
		})),
		getModels: vi.fn(async (): Promise<unknown[]> => []),
		getToolServersData: vi.fn(async (): Promise<unknown[]> => []),
		getTerminalServers: vi.fn(async (): Promise<unknown[]> => []),
		getVersionUpdates: vi.fn(async () => ({ current: 'fixture', latest: 'fixture' })),
		loadKeybindings: vi.fn(),
		setTextScale: vi.fn(),
		setAppFontFamily: vi.fn(),
		goto: vi.fn(),
		toast: { error: vi.fn() },
		console: { log: vi.fn(), error: vi.fn() },
		WEBUI_VERSION: 'fixture',
		WEBUI_BUILD_CHANNEL: 'stable',
		$socket: null,
		WEBUI_API_BASE_URL: '/api/v1',
		Shortcut: { TOGGLE_SIDEBAR: 'sidebar' },
		matchKeybinding: () => 'sidebar',
		settings: store<unknown>({}),
		models: store<unknown[]>([]),
		banners: store<unknown[]>([]),
		tools: store<unknown[]>([]),
		toolServers: store<unknown[]>([]),
		terminalServers: store<unknown[]>([]),
		selectedTerminalId: store<string | null>('terminal'),
		showControls: store(false),
		showSidebar: store(false),
		showChangelog: store(false)
	};
	const api = runInNewContext(
		ts.transpileModule(
			code + '\n({bootstrap:bootstrapApp,state:()=>loaded,legalGate:()=>legalGateOpen})',
			{
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}
		).outputText,
		context
	) as {
		bootstrap: () => Promise<void>;
		state: () => boolean;
		legalGate: () => boolean;
	};
	return {
		context,
		api,
		destroy: (): void => {
			destroy.forEach((fn) => fn());
		}
	};
}

it('owns keyboard and persistence subscriptions across application replacement', async () => {
	const previous = rig();
	await previous.api.bootstrap();
	expect(previous.api.state()).toBe(true);
	expect(previous.context.showControls.active()).toBe(1);
	expect(previous.context.selectedTerminalId.active()).toBe(1);
	previous.destroy();
	const current = rig(previous.context.document);
	try {
		await current.api.bootstrap();
		previous.context.showSidebar.set.mockClear();
		current.context.document.dispatchEvent(new Event('keydown'));
		expect(current.context.showSidebar.set).toHaveBeenCalledOnce();
		expect(previous.context.showSidebar.set).not.toHaveBeenCalled();
		expect(previous.context.showControls.active()).toBe(0);
		expect(previous.context.selectedTerminalId.active()).toBe(0);
	} finally {
		current.destroy();
	}
	const controls = current.context.localStorage.showControls;
	const terminal = current.context.localStorage.selectedTerminalId;
	current.context.showControls.set(true);
	current.context.selectedTerminalId.set('late');
	expect(current.context.localStorage.showControls).toBe(controls);
	expect(current.context.localStorage.selectedTerminalId).toBe(terminal);
	current.context.showSidebar.set.mockClear();
	current.context.document.dispatchEvent(new Event('keydown'));
	expect(current.context.showSidebar.set).not.toHaveBeenCalled();
});

it('discards bootstrap responses and registrations after destruction', async () => {
	const app = rig();
	let release: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	app.context.getBanners.mockImplementation(async () => {
		await pending;
		return [];
	});
	app.context.getTools.mockImplementation(async () => {
		await pending;
		return [];
	});
	app.context.getUserSettings.mockImplementation(async () => {
		await pending;
		return { ui: { keyboardShortcuts: true, showChangelog: false, textScale: 1 } };
	});
	const boot = app.api.bootstrap();
	app.destroy();
	release();
	await boot;
	for (const item of [
		app.context.settings,
		app.context.models,
		app.context.tools,
		app.context.banners,
		app.context.toolServers,
		app.context.terminalServers
	]) {
		expect(item.set).not.toHaveBeenCalled();
	}
	expect(app.context.getModels).not.toHaveBeenCalled();
	expect(app.context.showControls.active()).toBe(0);
	expect(app.context.selectedTerminalId.active()).toBe(0);
	app.context.document.dispatchEvent(new Event('keydown'));
	expect(app.context.showSidebar.set).not.toHaveBeenCalled();
	expect(app.api.state()).toBe(false);
});

it.each(['success', 'unauthorized', 'requirements', 'requirements-error'])(
	'discards late legal %s without changing a replacement session',
	async (scenario) => {
		const app = rig();
		let release: () => void = () => {};
		const pending = new Promise<void>((resolve) => {
			release = resolve;
		});
		app.context.getLegalStatus.mockImplementation(async () => {
			if (scenario === 'requirements' || scenario === 'requirements-error')
				throw new Error('offline');
			await pending;
			if (scenario === 'unauthorized') throw new LegalApiError(401, 'expired');
			return { docs: [], needs_accept: false, server_time: 1 };
		});
		app.context.getLegalRequirements.mockImplementation(async () => {
			await pending;
			if (scenario === 'requirements-error') throw new Error('offline');
			return { docs: [], server_time: 1 };
		});
		const mount = app.context.onMount.mock.calls.at(-1)![0]();
		await Promise.resolve();
		app.destroy();
		app.context.localStorage.token = 'replacement';
		app.context.localStorage['chat-input-new'] = 'new draft';
		release();
		await mount;
		expect(app.context.localStorage.token).toBe('replacement');
		expect(app.context.localStorage['chat-input-new']).toBe('new draft');
		expect(app.context.user.set).not.toHaveBeenCalled();
		expect(app.context.goto).not.toHaveBeenCalled();
		expect(app.context.toast.error).not.toHaveBeenCalled();
		expect(app.context.getUserSettings).not.toHaveBeenCalled();
		expect(app.api.legalGate()).toBe(false);
		expect(app.api.state()).toBe(false);
		await app.api.bootstrap();
		expect(app.context.localStorage['chat-input-new']).toBe('new draft');
		expect(app.context.getUserSettings).not.toHaveBeenCalled();
	}
);

it.each(['accepted', 'required', 'unauthorized', 'requirements', 'requirements-error'])(
	'preserves the active session legal %s path',
	async (scenario) => {
		const app = rig();
		app.context.getLegalStatus.mockImplementation(async () => {
			if (scenario === 'unauthorized') throw new LegalApiError(401, 'expired');
			if (scenario.startsWith('requirements')) throw new Error('offline');
			return { docs: [], needs_accept: scenario === 'required', server_time: 1 };
		});
		if (scenario === 'requirements-error')
			app.context.getLegalRequirements.mockRejectedValue(new Error('offline'));
		try {
			await app.context.onMount.mock.calls.at(-1)![0]();
			expect(app.api.state()).toBe(scenario === 'accepted');
			expect(app.api.legalGate()).toBe(
				['required', 'requirements', 'requirements-error'].includes(scenario)
			);
			if (scenario === 'unauthorized') {
				expect(app.context.localStorage.token).toBeUndefined();
				expect(app.context.user.set).toHaveBeenCalledWith(null);
				expect(app.context.goto).toHaveBeenCalledWith('/auth?redirect=%2F');
			} else {
				expect(app.context.localStorage.token).toBe('fixture');
				expect(app.context.goto).not.toHaveBeenCalled();
			}
		} finally {
			app.destroy();
		}
	}
);
