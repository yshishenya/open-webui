// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Models from './+page.svelte';
import * as api from '$lib/apis/admin/billing';
import type { RateCardXlsxImportPreviewResponse } from '$lib/apis/admin/billing';
import { toast } from 'svelte-sonner';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/admin/billing/models') }) };
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		WEBUI_NAME: writable('Airis'),
		user: writable({ role: 'admin' }),
		settings: writable({})
	};
});
vi.mock('$lib/apis', () => ({
	getModels: vi.fn().mockResolvedValue([
		{ id: 'model-a', name: 'Same name' },
		{ id: 'model-b', name: 'Same name' }
	])
}));
vi.mock('$lib/apis/models', () => ({
	getBaseModels: vi.fn().mockResolvedValue([]),
	createNewModel: vi.fn(),
	updateModelById: vi.fn()
}));
vi.mock('$lib/apis/admin/billing', () => ({
	listRateCards: vi.fn().mockResolvedValue({
		items: [
			{
				id: 'rate-in',
				model_id: 'model-a',
				modality: 'text',
				unit: 'token_in',
				raw_cost_per_unit_kopeks: 12,
				is_active: true,
				created_at: 1
			},
			{
				id: 'rate-out',
				model_id: 'model-a',
				modality: 'text',
				unit: 'token_out',
				raw_cost_per_unit_kopeks: 34,
				is_active: true,
				created_at: 1
			}
		],
		total_pages: 1
	}),
	previewRateCardsXlsxImport: vi.fn(),
	applyRateCardsXlsxImport: vi.fn(),
	createRateCard: vi.fn(),
	updateRateCard: vi.fn(),
	deleteRateCardsByModel: vi.fn(),
	deactivateRateCardsByModel: vi.fn(),
	exportRateCardsXlsx: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));
vi.mock('$lib/utils/transitions', () => ({ flyAndScale: () => ({ duration: 0 }) }));
// Focus behavior needs the real-browser gate; these tests exercise the real dialogs' contracts.
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));

const preview: RateCardXlsxImportPreviewResponse = {
	summary: {
		rows_total: 1,
		rows_valid: 1,
		rows_invalid: 0,
		creates: 1,
		updates_via_create: 0,
		deactivations: 0,
		noops: 0,
		skipped_unknown_model: 0,
		skipped_out_of_scope: 0
	},
	warnings: [],
	errors: [],
	actions_preview: []
};

