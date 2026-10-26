<script lang="ts">
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { onMount, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, user, config } from '$lib/stores';
	import {
		getPlansWithStats,
		deletePlan,
		togglePlanActive,
		duplicatePlan
	} from '$lib/apis/admin/billing';
	import type { PlanStats } from '$lib/apis/admin/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Search from '$lib/components/icons/Search.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import ChartBar from '$lib/components/icons/ChartBar.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import Switch from '$lib/components/common/Switch.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');
	$: isRussian = getI18nLocale($i18n).toLowerCase().startsWith('ru');

	let loaded = false;
	let plansWithStats: PlanStats[] = [];
	let filteredPlans: PlanStats[] = [];
	let showDeleteConfirm = false;
	let planToDelete: PlanStats | null = null;
	let actionInProgress = false;
	let query = '';
	let loadError = '';
	let loadingPlans = false;
	let hasLoadedPlans = false;
	$: mrrByCurrency = Array.from(new Set(plansWithStats.map((item) => item.plan.currency))).map(
		(currency) => ({
			currency,
			amount: plansWithStats
				.filter((item) => item.plan.currency === currency)
				.reduce((sum, item) => sum + item.mrr, 0)
		})
	);
	let showUnlimitedOnly = false;

	const isUnlimitedPlan = (plan: PlanStats['plan']): boolean => {
		if (plan.quotas === null || plan.quotas === undefined) return true;
		return Object.values(plan.quotas).every((value) => value === null);
	};

	$: if (plansWithStats && query !== undefined) {
		filteredPlans = plansWithStats.filter((p) => {
			const matchesQuery =
				query === '' ||
				p.plan.name.toLowerCase().includes(query.toLowerCase()) ||
				(p.plan.name_ru?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
				p.plan.id.toLowerCase().includes(query.toLowerCase());
			const matchesUnlimited = !showUnlimitedOnly || isUnlimitedPlan(p.plan);
			return matchesQuery && matchesUnlimited;
		});
	}

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await loadPlans();

		loaded = true;
	});

	const loadPlans = async (): Promise<void> => {
		loadingPlans = true;
		loadError = '';
		try {
			const result = await getPlansWithStats(localStorage.token);
			if (!result) throw new Error('Failed to load plans');
			plansWithStats = result;
			hasLoadedPlans = true;
		} catch (error: unknown) {
			console.error('Failed to load plans:', error);
			loadError = $i18n.t('Failed to load plans');
			toast.error(loadError);
		} finally {
			loadingPlans = false;
		}
	};

	const handleToggleActive = async (planId: string) => {
		if (actionInProgress) return;
		actionInProgress = true;

		try {
			await togglePlanActive(localStorage.token, planId);
			toast.success($i18n.t('Plan status updated'));
			await loadPlans();
		} catch (error) {
			console.error('Failed to toggle plan:', error);
			toast.error($i18n.t('Failed to update plan status'));
		} finally {
			actionInProgress = false;
		}
	};

	const handleDuplicate = async (planId: string) => {
		if (actionInProgress) return;
		actionInProgress = true;

		try {
			const newPlan = await duplicatePlan(localStorage.token, planId);
			if (newPlan) {
				toast.success($i18n.t('Plan duplicated successfully'));
				await loadPlans();
				goto(`/admin/billing/plans/${newPlan.id}/edit`);
			}
		} catch (error) {
			console.error('Failed to duplicate plan:', error);
			toast.error($i18n.t('Failed to duplicate plan'));
		} finally {
			actionInProgress = false;
		}
	};

	const confirmDelete = (plan: PlanStats) => {
		planToDelete = plan;
		showDeleteConfirm = true;
	};

	const handleDelete = async () => {
		if (!planToDelete || actionInProgress) return;
		actionInProgress = true;

		try {
			const success = await deletePlan(localStorage.token, planToDelete.plan.id);
			if (success) {
				toast.success($i18n.t('Plan deleted successfully'));
				await loadPlans();
			}
		} catch (error: unknown) {
			console.error('Failed to delete plan:', error);
			toast.error(
				(typeof error === 'object' &&
					error !== null &&
					'detail' in error &&
					typeof error.detail === 'string' &&
					error.detail) ||
					$i18n.t('Failed to delete plan')
			);
		} finally {
			actionInProgress = false;
			showDeleteConfirm = false;
			planToDelete = null;
		}
	};

	const formatPrice = (
		price: number,
		currency: string,
		locale: string = getI18nLocale($i18n)
	): string => {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(price);
	};

	const formatMRR = (
		mrr: number,
		currency: string,
		locale: string = getI18nLocale($i18n)
	): string => {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(mrr);
	};

	const getIntervalLabel = (interval: string): string => {
		const intervals: Record<string, string> = {
			month: 'mo',
			year: 'yr',
			week: 'wk',
			day: 'd'
		};
		return intervals[interval] || interval;
	};
</script>

