<script lang="ts">
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { getContext, onDestroy, onMount } from 'svelte';

	import { page } from '$app/stores';

	import { getLeadMagnetInfo, type Balance, type LeadMagnetInfo } from '$lib/apis/billing';
	import { chatId, models, socket } from '$lib/stores';
	import { hasFreeTextQuota } from '$lib/utils/airis/billing_ui';
	import CreditCard from '$lib/components/icons/CreditCard.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import { buildBillingBalanceHref } from '$lib/utils/airis/billing_block';
	import { getBillingReturnTo } from '$lib/utils/airis/return_to';
	import {
		loadWalletBalance as getBalance,
		WALLET_BALANCE_EVENT
	} from '$lib/utils/airis/wallet_settings';

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
	let destroyed = false;
	let balanceRevision = 0;
	let removeSocketListener: () => void = () => {};
	let unsubscribeSocket: () => void = () => {};

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

	const loadBalance = async (force = false, fresh = false): Promise<void> => {
		const token = localStorage.token;
		if (!token || !shouldRefresh(force)) return;
		if (inflightLoad) {
			await inflightLoad;
			if (force && !destroyed) await loadBalance(true, fresh);
			return;
		}

		const hasExistingBalance = balance !== null;
		loading = !hasExistingBalance;
		refreshing = hasExistingBalance;
		hasError = false;

		inflightLoad = (async () => {
			try {
				const current = await getBalance(token, fresh);
				if (destroyed || localStorage.token !== token) return;
				if (!current) throw new Error('No confirmed wallet state');
				balance = current;
				const revision = balanceRevision;
				try {
					const info = await getLeadMagnetInfo(token);
					if (!destroyed && localStorage.token === token && revision === balanceRevision)
						freeInfo = info;
				} catch {
					if (!destroyed && localStorage.token === token && revision === balanceRevision)
						freeInfo = null;
				}
				if (destroyed || localStorage.token !== token || revision !== balanceRevision) return;
				lastLoadedAt = Date.now();
				hasError = false;
			} catch (error) {
				if (destroyed || localStorage.token !== token) return;
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
		void loadBalance(true, true);
	};

	const handleVisibilityChange = (): void => {
		if (document.visibilityState === 'visible') {
			void loadBalance(true, true);
		}
	};
	const handleWalletBalance = (event: Event): void => {
		if (!(event instanceof CustomEvent)) return;
		const current = (event as CustomEvent<Balance | null>).detail;
		balanceRevision += 1;
		hasError = current === null;
		if (current) {
			balance = current;
			lastLoadedAt = Date.now();
			loading = false;
		}
	};
	const handleWalletRefresh = (): void => {
		void loadBalance(true, true);
	};
	const handleChatEvent = (event: {
		data?: { type?: string; data?: { active?: boolean } };
	}): void => {
		const payload = event.data;
		// Completion chunks can precede settlement; task inactivity follows server cleanup.
		if (payload?.type === 'chat:active' && payload.data?.active === false) handleWalletRefresh();
	};

	onMount(() => {
		window.addEventListener(WALLET_BALANCE_EVENT, handleWalletBalance);
		unsubscribeSocket = socket.subscribe((client) => {
			removeSocketListener();
			client?.on('events', handleChatEvent);
			removeSocketListener = () => {
				client?.off('events', handleChatEvent);
			};
		});
		void loadBalance(true);

		window.addEventListener('focus', handleWindowFocus);
		document.addEventListener('visibilitychange', handleVisibilityChange);
	});

	onDestroy(() => {
		destroyed = true;
		window.removeEventListener(WALLET_BALANCE_EVENT, handleWalletBalance);
		unsubscribeSocket();
		removeSocketListener();
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
			class="group flex min-h-11 min-w-0 items-center gap-1.5 px-2.5 text-left transition hover:bg-gray-100/80 dark:hover:bg-gray-800/80 focus-visible:ring-2 focus-visible:ring-inset"
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
				class="min-w-0 whitespace-nowrap tabular-nums text-[13px] font-semibold leading-tight {isLowBalance
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
			class="flex min-h-11 min-w-11 shrink-0 items-center justify-center px-2 text-gray-700 transition hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-50 focus-visible:ring-2 focus-visible:ring-inset"
			data-testid="header-billing-topup"
			aria-label={$i18n.t('Top up balance')}
			title={$i18n.t('Top up balance')}
		>
			<Plus className="size-3.5" strokeWidth="2.2" />
			<span class="hidden pl-1 text-xs font-medium lg:inline">{$i18n.t('Top up balance')}</span>
		</a>
	</div>
</div>
