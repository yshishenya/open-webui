// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import HTMLToken from './HTMLToken.svelte';

vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: '' }));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { settings: writable({}) };
});

const cases: [string, string | null][] = [
	['src="/api/v1/files/ab-12/content" controls></TAG>', '/api/v1/files/ab-12/content'],
	["src='/media?a=1&amp;b=2'></TAG>", '/media?a=1&b=2'],
	['SRC=/media></TAG>', '/media'],
	['src="/preferred">/legacy</TAG>', '/preferred'],
	['> https://example.com/media?a=1&amp;b=2 </TAG>', 'https://example.com/media?a=1&b=2'],
	['src="/media?value=&amp;amp;"></TAG>', '/media?value=&amp;'],
	['></TAG>', null],
	['src=""></TAG>', null],
	['src="javascript:alert(1)"></TAG>', null],
	['>javascript:alert(1)</TAG>', null],
	['>java&#x09;script:alert(1)</TAG>', null],
	['src="javascript:alert(1)" onerror="alert(2)"></TAG>', null]
];

for (const kind of ['video', 'audio'] as const) {
	it.each(cases)(`${kind} source: %s`, async (suffix, expected) => {
		const text = `<${kind} ${suffix.replaceAll('TAG', kind)}`;
		const target = document.createElement('div');
		const component = mount(HTMLToken, {
			target,
			props: { id: 'media-check', token: { type: 'html', raw: text, text, block: true } }
		});
		try {
			flushSync();
			const media = target.querySelector(kind);
			if (expected === null) {
				expect(media).toBeNull();
				expect(target.textContent).toBe(text);
			} else {
				expect(media?.getAttribute('src')).toBe(expected);
				expect(media?.hasAttribute('controls')).toBe(true);
				expect(media?.hasAttribute('onerror')).toBe(false);
			}
		} finally {
			await unmount(component);
		}
	});
}

it.each(['</video>', '</audio>'])('consumes native media closing token %s', async (text) => {
	const target = document.createElement('div');
	const component = mount(HTMLToken, {
		target,
		props: { id: 'closing-check', token: { type: 'html', raw: text, text, block: false } }
	});
	try {
		flushSync();
		expect(target.textContent).toBe('');
	} finally {
		await unmount(component);
	}
});
