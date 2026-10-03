<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import { getPlansWithStats, type PlanStats } from '$lib/apis/admin/billing';
	import { formatReportMoney } from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	let stats: PlanStats | null = null;
	let loading = false;
	let error = '';
	let request = 0;
	let loadedId = '';
	let mounted = false;
	onDestroy(() => {
		request++;
		mounted = false;
	});
	const load = async (): Promise<void> => {
		const id = ++request;
		const selectedPlan = String($page.params.id);
		loadedId = selectedPlan;
		loading = true;
		error = '';
		try {
			const result = await getPlansWithStats(localStorage.token);
			if (id !== request || selectedPlan !== String($page.params.id)) return;
			stats = result.find((item) => item.plan.id === selectedPlan) || null;
			if (!stats) error = 'Plan not found';
		} catch {
			if (id === request) error = 'Failed to load analytics';
		} finally {
			if (id === request) loading = false;
		}
	};
	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		mounted = true;
		await load();
	});
	$: if (mounted && String($page.params.id) !== loadedId) {
		stats = null;
		void load();
	}
</script>

<svelte:head><title>{$i18n.t('Subscription overview')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full min-w-0 max-w-5xl px-4 py-5">
	<a href="/admin/billing/plans" class="text-sm underline">← {$i18n.t('Subscriptions')}</a>
	<h1 class="my-4 break-words text-xl font-semibold">
		{stats?.plan.name_ru || stats?.plan.name || $i18n.t('Subscription overview')}
	</h1>
	{#if loading}<p role="status">{$i18n.t('Loading')}</p>{/if}{#if error}<p
			role="alert"
			class="text-red-700"
		>
			{$i18n.t(error)}
			<button type="button" class="underline" on:click={load}>{$i18n.t('Retry')}</button>
		</p>{/if}
	{#if stats && !loading && !error}<dl class="grid gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
				<dt class="text-sm text-gray-500">{$i18n.t('Active subscriptions')}</dt>
				<dd class="mt-2 text-xl font-semibold">{stats.active_subscriptions}</dd>
			</div>
			<div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
				<dt class="text-sm text-gray-500">{$i18n.t('Canceled subscriptions')}</dt>
				<dd class="mt-2 text-xl font-semibold">{stats.canceled_subscriptions}</dd>
			</div>
			<div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
				<dt class="text-sm text-gray-500">{$i18n.t('Calculated monthly income')}</dt>
				<dd class="mt-2 break-words text-xl font-semibold">
					{formatReportMoney(Math.round(stats.mrr * 100), stats.plan.currency, $i18n.language)}
				</dd>
			</div>
		</dl>
		<p class="mt-3 text-sm text-gray-500">
			{$i18n.t(
				'Calculated from current plan price and active subscriptions; this is not actual payment history.'
			)}
		</p>
		<section class="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
			<h2 class="font-medium">{$i18n.t('Income history is not connected yet')}</h2>
			<p class="mt-2 text-sm text-gray-500">
				{$i18n.t(
					'Historical income and churn require complete period data. No demonstration values are shown.'
				)}
			</p>
		</section>
		<div class="mt-5 flex flex-wrap gap-3">
			<a href={`/admin/billing/plans/${stats.plan.id}/subscribers`} class="underline"
				>{$i18n.t('View subscribers')}</a
			><a href={`/admin/billing/plans/${stats.plan.id}/edit`} class="underline"
				>{$i18n.t('Edit Plan')}</a
			><a href="/admin/billing/transactions?tab=payments&kind=subscription" class="underline"
				>{$i18n.t('Subscription payments')}</a
			>
		</div>{/if}
</div>
