// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount, type ComponentProps } from 'svelte';
import { writable } from 'svelte/store';
import type { BillingReportingPayment } from '$lib/apis/admin/billing_reporting';
import ReportingRecords from './ReportingRecords.svelte';

it('confirms only positive refunds and shows unavailable data separately from zero', async () => {
	const payments: BillingReportingPayment[] = [0, '0', 2500, 50000, 'invalid'].map(
		(value, index) => ({
			id: `payment-${index}`,
			user_id: 'customer',
			name: 'Customer',
			kind: 'topup',
			status: 'succeeded',
			amount_kopeks: 50000,
			currency: 'RUB',
			provider: 'yookassa',
			provider_payment_id: null,
			processed_at: 100,
			created_at: 100,
			credited_at: 100,
			credit_status: 'credited',
			is_test: false,
			// Exercise malformed and legacy JSON values at the component boundary.
			refunded_kopeks: value as number,
			source: 'billing_payment',
			wallet_id: null,
			subscription_id: null
		})
	);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(ReportingRecords, {
		target,
		props: { payments },
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await tick();
		const details = Array.from(target.querySelectorAll('tbody tr details'));
		for (const index of [0, 1]) expect(details[index].textContent).not.toContain('Refunds');
		for (const index of [2, 3]) {
			expect(details[index].textContent).toContain(
				'Refund confirmed; wallet reflection requires verification'
			);
		}
		expect(details[2].textContent).toContain('25,00');
		expect(details[3].textContent).toContain('500,00');
		expect(details[4].textContent).toContain('Status unavailable');
		expect(details[4].textContent).not.toContain('Refund confirmed');
	} finally {
		await unmount(component);
		target.remove();
	}
});

const payment: BillingReportingPayment = {
	id: 'payment',
	user_id: 'customer',
	name: 'Customer',
	kind: 'topup',
	status: 'succeeded',
	amount_kopeks: 1000,
	currency: 'RUB',
	provider: 'yookassa',
	provider_payment_id: 'provider-payment',
	processed_at: 100,
	created_at: 90,
	credited_at: 100,
	credit_status: 'credited',
	is_test: false,
	refunded_kopeks: 0,
	source: 'billing_payment',
	wallet_id: 'wallet',
	subscription_id: null
};
const render = async (
	props: ComponentProps<typeof ReportingRecords>
): Promise<{
	target: HTMLDivElement;
	cleanup: () => Promise<void>;
}> => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(ReportingRecords, {
		target,
		props,
		context: new Map([['i18n', writable({ language: 'en', t: (key: string): string => key })]])
	});
	await tick();
	return {
		target,
		cleanup: async (): Promise<void> => {
			await unmount(component);
			target.remove();
		}
	};
};
const field = (target: HTMLElement, label: string): string | null | undefined =>
	Array.from(target.querySelectorAll('dt')).find((node) => node.textContent === label)
		?.nextElementSibling?.textContent;

describe('refund amount compatibility at the reporting boundary', () => {
	it.each([0, '0', '00'])('does not confirm a zero refund (%s)', async (value) => {
		const { target, cleanup } = await render({
			payments: [{ ...payment, refunded_kopeks: value as unknown as number }]
		});
		try {
			expect(target.textContent).not.toContain('Refund confirmed');
			expect(field(target, 'Refunds')).toBeUndefined();
		} finally {
			await cleanup();
		}
	});
	it.each([250, '250', 1000])(
		'keeps the partial/full refund wallet warning (%s)',
		async (value) => {
			const { target, cleanup } = await render({
				payments: [{ ...payment, refunded_kopeks: value as unknown as number }]
			});
			try {
				expect(field(target, 'Refunds')).toContain(
					'Refund confirmed; wallet reflection requires verification'
				);
				expect(field(target, 'Provider payment ID')).toBe('provider-payment');
			} finally {
				await cleanup();
			}
		}
	);
	it.each([null, undefined, '', 'invalid', NaN, Infinity, -1, true, '0.5'])(
		'marks unavailable data explicitly (%s)',
		async (value) => {
			const { target, cleanup } = await render({
				payments: [{ ...payment, refunded_kopeks: value as unknown as number }]
			});
			try {
				expect(field(target, 'Refunds')).toBe('Status unavailable');
				expect(target.textContent).not.toContain('Refund confirmed');
			} finally {
				await cleanup();
			}
		}
	);
});

