// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { normalizeNote } from '../src/lib/utils/airis/notes';

const output = vi.hoisted(() => ({
	canvas: vi.fn(),
	addImage: vi.fn(),
	addPage: vi.fn(),
	save: vi.fn()
}));
vi.mock('html2canvas-pro', () => ({ default: output.canvas }));
vi.mock('$lib/apis/notes', () => ({ createNewNote: vi.fn() }));
vi.mock('jspdf', () => ({
	default: class {
		addImage = output.addImage;
		addPage = output.addPage;
		save = output.save;
	}
}));
import { downloadPdf } from '../src/lib/components/notes/utils';

it('exports sanitized note content with its title, paginates and removes the hidden node', async () => {
	output.canvas.mockImplementation(async (node: HTMLElement) => {
		expect(document.body.contains(node)).toBe(true);
		expect(node.textContent).toBe('Note titleRetained text');
		expect(node.querySelector('script')).toBeNull();
		expect(node.querySelector('img')?.hasAttribute('onerror')).toBe(false);
		return { width: 1000, height: 5000, toDataURL: () => 'data:image/jpeg;base64,TEST' };
	});
	const count = document.body.children.length;
	await downloadPdf(
		normalizeNote({
			id: 'pdf',
			user_id: 'owner',
			title: 'Note title',
			created_at: 1,
			updated_at: 1,
			data: {
				content: { html: '<p>Retained text</p><script>bad()</script><img src="x" onerror="bad()">' }
			}
		})
	);
	expect(output.canvas).toHaveBeenCalledWith(
		expect.any(HTMLElement),
		expect.objectContaining({ width: 1024, windowWidth: 1024, windowHeight: 1400 })
	);
	expect(output.addImage).toHaveBeenCalledTimes(4);
	expect(output.addPage).toHaveBeenCalledTimes(3);
	expect(output.save).toHaveBeenCalledWith('Note title.pdf');
	expect(document.body.children.length).toBe(count);
});
