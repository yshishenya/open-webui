<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		getBillingReportingCustomer,
		type BillingReportingCustomerDetail
	} from '$lib/apis/admin/billing_reporting';

	const i18n = getContext<Readable<I18nType>>('i18n');
	let loaded = false;
	let loading = true;
	let errorMessage = '';
	let detail: BillingReportingCustomerDetail | null = null;
	let activeTab: 'payments' | 'ledger' | 'usage' = 'payments';

	const money = (kopeks: number): string =>
		new Intl.NumberFormat($i18n.language, { style: 'currency', currency: detail?.wallet.currency ?? 'RUB', maximumFractionDigits: 2 }).format(
			kopeks / 100
		);
	const dateTime = (value: number | null): string => (value ? new Date(value * 1000).toLocaleString($i18n.language) : '—');

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		try {
			const customerId = String($page.params.id ?? '');
			if (!customerId) throw new Error('Missing customer id');
			detail = await getBillingReportingCustomer(localStorage.token, customerId);
		} catch (error) {
			console.error('Failed to load billing customer:', error);
			errorMessage = $i18n.t('Failed to load customer financial profile');
		} finally {
			loading = false;
			loaded = true;
		}
	});
</script>

<svelte:head><title>{$i18n.t('Customer financial profile')} • {$WEBUI_NAME}</title></svelte:head>

{#if !loaded || loading}
	<div class="flex h-64 items-center justify-center"><Spinner className="size-5" /></div>
{:else if errorMessage}
	<div class="mx-auto max-w-5xl px-4 py-8"><div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{errorMessage}</div></div>
{:else if detail}
	<div class="mx-auto max-w-7xl px-4 py-5">
		<button class="mb-4 text-sm text-gray-500 underline" on:click={() => goto('/admin/billing/customers')}>← {$i18n.t('Back to customers')}</button>
		<div class="flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-xl font-semibold text-gray-900 dark:text-white">{detail.user.name}</h1><p class="text-sm text-gray-500">{detail.user.email} · {detail.user.id}</p></div><span class="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{detail.user.role}</span></div>
		<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"><div class="text-xs text-gray-500">{$i18n.t('Paid lifetime')}</div><div class="mt-2 font-semibold tabular-nums">{money(detail.metrics.paid_kopeks)}</div></div><div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"><div class="text-xs text-gray-500">{$i18n.t('Spent lifetime')}</div><div class="mt-2 font-semibold tabular-nums">{money(detail.metrics.spent_kopeks)}</div></div><div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"><div class="text-xs text-gray-500">{$i18n.t('Paid balance')}</div><div class="mt-2 font-semibold tabular-nums">{money(detail.wallet.balance_topup_kopeks)}</div></div><div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"><div class="text-xs text-gray-500">{$i18n.t('Bonus balance')}</div><div class="mt-2 font-semibold tabular-nums text-amber-600">{money(detail.wallet.balance_included_kopeks)}</div></div><div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"><div class="text-xs text-gray-500">{$i18n.t('Daily usage')}</div><div class="mt-2 font-semibold tabular-nums">{money(detail.wallet.daily_spent_kopeks)}</div></div></div>
		<div class="mt-5 rounded-xl border border-gray-200 dark:border-gray-800"><div class="flex gap-1 overflow-x-auto border-b border-gray-200 p-2 dark:border-gray-800">{#each [['payments', 'Payments'], ['ledger', 'Wallet ledger'], ['usage', 'Usage']] as tab}<button class={`rounded-lg px-3 py-2 text-sm ${activeTab === tab[0] ? 'bg-gray-100 font-medium dark:bg-gray-800' : 'text-gray-500'}`} on:click={() => (activeTab = tab[0] as typeof activeTab)}>{ $i18n.t(tab[1]) } <span class="ml-1 text-xs text-gray-400">{tab[0] === 'payments' ? detail.payments.length : tab[0] === 'ledger' ? detail.ledger.length : detail.usage.length}</span></button>{/each}</div>
			<div class="overflow-x-auto p-3">
				{#if activeTab === 'payments'}<table class="min-w-[850px] w-full text-left text-sm"><thead class="text-xs text-gray-500"><tr><th class="px-2 py-2">{$i18n.t('Time')}</th><th class="px-2 py-2">{$i18n.t('Type')}</th><th class="px-2 py-2">{$i18n.t('Status')}</th><th class="px-2 py-2 text-right">{$i18n.t('Amount')}</th><th class="px-2 py-2">{$i18n.t('Provider')}</th><th class="px-2 py-2">ID</th></tr></thead><tbody>{#each detail.payments as payment}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="px-2 py-2 text-xs">{dateTime(payment.processed_at)}</td><td class="px-2 py-2">{$i18n.t(payment.kind)}</td><td class="px-2 py-2">{payment.status}</td><td class="px-2 py-2 text-right tabular-nums">{money(payment.amount_kopeks)}</td><td class="px-2 py-2">{payment.provider}</td><td class="px-2 py-2 font-mono text-xs">{payment.id}</td></tr>{:else}<tr><td colspan="6" class="px-2 py-8 text-center text-gray-500">{$i18n.t('No payments')}</td></tr>{/each}</tbody></table>{:else if activeTab === 'ledger'}<table class="min-w-[850px] w-full text-left text-sm"><thead class="text-xs text-gray-500"><tr><th class="px-2 py-2">{$i18n.t('Time')}</th><th class="px-2 py-2">{$i18n.t('Type')}</th><th class="px-2 py-2 text-right">{$i18n.t('Delta')}</th><th class="px-2 py-2 text-right">{$i18n.t('Paid balance after')}</th><th class="px-2 py-2 text-right">{$i18n.t('Bonus after')}</th><th class="px-2 py-2">{$i18n.t('Reference')}</th></tr></thead><tbody>{#each detail.ledger as entry}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="px-2 py-2 text-xs">{dateTime(Number(entry.created_at))}</td><td class="px-2 py-2">{entry.type}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(entry.amount_kopeks))}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(entry.balance_topup_after))}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(entry.balance_included_after))}</td><td class="px-2 py-2 font-mono text-xs">{entry.reference_id ?? '—'}</td></tr>{/each}</tbody></table>{:else}<table class="min-w-[950px] w-full text-left text-sm"><thead class="text-xs text-gray-500"><tr><th class="px-2 py-2">{$i18n.t('Time')}</th><th class="px-2 py-2">{$i18n.t('Model')}</th><th class="px-2 py-2">{$i18n.t('Modality')}</th><th class="px-2 py-2 text-right">{$i18n.t('Charged')}</th><th class="px-2 py-2">{$i18n.t('Source')}</th><th class="px-2 py-2">{$i18n.t('Request')}</th></tr></thead><tbody>{#each detail.usage as event}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="px-2 py-2 text-xs">{dateTime(Number(event.created_at))}</td><td class="px-2 py-2">{event.model_id}</td><td class="px-2 py-2">{event.modality}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(event.cost_charged_kopeks))}</td><td class="px-2 py-2">{event.billing_source}</td><td class="px-2 py-2 font-mono text-xs">{event.request_id}</td></tr>{/each}</tbody></table>{/if}
			</div>
		</div>
		<p class="mt-3 text-xs text-gray-400">{$i18n.t('Payment time uses processed_at fallback until provider paid_at is persisted. Raw provider payloads and payment method identifiers are intentionally hidden.')}</p>
	</div>
{/if}