<svelte:head>
	<title>
		{$i18n.t('Subscriptions')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if !loaded}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else}
	<div class="px-4.5 w-full">
		<p class="my-4 text-sm text-gray-500">
			{$i18n.t(
				'Subscription settings are separate from wallet top-ups. Calculated monthly income is not received cash.'
			)}
		</p>
		{#if $config?.features?.enable_billing_subscriptions === false}
			<p
				class="my-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
			>
				{$i18n.t(
					'New subscriptions are disabled. Existing plans and subscription history remain available.'
				)}
			</p>
		{:else if $config?.features?.enable_billing_subscriptions === true}
			<p class="my-3 text-sm text-gray-500">{$i18n.t('New subscriptions are enabled.')}</p>
		{/if}
		{#if loadError}<p role="alert" class="my-3 text-red-700 dark:text-red-300">
				{loadError}
				<button type="button" class="underline" disabled={loadingPlans} on:click={loadPlans}
					>{$i18n.t('Retry')}</button
				>
			</p>{/if}
		<div class="flex flex-col gap-1 px-1 mt-2.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex justify-between items-center w-full">
					<div class="flex items-center md:self-center text-xl font-medium px-0.5 gap-2 shrink-0">
						<h1>{$i18n.t('Subscriptions')}</h1>
						{#if hasLoadedPlans}<div class="text-lg font-medium text-gray-500 dark:text-gray-500">
								{filteredPlans.length}
							</div>{/if}
					</div>

					<div class="flex w-full justify-end gap-1.5">
						<button
							class="px-2 py-1.5 rounded-xl bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200 transition font-medium text-sm flex items-center"
							on:click={() => {
								showUnlimitedOnly = !showUnlimitedOnly;
							}}
						>
							{$i18n.t('Безлимит')}
						</button>
						<button
							aria-label={$i18n.t('New Plan')}
							class="px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition font-medium text-sm flex items-center"
							on:click={() => goto('/admin/billing/plans/new')}
						>
							<Plus className="size-3" strokeWidth="2.5" />
							<div class="hidden md:block md:ml-1 text-xs">{$i18n.t('New Plan')}</div>
						</button>
					</div>
				</div>
			</div>
		</div>

		<div
			class="py-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30"
		>
			<!-- Search -->
			<div class="px-3.5 flex flex-1 items-center w-full space-x-2 py-0.5 pb-2">
				<div class="flex flex-1">
					<div class="self-center ml-1 mr-3">
						<Search className="size-3.5" />
					</div>
					<input
						aria-label={$i18n.t('Search Plans')}
						class="w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
						bind:value={query}
						placeholder={$i18n.t('Search Plans')}
					/>
					{#if query}
						<div class="self-center pl-1.5 translate-y-[0.5px] rounded-l-xl bg-transparent">
							<button
								aria-label={$i18n.t('Clear search')}
								class="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition"
								on:click={() => {
									query = '';
								}}
							>
								<XMark className="size-3" strokeWidth="2" />
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Plans List -->
			{#if filteredPlans.length !== 0}
				<div class="px-3 my-2 gap-1 lg:gap-2 grid lg:grid-cols-2">
					{#each filteredPlans as planStat (planStat.plan.id)}
						{@const planName =
							(isRussian
								? planStat.plan.name_ru || planStat.plan.name
								: planStat.plan.name || planStat.plan.name_ru) || planStat.plan.id}
						{@const planLabel = `${planName} (${planStat.plan.id})`}
						<div
							class="flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-4 cursor-pointer w-full px-2 py-2 dark:hover:bg-white/5 hover:bg-black/5 rounded-xl"
						>
							<a
								class="flex min-w-0 flex-1 space-x-3.5 cursor-pointer w-full"
								aria-label={`${$i18n.t('Edit Plan')}: ${planLabel}`}
								href={`/admin/billing/plans/${planStat.plan.id}/edit`}
							>
								<div class="flex min-w-0 w-full items-center text-left">
									<div class="min-w-0 w-full flex-1 self-center pl-1">
										<Tooltip content={planStat.plan.id} placement="top-start">
											<div class="flex min-w-0 flex-wrap items-center gap-1.5">
												<div
													class="shrink-0 text-xs font-semibold px-1 rounded-sm uppercase
													{planStat.plan.is_active
														? 'bg-green-500/20 text-green-700 dark:text-green-200'
														: 'bg-gray-500/20 text-gray-700 dark:text-gray-200'}"
												>
													{planStat.plan.is_active ? $i18n.t('Active') : $i18n.t('Inactive')}
												</div>
												<div
													class="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere] text-sm font-medium"
												>
													{planName}
												</div>
												<div class="w-full sm:w-auto text-gray-500 text-xs font-medium shrink-0">
													{formatPrice(
														planStat.plan.price,
														planStat.plan.currency,
														getI18nLocale($i18n)
													)}/{$i18n.t(getIntervalLabel(planStat.plan.interval))}
												</div>
											</div>
										</Tooltip>

										<div class="flex min-w-0 flex-wrap gap-1.5 px-1">
											<div class="text-xs text-gray-500 shrink-0">
												{planStat.active_subscriptions}
												{$i18n.t('subscribers')}
											</div>
											{#if planStat.mrr > 0}
												<div class="text-xs text-gray-500">
													• {$i18n.t('Calculated monthly income')}: {formatMRR(
														planStat.mrr,
														planStat.plan.currency,
														getI18nLocale($i18n)
													)}
												</div>
											{/if}
											{#if planStat.plan.description_ru || planStat.plan.description}
												<div
													class="text-xs overflow-hidden text-ellipsis line-clamp-1 text-gray-400"
												>
													• {isRussian
														? planStat.plan.description_ru || planStat.plan.description
														: planStat.plan.description || planStat.plan.description_ru}
												</div>
											{/if}
										</div>
									</div>
								</div>
							</a>

							<div class="flex shrink-0 flex-wrap flex-row gap-0.5 self-start sm:self-center">
								<Tooltip content={$i18n.t('Delete')}>
									<button
										aria-label={`${$i18n.t('Delete')}: ${planLabel}`}
										class="self-center w-fit text-sm px-2 py-2 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"
										type="button"
										disabled={planStat.active_subscriptions > 0}
										on:click={() => confirmDelete(planStat)}
									>
										<GarbageBin />
									</button>
								</Tooltip>
								<Tooltip content={$i18n.t('Subscribers')}>
									<button
										aria-label={`${$i18n.t('Subscribers')}: ${planLabel}`}
										class="self-center w-fit text-sm px-2 py-2 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"
										type="button"
										on:click={() => goto(`/admin/billing/plans/${planStat.plan.id}/subscribers`)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="size-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
											/>
										</svg>
									</button>
								</Tooltip>

								<Tooltip content={$i18n.t('Analytics')}>
									<button
										aria-label={`${$i18n.t('Analytics')}: ${planLabel}`}
										class="self-center w-fit text-sm px-2 py-2 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"
										type="button"
										on:click={() => goto(`/admin/billing/plans/${planStat.plan.id}/analytics`)}
									>
										<ChartBar className="size-4" />
									</button>
								</Tooltip>

								<Tooltip content={$i18n.t('Duplicate')}>
									<button
										aria-label={`${$i18n.t('Duplicate')}: ${planLabel}`}
										class="self-center w-fit text-sm px-2 py-2 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"
										type="button"
										disabled={actionInProgress}
										on:click={() => handleDuplicate(planStat.plan.id)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="size-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
											/>
										</svg>
									</button>
								</Tooltip>

								<div class="self-center mx-1">
									<Tooltip
										content={planStat.plan.is_active ? $i18n.t('Enabled') : $i18n.t('Disabled')}
									>
										<Switch
											ariaLabel={`${$i18n.t('Active')}: ${planLabel}`}
											state={planStat.plan.is_active}
											on:change={() => handleToggleActive(planStat.plan.id)}
										/>
									</Tooltip>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if loadingPlans}
				<div class="flex justify-center p-8"><Spinner className="size-5" /></div>
			{:else if !loadError}
				<div class="w-full h-full flex flex-col justify-center items-center my-16 mb-24">
					<div class="max-w-md text-center">
						<div class="text-3xl mb-3">📋</div>
						<div class="text-lg font-medium mb-1">{$i18n.t('No plans found')}</div>
						<div class="text-gray-500 text-center text-xs">
							{#if query}
								{$i18n.t('Try adjusting your search to find what you are looking for.')}
							{:else}
								{$i18n.t('Wallet top-ups work without subscription plans.')}
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Summary Stats -->
		{#if plansWithStats.length > 0}
			<div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
				<div
					class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3"
				>
					<div class="text-xs text-gray-500">{$i18n.t('Total Plans')}</div>
					<div class="text-lg font-medium">{plansWithStats.length}</div>
					<div class="text-xs text-gray-400">
						{plansWithStats.filter((p) => p.plan.is_active).length}
						{$i18n.t('active')}
					</div>
				</div>
				<div
					class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3"
				>
					<div class="text-xs text-gray-500">{$i18n.t('Subscribers')}</div>
					<div class="text-lg font-medium">
						{plansWithStats.reduce((sum, p) => sum + p.active_subscriptions, 0)}
					</div>
					<div class="text-xs text-gray-400">{$i18n.t('across all plans')}</div>
				</div>
				<div
					class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3"
				>
					<div class="text-xs text-gray-500">{$i18n.t('Calculated monthly income')}</div>
					<div class="text-lg font-medium">
						{#each mrrByCurrency as row}<div>
								{formatMRR(row.amount, row.currency, getI18nLocale($i18n))}
							</div>{/each}
					</div>
					<div class="text-xs text-gray-400">{$i18n.t('monthly')}</div>
				</div>
			</div>
		{/if}
	</div>

	<ConfirmDialog
		bind:show={showDeleteConfirm}
		title={$i18n.t('Delete plan?')}
		on:confirm={handleDelete}
	>
		<div class="text-sm text-gray-500 truncate">
			{$i18n.t('This will delete')}
			<span class="font-semibold">
				{isRussian
					? planToDelete?.plan.name_ru || planToDelete?.plan.name
					: planToDelete?.plan.name || planToDelete?.plan.name_ru}</span
			>.
		</div>
	</ConfirmDialog>
{/if}
