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

export const sanitizedSvg: Action<HTMLElement, string> = (node, svg) => {
	const update = (value: string): void => {
		node.replaceChildren(
			DOMPurify.sanitize(value, {
				USE_PROFILES: { svg: true, svgFilters: true }, // allow <svg>, <defs>, <filter>, etc.
				WHOLE_DOCUMENT: false,
				ADD_TAGS: ['style', 'foreignObject'], // include foreignObject if using HTML labels
				ADD_ATTR: [
					'class',
					'style',
					'id',
					'data-*',
					'viewBox',
					'preserveAspectRatio',
					// markers / arrows
					'markerWidth',
					'markerHeight',
					'markerUnits',
					'refX',
					'refY',
					'orient',
					// hrefs (for gradients, markers, etc.)
					'href',
					'xlink:href',
					// text positioning
					'dominant-baseline',
					'text-anchor',
					// pattern / clip / mask units
					'clipPathUnits',
					'filterUnits',
					'patternUnits',
					'patternContentUnits',
					'maskUnits',
					// a11y niceties
					'role',
					'aria-label',
					'aria-labelledby',
					'aria-hidden',
					'tabindex'
				],
				SANITIZE_DOM: true,
				RETURN_DOM_FRAGMENT: true
			})
		);
	};
	update(svg);
	return { update };
};
