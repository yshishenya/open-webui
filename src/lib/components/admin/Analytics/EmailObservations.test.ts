// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { readable } from 'svelte/store';
import type { DiagnosticScope } from '$lib/apis/airis/emailObservations';
import EmailObservations from './EmailObservations.svelte';

const api = vi.hoisted(() => ({
	list: vi.fn(),
	declare: vi.fn(),
	close: vi.fn(),
	read: vi.fn(),
	start: vi.fn(),
	page: vi.fn(),
	users: vi.fn()
}));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$lib/apis/users', () => ({ getUsers: api.users }));
vi.mock('$lib/apis/airis/emailObservations', async (load) => {
	const real = await load<typeof import('$lib/apis/airis/emailObservations')>();
	return {
		...real,
		listDiagnosticScopes: api.list,
		declareDiagnosticScope: api.declare,
		closeDiagnosticScope: api.close,
		observationApi: () => ({ read: api.read, start: api.start, page: api.page })
	};
});
const group = (): DiagnosticScope => ({
	id: 'scope',
	purpose: 'diagnostic',
	administrative: false,
	declared_at: 100,
	observed_from: null,
	closed_at: null,
	registrations_from: 0,
	registrations_until: 100,
	payments_from: 0,
	payments_until: 200,
	member_count: 2,
	last_run: null
});

describe('EmailObservations', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement;
	beforeEach(() => {
		vi.resetAllMocks();
		api.list.mockResolvedValue({ items: [], next_cursor: null });
		target = document.createElement('div');
		document.body.appendChild(target);
		localStorage.token = 'test-token';
	});
	afterEach(async () => {
		if (mounted) await unmount(mounted);
		mounted = null;
		target.remove();
	});
	async function show(): Promise<void> {
		mounted = mount(EmailObservations, {
			target,
			context: new Map([['i18n', readable({ language: 'ru' })]])
		});
		await vi.waitFor(() => expect(api.list).toHaveBeenCalledOnce());
		await tick();
	}
	async function click(text: string): Promise<void> {
		const button = [...target.querySelectorAll('button')].find(
			(node) => node.textContent?.trim() === text
		);
		expect(button, `Missing button ${text}`).toBeTruthy();
		await vi.waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
		button?.click();
		await tick();
	}

	it('labels diagnostic purpose, unknown coverage and empty state without transport controls', async () => {
		await show();
		expect(target.textContent).toContain('Диагностических групп пока нет.');
		expect(target.textContent).toContain('не меняет согласия и не отправляет письма');
		expect(target.textContent).toContain('не доказывает непрерывную или прошлую');
		expect(api.start).not.toHaveBeenCalled();
	});
	it('shows a recoverable service failure', async () => {
		api.list.mockRejectedValue(new Error('offline'));
		await show();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain(
			'Не удалось подтвердить состояние'
		);
		api.list.mockResolvedValue({ items: [], next_cursor: null });
		await click('Обновить');
		await vi.waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
		await tick();
		expect(target.querySelector('[role="alert"]')).toBeNull();
	});
	it('shows earlier groups as diagnostic and keeps unknown observation time explicit', async () => {
		api.list.mockResolvedValue({ items: [group()], next_cursor: null });
		await show();
		const button = target.querySelector('button[aria-pressed="false"]') as HTMLButtonElement;
		button.click();
		await tick();
		expect(target.textContent).toContain('Прежняя диагностическая группа');
		expect(target.textContent).toContain('Пока неизвестно');
		expect(target.textContent).toContain('Не начат');
	});
	it('retains incomplete traversal and missing source evidence on a closed group', async () => {
		const scope = {
			...group(),
			closed_at: 105,
			last_run: {
				id: 'run',
				started_at: 101,
				finished_at: 105,
				status: 'failed' as const,
				cursor: 1,
				upper_ordinal: 2,
				scanned_members: 1,
				scanned_scenarios: 6,
				missing_source_members: 1,
				failure_reason: 'operator_stop',
				lease_until: null
			}
		};
		api.list.mockResolvedValue({ items: [scope], next_cursor: null });
		await show();
		(target.querySelector('button[aria-pressed="false"]') as HTMLButtonElement).click();
		await tick();
		expect(target.textContent).toContain('Неполный проход');
		expect(target.textContent).toContain('Потерянных источников среди посещённых: 1');
		expect(target.textContent).toContain('operator_stop');
		const run = [...target.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Начать или продолжить')
		);
		expect((run as HTMLButtonElement).disabled).toBe(true);
	});
	it('picks ordinary accounts and replays the same immutable declaration after a lost response', async () => {
		api.users.mockResolvedValue({
			users: [
				{
					id: 'negative',
					name: 'Без подтверждения',
					role: 'user',
					email_verified: false,
					created_at: 100
				},
				{ id: 'admin', name: 'Администратор', role: 'admin', created_at: 100 }
			],
			total: 2
		});
		api.declare
			.mockRejectedValueOnce(new Error('lost'))
			.mockResolvedValueOnce({ ...group(), administrative: true });
		await show();
		await click('Объявить диагностическую группу');
		await vi.waitFor(() => expect(target.querySelector('input[type="checkbox"]')).toBeTruthy());
		expect(target.textContent).toContain('Без подтверждения');
		expect(target.textContent).not.toContain('Администратор');
		(target.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
		await tick();
		const form = target.querySelector('form') as HTMLFormElement;
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(api.declare).toHaveBeenCalledOnce());
		await tick();
		expect(target.textContent).toContain('Результат объявления пока неизвестен');
		expect((target.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
		expect(
			form.checkValidity(),
			[...form.querySelectorAll('input')]
				.map((input) => `${input.type}:${input.value}:${input.validationMessage}`)
				.join(' | ')
		).toBe(true);
		await click('Повторить то же объявление');
		await vi.waitFor(() => expect(api.declare).toHaveBeenCalledTimes(2));
		expect(api.declare.mock.calls[1]).toEqual(api.declare.mock.calls[0]);
		expect(api.declare.mock.calls[0][1].user_ids).toEqual(['negative']);
	});
});
