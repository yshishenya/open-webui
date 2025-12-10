<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { user } from '$lib/stores';
	import { getPlans, createPayment } from '$lib/apis/billing';
	import type { Plan, PaymentResponse } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let plans: Plan[] = [];
	let creatingPayment = false;
	let selectedPlanId: string | null = null;

	onMount(async () => {
		await loadPlans();
	});

	const loadPlans = async () => {
		loading = true;
		try {
			const result = await getPlans(localStorage.token);
			if (result) {
				// Sort by display_order
				plans = result.sort((a, b) => a.display_order - b.display_order);
			}
		} catch (error) {
			console.error('Failed to load plans:', error);
			toast.error($i18n.t('Failed to load subscription plans'));
		} finally {
			loading = false;
		}
	};

	const handleSubscribe = async (planId: string) => {
		if (creatingPayment) return;

		creatingPayment = true;
		selectedPlanId = planId;

		try {
			const returnUrl = `${window.location.origin}/billing/dashboard`;
			const result = await createPayment(localStorage.token, planId, returnUrl);

			if (result && result.confirmation_url) {
				// Redirect to payment page
				window.location.href = result.confirmation_url;
			} else {
				toast.error($i18n.t('Failed to create payment'));
			}
		} catch (error) {
			console.error('Failed to create payment:', error);
			toast.error($i18n.t('Failed to create payment'));
		} finally {
			creatingPayment = false;
			selectedPlanId = null;
		}
	};

	const formatPrice = (price: number, currency: string): string => {
		if (price === 0) {
			return $i18n.t('Free');
		}
		return new Intl.NumberFormat('ru-RU', {
			style: 'currency',
			currency: currency
		}).format(price);
	};

	const formatInterval = (interval: string): string => {
		const intervals = {
			month: $i18n.t('per month'),
			year: $i18n.t('per year'),
			week: $i18n.t('per week'),
			day: $i18n.t('per day')
		};
		return intervals[interval] || interval;
	};

	const formatQuota = (value: number): string => {
		if (value >= 1000000) {
			return `${(value / 1000000).toFixed(1)}M`;
		} else if (value >= 1000) {
			return `${(value / 1000).toFixed(0)}K`;
		}
		return value.toString();
	};

	const getQuotaLabel = (key: string): string => {
		const labels = {
			tokens_input: $i18n.t('Input tokens'),
			tokens_output: $i18n.t('Output tokens'),
			requests: $i18n.t('Requests')
		};
		return labels[key] || key;
	};
</script>

<div class="flex flex-col w-full h-full">
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b dark:border-gray-800">
		<div class="flex items-center gap-2">
			<div class="text-2xl font-semibold">
				{$i18n.t('Subscription Plans')}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto px-5 py-8">
		{#if loading}
			<div class="flex items-center justify-center h-64">
				<Spinner className="size-8" />
			</div>
		{:else if plans.length === 0}
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<div class="text-gray-500 dark:text-gray-400 text-lg">
					{$i18n.t('No subscription plans available')}
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
				{#each plans as plan (plan.id)}
					<div
						class="flex flex-col border dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-850 shadow-sm hover:shadow-md transition-shadow"
					>
						<!-- Plan Header -->
						<div class="mb-4">
							<h3 class="text-xl font-bold text-gray-900 dark:text-gray-50">
								{plan.name_ru || plan.name}
							</h3>
							{#if plan.description || plan.description_ru}
								<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
									{plan.description_ru || plan.description}
								</p>
							{/if}
						</div>

						<!-- Price -->
						<div class="mb-6">
							<div class="flex items-baseline gap-1">
								<span class="text-3xl font-bold text-gray-900 dark:text-gray-50">
									{formatPrice(plan.price, plan.currency)}
								</span>
								{#if plan.price > 0}
									<span class="text-gray-600 dark:text-gray-400 text-sm">
										/ {formatInterval(plan.interval)}
									</span>
								{/if}
							</div>
						</div>

						<!-- Features -->
						{#if plan.features && plan.features.length > 0}
							<div class="mb-6 space-y-2">
								<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									{$i18n.t('Features')}:
								</div>
								{#each plan.features as feature}
									<div class="flex items-start gap-2">
										<svg
											class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											/>
										</svg>
										<span class="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Quotas -->
						{#if plan.quotas && Object.keys(plan.quotas).length > 0}
							<div class="mb-6 space-y-2">
								<div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									{$i18n.t('Quotas')}:
								</div>
								{#each Object.entries(plan.quotas) as [key, value]}
									<div class="flex items-center justify-between text-sm">
										<span class="text-gray-600 dark:text-gray-400">{getQuotaLabel(key)}</span>
										<span class="font-medium text-gray-900 dark:text-gray-50">
											{formatQuota(value)}
										</span>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Subscribe Button -->
						<div class="mt-auto pt-4">
							{#if plan.price === 0}
								<button
									type="button"
									disabled
									class="w-full py-2.5 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
								>
									{$i18n.t('Current Plan')}
								</button>
							{:else}
								<button
									type="button"
									on:click={() => handleSubscribe(plan.id)}
									disabled={creatingPayment}
									class="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium transition-colors disabled:cursor-not-allowed"
								>
									{#if creatingPayment && selectedPlanId === plan.id}
										<div class="flex items-center justify-center gap-2">
											<Spinner className="size-4" />
											<span>{$i18n.t('Processing')}...</span>
										</div>
									{:else}
										{$i18n.t('Subscribe')}
									{/if}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	/* Additional styling if needed */
</style>
