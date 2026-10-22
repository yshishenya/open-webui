// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount, type ComponentProps } from 'svelte';
import { writable } from 'svelte/store';
import { formatReportMoney, formatReportTime } from '$lib/utils/airis/billing_reporting_ui';
import ReportingRecords from './ReportingRecords.svelte';

const payment = {
	id: 'payment',
	user_id: 'customer',
	name: 'Customer',
	kind: 'topup',
	status: 'succeeded',
	amount_kopeks: 123456,
	currency: 'USD',
	provider: 'yookassa',
	provider_payment_id: 'provider',
	processed_at: 1790812800,
	created_at: 1790812800,
	credited_at: 1790812800,
	credit_status: 'credited' as const,
	is_test: false,
	refunded_kopeks: 250,
	source: 'billing_payment',
	wallet_id: 'wallet',
	subscription_id: null
};
const cases: Array<ComponentProps<typeof ReportingRecords>> = [
	{ dataset: 'payments', payments: [payment] },
	{
		dataset: 'refunds',
		refunds: [
			{
				id: 'refund',
				payment_id: 'payment',
				user_id: 'customer',
				name: 'Customer',
				amount_kopeks: 123456,
				currency: 'USD',
				occurred_at: 1790812800,
				wallet_reflection: 'requires_verification'
			}
		]
	},
	{
		dataset: 'usage',
		currency: 'USD',
		rows: [
			{
				id: 'usage',
				created_at: 1790812800,
				model_id: 'model',
				request_id: 'request',
				cost_charged_kopeks: 123456,
				cost_charged_input_kopeks: 250
			}
		]
	},
	{
		dataset: 'ledger',
		currency: 'USD',
		rows: [
			{
				id: 'ledger',
				created_at: 1790812800,
				type: 'adjustment',
				amount_kopeks: 123456,
				balance_topup_after: 123456,
				balance_included_after: 0,
				delta_topup_kopeks: 250
			}
		]
	}
];

it.each(cases)(
	'updates $dataset dates and amounts on RU → EN → RU without replacing rows',
	async (props) => {
		const selected = createInstance();
		await selected.init({
			lng: 'ru-RU',
			fallbackLng: 'en-US',
			resources: {
				'ru-RU': { translation: { Details: 'Подробности' } },
				'en-US': { translation: { Details: 'Details' } }
			}
		});
		const language = writable(selected);
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(ReportingRecords, {
			target,
			props,
			context: new Map([['i18n', language]])
		});
		try {
			for (const locale of ['ru-RU', 'en-US', 'ru-RU']) {
				await selected.changeLanguage(locale);
				language.set(selected);
				await tick();
				expect(target.querySelector('tbody tr td')?.textContent?.trim()).toBe(
					formatReportTime(1790812800, locale)
				);
				expect(target.querySelector('tbody tr td:nth-child(4)')?.textContent).toContain(
					formatReportMoney(123456, 'USD', locale)
				);
				if (props.dataset !== 'refunds') {
					expect(target.querySelector('details')?.textContent).toContain(
						formatReportMoney(250, 'USD', locale)
					);
				}
			}
			// Requested language can differ from the loaded translation language.
			await selected.changeLanguage('unavailable');
			language.set(selected);
			await tick();
			expect(selected.resolvedLanguage).toBe('en-US');
			expect(target.querySelector('tbody tr td:nth-child(4)')?.textContent).toContain(
				formatReportMoney(123456, 'USD', 'en-US')
			);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it('never presents an unknown payment status as confirmed', async () => {
	const target = document.createElement('div');
	const component = mount(ReportingRecords, {
		target,
		props: { payments: [{ ...payment, status: 'future_status', credit_status: 'not_credited' }] },
		context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
	});
	try {
		await tick();
		expect(target.textContent).toContain('Status unavailable');
		expect(target.textContent).not.toContain('Payment confirmed');
	} finally {
		await unmount(component);
	}
});
