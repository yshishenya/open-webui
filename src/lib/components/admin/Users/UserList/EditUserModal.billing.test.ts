// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import { toast } from 'svelte-sonner';
import EditUserModal from './EditUserModal.svelte';
import * as api from '$lib/apis/admin/billing';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
vi.mock('$lib/components/chat/Settings/Account/UserProfileImage.svelte', () => ({
	default: () => {}
}));
// jsdom has no Web Animations API. Keep the real dialogs and their lifecycle;
// only visual transitions are synchronous, as in the other modal tests.
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));
vi.mock('$lib/utils/transitions', () => ({ flyAndScale: () => ({ duration: 0 }) }));
vi.mock('$lib/apis/users', () => ({ getUserGroupsById: async () => [], updateUserById: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('$lib/apis/admin/billing', () => ({
	getUserSubscription: vi.fn(),
	getActivePlans: vi.fn(),
	getUserWalletAdmin: vi.fn(),
	changeUserSubscription: vi.fn(),
	adjustUserWalletAdmin: vi.fn()
}));

let target: HTMLDivElement;

beforeEach(() => {
	vi.resetAllMocks();
	sessionStorage.clear();
	localStorage.clear();
	target = document.createElement('div');
	document.body.appendChild(target);
	vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'confirmed-operation-key') });
	vi.mocked(api.getActivePlans).mockResolvedValue([
		{
			id: 'old',
			name: 'Old',
			price: 10,
			currency: 'RUB',
			interval: 'month',
			is_active: true,
			display_order: 0,
			created_at: 1,
			updated_at: 1
		},
		{
			id: 'new',
			name: 'New',
			price: 20,
			currency: 'RUB',
			interval: 'month',
			is_active: true,
			display_order: 1,
			created_at: 1,
			updated_at: 1
		}
	]);
	vi.mocked(api.getUserSubscription).mockResolvedValue({
		user_id: 'fixture',
		plan: {
			id: 'old',
			name: 'Old',
			price: 10,
			currency: 'RUB',
			interval: 'month',
			is_active: true,
			display_order: 0,
			created_at: 1,
			updated_at: 1
		},
		subscription: {
			id: 'sub',
			user_id: 'fixture',
			plan_id: 'old',
			status: 'active',
			current_period_start: 100,
			current_period_end: 200,
			created_at: 1
		},
		usage: {}
	});
	vi.mocked(api.getUserWalletAdmin).mockResolvedValue({
		user_id: 'fixture',
		wallet: {
			id: 'wallet',
			user_id: 'fixture',
			currency: 'RUB',
			balance_topup_kopeks: 100,
			balance_included_kopeks: 0,
			daily_spent_kopeks: 0,
			daily_cap_kopeks: null,
			created_at: 1,
			updated_at: 1
		},
		ledger_preview: []
	});
});

afterEach(() => {
	target.remove();
	vi.unstubAllGlobals();
});

const button = (label: string): HTMLButtonElement => {
	const match = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
		(element) => element.textContent?.trim() === label
	);
	if (!match) throw new Error('Missing button ' + label);
	return match;
};
const fill = async (selector: string, value: string): Promise<void> => {
	const input = document.querySelector<HTMLInputElement>(selector);
	if (!input) throw new Error('Missing input ' + selector);
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
};
const open = async (
	translations: Record<string, string> = {}
): Promise<ReturnType<typeof mount>> => {
	const i18n = createInstance();
	await i18n.init({
		lng: 'en',
		resources: { en: { translation: translations } },
		initImmediate: false
	});
	const component = mount(EditUserModal, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			show: true,
			selectedUser: {
				id: 'fixture',
				name: 'Fixture',
				email: 'fixture@example.invalid',
				role: 'user',
				profile_image_url: ''
			},
			sessionUser: { id: 'admin', role: 'admin' }
		}
	});
	await vi.waitFor(() => expect(document.querySelector('#wallet-adjust-reason')).not.toBeNull());
	return component;
};