const deferred = <T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: Error) => void;
} => {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const button = (name: string): HTMLButtonElement => {
	const found = [...document.querySelectorAll('button')].find(
		(element) => element.getAttribute('aria-label') === name || element.textContent?.trim() === name
	);
	if (!found) throw new Error(`Missing button: ${name}`);
	return found;
};

const checkbox = (model: string): HTMLInputElement => {
	const found = document.querySelector<HTMLInputElement>(
		`input[aria-label="Select: Same name (${model})"]`
	);
	if (!found) throw new Error(`Missing model: ${model}`);
	return found;
};

const chooseFile = async (file = new File(['xlsx'], 'prices.xlsx')): Promise<File> => {
	const input = document.querySelector<HTMLInputElement>('#rate-card-import-file');
	if (!input) throw new Error('Missing import file input');
	Object.defineProperty(input, 'files', { configurable: true, value: [file] });
	input.dispatchEvent(new Event('change', { bubbles: true }));
	await tick();
	return file;
};

const changeMode = async (mode: 'patch' | 'full_sync'): Promise<void> => {
	const input = document.querySelector<HTMLSelectElement>('#rate-card-import-mode');
	if (!input) throw new Error('Missing import mode');
	input.value = mode;
	input.dispatchEvent(new Event('change', { bubbles: true }));
	await tick();
};

describe('billing model import preview binding and controls', () => {
	let component: ReturnType<typeof mount> | null = null;
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.mocked(api.previewRateCardsXlsxImport).mockReset().mockResolvedValue(preview);
		vi.mocked(api.applyRateCardsXlsxImport).mockReset().mockResolvedValue(preview);
		document.body.innerHTML = '';
		const target = document.createElement('div');
		document.body.append(target);
		component = mount(Models, {
			target,
			context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
		});
		await vi.waitFor(() => expect(checkbox('model-a')).toBeTruthy());
	});
	afterEach(async () => {
		if (component) await unmount(component);
		component = null;
		document.body.innerHTML = '';
	});

	const openImport = async (): Promise<File> => {
		if (!checkbox('model-a').checked) checkbox('model-a').click();
		await tick();
		button('Import XLSX').click();
		await tick();
		return chooseFile();
	};
	const runPreview = async (): Promise<void> => {
		button('Preview import').click();
		await vi.waitFor(() => expect(button('Apply import').disabled).toBe(false));
	};

	it.each(['mode', 'file', 'scope'] as const)(
		'requires a new preview after changing %s',
		async (change) => {
			await openImport();
			await runPreview();
			if (change === 'mode') await changeMode('full_sync');
			if (change === 'file') await chooseFile(); // Identical name and size, different File.
			if (change === 'scope') {
				checkbox('model-b').click();
				await tick();
			}
			expect(button('Apply import').disabled).toBe(true);
			expect(api.applyRateCardsXlsxImport).not.toHaveBeenCalled();
			await runPreview();
			button('Apply import').click();
			await vi.waitFor(() => expect(api.applyRateCardsXlsxImport).toHaveBeenCalledTimes(1));
			expect(vi.mocked(api.applyRateCardsXlsxImport).mock.calls[0][1]).toEqual(
				vi.mocked(api.previewRateCardsXlsxImport).mock.calls.at(-1)?.[1]
			);
		}
	);

	it.each(['resolve', 'reject'] as const)(
		'ignores an old preview %s after a mode change away and back',
		async (outcome) => {
			const old = deferred<RateCardXlsxImportPreviewResponse>();
			vi.mocked(api.previewRateCardsXlsxImport).mockImplementationOnce(() => old.promise);
			await openImport();
			button('Preview import').click();
			await tick();
			await changeMode('full_sync');
			await changeMode('patch');
			await runPreview();
			if (outcome === 'resolve') {
				old.resolve({ ...preview, errors: [{ code: 'old', message: 'old response' }] });
			} else old.reject(new Error('old request failed'));
			await tick();
			expect(button('Apply import').disabled).toBe(false);
			expect(document.body.textContent).not.toContain('old response');
			expect(document.body.textContent).not.toContain('Failed to preview import');
		}
	);

	it('does not let an old finally clear the loading state of a newer preview', async () => {
		const old = deferred<RateCardXlsxImportPreviewResponse>();
		const current = deferred<RateCardXlsxImportPreviewResponse>();
		vi.mocked(api.previewRateCardsXlsxImport)
			.mockImplementationOnce(() => old.promise)
			.mockImplementationOnce(() => current.promise);
		await openImport();
		button('Preview import').click();
		await tick();
		await chooseFile();
		button('Preview import').click();
		await tick();
		old.resolve(preview);
		await tick();
		expect(button('Previewing...').disabled).toBe(true);
		expect(button('Apply import').disabled).toBe(true);
		current.resolve(preview);
		await vi.waitFor(() => expect(button('Apply import').disabled).toBe(false));
	});

	it('ignores a preview after closing and reopening the dialog', async () => {
		const old = deferred<RateCardXlsxImportPreviewResponse>();
		vi.mocked(api.previewRateCardsXlsxImport).mockImplementationOnce(() => old.promise);
		await openImport();
		button('Preview import').click();
		await tick();
		button('Close').click();
		await tick();
		button('Import XLSX').click();
		await tick();
		old.resolve(preview);
		await tick();
		expect(button('Apply import').disabled).toBe(true);
	});

	it.each(['file', 'scope'] as const)(
		'ignores a pending preview after changing %s',
		async (change) => {
			const old = deferred<RateCardXlsxImportPreviewResponse>();
			vi.mocked(api.previewRateCardsXlsxImport).mockImplementationOnce(() => old.promise);
			await openImport();
			button('Preview import').click();
			await tick();
			if (change === 'file') await chooseFile();
			else {
				checkbox('model-b').click();
				await tick();
			}
			old.resolve(preview);
			await tick();
			expect(button('Apply import').disabled).toBe(true);
			expect(api.applyRateCardsXlsxImport).not.toHaveBeenCalled();
		}
	);

	it.each([
		['resolve', 'scope'],
		['reject', 'scope'],
		['resolve', 'file'],
		['reject', 'mode']
	] as const)(
		'does not overwrite a new dialog when an older apply %s arrives after changing %s',
		async (outcome, change) => {
			const old = deferred<Awaited<ReturnType<typeof api.applyRateCardsXlsxImport>>>();
			vi.mocked(api.applyRateCardsXlsxImport).mockImplementationOnce(() => old.promise);
			const file = await openImport();
			await runPreview();
			button('Apply import').click();
			await vi.waitFor(() => expect(api.applyRateCardsXlsxImport).toHaveBeenCalledTimes(1));
			button('Import XLSX').click();
			await tick();
			if (change === 'scope') {
				checkbox('model-b').click();
				await tick();
			}
			// Even a programmatic change to disabled controls cannot rebind the in-flight request.
			if (change === 'file') await chooseFile();
			if (change === 'mode') await changeMode('full_sync');
			expect(button('Preview import').disabled).toBe(true);
			expect(button('Applying...').disabled).toBe(true);
			if (outcome === 'resolve') old.resolve(preview);
			else old.reject(new Error('old apply failed'));
			await vi.waitFor(() => expect(button('Preview import').disabled).toBe(false));
			expect(
				document.querySelector('[role="dialog"][aria-label="Import rate cards from XLSX"]')
			).toBeTruthy();
			expect(button('Apply import').disabled).toBe(true);
			expect(toast.success).not.toHaveBeenCalled();
			expect(toast.error).not.toHaveBeenCalled();
			expect(vi.mocked(api.applyRateCardsXlsxImport).mock.calls[0][1]).toEqual({
				file,
				mode: 'patch',
				scope_model_ids: ['model-a']
			});
		}
	);

	it('keeps invalid rows blocked and never applies a preview automatically', async () => {
		vi.mocked(api.previewRateCardsXlsxImport).mockResolvedValue({
			...preview,
			summary: { ...preview.summary, rows_invalid: 1 }
		});
		await openImport();
		button('Preview import').click();
		await vi.waitFor(() => expect(document.body.textContent).toContain('Fix errors to apply'));
		expect(button('Apply import').disabled).toBe(true);
		expect(api.applyRateCardsXlsxImport).not.toHaveBeenCalled();
	});

	it('submits one reviewed request even if confirmation is clicked twice', async () => {
		const pending = deferred<Awaited<ReturnType<typeof api.applyRateCardsXlsxImport>>>();
		vi.mocked(api.applyRateCardsXlsxImport).mockImplementationOnce(() => pending.promise);
		await openImport();
		await runPreview();
		const apply = button('Apply import');
		apply.click();
		apply.click();
		await vi.waitFor(() => expect(api.applyRateCardsXlsxImport).toHaveBeenCalledTimes(1));
		pending.resolve(preview);
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
	});

	it('requires a fresh preview after an unconfirmed apply, without replaying it', async () => {
		vi.mocked(api.applyRateCardsXlsxImport).mockRejectedValueOnce(new Error('response lost'));
		await openImport();
		await runPreview();
		button('Apply import').click();
		await vi.waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				expect.stringContaining('Import status could not be confirmed')
			)
		);
		expect(api.applyRateCardsXlsxImport).toHaveBeenCalledTimes(1);
		button('Import XLSX').click();
		await tick();
		expect(button('Apply import').disabled).toBe(true);
	});

	it('names selection/edit controls by model ID and exposes the editor title and switches', async () => {
		expect(document.querySelector('input[aria-label="Select all visible models"]')).toBeTruthy();
		const selectAll = document.querySelector<HTMLInputElement>(
			'input[aria-label="Select all visible models"]'
		)!;
		checkbox('model-a').click();
		await tick();
		expect(selectAll.indeterminate).toBe(true);
		selectAll.click();
		await tick();
		expect(selectAll.checked).toBe(true);
		selectAll.click();
		await tick();
		expect(checkbox('model-a').checked).toBe(false);
		button('Edit: Model prices — Same name (model-a)').click();
		await tick();
		const dialog = document.querySelector('[role="dialog"][aria-label="Model prices — Same name"]');
		expect(dialog).toBeTruthy();
		expect(
			dialog?.querySelector('[role="switch"][aria-label="Free access — Same name"]')
		).toBeTruthy();
		expect(
			dialog?.querySelector('[role="switch"][aria-label="Enable modality: Text"]')
		).toBeTruthy();
		expect(api.updateRateCard).not.toHaveBeenCalled();
		expect(api.createRateCard).not.toHaveBeenCalled();
	});

	it('retains per-1000-token units in mobile prices, including All view', async () => {
		const mobile = document.querySelector('.md\\:hidden');
		expect(mobile?.textContent).toContain('Input price per 1000 tokens');
		expect(mobile?.textContent).toContain('Output price per 1000 tokens');
		button('All').click();
		await tick();
		expect(mobile?.textContent).toContain('Tokens · in/out (per 1k)');
	});
});
