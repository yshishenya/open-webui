// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { writable } from 'svelte/store';
import FilePreview from './FilePreview.svelte';

vi.mock('$lib/utils', () => ({ initMermaid: vi.fn(), renderMermaidDiagram: vi.fn() }));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { settings: writable({}), config: writable({}) };
});
vi.mock('$lib/components/common/PDFViewer.svelte', () => ({ default: null }));
vi.mock('./NotebookView.svelte', () => ({ default: null }));
vi.mock('./SqliteView.svelte', () => ({ default: null }));
vi.mock('./FileCodeEditor.svelte', () => ({ default: null }));

it('keeps Office formatting while rejecting active markup at the receiving sink', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FilePreview, {
		target,
		context: new Map([['i18n', writable({ t: (text: string): string => text })]]),
		props: {
			selectedFile: 'report.docx',
			fileOfficeHtml:
				'<table><tr><td>Report</td></tr></table><img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">Link</a>'
		}
	});
	try {
		await tick();
		expect(target.querySelector('td')?.textContent).toBe('Report');
		expect(target.querySelector('script')).toBeNull();
		expect(target.querySelector('img')?.hasAttribute('onerror')).toBe(false);
		expect(target.querySelector('a')?.hasAttribute('href')).toBe(false);
	} finally {
		await unmount(component);
		target.remove();
	}
});