it('explains usage with saved quantities, price parts and references, without pricing requests', async () => {
	const { target, cleanup } = await render({
		dataset: 'usage',
		currency: 'EUR',
		rows: [
			{
				id: 'usage',
				user_id: 'customer',
				created_at: 100,
				request_id: 'request',
				model_id: 'model',
				modality: 'text',
				billing_source: 'payg',
				prompt_tokens: 1200,
				completion_tokens: 30,
				cost_charged_kopeks: 250,
				cost_charged_input_kopeks: 200,
				cost_charged_output_kopeks: 50,
				cost_raw_kopeks: 500,
				cost_raw_input_kopeks: 400,
				cost_raw_output_kopeks: 100,
				is_estimated: true,
				estimate_reason: 'usage_missing',
				pricing_version: 'saved-version',
				pricing_rate_card_input_id: 'saved-input',
				pricing_rate_card_output_id: 'saved-output'
			}
		]
	});
	try {
		expect(field(target, 'Input tokens')).toBe('1200');
		expect(field(target, 'Output tokens')).toBe('30');
		expect(field(target, 'Customer input charge')).toContain('€2.00');
		expect(field(target, 'Customer output charge')).toContain('€0.50');
		expect(field(target, 'Base price before discounts')).toContain('€5.00');
		expect(field(target, 'Estimate reason')).toContain('usage_missing');
		expect(field(target, 'Estimate reason')).toContain(
			'The provider did not return usage; the saved estimate was used.'
		);
		expect(field(target, 'Saved input rate reference')).toBe('saved-input');
		expect(target.textContent).toContain('Historical rate is unavailable in these details');
		expect(target.textContent).toContain('Stored base prices are not provider costs.');
	} finally {
		await cleanup();
	}
});

it('does not replace missing saved costs with zero; preserves zero quantities and audio units', async () => {
	const { target, cleanup } = await render({
		dataset: 'usage',
		rows: [
			{
				id: 'audio',
				created_at: 100,
				modality: 'tts',
				billing_source: 'lead_magnet',
				cost_charged_kopeks: 0,
				measured_units: 0,
				measured_unit: 'tts_char',
				tts_seconds: 1.5
			}
		]
	});
	try {
		expect(field(target, 'Customer input charge')).toBe('Not recorded');
		expect(field(target, 'Base price before discounts')).toBe('Not recorded');
		expect(field(target, 'Saved units')).toMatch(/^\s*0\s*·\s*tts_char\s*$/);
		expect(field(target, 'Speech synthesis seconds')).toBe('1.5');
		expect(field(target, 'Billing source')?.trim()).toBe('Free allowance');
	} finally {
		await cleanup();
	}
});

it('keeps provider refund ID and the exact original payment navigation separate from wallet reconciliation', async () => {
	const onPayment = vi.fn();
	const { target, cleanup } = await render({
		dataset: 'refunds',
		onPayment,
		refunds: [
			{
				id: 'provider-refund',
				payment_id: 'original-payment',
				user_id: 'customer',
				name: 'Customer',
				amount_kopeks: 250,
				currency: 'RUB',
				occurred_at: 100,
				wallet_reflection: 'requires_verification'
			}
		]
	});
	try {
		expect(target.textContent).toContain('Provider refund ID: provider-refund');
		const buttons = target.querySelectorAll('button');
		expect(buttons).toHaveLength(1);
		buttons[0].click();
		expect(onPayment).toHaveBeenCalledWith('customer', 'original-payment');
	} finally {
		await cleanup();
	}
});

it('shows saved adjustment author, reason and signed balance parts without financial actions', async () => {
	const { target, cleanup } = await render({
		dataset: 'ledger',
		rows: [
			{
				id: 'adjustment',
				user_id: 'customer',
				created_at: 100,
				type: 'adjustment',
				amount_kopeks: -200,
				balance_topup_after: 500,
				balance_included_after: 100,
				reference_id: 'intent',
				admin_user_id: 'admin',
				adjustment_reason: 'Correction',
				delta_topup_kopeks: -300,
				delta_included_kopeks: 100
			}
		]
	});
	try {
		expect(field(target, 'Adjustment author ID')).toBe('admin');
		expect(field(target, 'Adjustment reason')).toBe('Correction');
		expect(field(target, 'Paid balance change')).toContain('-');
		expect(field(target, 'Reference')).toBe('intent');
		expect(target.querySelectorAll('button')).toHaveLength(0);
	} finally {
		await cleanup();
	}
});
