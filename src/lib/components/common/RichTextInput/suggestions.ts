import type { ComponentProps as SvelteProps, SvelteComponent } from 'svelte';
import type { Readable } from 'svelte/store';
import type { i18n as I18n } from 'i18next';
import type {
	SuggestionOptions,
	SuggestionProps,
	SuggestionKeyDownProps
} from '@tiptap/suggestion';
import type CommandSuggestionList from '$lib/components/chat/MessageInput/CommandSuggestionList.svelte';
import type MentionList from '$lib/components/channel/MessageInput/MentionList.svelte';
import { createClassComponent } from 'svelte/legacy';

import tippy, { type Instance } from 'tippy.js';

type Item = { id: string; label: string };
type ListProps = Pick<SvelteProps<typeof CommandSuggestionList>, 'char' | 'query' | 'command'>;
type ListExports = Pick<CommandSuggestionList, '_onKeyDown'>;
type ListEvents = Record<string, CustomEvent<unknown>>;
type ListSlots = Record<string, never>;

export function getSuggestionRenderer(
	Component: typeof CommandSuggestionList | typeof MentionList,
	ComponentProps: Record<string, unknown> & { i18n?: Readable<I18n> } = {}
): NonNullable<SuggestionOptions<unknown, Item>['render']> {
	return function suggestionRenderer() {
		let component: (SvelteComponent<ListProps, ListEvents, ListSlots> & ListExports) | null = null;
		let container: HTMLDivElement | null = null;

		let popup: Instance | null = null;
		let refEl: HTMLDivElement | null = null; // dummy reference

		return {
			onStart: (props: SuggestionProps<unknown, Item>): void => {
				container = document.createElement('div');
				container.className = 'suggestion-list-container';
				document.body.appendChild(container);

				// mount Svelte component
				component = createClassComponent<ListProps, ListExports, ListEvents, ListSlots>({
					component: Component,
					target: container,
					props: {
						char: props?.text?.charAt(0),
						query: props?.query,
						command: (item: Item): void => {
							props.command({ id: item.id, label: item.label });
						},
						...ComponentProps
					},
					context: new Map<string, unknown>([['i18n', ComponentProps?.i18n]])
				});

				// Create a tiny reference element so outside taps are truly "outside"
				refEl = document.createElement('div');
				Object.assign(refEl.style, {
					position: 'fixed',
					left: '0px',
					top: '0px',
					width: '0px',
					height: '0px'
				});
				document.body.appendChild(refEl);

				// TipTap can lose cursor geometry while the editor updates.
				popup = tippy(refEl, {
					getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
					appendTo: () => document.body,
					content: container,
					interactive: true,
					trigger: 'manual',
					theme: 'transparent',
					placement: 'top-start',
					offset: [-10, -2],
					arrow: false,
					popperOptions: {
						strategy: 'fixed',
						modifiers: [
							{
								name: 'preventOverflow',
								options: {
									boundary: 'viewport', // keep within the viewport
									altAxis: true, // also prevent overflow on the cross axis (X)
									tether: true,
									padding: 8
								}
							},
							{
								name: 'flip',
								options: {
									boundary: 'viewport',
									fallbackPlacements: ['top-end', 'bottom-start', 'bottom-end']
								}
							},
							// Ensure transforms don’t cause layout widening in some browsers
							{ name: 'computeStyles', options: { adaptive: true } }
						]
					},
					// Helps avoid accidental focus/hover “linking” from far away elements
					interactiveBorder: 8
				});
				popup?.show();
			},

			onUpdate: (props: SuggestionProps<unknown, Item>): void => {
				if (!component) return;

				component.$set({
					query: props.query,
					command: (item: Item): void => {
						props.command({ id: item.id, label: item.label });
					}
				});

				if (popup) {
					popup.setProps({ getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect() });
				}
			},

			onKeyDown: (props: SuggestionKeyDownProps): boolean => {
				// forward to the Svelte component’s handler
				// (expose this from component as `export function onKeyDown(evt)`)
				return component?._onKeyDown?.(props.event) ?? false;
			},

			onExit: (): void => {
				popup?.destroy();
				popup = null;

				try {
					component?.$destroy();
				} catch (e) {
					console.error('Error unmounting component:', e);
				}

				component = null;

				if (container?.parentNode) container.parentNode.removeChild(container);
				container = null;

				if (refEl?.parentNode) refEl.parentNode.removeChild(refEl);
				refEl = null;
			}
		};
	};
}
