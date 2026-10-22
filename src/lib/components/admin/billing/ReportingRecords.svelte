<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import {
		formatReportMoney,
		formatReportTime,
		reportRefundKopeks,
		paymentLabel,
		ledgerLabel,
		modalityLabel
	} from '$lib/utils/airis/billing_reporting_ui';
	import type {
		BillingReportingPayment,
		BillingReportingRow,
		BillingReportingRefund
	} from '$lib/apis/admin/billing_reporting';
	const i18n = getContext<Readable<I18nType>>('i18n');
	export let dataset: 'payments' | 'refunds' | 'usage' | 'ledger' = 'payments';
	export let payments: BillingReportingPayment[] = [];
	export let refunds: BillingReportingRefund[] = [];
	export let rows: BillingReportingRow[] = [];
	export let currency = 'RUB';
	export let onCustomer: ((id: string) => void) | undefined = undefined;
	export let onPayment: ((customerId: string, paymentId: string) => void) | undefined = undefined;
	export let onUsageLedger: ((customerId: string, requestId: string) => void) | undefined =
		undefined;
	export let loading = false;
	export let error = false;
	$: locale = getI18nLocale($i18n);
	const money = (value: number, locale: string, code = currency): string =>
		formatReportMoney(value, code, locale);
	const time = (value: number | null | undefined, locale: string): string =>
		formatReportTime(value, locale);
	const str = (row: BillingReportingRow, key: string): string =>
		typeof row[key] === 'string' ? String(row[key]) : '';
	const savedMoney = (row: BillingReportingRow, key: string, locale: string): string =>
		typeof row[key] === 'number' && Number.isSafeInteger(row[key])
			? money(Number(row[key]), locale, str(row, 'currency') || currency)
			: $i18n.t('Not recorded');
	const credit = (payment: BillingReportingPayment): string =>
		payment.credit_status === 'credited'
			? 'Wallet credited'
			: payment.kind === 'topup' && payment.status === 'succeeded'
				? 'Payment confirmed but wallet credit not found'
				: payment.kind === 'topup'
					? 'Wallet not credited'
					: 'Subscription payment';
</script>