it('keeps plan selection as a draft; cancel sends zero requests, confirm sends one', async () => {
	const component = await open();
	try {
		const select = document.querySelector<HTMLSelectElement>(
			'select[aria-label="Subscription Plan"]'
		)!;
		select.value = 'new';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(api.changeUserSubscription).not.toHaveBeenCalled();
		const reason = Array.from(document.querySelectorAll('label'))
			.find((label) => label.textContent?.includes('Reason'))
			?.querySelector('input');
		expect(reason).toBeTruthy();
		reason!.value = 'manual approval';
		reason!.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		button('Review subscription change').click();
		await tick();
		button('Cancel').click();
		await tick();
		expect(api.changeUserSubscription).not.toHaveBeenCalled();
		button('Review subscription change').click();
		await tick();
		button('Confirm').click();
		await vi.waitFor(() => expect(api.changeUserSubscription).toHaveBeenCalledTimes(1));
		expect(api.changeUserSubscription).toHaveBeenCalledWith(undefined, 'fixture', {
			plan_id: 'new',
			reset_usage: false,
			reason: 'manual approval',
			cancel_scheduled_change: false,
			expected_subscription_id: 'sub',
			expected_plan_id: 'old',
			expected_next_plan_id: null,
			expected_period_start: 100,
			expected_period_end: 200
		});
	} finally {
		await unmount(component);
	}
});

it('persists the confirmed wallet intent after a lost response and retries it after remount', async () => {
	vi.mocked(api.adjustUserWalletAdmin).mockRejectedValueOnce(
		new Error('response lost after commit')
	);
	const summary = await api.getUserWalletAdmin('', 'fixture');
	vi.mocked(api.adjustUserWalletAdmin).mockResolvedValueOnce({
		success: true,
		wallet: summary.wallet,
		ledger_entry: {
			id: 'effect',
			user_id: 'fixture',
			wallet_id: 'wallet',
			currency: 'RUB',
			type: 'adjustment',
			amount_kopeks: 125,
			balance_included_after: 0,
			balance_topup_after: 225,
			reference_id: 'effect',
			reference_type: 'admin_wallet_adjustment',
			idempotency_key: 'confirmed-operation-key',
			metadata_json: { reason: 'confirmed reason' },
			created_at: 1
		}
	});
	let component = await open({ 'response lost after commit': 'Ответ потерян после сохранения' });
	try {
		await fill('#wallet-delta-topup', '1.25');
		await fill('#wallet-adjust-reason', 'confirmed reason');
		button('Apply wallet adjustment').click();
		await tick();
		button('Cancel').click();
		await tick();
		expect(api.adjustUserWalletAdmin).not.toHaveBeenCalled();
		expect(crypto.randomUUID).not.toHaveBeenCalled();
		expect(sessionStorage.getItem('airis.wallet-adjustment:admin:fixture')).toBeNull();
		button('Apply wallet adjustment').click();
		await tick();
		button('Confirm').click();
		await vi.waitFor(() => expect(api.adjustUserWalletAdmin).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(button('Retry same adjustment').disabled).toBe(false));
		expect(toast.error).toHaveBeenCalledWith('Ответ потерян после сохранения');
		const firstPayload = vi.mocked(api.adjustUserWalletAdmin).mock.calls[0][2];
		expect(firstPayload).toEqual({
			delta_topup_kopeks: 125,
			delta_included_kopeks: 0,
			reason: 'confirmed reason',
			idempotency_key: 'confirmed-operation-key'
		});
		expect(document.querySelector<HTMLInputElement>('#wallet-adjust-reason')?.disabled).toBe(true);
		expect(document.querySelector<HTMLInputElement>('#wallet-delta-topup')?.disabled).toBe(true);
		expect(document.querySelector<HTMLInputElement>('#wallet-delta-included')?.disabled).toBe(true);
		await unmount(component);
		component = await open();
		expect(document.querySelector<HTMLInputElement>('#wallet-delta-topup')?.value).toBe('1.25');
		expect(document.querySelector<HTMLInputElement>('#wallet-adjust-reason')?.disabled).toBe(true);
		expect(sessionStorage.getItem('airis.wallet-adjustment:admin:fixture')).toBe(
			JSON.stringify(firstPayload)
		);
		// Force a stale DOM value: the retry still uses the frozen, confirmed payload.
		await fill('#wallet-adjust-reason', 'silently changed intent');
		button('Retry same adjustment').click();
		button('Retry same adjustment').click();
		await vi.waitFor(() => expect(api.adjustUserWalletAdmin).toHaveBeenCalledTimes(2));
		expect(vi.mocked(api.adjustUserWalletAdmin).mock.calls[1][2]).toEqual(firstPayload);
		expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
		await vi.waitFor(() =>
			expect(document.querySelector<HTMLInputElement>('#wallet-adjust-reason')?.disabled).toBe(
				false
			)
		);
		expect(sessionStorage.getItem('airis.wallet-adjustment:admin:fixture')).toBeNull();
	} finally {
		await unmount(component);
	}
});
