// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

function fixture(mode: 'reject' | 'null' | 'success' | 'delayed', initial: string[] = []) {
	const source = readFileSync('src/lib/components/layout/Sidebar/PinnedModelList.svelte', 'utf8');
	const component = parse(source);
	const instance = component.instance;
	let unpinExpression = '';
	function findUnpin(value: unknown): void {
		if (!value || typeof value !== 'object') return;
		const node = value as Record<string, unknown>;
		if (node.type === 'Attribute' && node.name === 'onUnpin') {
			const expression = (node.value as { expression: { start: number; end: number } }[])[0]
				.expression;
			unpinExpression = source.slice(expression.start, expression.end);
		}
		for (const child of Object.values(node)) {
			if (Array.isArray(child)) child.forEach(findUnpin);
			else if (child && typeof child === 'object') findUnpin(child);
		}
	}
	findUnpin(component.html);
	if (!unpinExpression) throw new Error('Missing actual unpin handler');
	let responseMode = mode;
	if (!instance) throw new Error('Missing component script');
	const parsed = ts.createSourceFile(
		'pins.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const code = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s))
		.map((s) => s.getText(parsed).replace(/^export\s+/, ''))
		.join('\n');
	let mount: () => Promise<void> = async () => {};
	let destroy: () => void = () => {};
	let release: () => void = () => {};
	let drag: (event: {
		item: { dataset: { id?: string } };
		newIndex?: number;
	}) => Promise<void> = async () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	const subscriptions = new Set<(value: { pinnedModels: string[]; untouched: string }) => void>();
	const instances = new Set<object>();
	const settingsSet = vi.fn();
	const destroySortable = vi.fn();
	const context = {
		$settings: { pinnedModels: initial, untouched: 'preserved' },
		$config: { default_pinned_models: 'alpha,beta,missing' },
		$models: [{ id: 'alpha' }, { id: 'beta' }, { id: 'hidden', info: { meta: { hidden: true } } }],
		$mobile: false,
		localStorage: { token: 'local-fixture' },
		document: { getElementById: (): object => ({}) },
		onMount: (cb: () => Promise<void>): void => {
			mount = cb;
		},
		onDestroy: (cb: () => void): void => {
			destroy = cb;
		},
		tick: async (): Promise<void> => {},
		toast: { error: vi.fn() },
		$i18n: { t: (key: string): string => key },
		getContext: (): null => null,
		settings: {
			set: (value: { pinnedModels: string[]; untouched: string }): void => {
				settingsSet(value);
				context.$settings = value;
				for (const cb of subscriptions) cb(value);
			},
			subscribe: (
				cb: (value: { pinnedModels: string[]; untouched: string }) => void
			): (() => void) => {
				subscriptions.add(cb);
				cb(context.$settings);
				return () => {
					subscriptions.delete(cb);
				};
			}
		},
		readPins: (): string[] => [],
		unpin: null as ((modelId: string) => (() => Promise<void>) | null) | null,
		updateUserSettings: vi.fn(
			async (
				_token: string,
				_payload: { ui: { pinnedModels: string[]; untouched: string } }
			): Promise<object | null> => {
				if (responseMode === 'delayed') await pending;
				if (responseMode === 'reject') throw new Error('fixture unavailable');
				return responseMode === 'null' ? null : { token: _token, ui: _payload.ui };
			}
		),
		Sortable: class {
			constructor(_element: object, options: { onUpdate: typeof drag }) {
				instances.add(this);
				drag = options.onUpdate;
			}
			destroy(): void {
				destroySortable();
				instances.delete(this);
			}
		}
	};
	runInNewContext(
		ts.transpileModule(
			code +
				'\n;unpin = (modelId: string) => (' +
				unpinExpression +
				');readPins = () => pinnedModels;',
			{
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}
		).outputText,
		context
	);
	return {
		context,
		subscriptions,
		instances,
		mount: () => mount(),
		destroy: () => destroy(),
		release: () => release(),
		setMode: (next: typeof mode): void => {
			responseMode = next;
		},
		unpin: async (id: string): Promise<void> => {
			await context.unpin?.(id)?.();
		},
		drag: (id?: string, newIndex?: number) => drag({ item: { dataset: { id } }, newIndex }),
		settingsSet,
		destroySortable
	};
}

it.each(['reject', 'null', 'success'] as const)(
	'initialization settles %s settings response and owns cleanup',
	async (mode) => {
		const f = fixture(mode);
		await expect(f.mount()).resolves.toBeUndefined();
		expect(f.context.$settings).toEqual({
			pinnedModels: ['alpha', 'beta'],
			untouched: 'preserved'
		});
		expect(f.subscriptions.size).toBe(1);
		expect(f.instances.size).toBe(1);
		expect(f.context.toast.error).toHaveBeenCalledTimes(mode === 'success' ? 0 : 1);
		f.destroy();
		expect(f.subscriptions.size).toBe(0);
		expect(f.instances.size).toBe(0);
		expect(f.destroySortable).toHaveBeenCalledTimes(1);
	}
);

it('destroy during persisted defaults prevents late subscription and Sortable', async () => {
	const f = fixture('delayed');
	const mounting = f.mount();
	f.destroy();
	f.release();
	await mounting;
	expect(f.subscriptions.size).toBe(0);
	expect(f.instances.size).toBe(0);
});

it.each(['reject', 'null', 'success'] as const)(
	'reorder settles %s without mutating the prior array',
	async (mode) => {
		const original = ['alpha', 'beta'];
		const f = fixture(mode, original);
		await f.mount();
		await expect(f.drag('alpha', 1)).resolves.toBeUndefined();
		expect(original).toEqual(['alpha', 'beta']);
		expect(f.context.$settings.pinnedModels).toEqual(['beta', 'alpha']);
		expect(f.context.$settings.untouched).toBe('preserved');
		expect(f.context.toast.error).toHaveBeenCalledTimes(mode === 'success' ? 0 : 1);
		f.destroy();
	}
);

it.each([
	[undefined, 0],
	['missing', 0],
	['alpha', undefined],
	['alpha', -1],
	['alpha', 2],
	['alpha', NaN],
	['alpha', 0.5]
] as const)('invalid drag %s/%s changes no settings', async (id, index) => {
	const f = fixture('success', ['alpha', 'beta']);
	await f.mount();
	await f.drag(id, index);
	expect(f.settingsSet).not.toHaveBeenCalled();
	expect(f.context.updateUserSettings).not.toHaveBeenCalled();
	f.destroy();
});

it.each(['reject', 'null', 'success'] as const)(
	'unpin settles %s response and preserves other settings',
	async (mode) => {
		const f = fixture(mode, ['alpha', 'beta']);
		await f.mount();
		await expect(f.unpin('alpha')).resolves.toBeUndefined();
		expect(f.context.$settings).toEqual({ pinnedModels: ['beta'], untouched: 'preserved' });
		expect(f.context.updateUserSettings).toHaveBeenLastCalledWith('local-fixture', {
			ui: { pinnedModels: ['beta'], untouched: 'preserved' }
		});
		expect(f.context.toast.error).toHaveBeenCalledTimes(mode === 'success' ? 0 : 1);
		f.destroy();
	}
);

it.each(['reject', 'null', 'success'] as const)(
	'stale and hidden cleanup settles %s and remains subscribed',
	async (mode) => {
		const f = fixture(mode, ['alpha', 'missing', 'hidden', 'beta']);
		await expect(f.mount()).resolves.toBeUndefined();
		expect(f.context.$settings.pinnedModels).toEqual(['alpha', 'beta']);
		expect(f.context.toast.error).toHaveBeenCalledTimes(mode === 'success' ? 0 : 1);
		f.context.settings.set({ pinnedModels: ['beta'], untouched: 'changed elsewhere' });
		expect(f.context.readPins()).toEqual(['beta']);
		expect(f.subscriptions.size).toBe(1);
		expect(f.instances.size).toBe(1);
		f.destroy();
		expect(f.subscriptions.size).toBe(0);
		expect(f.instances.size).toBe(0);
	}
);

it('successful retry sends exact latest ordering after a failed save', async () => {
	const f = fixture('reject', ['alpha', 'beta']);
	await f.mount();
	await f.drag('alpha', 1);
	f.setMode('success');
	await f.drag('beta', 1);
	expect(f.context.updateUserSettings).toHaveBeenLastCalledWith('local-fixture', {
		ui: { pinnedModels: ['alpha', 'beta'], untouched: 'preserved' }
	});
	expect(f.context.toast.error).toHaveBeenCalledTimes(1);
	f.destroy();
});

it('late rejected initialization after destroy emits no error or resource', async () => {
	const f = fixture('delayed');
	const mounting = f.mount();
	f.destroy();
	f.setMode('reject');
	f.release();
	await expect(mounting).resolves.toBeUndefined();
	expect(f.context.toast.error).not.toHaveBeenCalled();
	expect(f.subscriptions.size).toBe(0);
	expect(f.instances.size).toBe(0);
});
