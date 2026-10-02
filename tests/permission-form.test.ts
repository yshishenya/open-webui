// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import { DEFAULT_PERMISSIONS } from '$lib/constants/permissions';
import PermissionFormHarness from './fixtures/PermissionFormHarness.svelte';

vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { config: writable({}), settings: writable({}) };
});

type Input = Record<string, Record<string, unknown> | null>;
type Saved = Record<string, Record<string, unknown>>;
let component: Record<string, unknown> | null = null;
let target: HTMLDivElement | null = null;

async function render(permissions: Input = {}, defaultPermissions: Input = {}): Promise<void> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(PermissionFormHarness, {
		target,
		props: { permissions, defaultPermissions },
		context: new Map([['i18n', writable(i18n)]])
	});
	await tick();
}

function state(): Saved {
	return JSON.parse(target?.querySelector('output')?.textContent ?? '{}') as Saved;
}

async function cleanup(): Promise<void> {
	if (component) await unmount(component);
	target?.remove();
	component = null;
	target = null;
}

afterEach(cleanup);

describe('permission form behavior', () => {
	it('fills every empty section with existing defaults', async () => {
		await render();
		expect(state()).toEqual(DEFAULT_PERMISSIONS);
	});

	it('preserves explicit overrides and unknown section/root fields', async () => {
		await render({
			chat: { controls: false, temporary_enforced: true, future_chat_flag: true },
			workspace: { models: true },
			future_section: { enabled: true }
		});
		const actual = state();
		expect(actual.chat).toMatchObject({
			controls: false,
			temporary_enforced: true,
			edit: true,
			future_chat_flag: true
		});
		expect(actual.workspace).toMatchObject({ models: true, knowledge: false });
		expect(actual.future_section).toEqual({ enabled: true });
	});

	it('binds the real switch back to the serialized state and preserves it after reload', async () => {
		const defaultsBefore = JSON.stringify(DEFAULT_PERMISSIONS);
		await render({ workspace: { models: false } });
		const toggle = target?.querySelector<HTMLButtonElement>(
			'button[role="switch"][aria-label="Models Access"]'
		);
		expect(toggle).not.toBeNull();
		toggle?.click();
		await tick();
		await tick();
		expect(state().workspace.models).toBe(true);
		const saved = state();
		await cleanup();
		await render(saved);
		expect(state()).toEqual(saved);
		expect(JSON.stringify(DEFAULT_PERMISSIONS)).toBe(defaultsBefore);
	});

	it('fills null sections and reinitializes partial settings after a bound edit', async () => {
		await render({ chat: null });
		expect(state().chat).toEqual(DEFAULT_PERMISSIONS.chat);
		const load = component?.load;
		expect(typeof load).toBe('function');
		if (typeof load === 'function')
			load({ features: { notes: false }, workspace: { tools: true } });
		await tick();
		expect(state().features.notes).toBe(false);
		expect(state().workspace.tools).toBe(true);
		expect(state().chat).toEqual(DEFAULT_PERMISSIONS.chat);
	});

	it('explains global defaults while keeping a group override false', async () => {
		await render({ workspace: { models: false } }, { workspace: { models: true } });
		expect(target?.textContent).toContain(
			'This is a default user permission and will remain enabled.'
		);
		expect(state().workspace.models).toBe(false);
	});
});
