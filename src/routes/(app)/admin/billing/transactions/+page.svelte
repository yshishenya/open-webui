<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		getBillingReportingLedger,
		getBillingReportingPayments,
		getBillingReportingUsage,
		getBillingReportingExportUrl,
		type BillingReportingPayment,
		type BillingReportingRow
	} from '$lib/apis/admin/billing_reporting';

	const i18n = getContext<Readable<I18nType>>('i18n');
	let loaded = false;
	let loading = true;
	let errorMessage = '';
	let activeTab: 'payments' | 'ledger' | 'usage' = 'payments';
	let payments: BillingReportingPayment[] = [];
	let ledger: BillingReportingRow[] = [];
	let usage: BillingReportingRow[] = [];
	let page = 1;
	let totalPages = 1;
	let total = 0;
	let status = '';
	let userId = '';

	const money = (kopeks: number): string => new Intl.NumberFormat($i18n.language, { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(kopeks / 100);
	const dateTime = (value: number | null): string => (value ? new Date(value * 1000).toLocaleString($i18n.language) : '—');

	const load = async (): Promise<void> => {
		loading = true;
		errorMessage = '';
		try {
			if (activeTab === 'payments') {
				const result = await getBillingReportingPayments(localStorage.token, { page, page_size: 50, status: status || undefined, user_id: userId || undefined });
				payments = result.items; total = result.total; totalPages = Math.max(1, result.total_pages);
			} else if (activeTab === 'ledger') {
				const result = await getBillingReportingLedger(localStorage.token, { page, page_size: 50, user_id: userId || undefined });
				ledger = result.items; total = result.total; totalPages = Math.max(1, result.total_pages);
			} else {
				const result = await getBillingReportingUsage(localStorage.token, { page, page_size: 50, user_id: userId || undefined });
				usage = result.items; total = result.total; totalPages = Math.max(1, result.total_pages);
			}
		} catch (error) {
			console.error('Failed to load billing transactions:', error);
			errorMessage = $i18n.t('Failed to load billing transactions');
		} finally {
			loading = false;
		}
	};

	const selectTab = async (tab: typeof activeTab): Promise<void> => { activeTab = tab; page = 1; await load(); };
	const exportData = async (): Promise<void> => {
		try {
			const response = await fetch(getBillingReportingExportUrl({
				dataset: activeTab,
				user_id: userId || undefined,
				status: activeTab === 'payments' ? status || undefined : undefined
			}), { headers: { Authorization: `Bearer ${localStorage.token}` } });
			if (!response.ok) throw new Error(`Export failed (${response.status})`);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `billing-${activeTab}.csv`;
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to export billing transactions:', error);
			errorMessage = $i18n.t('Failed to export billing transactions');
		}
	};

	onMount(async () => { if ($user?.role !== 'admin') { await goto('/'); return; } await load(); loaded = true; });
</script>

<svelte:head><title>{$i18n.t('Billing transactions')} • {$WEBUI_NAME}</title></svelte:head>

{#if !loaded || loading}<div class="flex h-64 items-center justify-center"><Spinner className="size-5" /></div>{:else}<div class="mx-auto max-w-7xl px-4 py-5"><div class="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-xl font-semibold text-gray-900 dark:text-white">{$i18n.t('Transactions')}</h1><p class="mt-1 text-sm text-gray-500">{total} {$i18n.t('events in this view')}</p></div><div class="flex flex-wrap gap-2"><label class="sr-only" for="transaction-user">{$i18n.t('User ID')}</label><input id="transaction-user" bind:value={userId} placeholder={$i18n.t('Filter by user ID')} class="w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" on:change={() => { page = 1; load(); }} />{#if activeTab === 'payments'}<select bind:value={status} on:change={() => { page = 1; load(); }} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"><option value="">{$i18n.t('All statuses')}</option><option value="succeeded">{$i18n.t('succeeded')}</option><option value="pending">{$i18n.t('pending')}</option><option value="failed">{$i18n.t('failed')}</option><option value="canceled">{$i18n.t('canceled')}</option></select>{/if}<button on:click={exportData} class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">{$i18n.t('Export CSV')}</button></div></div>{#if errorMessage}<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{errorMessage} <button class="ml-2 underline" on:click={load}>{$i18n.t('Retry')}</button></div>{/if}<div class="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><div class="flex gap-1 border-b border-gray-200 p-2 dark:border-gray-800">{#each [['payments', 'Payments'], ['ledger', 'Wallet ledger'], ['usage', 'Usage charges']] as tab}<button class={`rounded-lg px-3 py-2 text-sm ${activeTab === tab[0] ? 'bg-gray-100 font-medium dark:bg-gray-800' : 'text-gray-500'}`} on:click={() => selectTab(tab[0] as typeof activeTab)}>{$i18n.t(tab[1])}</button>{/each}</div><div class="overflow-x-auto p-3">{#if activeTab === 'payments'}<table class="min-w-[900px] w-full text-left text-sm"><thead class="text-xs text-gray-500"><tr><th class="px-2 py-2">{$i18n.t('Time')}</th><th class="px-2 py-2">{$i18n.t('Customer')}</th><th class="px-2 py-2">{$i18n.t('Type')}</th><th class="px-2 py-2">{$i18n.t('Status')}</th><th class="px-2 py-2 text-right">{$i18n.t('Amount')}</th><th class="px-2 py-2">{$i18n.t('Provider')}</th><th class="px-2 py-2">ID</th></tr></thead><tbody>{#each payments as row}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="px-2 py-2 text-xs">{dateTime(row.processed_at)}</td><td class="px-2 py-2"><button class="text-left underline" on:click={() => goto(`/admin/billing/customers/${encodeURIComponent(row.user_id)}`)}>{row.user_id}</button></td><td class="px-2 py-2">{$i18n.t(row.kind)}</td><td class="px-2 py-2">{row.status}</td><td class="px-2 py-2 text-right tabular-nums">{money(row.amount_kopeks)}</td><td class="px-2 py-2">{row.provider}</td><td class="px-2 py-2 font-mono text-xs">{row.id}</td></tr>{:else}<tr><td colspan="7" class="px-2 py-8 text-center text-gray-500">{$i18n.t('No transactions')}</td></tr>{/each}</tbody></table>{:else if activeTab === 'ledger'}<table class="min-w-[950px] w-full text-left text-sm"><thead class="text-xs text-gray-500"><tr><th class="px-2 py-2">{$i18n.t('Time')}</th><th class="px-2 py-2">{$i18n.t('Customer')}</th><th class="px-2 py-2">{$i18n.t('Type')}</th><th class="px-2 py-2 text-right">{$i18n.t('Delta')}</th><th class="px-2 py-2 text-right">{$i18n.t('Balance after')}</th><th class="px-2 py-2">{$i18n.t('Reference')}</th></tr></thead><tbody>{#each ledger as row}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="px-2 py-2 text-xs">{dateTime(Number(row.created_at))}</td><td class="px-2 py-2">{row.name || row.user_id}</td><td class="px-2 py-2">{row.type}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(row.amount_kopeks))}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(row.balance_topup_after))}</td><td class="px-2 py-2 font-mono text-xs">{row.reference_id || '—'}</td></tr>{/each}</tbody></table>{:else}<table class="min-w-[1000px] w-full text-left text-sm"><thead class="text-xs text-gray-500"><tr><th class="px-2 py-2">{$i18n.t('Time')}</th><th class="px-2 py-2">{$i18n.t('Customer')}</th><th class="px-2 py-2">{$i18n.t('Model')}</th><th class="px-2 py-2">{$i18n.t('Modality')}</th><th class="px-2 py-2 text-right">{$i18n.t('Charged')}</th><th class="px-2 py-2">{$i18n.t('Source')}</th><th class="px-2 py-2">{$i18n.t('Request')}</th></tr></thead><tbody>{#each usage as row}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="px-2 py-2 text-xs">{dateTime(Number(row.created_at))}</td><td class="px-2 py-2">{row.name || row.user_id}</td><td class="px-2 py-2">{row.model_id}</td><td class="px-2 py-2">{row.modality}</td><td class="px-2 py-2 text-right tabular-nums">{money(Number(row.cost_charged_kopeks))}</td><td class="px-2 py-2">{row.billing_source}</td><td class="px-2 py-2 font-mono text-xs">{row.request_id}</td></tr>{/each}</tbody></table>{/if}</div><div class="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-800"><span class="text-gray-500">{$i18n.t('Page')} {page} / {totalPages}</span><div class="flex gap-2"><button disabled={page <= 1} on:click={() => { page -= 1; load(); }} class="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">{$i18n.t('Previous')}</button><button disabled={page >= totalPages} on:click={() => { page += 1; load(); }} class="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">{$i18n.t('Next')}</button></div></div></div></div>{/if}
