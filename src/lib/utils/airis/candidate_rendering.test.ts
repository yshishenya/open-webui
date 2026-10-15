// @vitest-environment jsdom
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { readable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import CodeBlock from '$lib/components/chat/Messages/CodeBlock.svelte';
import MarkdownInlineTokens from '$lib/components/chat/Messages/Markdown/MarkdownInlineTokens.svelte';

vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});

const instances: ReturnType<typeof createClassComponent>[] = [];
const context = new Map([['i18n', readable({ t: (value: string) => value })]]);
afterEach(async () => {
	instances.splice(0).forEach((instance) => instance.$destroy());
	await tick();
	document.body.replaceChildren();
});

it('preserves highlighted and literal code across language and content updates', async () => {
	const code = 'const text = "<img src=x onerror=alert(1)>";\n\n';
	const instance = createClassComponent({
		component: CodeBlock,
		target: document.body,
		context,
		props: { code, lang: 'javascript', edit: false, run: false }
	});
	instances.push(instance);
	await tick();
	const rendered = (): HTMLElement => {
		const node = document.querySelector('pre code');
		if (!(node instanceof HTMLElement)) throw new Error('Missing rendered code');
		return node;
	};
	expect(rendered().textContent).toBe(code);
	expect(rendered().querySelector('.hljs-keyword')).not.toBeNull();
	expect(rendered().querySelector('img, script, [onerror]')).toBeNull();
	instance.$set({ code: 'let next = 2;\n' });
	await tick();
	expect(rendered().textContent).toBe('let next = 2;\n');
	expect(rendered().querySelector('.hljs-keyword')).not.toBeNull();
	instance.$set({ lang: 'unknown-language', code: '<script>alert(1)</script>&amp;\n' });
	await tick();
	expect(rendered().textContent).toBe('<script>alert(1)</script>&amp;\n');
	expect(rendered().children).toHaveLength(0);
	instance.$set({ lang: 'javascript', code: '' });
	await tick();
	expect(rendered().textContent).toBe('');
});

it('sanitizes footnote markup on mount and update while preserving formatting and entities', async () => {
	const instance = createClassComponent({
		component: MarkdownInlineTokens,
		target: document.body,
		context,
		props: {
			id: 'footnote',
			tokens: [
				{ type: 'footnote', raw: '', escapedText: '<b>1</b>&amp;<img src=x onerror=alert(1)>' }
			]
		}
	});
	instances.push(instance);
	await tick();
	const footnote = document.querySelector('sup.footnote-ref.footnote-ref-text');
	expect(footnote?.textContent).toBe('1&');
	expect(footnote?.querySelector('b')?.textContent).toBe('1');
	expect(document.querySelector('[onerror], script')).toBeNull();
	instance.$set({
		tokens: [{ type: 'footnote', raw: '', escapedText: '2&lt;3<script>alert(1)</script>' }]
	});
	await tick();
	expect(footnote?.textContent).toBe('2<3');
	expect(footnote?.querySelector('b, script')).toBeNull();
});
