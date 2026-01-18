<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { PublicPageLayout } from '$lib/components/landing';
	import { getPlansPublic } from '$lib/apis/billing';
	import type { PublicPlan } from '$lib/apis/billing';
	import { getQuotaLabel, formatQuotaValue } from '$lib/utils/billing-formatters';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import { config } from '$lib/stores';

	const i18n = getContext('i18n');

	let billingPeriod: 'monthly' | 'annual' = 'monthly';
	let plans: PublicPlan[] = [];
	let loading = true;
	let errorMessage = '';
	let didLoad = false;
	let unsubscribeConfig: (() => void) | null = null;
	let subscriptionsEnabled = true;

	const heroImage =
		'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80';

	onMount(async () => {
		unsubscribeConfig = config.subscribe((current) => {
			if (!current || didLoad) return;
			const enabled = current.features?.enable_billing_subscriptions ?? true;
			if (!enabled) {
				subscriptionsEnabled = false;
				loading = false;
				didLoad = true;
				return;
			}
			subscriptionsEnabled = true;
			didLoad = true;
			loadPlans();
		});
	});

	onDestroy(() => {
		unsubscribeConfig?.();
	});

	const loadPlans = async (): Promise<void> => {
		loading = true;
		errorMessage = '';
		try {
			const result = await getPlansPublic();
			plans = (result ?? []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
		} catch (error) {
			console.error('Failed to load public plans:', error);
			errorMessage = $i18n.t('Failed to load subscription plans');
		} finally {
			loading = false;
		}
	};

	$: monthlyPlans = plans.filter((plan) => plan.interval === 'month');
	$: annualPlans = plans.filter((plan) => plan.interval === 'year');
	$: annualAvailable = annualPlans.length > 0;
	$: activePlans =
		billingPeriod === 'annual' && annualAvailable
			? annualPlans
			: monthlyPlans.length > 0
				? monthlyPlans
				: plans;

	const formatPrice = (plan: PublicPlan): string => {
		if (plan.price === 0) return $i18n.t('Free');
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency: plan.currency
			}).format(plan.price);
		} catch (error) {
			console.warn('Invalid currency code:', plan.currency, error);
			return `${plan.price} ${plan.currency}`.trim();
		}
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

	const getPlanTitle = (plan: PublicPlan): string => {
		return plan.name_ru || plan.name;
	};

	const getPlanDescription = (plan: PublicPlan): string => {
		return plan.description_ru || plan.description || '';
	};

	const getPlanFeatures = (plan: PublicPlan): { text: string }[] => {
		const items: { text: string }[] = [];
		if (plan.quotas) {
			for (const [key, value] of Object.entries(plan.quotas)) {
				items.push({
					text: `${getQuotaLabel(key, (k) => $i18n.t(k))}: ${formatQuotaValue(value)}`
				});
			}
		}
		if (plan.features) {
			plan.features.forEach((feature) => items.push({ text: feature }));
		}
		return items;
	};

	const getPopularIndex = (list: PublicPlan[]): number => {
		if (list.length < 3) return -1;
		return Math.floor(list.length / 2);
	};

	const handleSelectPlan = (plan: PublicPlan) => {
		if (plan.price === 0) {
			window.location.href = '/';
			return;
		}
		window.location.href = `/auth?plan=${plan.id}`;
	};
</script>

<PublicPageLayout
	title="Тарифы"
	description="Выберите подходящий тариф AIris. От бесплатного доступа до корпоративных решений."
	showHero={true}
	heroTitle="Тарифы и оплата"
	heroSubtitle="Прозрачные планы и оплата по факту использования"
	heroEyebrow="Тарифы"
	heroImage={heroImage}
	heroImageAlt="Оплата и финансы"
