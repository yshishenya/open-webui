<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { sanitizeReturnTo } from '$lib/utils/airis/return_to';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME } from '$lib/stores';
	import { getPublicRateCards, getPublicPricingConfig } from '$lib/apis/billing';
	import type { PublicRateCardResponse, PublicPricingConfig } from '$lib/apis/billing';
	import Estimator from '$lib/components/pricing/Estimator.svelte';
	import type { PricingEstimatorConfig } from '$lib/components/pricing/Estimator.svelte';
	import RatesTable from '$lib/components/pricing/RatesTable.svelte';
	import configData from '$lib/data/pricing-estimator.json';
	const i18n = getContext('i18n');
	$: returnTo = sanitizeReturnTo($page.url.searchParams.get('return_to'));
	let periodParams = new URLSearchParams();
	$: {
		periodParams = new URLSearchParams();
		if (returnTo) periodParams.set('return_to', returnTo);
		for (const key of ['from_date', 'to_date']) {
			const value = $page.url.searchParams.get(key);
			if (value) periodParams.set(key, value);
		}
	}
	$: balanceHref = '/billing/balance' + (periodParams.size ? '?' + periodParams : '');
	$: historyHref = '/billing/history' + (periodParams.size ? '?' + periodParams : '');

	const estimatorConfig = configData as PricingEstimatorConfig;
	let rateCard: PublicRateCardResponse | null = null;
	let pricing: PublicPricingConfig | null = null;
	let loading = true;
	let error: string | null = null;
	const load = async (): Promise<void> => {
		loading = true;
		error = null;
		try {
			const [rates, settings] = await Promise.all([getPublicRateCards(), getPublicPricingConfig()]);
			rateCard = rates;
			pricing = settings;
			if (!rates) error = $i18n.t('Rates could not be loaded');
		} catch {
			error = $i18n.t('Rates could not be loaded');
		} finally {
			loading = false;
		}
	};
	onMount(() => {
		void load();
	});
</script>

<svelte:head><title>{$i18n.t('Usage cost')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full max-w-5xl space-y-6 px-1 pb-6">
	<div>
		<h1 class="text-xl font-semibold">{$i18n.t('Usage cost')}</h1>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
			{$i18n.t('Choose a model and see an example cost. Actual charges are in Operations.')}
		</p>
	</div>
	<div class="flex flex-wrap gap-3">
		<a
			href={balanceHref}
			class="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-4 text-sm dark:border-gray-700"
			>{$i18n.t('Back to balance')}</a
		><a href={historyHref} class="inline-flex min-h-11 items-center underline text-sm"
			>{$i18n.t('View operations')}</a
		>
	</div>
	{#if error}<div role="alert" class="text-sm">
			{error}<button type="button" class="ml-3 min-h-11 underline" on:click={load}
				>{$i18n.t('Retry')}</button
			>
		</div>{/if}
	<Estimator
		config={estimatorConfig}
		{rateCard}
		{loading}
		{error}
		recommendedModelIdByType={pricing?.recommended_model_ids ?? {}}
		primaryLabel={$i18n.t('Open balance')}
		onPrimaryAction={() => {
			void goto(balanceHref);
		}}
		onScrollToCalculation={() =>
			document.getElementById('billing-cost-explanation')?.scrollIntoView({ block: 'start' })}
	/>
	<section
		id="billing-cost-explanation"
		class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
	>
		<h2 class="font-medium">{$i18n.t('How the cost is calculated')}</h2>
		<p class="mt-2 text-sm">
			{$i18n.t(
				'Text includes your request, the previous chat history sent to the model, and its reply. Longer chats can cost more.'
			)}
		</p>
		<p class="mt-2 text-sm">
			{$i18n.t(
				'Before starting, an amount is reserved. After the reply, only its final cost is charged and unused money is released.'
			)}
		</p>
		<p class="mt-2 text-sm">
			{$i18n.t(
				'When the provider does not return usage data, the charge uses an estimate and is marked in Operations.'
			)}
		</p>
	</section>
	<section>
		<h2 class="mb-4 text-lg font-medium">{$i18n.t('Model rates')}</h2>
		<RatesTable
			models={rateCard?.models ?? []}
			currency={rateCard?.currency ?? 'RUB'}
			updatedAt={rateCard?.updated_at ?? null}
			popularModelIds={pricing?.popular_model_ids ?? []}
			{loading}
			{error}
		/>
	</section>
</div>
