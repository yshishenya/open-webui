<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/common/Modal.svelte';
	import type { BillingBlockedDetail, BillingBlockedInsufficientFunds } from '$lib/utils/airis/billing_block';
	import { buildBillingBalanceHref } from '$lib/utils/airis/billing_block';

	const i18n = getContext('i18n');

	export let open = false;
	export let detail: BillingBlockedDetail | null = null;
	export let returnTo: string | null = null;

	const formatMoney = (kopeks: number | null, currency: string | null): string => {
		if (kopeks === null || currency === null) {
			return $i18n.t('—');
		}
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, { style: 'currency', currency }).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currency, error);
			return `${amount.toFixed(2)} ${currency}`.trim();
		}
	};

	const formatDateTime = (timestamp: number | null): string => {
		if (!timestamp) return $i18n.t('Never');
		return new Date(timestamp * 1000).toLocaleString($i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const handleNavigate = async (href: string): Promise<void> => {
		open = false;
		await goto(href);
	};

	$: insufficientFundsDetail = (detail?.error === 'insufficient_funds'
		? (detail as BillingBlockedInsufficientFunds)
		: null);
	$: currency = insufficientFundsDetail?.currency ?? null;
	$: requiredKopeks = insufficientFundsDetail?.required_kopeks ?? null;
	$: topupHref =
		detail?.error === 'insufficient_funds'
			? buildBillingBalanceHref({
					returnTo,
					focus: 'topup',
					requiredKopeks,
					src: 'chat_blocked'
				})
			: buildBillingBalanceHref({ returnTo, focus: 'limits', src: 'chat_blocked' });
	$: autoTopupHref = buildBillingBalanceHref({ returnTo, focus: 'auto_topup', src: 'chat_blocked' });
	$: showAutoTopupCTA =
		detail?.error === 'insufficient_funds' &&
		(insufficientFundsDetail?.auto_topup_status === 'missing_payment_method' ||
			insufficientFundsDetail?.auto_topup_status === 'missing_config' ||
			insufficientFundsDetail?.auto_topup_status === 'invalid_amount' ||
			insufficientFundsDetail?.auto_topup_status === 'fail_limit');
</script>

<Modal
	bind:show={open}
	size="sm"
	containerClassName="p-3"
	className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-4xl"
>
	{#if detail}
		<div class="p-5">
			<div class="flex items-start justify-between gap-3">
				<div>
					{#if detail.error === 'insufficient_funds'}
						<h2 class="text-lg font-semibold">{$i18n.t('Low balance')}</h2>
						<div class="text-sm text-gray-500 mt-1">
							{$i18n.t('Top up to keep working')}
						</div>
					{:else if detail.error === 'daily_cap_exceeded'}
						<h2 class="text-lg font-semibold">{$i18n.t('Daily cap reached')}</h2>
						<div class="text-sm text-gray-500 mt-1">
							{$i18n.t('Set limits to control spending')}
						</div>
					{:else}
						<h2 class="text-lg font-semibold">{$i18n.t('Max reply cost limit reached')}</h2>
						<div class="text-sm text-gray-500 mt-1">
							{$i18n.t('Set limits to control spending')}
						</div>
					{/if}
				</div>
				<button
					type="button"
					aria-label={$i18n.t('Close')}
					class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition px-2 -my-1"
					on:click={() => (open = false)}
				>
					&times;
				</button>
			</div>

			<div class="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-200">
				{#if detail.error === 'insufficient_funds'}
					<div class="flex items-center justify-between gap-3">
						<span class="text-gray-500">{$i18n.t('Available now')}</span>
						<span class="font-medium">
							{formatMoney(insufficientFundsDetail?.available_kopeks ?? null, currency)}
						</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span class="text-gray-500">{$i18n.t('Required for this reply')}</span>
						<span class="font-medium">
							{formatMoney(insufficientFundsDetail?.required_kopeks ?? null, currency)}
						</span>
					</div>

					{#if insufficientFundsDetail?.auto_topup_status === 'created' || insufficientFundsDetail?.auto_topup_status === 'pending'}
						<div class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
							{$i18n.t('Top-up is processing')}
							<span class="mx-1">•</span>
							{$i18n.t('This may take a minute')}
						</div>
					{:else if showAutoTopupCTA}
						<div class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
							{$i18n.t('Enable auto-topup, then make one top-up to save your payment method')}
							<span class="mx-1">•</span>
							{$i18n.t("We don't store card details")}.
						</div>
					{/if}
				{:else if detail.error === 'daily_cap_exceeded'}
					<div class="flex items-center justify-between gap-3">
						<span class="text-gray-500">{$i18n.t('Daily cap')}</span>
						<span class="font-medium">
							{formatMoney(detail.daily_cap_kopeks ?? null, 'RUB')}
						</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span class="text-gray-500">{$i18n.t('Spent today')}</span>
						<span class="font-medium">
							{formatMoney(detail.daily_spent_kopeks ?? null, 'RUB')}
						</span>
					</div>
					{#if detail.daily_reset_at}
						<div class="flex items-center justify-between gap-3">
							<span class="text-gray-500">{$i18n.t('Resets at')}</span>
							<span class="font-medium">{formatDateTime(detail.daily_reset_at ?? null)}</span>
						</div>
					{/if}
				{:else}
					<div class="flex items-center justify-between gap-3">
						<span class="text-gray-500">{$i18n.t('Max reply cost')}</span>
						<span class="font-medium">
							{formatMoney(detail.max_reply_cost_kopeks ?? null, 'RUB')}
						</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span class="text-gray-500">{$i18n.t('Required for this reply')}</span>
						<span class="font-medium">{formatMoney(detail.required_kopeks ?? null, 'RUB')}</span>
					</div>
				{/if}
			</div>

			<div class="mt-5 flex flex-wrap gap-2 justify-end">
				{#if showAutoTopupCTA}
					<button
						type="button"
						class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
						on:click={() => handleNavigate(autoTopupHref)}
					>
						{$i18n.t('Manage limits & auto-topup')}
					</button>
				{/if}
				<button
					type="button"
					class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
					on:click={() => handleNavigate(topupHref)}
				>
					{#if detail.error === 'insufficient_funds'}
						{$i18n.t('Top up')}
					{:else}
						{$i18n.t('Manage limits & auto-topup')}
					{/if}
				</button>
			</div>
		</div>
	{/if}
</Modal>

