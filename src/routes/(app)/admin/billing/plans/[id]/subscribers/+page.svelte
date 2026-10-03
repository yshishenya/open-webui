<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { page as route } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import {
		getPlan,
		getPlanSubscribers,
		type Plan,
		type PlanSubscriber
	} from '$lib/apis/admin/billing';
	import ReportingPagination from '$lib/components/admin/billing/ReportingPagination.svelte';
	import {
		formatReportTime,
		moneyPage,
		moneyFilters,
		customerHref
	} from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	let plan: Plan | null = null;
	let rows: PlanSubscriber[] = [];
	let page = moneyPage($route.url.searchParams.get('page'));
	let total = 0;
	let totalPages = 1;
	let loading = false;
	let error = '';
	let request = 0;
	onDestroy(() => {
		request++;
		mounted = false;
	});
	let planId = String($route.params.id);
	let mounted = false;
	const load = async (): Promise<void> => {
		const id = ++request;
		const selectedPlan = planId;
		loading = true;
		error = '';
		rows = [];
		try {
			const [nextPlan, result] = await Promise.all([
				getPlan(localStorage.token, selectedPlan),
				getPlanSubscribers(localStorage.token, selectedPlan, page, 20)
			]);
			if (id !== request || selectedPlan !== String($route.params.id)) return;
			plan = nextPlan;
			rows = result.items;
			total = result.total;
			totalPages = Math.max(1, result.total_pages);
			await goto(`?page=${page}`, { replaceState: true, noScroll: true, keepFocus: true });
		} catch {
			if (id === request) error = 'Failed to load subscribers';
		} finally {
			if (id === request) loading = false;
		}
	};
	const state = (value: string): string =>
		(
			({
				active: 'Active',
				canceled: 'Canceled',
				trialing: 'Trial',
				past_due: 'Past Due',
				incomplete: 'Incomplete',
				incomplete_expired: 'Expired'
			}) as Record<string, string>
		)[value] || value;
	const quota = (used: number, limit: number | null | undefined): string =>
		`${used.toLocaleString($i18n.language)} / ${limit === null || limit === undefined ? $i18n.t('Unlimited') : limit.toLocaleString($i18n.language)}`;
	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		mounted = true;
		await load();
	});
	$: if (mounted && String($route.params.id) !== planId) {
		planId = String($route.params.id);
		plan = null;
		page = moneyPage($route.url.searchParams.get('page'));
		void load();
	}
</script>

<svelte:head><title>{$i18n.t('Subscription customers')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full min-w-0 max-w-6xl px-4 py-5">
	<a href="/admin/billing/plans" class="text-sm underline">← {$i18n.t('Subscriptions')}</a>
	<h1 class="mt-4 break-words text-xl font-semibold">
		{plan?.name_ru || plan?.name || $i18n.t('Subscription customers')}
	</h1>
	<p class="my-3 text-sm text-gray-500">{total} {$i18n.t('subscriptions across all statuses')}</p>
	{#if error}<p role="alert" class="mb-4 text-red-700">
			{$i18n.t(error)}
			<button type="button" on:click={load} class="underline">{$i18n.t('Retry')}</button>
		</p>{/if}{#if loading}<p role="status" class="mb-3">{$i18n.t('Loading')}</p>{/if}
	<div class="space-y-3">
		{#each rows as row}<article class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
				<div class="flex flex-wrap justify-between gap-3">
					<div class="min-w-0">
						<a
							class="break-words font-medium underline"
							href={customerHref(
								row.user_id,
								{ ...moneyFilters($route.url), currency: plan?.currency || 'RUB' },
								`/admin/billing/plans/${encodeURIComponent(planId)}/subscribers?page=${page}`
							)}>{row.name || row.email}</a
						>
						<p class="mt-1 break-all text-xs text-gray-500">{row.email}</p>
					</div>
					<span class="text-sm">{$i18n.t(state(row.subscription_status))}</span>
				</div>
				<dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
					<div>
						<dt class="text-gray-500">{$i18n.t('Current subscription period')}</dt>
						<dd>
							{formatReportTime(row.current_period_start, $i18n.language)} — {formatReportTime(
								row.current_period_end,
								$i18n.language
							)} UTC
						</dd>
					</div>
					<div>
						<dt class="text-gray-500">{$i18n.t('Subscribed')}</dt>
						<dd>{formatReportTime(row.subscribed_at, $i18n.language)} UTC</dd>
					</div>
				</dl>
				<details class="mt-3 text-sm">
					<summary class="cursor-pointer">{$i18n.t('Usage Quotas')}</summary>
					<dl class="mt-2 space-y-2">
						<div>
							{$i18n.t('Input Tokens')}: {quota(row.tokens_input_used, row.tokens_input_limit)}
						</div>
						<div>
							{$i18n.t('Output Tokens')}: {quota(row.tokens_output_used, row.tokens_output_limit)}
						</div>
						<div>{$i18n.t('Requests')}: {quota(row.requests_used, row.requests_limit)}</div>
					</dl>
				</details>
			</article>{:else}{#if !loading && !error}<p>{$i18n.t('No subscribers')}</p>{/if}{/each}
	</div>
	<ReportingPagination
		{page}
		{total}
		{totalPages}
		{loading}
		onPage={(next) => {
			page = next;
			void load();
		}}
	/>
	<p class="mt-4 text-xs text-gray-500">
		{$i18n.t('The period end is not a confirmed future payment date.')}
	</p>
</div>
