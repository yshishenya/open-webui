<script lang="ts">
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { getContext, onDestroy, onMount } from 'svelte';

	import { page } from '$app/stores';

	import {
		getBalance,
		getLeadMagnetInfo,
		type Balance,
		type LeadMagnetInfo
	} from '$lib/apis/billing';
	import { chatId, models } from '$lib/stores';
	import { hasFreeTextQuota } from '$lib/utils/airis/billing_ui';
	import CreditCard from '$lib/components/icons/CreditCard.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import { buildBillingBalanceHref } from '$lib/utils/airis/billing_block';
	import { getBillingReturnTo } from '$lib/utils/airis/return_to';

	const i18n = getContext('i18n');

	const LOW_BALANCE_THRESHOLD_KOPEKS = 10_000;
	const REFRESH_INTERVAL_MS = 45_000;

	export let className = '';

	let balance: Balance | null = null;
	let freeInfo: LeadMagnetInfo | null = null;
	let freeAvailable = false;
	let loading = true;
	let refreshing = false;
	let hasError = false;
	let lastLoadedAt: number | null = null;
	let inflightLoad: Promise<void> | null = null;
	let returnTo: string | null = null;
	let totalBalanceKopeks = 0;
	let currency = 'RUB';
	let isLowBalance = false;
	let balanceHref = '/billing/balance';
	let topupHref = '/billing/balance?focus=topup';
	let amountLabel = '';

	const formatMoney = (kopeks: number, currencyCode: string, locale: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat(locale, {
				style: 'currency',
				currency: currencyCode,
				maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currencyCode, error);
			return `${amount.toFixed(2)} ${currencyCode}`.trim();
		}
	};

	const shouldRefresh = (force: boolean): boolean =>
		force || lastLoadedAt === null || Date.now() - lastLoadedAt >= REFRESH_INTERVAL_MS;

	const loadBalance = async (force = false): Promise<void> => {
		const token = localStorage.token;
		if (!token || !shouldRefresh(force)) return;
		if (inflightLoad) {
			await inflightLoad;
			return;
		}

		const hasExistingBalance = balance !== null;
		loading = !hasExistingBalance;
		refreshing = hasExistingBalance;
		hasError = false;

		inflightLoad = (async () => {
			try {
				balance = await getBalance(token);
				try {
					freeInfo = await getLeadMagnetInfo(token);
				} catch {
					freeInfo = null;
				}
				lastLoadedAt = Date.now();
				hasError = false;
			} catch (error) {
				console.error('Failed to load header billing balance:', error);
				hasError = true;
			} finally {
				loading = false;
				refreshing = false;
				inflightLoad = null;
			}
		})();

		await inflightLoad;
	};

	const handleWindowFocus = (): void => {
		void loadBalance();
	};

	const handleVisibilityChange = (): void => {
		if (document.visibilityState === 'visible') {
			void loadBalance();
		}
	};

	onMount(() => {
		void loadBalance(true);

		window.addEventListener('focus', handleWindowFocus);
		document.addEventListener('visibilitychange', handleVisibilityChange);
	});

	onDestroy(() => {
		window.removeEventListener('focus', handleWindowFocus);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	});

	$: returnTo = getBillingReturnTo($page.url, $chatId);
	$: totalBalanceKopeks =
		(balance?.balance_topup_kopeks ?? 0) + (balance?.balance_included_kopeks ?? 0);
	$: currency = balance?.currency ?? 'RUB';
	$: freeAvailable =
		hasFreeTextQuota(freeInfo) && $models.some((model) => model.info?.meta?.lead_magnet);
	$: isLowBalance =
		balance !== null &&
		!hasError &&
		!freeAvailable &&
		totalBalanceKopeks <= LOW_BALANCE_THRESHOLD_KOPEKS;
	$: balanceHref = buildBillingBalanceHref({ returnTo, src: 'header_balance' });
	$: topupHref = buildBillingBalanceHref({
		returnTo,
		focus: 'topup',
		src: 'header_topup'
	});
	$: amountLabel =
		balance !== null
			? formatMoney(totalBalanceKopeks, currency, getI18nLocale($i18n))
			: loading
				? '...'
				: '--';
</script>

<div
	class="shrink-0 {className}"
	data-testid="header-billing-access"
	data-state={hasError ? 'error' : isLowBalance ? 'low' : 'normal'}
>
	<div
		class="flex min-h-11 items-stretch overflow-hidden rounded-xl border border-gray-200/80 bg-white/85 shadow-sm shadow-black/[0.03] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80"
		data-testid="header-billing-shell"
	>
		<a
			href={balanceHref}
			class="group flex h-full min-w-0 items-center gap-1.5 px-2.5 text-left transition hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
			data-testid="header-billing-balance"
			aria-label={`${$i18n.t('Open wallet')}: ${amountLabel}${freeAvailable ? ', ' + $i18n.t('Free text quota available') : ''}${hasError ? ', ' + $i18n.t('Balance could not be refreshed') : ''}`}
		>
			<CreditCard
				className="size-4 shrink-0 {isLowBalance
					? 'text-amber-700 dark:text-amber-200'
					: 'text-gray-500 dark:text-gray-400'}"
				strokeWidth="1.7"
			/>

			<div
				class="min-w-[2.6rem] max-w-[10rem] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums text-[13px] font-semibold leading-none {isLowBalance
					? 'text-amber-800 dark:text-amber-100'
					: 'text-gray-900 dark:text-gray-50'}"
				data-testid="header-billing-amount"
				title={amountLabel}
			>
				{amountLabel}
				{#if freeAvailable}<span class="ml-1 text-xs text-emerald-700 dark:text-emerald-300"
						>{$i18n.t('Free')}</span
					>{/if}
				{#if refreshing}
					<span class="ml-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">•</span>
				{/if}
			</div>
		</a>

		<div class="my-auto h-4 w-px shrink-0 bg-gray-200/80 dark:bg-gray-800"></div>

		<a
			href={topupHref}
			class="flex h-full shrink-0 items-center justify-center px-2 text-gray-700 transition hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-50"
			data-testid="header-billing-topup"
			aria-label={$i18n.t('Top up balance')}
			title={$i18n.t('Top up balance')}
		>
			<Plus className="size-3.5" strokeWidth="2.2" />
			<span class="hidden pl-1 text-xs font-medium sm:inline">{$i18n.t('Top up balance')}</span>
		</a>
	</div>
</div>
