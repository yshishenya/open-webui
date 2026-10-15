// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import type { SuggestionProps } from '@tiptap/suggestion';
import type { Props as TippyProps } from 'tippy.js';
import { expect, it, vi } from 'vitest';
import CommandSuggestionList from '../src/lib/components/chat/MessageInput/CommandSuggestionList.svelte';
import { getSuggestionRenderer } from '../src/lib/components/common/RichTextInput/suggestions';

const state = vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
	return {
		options: {} as Partial<TippyProps>,
		component: { $set: vi.fn(), $destroy: vi.fn(), _onKeyDown: vi.fn(() => false) },
		popup: {
			show: vi.fn(),
			destroy: vi.fn(),
			setProps: vi.fn((props: Partial<TippyProps>): void => {
				Object.assign(state.options, props);
			})
		}
	};
});
vi.mock('svelte/legacy', () => ({ createClassComponent: () => state.component }));
vi.mock('tippy.js', () => ({
	default: (_target: HTMLElement, props: Partial<TippyProps>) => {
		state.options = props;
		return state.popup;
	}
}));

it('provides a valid cursor rectangle at start and update when TipTap has no geometry', () => {
	const rectangle = new DOMRect(10, 20, 30, 40);
	const props: SuggestionProps<unknown, { id: string; label: string }> = {
		editor: {} as Editor,
		range: { from: 0, to: 0 },
		query: '',
		text: '/',
		items: [],
		command: vi.fn(),
		decorationNode: null
	};
	const originalChildren = document.body.childElementCount;
	for (const clientRect of [() => rectangle, () => null, undefined, null]) {
		const renderer = getSuggestionRenderer(CommandSuggestionList)();
		try {
			renderer.onStart?.({ ...props, clientRect });
			const actual = state.options.getReferenceClientRect?.();
			expect(actual).toBeInstanceOf(DOMRect);
			expect(actual?.toJSON()).toEqual((clientRect?.() ?? new DOMRect()).toJSON());
			if (clientRect?.()) expect(actual).toBe(rectangle);

			for (const absent of [() => null, undefined, null]) {
				renderer.onUpdate?.({ ...props, clientRect: () => rectangle });
				expect(state.options.getReferenceClientRect?.()).toBe(rectangle);
				renderer.onUpdate?.({ ...props, clientRect: absent });
				expect(state.options.getReferenceClientRect?.()?.toJSON()).toEqual(new DOMRect().toJSON());
			}
		} finally {
			renderer.onExit?.(props);
		}
		expect(document.body.childElementCount).toBe(originalChildren);
	}
});
