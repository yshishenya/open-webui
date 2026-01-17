<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, config } from '$lib/stores';
	import {
		getPlans,
		createPayment,
		getMySubscription,
		resumeSubscription,
		activateFreePlan
	} from '$lib/apis/billing';
	import type { Plan, PaymentResponse, Subscription } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let plans: Plan[] = [];
	let subscription: Subscription | null = null;
	let creatingPayment = false;
	let selectedPlanId: string | null = null;
	let resumingPlanId: string | null = null;
	let activatingPlanId: string | null = null;
	let didLoad = false;
	let unsubscribeConfig: (() => void) | null = null;

	onMount(async () => {
		unsubscribeConfig = config.subscribe((current) => {
			if (!current || didLoad) return;
			const enabled = current.features?.enable_billing_subscriptions ?? true;
			if (!enabled) {
				loading = false;
				goto('/billing/dashboard');
				didLoad = true;
				return;
			}
			didLoad = true;
			loadData();
		});
	});

	onDestroy(() => {
		unsubscribeConfig?.();
	});

	const loadPlans = async (): Promise<Plan[]> => {
		try {
			const result = await getPlans(localStorage.token);
			if (result) {
				return result.sort((a, b) => a.display_order - b.display_order);
			}
		} catch (error) {
			console.error('Failed to load plans:', error);
			toast.error($i18n.t('Failed to load subscription plans'));
		}
		return [];
	};

	const loadSubscription = async (): Promise<Subscription | null> => {
		try {
			return await getMySubscription(localStorage.token);
		} catch (error) {
			console.error('Failed to load subscription:', error);
			return null;
		}
	};

	const loadData = async (): Promise<void> => {
		loading = true;
		try {
			const [plansResult, subscriptionResult] = await Promise.all([
				loadPlans(),
				loadSubscription()
			]);
			plans = plansResult;
			subscription = subscriptionResult;
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

	const handleResumeSubscription = async (planId: string): Promise<void> => {
		if (resumingPlanId) return;
		resumingPlanId = planId;

		try {
			const result = await resumeSubscription(localStorage.token);
			if (result) {
				subscription = result;
				toast.success($i18n.t('Subscription resumed successfully'));
			} else {
				toast.error($i18n.t('Failed to resume subscription'));
			}
		} catch (error) {
			console.error('Failed to resume subscription:', error);
			toast.error($i18n.t('Failed to resume subscription'));
		} finally {
			resumingPlanId = null;
		}
	};

	const handleActivateFreePlan = async (planId: string): Promise<void> => {
		if (activatingPlanId) return;
		activatingPlanId = planId;

		try {
			const result = await activateFreePlan(localStorage.token, planId);
			if (result) {
				subscription = result;
				toast.success($i18n.t('Free plan activated successfully'));
			} else {
				toast.error($i18n.t('Failed to activate free plan'));
			}
		} catch (error) {
			console.error('Failed to activate free plan:', error);
			toast.error($i18n.t('Failed to activate free plan'));
		} finally {
			activatingPlanId = null;
		}
	};

	const isCurrentPlan = (planId: string): boolean => {
		return (
			subscription?.plan_id === planId &&
			(subscription.status === 'active' || subscription.status === 'trialing')
		);
	};

	const isCancelingCurrentPlan = (planId: string): boolean => {
		return Boolean(subscription?.plan_id === planId && subscription?.cancel_at_period_end);
	};

	const formatPrice = (price: number, currency: string): string => {
		if (price === 0) {
			return $i18n.t('Free');
		}
		return new Intl.NumberFormat($i18n.locale, {
			style: 'currency',
			currency: currency
		}).format(price);
	};

	const formatInterval = (interval: string): string => {
		const intervals: Record<string, string> = {
			month: $i18n.t('per month'),
			year: $i18n.t('per year'),
			week: $i18n.t('per week'),
			day: $i18n.t('per day')
		};
		return intervals[interval] || interval;
	};

	const formatQuota = (value: number | null): string => {
		if (value === null) return '∞';
		if (value >= 1000000) {
			return `${(value / 1000000).toFixed(1)}M`;
		} else if (value >= 1000) {
			return `${(value / 1000).toFixed(0)}K`;
		}
		return value.toString();
	};

	const getQuotaLabel = (key: string): string => {
		const labels: Record<string, string> = {
			tokens_input: $i18n.t('Input tokens'),
			tokens_output: $i18n.t('Output tokens'),
			requests: $i18n.t('Requests')
		};
		return labels[key] || key;
	};
</script>

<svelte:head>
	<title>
		{$i18n.t('Subscription Plans')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loading}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else if plans.length === 0}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">
				{$i18n.t('No subscription plans available')}
			</div>
		</div>
	</div>
{:else}
	<div class="w-full">
		<!-- Header -->
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Subscription Plans')}</div>
				</div>
			</div>
			<div class="text-sm text-gray-500">
				{$i18n.t('Choose a plan that fits your needs')}
			</div>
		</div>

		<!-- Plans Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
			{#each plans as plan (plan.id)}
				<div class="flex flex-col bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-5 hover:shadow-lg transition-shadow">
					<!-- Plan Header -->
					<div class="mb-3">
						<h3 class="text-lg font-semibold">
							{plan.name_ru || plan.name}
						</h3>
						{#if plan.description || plan.description_ru}
							<p class="text-sm text-gray-500 mt-1">
								{plan.description_ru || plan.description}
							</p>
						{/if}
					</div>

					<!-- Price -->
					<div class="mb-4">
						<div class="flex items-baseline gap-1">
							<span class="text-2xl font-bold">
								{formatPrice(plan.price, plan.currency)}
							</span>
							{#if plan.price > 0}
								<span class="text-gray-500 text-sm">
									{formatInterval(plan.interval)}
								</span>
							{/if}
						</div>
					</div>

					<!-- Features -->
					{#if plan.features && plan.features.length > 0}
						<div class="mb-4 space-y-1.5">
							<div class="text-xs text-gray-500 mb-2">{$i18n.t('Features')}:</div>
							{#each plan.features as feature}
								<div class="flex items-start gap-2">
									<svg
										class="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2.5"
											d="M5 13l4 4L19 7"
										/>
									</svg>
									<span class="text-sm">{feature}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Quotas -->
					{#if plan.quotas && Object.keys(plan.quotas).length > 0}
						<div class="mb-4 space-y-1.5">
							<div class="text-xs text-gray-500 mb-2">{$i18n.t('Quotas')}:</div>
							{#each Object.entries(plan.quotas) as [key, value]}
								<div class="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-850 rounded-lg px-2 py-1.5">
									<span class="text-gray-600 dark:text-gray-400">{getQuotaLabel(key)}</span>
									<span class="font-medium">{formatQuota(value)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Subscribe Button -->
					<div class="mt-auto pt-3">
						{#if isCurrentPlan(plan.id)}
							<button
								type="button"
								on:click={() => handleResumeSubscription(plan.id)}
								disabled={!isCancelingCurrentPlan(plan.id) || resumingPlanId !== null}
								class="w-full py-2 px-4 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium disabled:cursor-not-allowed"
							>
								{#if isCancelingCurrentPlan(plan.id)}
									{#if resumingPlanId === plan.id}
										<div class="flex items-center justify-center gap-2">
											<Spinner className="size-4" />
											<span>{$i18n.t('Resuming')}...</span>
										</div>
									{:else}
										{$i18n.t('Resume Subscription')}
									{/if}
								{:else}
									{$i18n.t('Current Plan')}
								{/if}
							</button>
						{:else if plan.price === 0}
							<button
								type="button"
								on:click={() => handleActivateFreePlan(plan.id)}
								disabled={activatingPlanId !== null}
								class="w-full py-2 px-4 rounded-xl bg-black hover:bg-gray-900 disabled:bg-gray-400 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 font-medium transition disabled:cursor-not-allowed"
							>
								{#if activatingPlanId === plan.id}
									<div class="flex items-center justify-center gap-2">
										<Spinner className="size-4" />
										<span>{$i18n.t('Activating')}...</span>
									</div>
								{:else}
									{$i18n.t('Activate Free Plan')}
								{/if}
							</button>
						{:else}
							<button
								type="button"
								on:click={() => handleSubscribe(plan.id)}
								disabled={creatingPayment}
								class="w-full py-2 px-4 rounded-xl bg-black hover:bg-gray-900 disabled:bg-gray-400 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 font-medium transition disabled:cursor-not-allowed"
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
	</div>
{/if}