>
	<div class="container mx-auto px-4 pt-4 pb-16">
		{#if loading}
			<div class="flex justify-center">
				<Spinner className="size-5" />
			</div>
		{:else if !subscriptionsEnabled}
			<div class="max-w-4xl mx-auto text-center">
				<div class="bg-white rounded-2xl border border-gray-200/70 p-8 shadow-sm">
					<h3 class="text-2xl font-semibold text-gray-900 mb-3">{$i18n.t('Wallet')}</h3>
					<p class="text-gray-600 text-sm mb-6">
						{$i18n.t('Pay-as-you-go via wallet balance.')}
					</p>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 mb-6">
						<div class="bg-gray-50 rounded-xl border border-gray-200/70 p-4">
							{$i18n.t('No subscription needed')}
						</div>
						<div class="bg-gray-50 rounded-xl border border-gray-200/70 p-4">
							{$i18n.t('Top up when you want')}
						</div>
						<div class="bg-gray-50 rounded-xl border border-gray-200/70 p-4">
							{$i18n.t('Pay only for what you use')}
						</div>
					</div>

					<a
						href="/auth"
						class="inline-flex items-center justify-center px-6 py-2 rounded-full bg-black text-white shadow-sm"
					>
						{$i18n.t('Start free')}
					</a>
				</div>
			</div>
		{:else if errorMessage}
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<div class="text-gray-500 text-lg">{errorMessage}</div>
			</div>
		{:else}
			<div class="flex justify-center mb-12">
				<div class="bg-white/90 rounded-full p-1 border border-gray-200/70 shadow-sm inline-flex">
					<button
						on:click={() => (billingPeriod = 'monthly')}
						class="px-6 py-2 rounded-full transition-all duration-200 {billingPeriod === 'monthly'
							? 'bg-black text-white'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Ежемесячно
					</button>
					<button
						on:click={() => annualAvailable && (billingPeriod = 'annual')}
						disabled={!annualAvailable}
						class="px-6 py-2 rounded-full transition-all duration-200 relative {billingPeriod === 'annual'
							? 'bg-black text-white'
							: 'text-gray-600 hover:text-gray-900'} {annualAvailable ? '' : 'opacity-50 cursor-not-allowed'}"
					>
						Ежегодно
						{#if annualAvailable}
							<span class="absolute -top-2 -right-2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full">
								-16%
							</span>
						{/if}
					</button>
				</div>
			</div>

			<div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
				{#each activePlans as plan, index}
					<div class="relative">
						{#if index === getPopularIndex(activePlans)}
							<div class="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
								<span class="bg-black text-white px-4 py-1 rounded-full text-sm font-semibold shadow-sm">
									Популярный
								</span>
							</div>
						{/if}

						<div class="bg-white rounded-2xl border border-gray-200/70 p-8 h-full flex flex-col shadow-sm {index === getPopularIndex(activePlans)
							? 'ring-1 ring-gray-900/10'
							: ''}">
							<div class="text-center mb-6">
								<h3 class="text-2xl font-semibold text-gray-900 mb-2">
									{getPlanTitle(plan)}
								</h3>
								{#if getPlanDescription(plan)}
									<p class="text-gray-600 text-sm mb-4">
										{getPlanDescription(plan)}
									</p>
								{/if}
								<div class="mb-2">
									<span class="text-4xl font-semibold text-gray-900">
										{formatPrice(plan)}
									</span>
									{#if plan.price > 0}
										<span class="text-gray-600">{formatInterval(plan.interval)}</span>
									{/if}
								</div>
							</div>

							<ul class="space-y-3 mb-8 flex-grow">
								{#each getPlanFeatures(plan) as feature}
									<li class="flex items-start gap-3">
										<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
										<span class="text-gray-700 text-sm">{feature.text}</span>
									</li>
								{/each}
							</ul>

							<button
								on:click={() => handleSelectPlan(plan)}
								class="w-full py-3 px-6 rounded-full font-semibold transition-colors {index === getPopularIndex(activePlans)
									? 'bg-black text-white hover:bg-gray-900'
									: 'bg-gray-100 text-gray-900 hover:bg-gray-200'}"
							>
								{plan.price === 0 ? $i18n.t('Start for free') : $i18n.t('Choose plan')}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="max-w-3xl mx-auto">
			<h2 class="text-2xl md:text-3xl font-semibold text-center text-gray-900 mb-8">
				Часто задаваемые вопросы
			</h2>
			<div class="space-y-4">
				<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Можно ли изменить план позже?
						<svg
							class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Да, вы можете изменить свой план в любое время в личном кабинете.
					</p>
				</details>

				<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Как работает помесячная оплата?
						<svg
							class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Помесячная оплата списывается автоматически каждый месяц с момента покупки.
					</p>
				</details>
			</div>
		</div>
	</div>
</PublicPageLayout>
