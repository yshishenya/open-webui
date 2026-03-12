<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';

	import { page } from '$app/stores';

	import { getBalance, type Balance } from '$lib/apis/billing';
	import CreditCard from '$lib/components/icons/CreditCard.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import { buildBillingBalanceHref } from '$lib/utils/airis/billing_block';
	import { sanitizeReturnTo } from '$lib/utils/airis/return_to';

	const i18n = getContext('i18n');

	const LOW_BALANCE_THRESHOLD_KOPEKS = 10_000;
	const REFRESH_INTERVAL_MS = 45_000;

	export let className = '';

	let balance: Balance | null = null;
	let loading = true;
	let refreshing = false;
	let hasError = false;
	let lastLoadedAt: number | null = null;
	let inflightLoad: Promise<void> | null = null;
	let queryReturnTo: string | null = null;
	let currentPathReturnTo: string | null = null;
	let returnTo: string | null = null;
	let totalBalanceKopeks = 0;
	let currency = 'RUB';
	let isLowBalance = false;
	let balanceHref = '/billing/balance';
	let topupHref = '/billing/balance?focus=topup';
	let amountLabel = '';

	const formatMoney = (kopeks: number, currencyCode: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
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

	$: queryReturnTo = sanitizeReturnTo($page.url.searchParams.get('return_to'));
	$: currentPathReturnTo = sanitizeReturnTo(`${$page.url.pathname}${$page.url.search}`);
	$: returnTo = queryReturnTo ?? currentPathReturnTo;
	$: totalBalanceKopeks =
		(balance?.balance_topup_kopeks ?? 0) + (balance?.balance_included_kopeks ?? 0);
	$: currency = balance?.currency ?? 'RUB';
	$: isLowBalance = balance !== null && totalBalanceKopeks <= LOW_BALANCE_THRESHOLD_KOPEKS;
	$: balanceHref = buildBillingBalanceHref({ returnTo, src: 'header_balance' });
	$: topupHref = buildBillingBalanceHref({
		returnTo,
		focus: 'topup',
		src: 'header_topup'
	});
	$: amountLabel =
		balance !== null
			? formatMoney(totalBalanceKopeks, currency)
			: loading
				? '...'
				: '--';
</script>

<div
	class="shrink-0 {className}"
	data-testid="header-billing-access"
	data-state={isLowBalance ? 'low' : hasError ? 'error' : 'normal'}
>
	<div
		class="flex items-center rounded-full border border-gray-200/80 bg-white/85 p-1 shadow-sm shadow-black/[0.03] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80"
	>
		<a
			href={balanceHref}
			class="group flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-left transition hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
			data-testid="header-billing-balance"
			aria-label={$i18n.t('Open wallet')}
		>
			<div
				class="flex size-7 shrink-0 items-center justify-center rounded-full transition {isLowBalance
					? 'bg-amber-500/12 text-amber-700 dark:bg-amber-400/14 dark:text-amber-200'
					: 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/14 dark:text-sky-200'}"
			>
				<CreditCard className="size-4" strokeWidth="1.7" />
			</div>

			<div
				class="min-w-0 truncate tabular-nums text-[13px] font-semibold leading-none {isLowBalance
					? 'text-amber-800 dark:text-amber-100'
					: 'text-gray-900 dark:text-gray-50'}"
				data-testid="header-billing-amount"
			>
				{amountLabel}
				{#if refreshing}
					<span class="ml-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">•</span>
				{/if}
			</div>
		</a>

		<div class="mx-0.5 h-5 w-px shrink-0 bg-gray-200/80 dark:bg-gray-800"></div>

		<a
			href={topupHref}
			class="flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
			data-testid="header-billing-topup"
			aria-label={$i18n.t('Top up')}
		>
			<Plus className="size-4" strokeWidth="2.2" />
		</a>
	</div>
</div>
