// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { get, writable } from 'svelte/store';
import ChatPlaceholder from '$lib/components/chat/ChatPlaceholder.svelte';
import { models } from '$lib/stores';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
import { sanitizedHtml } from '$lib/utils/airis/sanitized_html';

it('preserves sanitized model markup and replaces it on updates without retaining unsafe nodes', () => {
	const node = document.createElement('div');
	const html = marked.parse('**Текст**\n<br>[Ссылка](https://example.test)') as string;
	const action = sanitizedHtml(node, html);
	expect(node.innerHTML).toBe(DOMPurify.sanitize(html));
	expect(node.querySelector('strong')?.textContent).toBe('Текст');
	expect(node.querySelector('a')?.href).toBe('https://example.test/');
	action?.update?.(
		'<script>window.bad=1</script><img src=x onerror="bad()"><a href="javascript:bad()">X</a><em>Новый</em>'
	);
	expect(node.querySelector('script, strong')).toBeNull();
	expect(node.querySelector('img')?.hasAttribute('onerror')).toBe(false);
	expect(node.querySelector('a')?.hasAttribute('href')).toBe(false);
	expect(node.querySelector('em')?.textContent).toBe('Новый');
	action?.update?.('');
	expect(node.childNodes).toHaveLength(0);
});

const component = readFileSync('src/lib/components/chat/Messages/ContentRenderer.svelte', 'utf8');
const script = component.split('<script>')[1].split('</script>')[0];
const source = ts.createSourceFile(
	'renderer.js',
	script,
	ts.ScriptTarget.Latest,
	true,
	ts.ScriptKind.JS
);
const helper = source.statements.find(
	(node) =>
		ts.isVariableStatement(node) &&
		node.declarationList.declarations.some((d) => d.name.getText(source) === 'extractDetailsBlocks')
);
if (!helper) throw new Error('Actual details parser missing');
const extract = runInNewContext(`${helper.getText(source)}\nextractDetailsBlocks`) as (
	text: string
) => { detailsContent: string; plainContent: string };

it('keeps plain, nested, multiple and unmatched details content unchanged', () => {
	for (const [text, detailsContent, plainContent] of [
		['', '', ''],
		[' plain ', '', 'plain'],
		[
			'a<details>x<details>y</details>z</details>b',
			'<details>x<details>y</details>z</details>',
			'ab'
		],
		[
			'<details>a</details>x<details>b</details>',
			'<details>a</details>\n<details>b</details>',
			'x'
		],
		['a<details>unclosed', '', 'a<details>unclosed']
	]) {
		expect(extract(text)).toEqual({ detailsContent, plainContent });
	}
});

it('updates the actual model placeholder after selection and forwards a suggested task', async () => {
	if (!Element.prototype.animate)
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({
				cancel: vi.fn(),
				finished: Promise.resolve(),
				finish: vi.fn(),
				pause: vi.fn(),
				play: vi.fn()
			}))
		});
	const original = get(models);
	models.set([
		{
			id: 'a',
			name: 'A',
			info: {
				meta: { description: '**Первый**', suggestion_prompts: [{ content: 'Составь план' }] }
			}
		},
		{ id: 'b', name: 'B', info: { meta: { description: '*Второй*' } } }
	]);
	const i18n = createInstance();
	await i18n.init({ lng: 'ru', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.appendChild(target);
	const onSelect = vi.fn();
	const component = mount(ChatPlaceholder, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { modelIds: ['a', 'b'], atSelectedModel: undefined, onSelect }
	});
	try {
		await tick();
		expect(target.querySelector('.markdown em')?.textContent).toBe('Второй');
		target.querySelector('button')?.click();
		await tick();
		expect(target.querySelector('.markdown strong')?.textContent).toBe('Первый');
		target.querySelector<HTMLButtonElement>('[role="listitem"]')?.click();
		expect(onSelect).toHaveBeenCalledWith({ type: 'prompt', data: 'Составь план' });
		models.update((items) =>
			items.map((item) =>
				item.id === 'b'
					? {
							...item,
							info: { meta: { description: '*Обновлён*<img src=x onerror="bad()">' } }
						}
					: item
			)
		);
		await tick();
		expect(target.querySelector('.markdown strong')).toBeNull();
		expect(target.querySelector('.markdown em')?.textContent).toBe('Обновлён');
		expect(target.querySelector('.markdown img')).toBeNull();
	} finally {
		await unmount(component);
		models.set(original);
		target.remove();
	}
});
