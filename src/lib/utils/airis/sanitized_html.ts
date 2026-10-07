import DOMPurify from 'dompurify';
import type { Action } from 'svelte/action';

// Only for browser-mounted content; public SSR markup stays in Svelte templates.
export const sanitizedHtml: Action<HTMLElement, string> = (node, html) => {
	const update = (value: string): void => {
		node.replaceChildren(DOMPurify.sanitize(value, { RETURN_DOM_FRAGMENT: true }));
	};
	update(html);
	return { update };
};
