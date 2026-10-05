// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClassComponent } from 'svelte/legacy';
import { tick, type ComponentProps } from 'svelte';
import { readable } from 'svelte/store';
import type { ContextUsage } from '$lib/utils/airis/frontend-contracts';
import CommandSuggestionList from './CommandSuggestionList.svelte';

vi.mock('$lib/apis/prompts', () => ({ getPrompts: vi.fn().mockResolvedValue([]) }));
vi.mock('$lib/apis/skills', () => ({ getSkillItems: vi.fn().mockResolvedValue({ items: [] }) }));
// Keep the actual slash commands and tooltip; other suggestion modes are outside this check.
vi.mock('./Commands/AtCommands.svelte', async () => ({
	default: (await import('$lib/components/common/Spinner.svelte')).default
}));
vi.mock('./Commands/Knowledge.svelte', async () => ({
	default: (await import('$lib/components/common/Spinner.svelte')).default
}));
vi.mock('./Commands/Skills.svelte', async () => ({
	default: (await import('$lib/components/common/Spinner.svelte')).default
}));
vi.mock('./Commands/Emojis.svelte', async () => ({
	default: (await import('$lib/components/common/Spinner.svelte')).default
}));

const usage = (threshold: number | null, percent: number | null): ContextUsage => ({
	tokens: 500,
	estimated_tokens: 500,
	threshold,
	percent,
	source: 'estimated'
});

describe('Context usage in slash suggestions', () => {
	let mounted: ReturnType<typeof createClassComponent> | null = null;
	afterEach(() => {
		mounted?.$destroy();
		mounted = null;
		document.body.innerHTML = '';
		vi.restoreAllMocks();
		Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
	});
	async function mount(
		props: Partial<ComponentProps<typeof CommandSuggestionList>>
	): Promise<void> {
		const target = document.createElement('div');
		document.body.appendChild(target);
		mounted = createClassComponent({
			component: CommandSuggestionList,
			target,
			context: new Map([['i18n', readable({ t: (key: string) => key })]]),
			props: { char: '/', query: '', command: vi.fn(), canCompact: true, ...props }
		});
		await tick();
	}
	function compact(): HTMLButtonElement {
		const node = document.querySelector<HTMLButtonElement>('button[aria-label^="Compact:"]');
		if (!node) throw new Error('Compact command missing');
		return node;
	}
	async function key(name: string): Promise<KeyboardEvent> {
		const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
		mounted?._onKeyDown(event);
		await tick();
		return event;
	}
	it.each([null, usage(null, null), usage(0, 70), usage(-1, 70)])(
		'hides the percentage and gauge without a positive limit: %j',
		async (contextUsage) => {
			await mount({ contextUsage });
			expect(compact().textContent).not.toContain('%');
			expect(compact().querySelector('circle')).toBeNull();
		}
	);
	it.each([
		[50.4, 50],
		[-10, 0],
		[150, 100],
		[null, 0]
	])('preserves rounded and clamped gauge for percent %s', async (percent, expected) => {
		await mount({ contextUsage: usage(1000, percent) });
		expect(compact().textContent).toContain(`${expected}% full`);
		const circle = compact().querySelectorAll('circle')[1];
		expect(parseFloat((circle as SVGElement).style.strokeDashoffset)).toBeCloseTo(
			50.27 * (1 - expected / 100)
		);
	});
	it('refreshes the same getter when the renderer updates its query', async () => {
		let current: ContextUsage | null = usage(1000, 25);
		await mount({ contextUsage: () => current });
		expect(compact().textContent).toContain('25% full');
		current = usage(1000, 80);
		mounted?.$set({ query: 'c' });
		await tick();
		expect(compact().textContent).toContain('80% full');
		current = null;
		mounted?.$set({ query: 'co' });
		await tick();
		expect(compact().textContent).not.toContain('%');
	});
	it('preserves keyboard selection and prevents disabled compact/fork actions', async () => {
		const onCompact = vi.fn();
		const onFork = vi.fn();
		const onStatus = vi.fn();
		Object.defineProperty(Element.prototype, 'scrollIntoView', {
			configurable: true,
			value: vi.fn()
		});
		await mount({
			canFork: true,
			canStatus: true,
			compactDisabled: true,
			forkDisabled: true,
			onCompact,
			onFork,
			onStatus
		});
		expect((await key('Enter')).defaultPrevented).toBe(true);
		expect(onCompact).not.toHaveBeenCalled();
		await key('ArrowDown');
		await key('Tab');
		expect(onFork).not.toHaveBeenCalled();
		await key('ArrowDown');
		await key('Enter');
		expect(onStatus).toHaveBeenCalledOnce();
		await key('ArrowUp');
		mounted?.$set({ forkDisabled: false });
		await tick();
		await key('Tab');
		expect(onFork).toHaveBeenCalledOnce();
		await key('ArrowUp');
		mounted?.$set({ compactDisabled: false });
		await tick();
		await key('Enter');
		expect(onCompact).toHaveBeenCalledOnce();
		expect(mounted?._onKeyDown(new KeyboardEvent('keydown', { key: 'a' }))).toBe(false);
		expect(mounted?._onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(true);
	});
});
