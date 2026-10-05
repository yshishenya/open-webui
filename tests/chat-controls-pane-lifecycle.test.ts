// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { get, writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Harness from './fixtures/ChatControlsPaneHarness.svelte';
import { showControls } from '../src/lib/stores';

// Leave the actual pane, drawer and controls lifecycle mounted; heavy leaf views are unrelated.
vi.mock('../src/lib/components/chat/Controls/Controls.svelte', () => ({ default: () => {} }));
vi.mock('../src/lib/components/chat/MessageInput/CallOverlay.svelte', () => ({
	default: () => {}
}));
vi.mock('../src/lib/components/chat/Artifacts.svelte', () => ({ default: () => {} }));
vi.mock('../src/lib/components/chat/ChatControls/Embeds.svelte', () => ({ default: () => {} }));
vi.mock('../src/lib/components/chat/FileNav.svelte', () => ({ default: () => {} }));
vi.mock('../src/lib/components/chat/PyodideFileNav.svelte', () => ({ default: () => {} }));
vi.mock('../src/lib/components/chat/Overview.svelte', () => ({ default: () => {} }));
vi.mock('../src/lib/stores', () => ({
	showControls: writable(false),
	showCallOverlay: writable(false),
	showArtifacts: writable(false),
	showEmbeds: writable(false),
	showFileNavPath: writable(null),
	selectedTerminalId: writable(null),
	terminalServers: writable([]),
	settings: writable({}),
	config: writable({}),
	user: writable({ role: 'user', permissions: { chat: { controls: true } } })
}));

let wide = true;
let width = 1280;
let mediaChanged: ((event: { matches: boolean }) => void) | undefined;
let component: { getSize: () => number; openPane: () => void } | undefined;
let target: HTMLDivElement;

const settle = async (): Promise<void> => {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
};
const resize = async (matches: boolean): Promise<void> => {
	wide = matches;
	width = matches ? 1280 : 390;
	mediaChanged?.({ matches });
	await settle();
};

beforeEach(() => {
	wide = true;
	width = 1280;
	localStorage.clear();
	showControls.set(false);
	vi.stubGlobal('matchMedia', () => ({
		get matches() {
			return wide;
		},
		addEventListener: (_: string, cb: typeof mediaChanged) => {
			mediaChanged = cb;
		},
		removeEventListener: () => {
			mediaChanged = undefined;
		}
	}));
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			disconnect(): void {}
		}
	);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => new DOMRect(0, 0, width, 800)
	);
	target = document.createElement('div');
	document.body.append(target);
});
afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	target.remove();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it.each([false, true])(
	'preserves controls open=%s across desktop → drawer → desktop',
	async (open) => {
		const i18n = createInstance();
		await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
		component = mount(Harness, { target, context: new Map([['i18n', writable(i18n)]]) });
		await settle();
		showControls.set(open);
		await settle();
		const initialSize = component.getSize();
		expect(initialSize > 0).toBe(open);
		await resize(false);
		expect(get(showControls)).toBe(open);
		await resize(true);
		expect(get(showControls)).toBe(open);
		expect(component.getSize() > 0).toBe(open);
		if (open) expect(component.getSize()).toBeCloseTo(initialSize, 0);
		expect(target.querySelector('input')?.value).toBe('unfinished draft');
	}
);

it.each(['invalid', '-100', '0'])('opens safely with unusable stored width %s', async (saved) => {
	localStorage.chatControlsSize = saved;
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	component = mount(Harness, { target, context: new Map([['i18n', writable(i18n)]]) });
	await settle();
	showControls.set(true);
	await settle();
	expect(component.getSize()).toBeGreaterThan(0);
	expect(Number.isFinite(component.getSize())).toBe(true);
	await resize(false);
	expect(() => component?.openPane()).not.toThrow();
	await resize(true);
	expect(get(showControls)).toBe(true);
	expect(component.getSize()).toBeGreaterThan(0);
	// A deliberate close must remain closed when the pane is recreated again.
	showControls.set(false);
	await settle();
	await resize(false);
	await resize(true);
	expect(get(showControls)).toBe(false);
	expect(component.getSize()).toBe(0);
});

it('leaves the existing pane unchanged when its container is detached or has zero width', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	component = mount(Harness, { target, context: new Map([['i18n', writable(i18n)]]) });
	await settle();
	showControls.set(true);
	await settle();
	const size = component.getSize();
	const container = target.querySelector('#test-chat-container');
	container?.removeAttribute('id');
	expect(() => component?.openPane()).not.toThrow();
	expect(component.getSize()).toBe(size);
	container?.setAttribute('id', 'test-chat-container');
	width = 0;
	expect(() => component?.openPane()).not.toThrow();
	expect(component.getSize()).toBe(size);
});