{#if dataset === 'ledger'}<p class="mb-3 text-sm text-gray-500">
		{$i18n.t(
			'Technical entries change the available balance. A zero settlement entry does not mean free usage.'
		)}
	</p>{/if}
<div class="md:overflow-x-auto md:rounded-xl md:border md:border-gray-200 dark:md:border-gray-800">
	<table class="reporting-records w-full md:min-w-[650px] text-left text-sm">
		<thead class="text-xs text-gray-500"
			><tr
				><th scope="col" class="p-3">{$i18n.t('Time')} · UTC</th><th scope="col" class="p-3"
					>{$i18n.t('Customer')}</th
				><th scope="col" class="p-3">{$i18n.t(dataset === 'usage' ? 'Model' : 'Operation')}</th><th
					scope="col"
					class="p-3 text-right">{$i18n.t(dataset === 'ledger' ? 'Balance change' : 'Amount')}</th
				><th scope="col" class="p-3">{$i18n.t('Details')}</th></tr
			></thead
		><tbody>
			{#if dataset === 'payments'}
				{#each payments as row}{@const refundedKopeks = reportRefundKopeks(row.refunded_kopeks)}<tr
						class="border-t border-gray-100 dark:border-gray-800"
						><td data-label="{$i18n.t('Time')} · UTC" class="p-3 text-xs"
							>{time(row.processed_at, locale)}</td
						><td data-label={$i18n.t('Customer')} class="p-3"
							>{#if onCustomer}<button
									type="button"
									class="min-h-11 text-left underline"
									on:click={() => onCustomer?.(row.user_id)}
									>{row.name?.trim() || row.user_id}</button
								>{:else}{row.name?.trim() || row.user_id}{/if}</td
						><td data-label={$i18n.t('Operation')} class="p-3"
							>{$i18n.t(row.kind === 'topup' ? 'Wallet top-up' : 'Subscription payment')}
							<div class="mt-1 text-xs text-gray-500">{$i18n.t(paymentLabel(row.status))}</div>
							<div class="mt-1 text-xs">{$i18n.t(credit(row))}</div></td
						><td data-label={$i18n.t('Amount')} class="p-3 text-right tabular-nums"
							>{money(row.amount_kopeks, locale, row.currency)}</td
						><td data-label={$i18n.t('Details')} class="p-3"
							><details>
								<summary class="min-h-11 cursor-pointer content-center"
									>{$i18n.t('Details')}</summary
								>
								<dl class="mt-2 space-y-2 text-xs">
									<div>
										<dt>{$i18n.t('Created')}</dt>
										<dd>{time(row.created_at, locale)}</dd>
									</div>
									<div>
										<dt>{$i18n.t('Wallet credit time')}</dt>
										<dd>{time(row.credited_at, locale)}</dd>
									</div>
									<div>
										<dt>{$i18n.t('Provider')}</dt>
										<dd>{row.provider}</dd>
									</div>
									<div>
										<dt>ID</dt>
										<dd class="break-all">{row.id}</dd>
									</div>
									<div>
										<dt>{$i18n.t('Provider payment ID')}</dt>
										<dd class="break-all">{row.provider_payment_id || $i18n.t('Not recorded')}</dd>
									</div>
									{#if refundedKopeks === null}<div>
											<dt>{$i18n.t('Refunds')}</dt>
											<dd>{$i18n.t('Status unavailable')}</dd>
										</div>{:else if refundedKopeks > 0}<div>
											<dt>{$i18n.t('Refunds')}</dt>
											<dd>
												{money(refundedKopeks, locale, row.currency)} · {$i18n.t(
													'Refund confirmed; wallet reflection requires verification'
												)}
											</dd>
										</div>{/if}{#if row.is_test}<div>{$i18n.t('Test payment')}</div>{/if}
								</dl>
							</details></td
						></tr
					>{/each}
			{:else if dataset === 'refunds'}
				{#each refunds as row}<tr class="border-t border-gray-100 dark:border-gray-800"
						><td data-label="{$i18n.t('Time')} · UTC" class="p-3 text-xs"
							>{time(row.occurred_at, locale)}</td
						><td data-label={$i18n.t('Customer')} class="p-3"
							>{#if onCustomer}<button
									type="button"
									class="min-h-11 underline"
									on:click={() => onCustomer?.(row.user_id)}
									>{row.name?.trim() || row.user_id}</button
								>{:else}{row.name?.trim() || row.user_id}{/if}</td
						><td data-label={$i18n.t('Operation')} class="p-3">{$i18n.t('Payment refund')}</td><td
							data-label={$i18n.t('Amount')}
							class="p-3 text-right tabular-nums"
							>{money(row.amount_kopeks, locale, row.currency)}</td
						><td data-label={$i18n.t('Details')} class="p-3"
							><details>
								<summary class="min-h-11 cursor-pointer content-center"
									>{$i18n.t('Refund confirmed; wallet reflection requires verification')}</summary
								>
								<p class="mt-2 break-all text-xs">
									{$i18n.t('Payment')}: {row.payment_id} · {$i18n.t('Provider refund ID')}: {row.id}
								</p>
								{#if onPayment}<button
										type="button"
										class="min-h-11 text-sm underline"
										on:click={() => onPayment?.(row.user_id, row.payment_id)}
										>{$i18n.t('Open original payment')}</button
									>{/if}
							</details></td
						></tr
					>{/each}
			{:else}
				{#each rows as row}<tr class="border-t border-gray-100 dark:border-gray-800"
						><td data-label="{$i18n.t('Time')} · UTC" class="p-3 text-xs"
							>{time(Number(row.created_at), locale)}</td
						><td data-label={$i18n.t('Customer')} class="p-3"
							>{#if onCustomer}<button
									type="button"
									class="min-h-11 underline"
									on:click={() => onCustomer?.(str(row, 'user_id'))}
									>{row.name || row.user_id}</button
								>{:else}{row.name || row.user_id}{/if}</td
						><td data-label={$i18n.t(dataset === 'usage' ? 'Model' : 'Operation')} class="p-3"
							>{dataset === 'usage'
								? row.model_id
								: $i18n.t(ledgerLabel(str(row, 'type')))}{#if dataset === 'usage'}<div
									class="mt-1 text-xs text-gray-500"
								>
									{$i18n.t(modalityLabel(str(row, 'modality')))}
								</div>{/if}</td
						><td
							data-label={$i18n.t(dataset === 'ledger' ? 'Balance change' : 'Amount')}
							class="p-3 text-right tabular-nums"
							>{money(
								Number(dataset === 'usage' ? row.cost_charged_kopeks : row.amount_kopeks),
								locale,
								str(row, 'currency') || currency
							)}{#if dataset === 'usage'}<div class="mt-1 text-xs text-gray-500">
									{$i18n.t(
										row.billing_source === 'lead_magnet'
											? 'Free allowance'
											: row.is_estimated
												? 'Charged from an estimate'
												: 'Final usage charge'
									)}
								</div>{/if}</td
						><td data-label={$i18n.t('Details')} class="p-3"
							><details>
								<summary class="min-h-11 cursor-pointer content-center"
									>{$i18n.t('Calculation details')}</summary
								>
								<dl class="mt-2 space-y-2 text-xs">
									{#if dataset === 'ledger'}<div>
											<dt>{$i18n.t('Paid balance after')}</dt>
											<dd>{money(Number(row.balance_topup_after), locale)}</dd>
										</div>
										<div>
											<dt>{$i18n.t('Bonus after')}</dt>
											<dd>{money(Number(row.balance_included_after), locale)}</dd>
										</div>
										<div>
											<dt>{$i18n.t('Reference')}</dt>
											<dd class="break-all">{row.reference_id || '—'}</dd>
										</div>
										{#if row.type === 'adjustment'}
											{#each [['Adjustment author ID', 'admin_user_id'], ['Adjustment reason', 'adjustment_reason']] as [label, key]}
												<div>
													<dt>{$i18n.t(label)}</dt>
													<dd class="break-all">{row[key] || $i18n.t('Not recorded')}</dd>
												</div>
											{/each}
											{#each [['Paid balance change', 'delta_topup_kopeks'], ['Bonus balance change', 'delta_included_kopeks']] as [label, key]}
												<div>
													<dt>{$i18n.t(label)}</dt>
													<dd>{savedMoney(row, key, locale)}</dd>
												</div>
											{/each}
										{/if}
										<div>
											<dt>ID</dt>
											<dd class="break-all">{row.id}</dd>
										</div>
									{:else}<div>
											<dt>{$i18n.t('Request')}</dt>
											<dd class="break-all">
												{row.request_id}
												{#if onUsageLedger && str(row, 'request_id')}<button
														type="button"
														class="min-h-11 text-sm underline"
														on:click={() =>
															onUsageLedger?.(str(row, 'user_id'), str(row, 'request_id'))}
														>{$i18n.t('Open related wallet records')}</button
													>{/if}
											</dd>
										</div>
										<div>
											<dt>{$i18n.t('Billing source')}</dt>
											<dd>
												{$i18n.t(
													row.billing_source === 'payg'
														? 'Wallet'
														: row.billing_source === 'lead_magnet'
															? 'Free allowance'
															: row.billing_source === 'subscription'
																? 'Subscription'
																: str(row, 'billing_source')
												)}
											</dd>
										</div>
										{#each [['Input tokens', 'prompt_tokens'], ['Output tokens', 'completion_tokens'], ['Images', 'measured_count'], ['Requested images', 'requested_count'], ['Characters', 'char_count'], ['Speech synthesis seconds', 'tts_seconds'], ['Speech recognition seconds', 'stt_seconds'], ['Saved units', 'measured_units']] as [label, key]}
											{#if typeof row[key] === 'number'}<div>
													<dt>{$i18n.t(label)}</dt>
													<dd>
														{row[key]}{#if key === 'measured_units' && row.measured_unit}
															· {row.measured_unit}{/if}
													</dd>
												</div>{/if}
										{/each}
										{#each [['Customer input charge', 'cost_charged_input_kopeks'], ['Customer output charge', 'cost_charged_output_kopeks'], ['Base price before discounts', 'cost_raw_kopeks'], ['Input price before discounts', 'cost_raw_input_kopeks'], ['Output price before discounts', 'cost_raw_output_kopeks']] as [label, key]}
											<div>
												<dt>{$i18n.t(label)}</dt>
												<dd>{savedMoney(row, key, locale)}</dd>
											</div>
										{/each}
										<div>{$i18n.t('Stored base prices are not provider costs.')}</div>
										<div>
											<dt>{$i18n.t('Provider')}</dt>
											<dd>{row.provider || $i18n.t('Not recorded')}</dd>
										</div>
										{#if row.is_estimated}<div>
												<dt>{$i18n.t('Estimate reason')}</dt>
												<dd class="break-all">
													{row.estimate_reason ||
														$i18n.t('Not recorded')}{#if row.estimate_reason === 'usage_missing'}
														· {$i18n.t(
															'The provider did not return usage; the saved estimate was used.'
														)}{/if}
												</dd>
											</div>{/if}
										<div>{$i18n.t('Historical rate is unavailable in these details')}</div>
										{#each [['Saved pricing version', 'pricing_version'], ['Saved rate reference', 'pricing_rate_card_id'], ['Saved input rate reference', 'pricing_rate_card_input_id'], ['Saved output rate reference', 'pricing_rate_card_output_id']] as [label, key]}
											{#if row[key]}<div>
													<dt>{$i18n.t(label)}</dt>
													<dd class="break-all">{row[key]}</dd>
												</div>{/if}
										{/each}
										<div>
											<dt>ID</dt>
											<dd class="break-all">{row.id}</dd>
										</div>
									{/if}
								</dl>
							</details></td
						></tr
					>{/each}
			{/if}
			{#if !loading && !error && (dataset === 'payments' ? payments.length === 0 : dataset === 'refunds' ? refunds.length === 0 : rows.length === 0)}<tr
					><td colspan="5" class="p-8 text-center text-gray-500"
						>{$i18n.t('No operations in this period')}</td
					></tr
				>{/if}
		</tbody>
	</table>
</div>

<style>
	@media (max-width: 767px) {
		.reporting-records {
			position: relative;
			display: block;
		}
		.reporting-records thead {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}
		.reporting-records tbody {
			display: grid;
			gap: 0.75rem;
		}
		.reporting-records tr {
			display: block;
			min-width: 0;
			border-width: 1px;
			border-radius: 0.75rem;
			padding: 0.75rem 1rem;
		}
		.reporting-records td {
			display: block;
			padding: 0.375rem 0;
			text-align: left;
			overflow-wrap: anywhere;
		}
		.reporting-records td[data-label]::before {
			content: attr(data-label);
			display: block;
			margin-bottom: 0.125rem;
			font-size: 0.75rem;
			font-weight: 400;
			opacity: 0.65;
		}
		.reporting-records td:nth-child(4) {
			font-size: 1.125rem;
			font-weight: 600;
		}
	}
</style>
