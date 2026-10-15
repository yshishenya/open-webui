// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { sanitizedHtml, sanitizedSvg } from './sanitized_html';

it('cleans active SVG markup, preserves diagram geometry and updates without stale content', () => {
	const node = document.createElement('div');
	const action = sanitizedSvg(
		node,
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">
		<defs><marker id="arrow" markerWidth="5" markerHeight="5"><path d="M0 0L5 2L0 5z"/></marker>
		<filter id="blur"><feGaussianBlur stdDeviation="1"/></filter></defs>
		<style>.box { fill: blue; }</style><rect class="box" width="100" height="50" filter="url(#blur)"/>
		<path d="M0 0L100 50" marker-end="url(#arrow)"/>
		<a href="https://example.com"><text x="2" y="20">Diagram</text></a>
		<script>window.bad=true</script><a href="javascript:alert(1)"><text onclick="alert(1)">Unsafe</text></a>
	</svg>`
	);
	expect(node.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
	expect(node.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 50');
	expect(node.querySelector('marker')).not.toBeNull();
	expect(node.querySelector('filter')).not.toBeNull();
	expect(node.querySelector('style')).not.toBeNull();
	expect(node.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
	expect(node.querySelector('script,[onclick],[href^="javascript:"]')).toBeNull();
	if (action && action.update)
		action.update('<svg xmlns="http://www.w3.org/2000/svg"><text>New</text></svg>');
	expect(node.textContent).toBe('New');
	expect(node.querySelector('rect')).toBeNull();
	const html = document.createElement('div');
	sanitizedHtml(
		html,
		'<math><mi>x</mi></math><img src=x onerror="alert(1)"><script>alert(1)</script>'
	);
	expect(html.querySelector('math')?.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML');
	expect(html.querySelector('script,[onerror]')).toBeNull();
});
