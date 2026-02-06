<script lang="ts">
	import { onDestroy, onMount, getContext, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME, models } from '$lib/stores';
	import {
		createTopup,
		getBalance,
		getLeadMagnetInfo,
		getPublicPricingConfig,
		updateAutoTopup,
		updateBillingSettings
	} from '$lib/apis/billing';
	import { getUserInfo } from '$lib/apis/users';
	import type { Balance, LeadMagnetInfo } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import UnifiedTimeline from '$lib/components/billing/UnifiedTimeline.svelte';
	import WalletTopupSection from '$lib/components/billing/WalletTopupSection.svelte';
	import WalletAutoTopupSection from '$lib/components/billing/WalletAutoTopupSection.svelte';
	import WalletSpendControls from '$lib/components/billing/WalletSpendControls.svelte';
	import WalletContactsSection from '$lib/components/billing/WalletContactsSection.svelte';
	import WalletLeadMagnetSection from '$lib/components/billing/WalletLeadMagnetSection.svelte';
	import WalletAdvancedSettings from '$lib/components/billing/WalletAdvancedSettings.svelte';
	import WalletHowItWorksModal from '$lib/components/billing/WalletHowItWorksModal.svelte';
	import InfoCircle from '$lib/components/icons/InfoCircle.svelte';
	import { trackEvent } from '$lib/utils/analytics';
	import { sanitizeReturnTo } from '$lib/utils/airis/return_to';

	const i18n = getContext('i18n');

	const DEFAULT_TOPUP_PACKAGES_KOPEKS = [100000, 150000, 500000, 1000000];
	const LOW_BALANCE_THRESHOLD_KOPEKS = 10000;
	const TOPUP_FLOW_STORAGE_KEY = 'billing_topup_flow_v1';
	const TOPUP_FLOW_TTL_MS = 10 * 60 * 1000;
	const TOPUP_RETURN_POLL_INTERVAL_MS = 3000;
	const TOPUP_RETURN_POLL_MAX_ATTEMPTS = 6;

	type TopupFlow = {
		started_at_ms: number;
		amount_kopeks: number;
		previous_total_kopeks: number;
		payment_id: string;
		return_to: string | null;
	};

	let loading = true;
	let refreshing = false;
	let balance: Balance | null = null;
	let errorMessage: string | null = null;
	let returnTo: string | null = null;
	let focusHint: 'topup' | 'limits' | 'auto_topup' | null = null;
	let topupPackages = DEFAULT_TOPUP_PACKAGES_KOPEKS;
	let allowCustomTopup = true;
	let highlightedPackageKopeks: number | null = null;
	let highlightedPackageLabel: string | null = null;
	let lastTopupKopeks: number | null = null;
	let topupFlow: TopupFlow | null = null;
	let topupReturnStatus: 'idle' | 'checking' | 'success' | 'pending' = 'idle';
	let topupReturnAttempts = 0;
	let topupReturnTimer: ReturnType<typeof setTimeout> | null = null;
	let topupReturnDismissed = false;
	let creatingTopupAmount: number | null = null;
	let savingAutoTopup = false;
	let leadMagnetInfo: LeadMagnetInfo | null = null;

	let savingPreferences = false;
	let maxReplyCost = '';
	let dailyCap = '';
	let contactEmail = '';
	let contactPhone = '';

	let customTopup = '';
	let customTopupKopeks: number | null = null;

	let autoTopupEnabled = false;
	let autoTopupThreshold = '';
	let autoTopupAmount = '';
	let advancedOpen = false;
	let advancedAutoLock = false;
	let lastTrackedStatus: 'success' | 'error' | null = null;
	let autoTopupBaseline = { enabled: false, threshold: '', amount: '' };
	let limitsBaseline = { maxReplyCost: '', dailyCap: '' };
	let contactsBaseline = { email: '', phone: '' };
	let requiredKopeksHint: number | null = null;
	let autoTopupDirty = false;
	let limitsDirty = false;
	let contactsDirty = false;
	let howItWorksOpen = false;

	$: returnTo = sanitizeReturnTo($page.url.searchParams.get('return_to'));
	$: requiredKopeksHint = (() => {
		const raw = $page.url.searchParams.get('required_kopeks');
		if (!raw) return null;
		const parsed = Number.parseInt(raw, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	})();
	$: autoTopupDirty =
		autoTopupEnabled !== autoTopupBaseline.enabled ||
		autoTopupThreshold !== autoTopupBaseline.threshold ||
		autoTopupAmount !== autoTopupBaseline.amount;
	$: limitsDirty =
		maxReplyCost !== limitsBaseline.maxReplyCost || dailyCap !== limitsBaseline.dailyCap;
	$: contactsDirty =
		contactEmail !== contactsBaseline.email || contactPhone !== contactsBaseline.phone;

	onMount(async () => {
		lastTopupKopeks = readLastTopupKopeks();
		void loadTopupConfig();

		const rawFocus = $page.url.searchParams.get('focus');
		if (rawFocus === 'topup' || rawFocus === 'limits' || rawFocus === 'auto_topup') {
			focusHint = rawFocus;
		}
		if (focusHint === 'limits' || focusHint === 'auto_topup') {
			advancedOpen = true;
			advancedAutoLock = true;
		}
		await loadBalance();
		await tick();
		applyFocusHint();
		await startTopupReturnCheck();
	});

	onDestroy(() => {
		if (topupReturnTimer) {
			clearTimeout(topupReturnTimer);
			topupReturnTimer = null;
		}
	});

	const loadTopupConfig = async (): Promise<void> => {
		try {
			const config = await getPublicPricingConfig();
			const amountsRub = config?.topup_amounts_rub ?? [];
			if (amountsRub.length > 0) {
				topupPackages = amountsRub.map((amount) => amount * 100);
				allowCustomTopup = false;
				return;
			}
		} catch (error) {
			console.warn('Failed to load public pricing config:', error);
		}
		topupPackages = DEFAULT_TOPUP_PACKAGES_KOPEKS;
		allowCustomTopup = true;
	};

	const readLastTopupKopeks = (): number | null => {
		try {
			const raw = localStorage.getItem('billing_last_topup_kopeks');
			if (!raw) return null;
			const parsed = Number.parseInt(raw, 10);
			return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
		} catch {
			return null;
		}
	};

	$: {
		if (requiredKopeksHint !== null) {
			const sorted = [...topupPackages].sort((a, b) => a - b);
			const match = sorted.find((amount) => amount >= requiredKopeksHint) ?? null;
			highlightedPackageKopeks = match ?? (sorted.at(-1) ?? null);
			highlightedPackageLabel = $i18n.t('Recommended top-up');
		} else if (lastTopupKopeks !== null && topupPackages.includes(lastTopupKopeks)) {
			highlightedPackageKopeks = lastTopupKopeks;
			highlightedPackageLabel = $i18n.t('Repeat last top-up');
		} else {
			highlightedPackageKopeks = null;
			highlightedPackageLabel = null;
		}
	}

	const readTopupFlowFromStorage = (): TopupFlow | null => {
		try {
			const raw = localStorage.getItem(TOPUP_FLOW_STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const startedAt = typeof parsed.started_at_ms === 'number' ? parsed.started_at_ms : null;
			const amount = typeof parsed.amount_kopeks === 'number' ? parsed.amount_kopeks : null;
			const previousTotal =
				typeof parsed.previous_total_kopeks === 'number' ? parsed.previous_total_kopeks : null;
			const paymentId = typeof parsed.payment_id === 'string' ? parsed.payment_id : null;
			const returnToParam = typeof parsed.return_to === 'string' ? parsed.return_to : null;
			if (!startedAt || !amount || previousTotal === null || !paymentId) return null;
			if (Date.now() - startedAt > TOPUP_FLOW_TTL_MS) return null;
			return {
				started_at_ms: startedAt,
				amount_kopeks: amount,
				previous_total_kopeks: previousTotal,
				payment_id: paymentId,
				return_to: sanitizeReturnTo(returnToParam)
			};
		} catch {
			return null;
		}
	};

	const clearTopupFlow = (): void => {
		try {
			localStorage.removeItem(TOPUP_FLOW_STORAGE_KEY);
		} catch {
			// ignore
		}
	};

	const handleTopupReturnRefresh = async (): Promise<void> => {
		await loadBalance({ showLoader: false });
		if (topupFlow && totalBalance > topupFlow.previous_total_kopeks) {
			topupReturnStatus = 'success';
			clearTopupFlow();
			if (topupReturnTimer) {
				clearTimeout(topupReturnTimer);
				topupReturnTimer = null;
			}
		}
	};

	const dismissTopupReturn = (): void => {
		topupReturnDismissed = true;
		if (topupReturnTimer) {
			clearTimeout(topupReturnTimer);
			topupReturnTimer = null;
		}
	};

	const scheduleTopupReturnCheck = (): void => {
		if (!topupFlow || topupReturnDismissed) return;
		if (topupReturnAttempts >= TOPUP_RETURN_POLL_MAX_ATTEMPTS) {
			topupReturnStatus = 'pending';
			return;
		}
		if (topupReturnTimer) {
			clearTimeout(topupReturnTimer);
			topupReturnTimer = null;
		}
		topupReturnTimer = setTimeout(async () => {
			topupReturnAttempts += 1;
			await loadBalance({ showLoader: false });
			if (!topupFlow) return;
			if (totalBalance > topupFlow.previous_total_kopeks) {
				topupReturnStatus = 'success';
				clearTopupFlow();
				if (topupReturnTimer) {
					clearTimeout(topupReturnTimer);
					topupReturnTimer = null;
				}
				return;
			}
			scheduleTopupReturnCheck();
		}, TOPUP_RETURN_POLL_INTERVAL_MS);
	};

	const startTopupReturnCheck = async (): Promise<void> => {
		if (topupReturnDismissed) return;
		const flow = readTopupFlowFromStorage();
		if (!flow) return;
		topupFlow = flow;
		if (totalBalance > flow.previous_total_kopeks) {
			topupReturnStatus = 'success';
			clearTopupFlow();
			return;
		}
		topupReturnStatus = 'checking';
		topupReturnAttempts = 0;
		scheduleTopupReturnCheck();
	};

	const loadBalance = async (options: { showLoader?: boolean } = {}): Promise<void> => {
		const showLoader = options.showLoader ?? balance === null;
		if (showLoader) {
			loading = true;
			errorMessage = null;
			leadMagnetInfo = null;
		} else {
			refreshing = true;
		}

		try {
			const balanceResult = await getBalance(localStorage.token);
			balance = balanceResult;
			autoTopupEnabled = balance?.auto_topup_enabled ?? false;
			autoTopupThreshold = formatMoneyInput(balance?.auto_topup_threshold_kopeks ?? null);
			autoTopupAmount = formatMoneyInput(balance?.auto_topup_amount_kopeks ?? null);
			maxReplyCost = formatMoneyInput(balance?.max_reply_cost_kopeks ?? null);
			dailyCap = formatMoneyInput(balance?.daily_cap_kopeks ?? null);

			try {
				const leadMagnetResult = await getLeadMagnetInfo(localStorage.token);
				leadMagnetInfo = leadMagnetResult;
			} catch (error) {
				console.error('Failed to load lead magnet info:', error);
				if (showLoader) {
					leadMagnetInfo = null;
				}
			}

			try {
				const infoResult = await getUserInfo(localStorage.token);
				contactEmail = infoResult?.billing_contact_email ?? '';
				contactPhone = infoResult?.billing_contact_phone ?? '';
			} catch (error) {
				console.error('Failed to load billing contacts:', error);
				if (showLoader) {
					contactEmail = '';
					contactPhone = '';
				}
			}

			autoTopupBaseline = {
				enabled: autoTopupEnabled,
				threshold: autoTopupThreshold,
				amount: autoTopupAmount
			};
			limitsBaseline = { maxReplyCost, dailyCap };
			contactsBaseline = { email: contactEmail, phone: contactPhone };

			const hasLimits =
				(balance?.max_reply_cost_kopeks ?? null) !== null ||
				(balance?.daily_cap_kopeks ?? null) !== null;
			const hasContacts = Boolean(contactEmail || contactPhone);
			const hasAutoTopup = balance?.auto_topup_enabled ?? false;
			if (!advancedAutoLock) {
				advancedOpen = hasAutoTopup || hasLimits || hasContacts;
			}
			if (lastTrackedStatus !== 'success') {
				trackEvent('billing_wallet_view', { status: 'success' });
				lastTrackedStatus = 'success';
			}
		} catch (error) {
			console.error('Failed to load balance:', error);
			if (showLoader) {
				errorMessage = $i18n.t('Failed to load balance');
				balance = null;
				leadMagnetInfo = null;
				if (lastTrackedStatus !== 'error') {
					trackEvent('billing_wallet_view', { status: 'error' });
					lastTrackedStatus = 'error';
				}
			} else {
				toast.error($i18n.t('Failed to load balance'));
			}
		} finally {
			loading = false;
			refreshing = false;
		}
	};

	const handleTopup = async (
		amountKopeks: number,
		source: 'package' | 'custom' = 'package'
	): Promise<void> => {
		if (creatingTopupAmount !== null) return;
		creatingTopupAmount = amountKopeks;

		try {
			if (source === 'package') {
				trackEvent('billing_wallet_topup_package_click', { amount_kopeks: amountKopeks });
			} else {
				trackEvent('billing_wallet_topup_custom_submit', { amount_kopeks: amountKopeks });
			}
			const params = new URLSearchParams();
			params.set('topup_return', '1');
			if (returnTo) {
				params.set('return_to', returnTo);
			}
			const returnUrl = `${window.location.origin}/billing/balance?${params.toString()}`;
			const result = await createTopup(localStorage.token, amountKopeks, returnUrl);
			if (result?.confirmation_url) {
				try {
					localStorage.setItem('billing_last_topup_kopeks', String(amountKopeks));
					lastTopupKopeks = amountKopeks;
				} catch {
					// ignore
				}
				if (result.payment_id) {
					const flow: TopupFlow = {
						started_at_ms: Date.now(),
						amount_kopeks: amountKopeks,
						previous_total_kopeks: totalBalance,
						payment_id: result.payment_id,
						return_to: returnTo
					};
					try {
						localStorage.setItem(TOPUP_FLOW_STORAGE_KEY, JSON.stringify(flow));
					} catch {
						// ignore
					}
				}
				window.location.href = result.confirmation_url;
				return;
			}
			toast.error($i18n.t('Failed to create topup'));
		} catch (error) {
			console.error('Failed to create topup:', error);
			toast.error($i18n.t('Failed to create topup'));
		} finally {
			creatingTopupAmount = null;
		}
	};

	const handleSaveAutoTopup = async (): Promise<void> => {
		if (!balance) return;
		savingAutoTopup = true;
		try {
			const threshold = parseMoneyInput(autoTopupThreshold);
			const amount = parseMoneyInput(autoTopupAmount);

			if (autoTopupEnabled && (threshold === null || amount === null)) {
				toast.error($i18n.t('Enter threshold and amount for auto-topup'));
				return;
			}

			await updateAutoTopup(localStorage.token, {
				enabled: autoTopupEnabled,
				threshold_kopeks: autoTopupEnabled ? (threshold ?? undefined) : undefined,
				amount_kopeks: autoTopupEnabled ? (amount ?? undefined) : undefined
			});

			trackEvent('billing_wallet_auto_topup_save', {
				enabled: autoTopupEnabled,
				threshold_kopeks: autoTopupEnabled ? threshold : null,
				amount_kopeks: autoTopupEnabled ? amount : null
			});
			toast.success($i18n.t('Auto-topup settings saved'));
			autoTopupBaseline = {
				enabled: autoTopupEnabled,
				threshold: autoTopupThreshold,
				amount: autoTopupAmount
			};
			// Avoid wiping other unsaved inputs (contacts/limits) by reloading the whole page state.
			// Balance is updated optimistically; a full refresh will still reconcile with backend state.
			balance = {
				...balance,
				auto_topup_enabled: autoTopupEnabled,
				auto_topup_threshold_kopeks: autoTopupEnabled
					? (threshold ?? balance.auto_topup_threshold_kopeks)
					: balance.auto_topup_threshold_kopeks,
				auto_topup_amount_kopeks: autoTopupEnabled
					? (amount ?? balance.auto_topup_amount_kopeks)
					: balance.auto_topup_amount_kopeks
			};
		} catch (error) {
			console.error('Failed to update auto-topup:', error);
			toast.error($i18n.t('Failed to update auto-topup'));
		} finally {
			savingAutoTopup = false;
		}
	};

	const handleSavePreferences = async (source: 'limits' | 'contacts'): Promise<void> => {
		if (!balance) return;
		savingPreferences = true;
		try {
			const payload: {
				max_reply_cost_kopeks?: number | null;
				daily_cap_kopeks?: number | null;
				billing_contact_email?: string | null;
				billing_contact_phone?: string | null;
			} = {};

			if (source === 'limits') {
				const maxReply = parseMoneyInput(maxReplyCost);
				const daily = parseMoneyInput(dailyCap);

				if (maxReplyCost && maxReply === null) {
					toast.error(
						$i18n.t('Invalid value for {label}', { label: $i18n.t('Max reply cost') })
					);
					return;
				}
				if (dailyCap && daily === null) {
					toast.error($i18n.t('Invalid value for {label}', { label: $i18n.t('Daily cap') }));
					return;
				}

				payload.max_reply_cost_kopeks = maxReply;
				payload.daily_cap_kopeks = daily;

				trackEvent('billing_wallet_limits_save', {
					max_reply_cost_kopeks: maxReply,
					daily_cap_kopeks: daily
				});
			} else {
				payload.billing_contact_email = contactEmail ? contactEmail : null;
				payload.billing_contact_phone = contactPhone ? contactPhone : null;

				trackEvent('billing_wallet_contacts_save', {
					has_email: Boolean(contactEmail),
					has_phone: Boolean(contactPhone)
				});
			}

			await updateBillingSettings(localStorage.token, payload);
			toast.success($i18n.t('Billing settings saved'));
			if (source === 'limits') {
				limitsBaseline = { maxReplyCost, dailyCap };
				balance = {
					...balance,
					max_reply_cost_kopeks:
						typeof payload.max_reply_cost_kopeks === 'number' ||
						payload.max_reply_cost_kopeks === null
							? payload.max_reply_cost_kopeks
							: balance.max_reply_cost_kopeks,
					daily_cap_kopeks:
						typeof payload.daily_cap_kopeks === 'number' || payload.daily_cap_kopeks === null
							? payload.daily_cap_kopeks
							: balance.daily_cap_kopeks
				};
			} else {
				contactsBaseline = { email: contactEmail, phone: contactPhone };
			}
		} catch (error) {
			console.error('Failed to update billing settings:', error);
			toast.error($i18n.t('Failed to update billing settings'));
		} finally {
			savingPreferences = false;
		}
	};

	const formatMoney = (kopeks: number | null | undefined, currency: string): string => {
		if (kopeks === null || kopeks === undefined) {
			return $i18n.t('Not set');
		}
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currency, error);
			return `${amount.toFixed(2)} ${currency}`.trim();
		}
	};

	const formatMoneyInput = (kopeks: number | null): string => {
		if (kopeks === null || kopeks === undefined) return '';
		return (kopeks / 100).toFixed(2);
	};

	const parseMoneyInput = (value: string): number | null => {
		if (!value) return null;
		const normalized = value.replace(',', '.');
		const parsed = Number.parseFloat(normalized);
		if (Number.isNaN(parsed) || parsed < 0) {
			return null;
		}
		return Math.round(parsed * 100);
	};

	const scrollToTopup = () => {
		const target = document.getElementById('topup-section');
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const scrollToFreeLimit = () => {
		const target = document.getElementById('free-limit-section');
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const scrollToAdvanced = () => {
		const target = document.getElementById('advanced-settings-section');
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const scrollToAutoTopup = () => {
		const target = document.getElementById('auto-topup-section');
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const applyFocusHint = (): void => {
		if (focusHint === 'topup') {
			scrollToTopup();
			return;
		}
		if (focusHint === 'auto_topup') {
			scrollToAutoTopup();
			return;
		}
		if (focusHint === 'limits') {
			scrollToAdvanced();
		}
	};

	const handleAdvancedToggle = (open: boolean): void => {
		advancedOpen = open;
		advancedAutoLock = true;
		trackEvent('billing_wallet_advanced_toggle', { open });
	};

	const openHowItWorks = (): void => {
		howItWorksOpen = true;
		trackEvent('billing_wallet_how_it_works_open');
	};

	const handleHowItWorksLimits = async (): Promise<void> => {
		advancedOpen = true;
		advancedAutoLock = true;
		await tick();
		scrollToAdvanced();
	};

	const buildBillingPath = (pathname: string): string => {
		if (!returnTo) return pathname;
		const params = new URLSearchParams();
		params.set('return_to', returnTo);
		return `${pathname}?${params.toString()}`;
	};

	const handleHistoryClick = async (event: MouseEvent): Promise<void> => {
		if (
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			event.button !== 0
		) {
			return;
		}
		event.preventDefault();
		trackEvent('billing_wallet_history_click');
		await goto(buildBillingPath('/billing/history'));
	};

	const handleReturnToClick = async (event: MouseEvent): Promise<void> => {
		if (!returnTo) return;
		if (
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			event.button !== 0
		) {
			return;
		}
		event.preventDefault();
		trackEvent('billing_wallet_return_to_chat_click');
		await goto(returnTo);
	};

	const formatDateTime = (timestamp: number | null | undefined): string => {
		if (!timestamp) return $i18n.t('Never');
		return new Date(timestamp * 1000).toLocaleString($i18n.locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	$: customTopupKopeks = parseMoneyInput(customTopup);
	$: totalBalance = (balance?.balance_topup_kopeks ?? 0) + (balance?.balance_included_kopeks ?? 0);
	$: isLowBalance = totalBalance < LOW_BALANCE_THRESHOLD_KOPEKS;

	$: leadMagnetModels =
		$models
			?.filter((model) => model.info?.meta?.lead_magnet)
			.map((model) => ({ id: model.id, name: model.name ?? model.id })) ?? [];
	const leadMagnetModelsReady = true;
	$: leadMagnetHasRemaining = (() => {
		if (!leadMagnetInfo?.enabled) return false;

		// Prefer server-provided remaining, but keep a local fallback for robustness.
		const remaining = (leadMagnetInfo.remaining ?? {}) as Record<string, number | undefined>;
		if (Object.values(remaining).some((value) => typeof value === 'number' && value > 0)) {
			return true;
		}

		const quotas = (leadMagnetInfo.quotas ?? {}) as Record<string, number | undefined>;
		const usage = (leadMagnetInfo.usage ?? {}) as Record<string, number | undefined>;
		return Object.entries(quotas).some(([key, limit]) => {
			if (typeof limit !== 'number' || limit <= 0) return false;
			const used = usage[key] ?? 0;
			return limit - used > 0;
		});
	})();
	$: freeUsageAvailable =
		Boolean(leadMagnetInfo?.enabled) && leadMagnetHasRemaining;
</script>

<svelte:head>
	<title>
		{$i18n.t('Wallet')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loading}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else if errorMessage}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">{errorMessage}</div>
			<button
				type="button"
				on:click={loadBalance}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else if !balance}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">
				{$i18n.t('No balance information available')}
			</div>
		</div>
	</div>
{:else}
	<div class="w-full">
		<div class="space-y-4">
			<WalletHowItWorksModal
				bind:open={howItWorksOpen}
				onTopup={scrollToTopup}
				onLimits={handleHowItWorksLimits}
			/>

			{#if topupReturnStatus !== 'idle' && !topupReturnDismissed && topupFlow}
				<div
					class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-start gap-3">
							{#if topupReturnStatus === 'checking'}
								<div class="pt-0.5">
									<Spinner className="size-4" />
								</div>
							{:else if topupReturnStatus === 'success'}
								<div
									class="mt-0.5 size-4 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[11px] font-semibold"
								>
									✓
								</div>
							{:else}
								<div
									class="mt-0.5 size-4 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[11px] font-semibold"
								>
									…
								</div>
							{/if}
							<div>
								<div class="text-sm font-medium">
									{#if topupReturnStatus === 'checking'}
										{$i18n.t('Checking top-up…')}
									{:else if topupReturnStatus === 'success'}
										{$i18n.t('Top-up successful')}
									{:else}
										{$i18n.t('Top-up is processing')}
									{/if}
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{$i18n.t('Top-up')}: {formatMoney(topupFlow.amount_kopeks, balance.currency)}
									{#if topupReturnStatus !== 'success'}
										<span class="mx-1">•</span>
										{$i18n.t('This may take a minute')}
									{/if}
								</div>
							</div>
						</div>
						<button
							type="button"
							aria-label={$i18n.t('Close')}
							on:click={dismissTopupReturn}
							class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition px-2 -my-1"
						>
							&times;
						</button>
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						{#if topupReturnStatus !== 'success'}
							<button
								type="button"
								on:click={handleTopupReturnRefresh}
								disabled={refreshing}
								class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							>
								{refreshing ? $i18n.t('Loading…') : $i18n.t('Refresh')}
							</button>
						{/if}
						{#if returnTo}
							<a
								href={returnTo}
								on:click={handleReturnToClick}
								class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							>
								{$i18n.t('Back to chat')}
							</a>
						{/if}
					</div>
				</div>
			{/if}

			<div
				class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-5"
			>
				<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-xl font-medium">{$i18n.t('Wallet')}</h1>
							{#if isLowBalance}
								<span
									class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300"
								>
									{$i18n.t('Low balance')}
								</span>
							{/if}
						</div>
						<div class="text-sm text-gray-500 mt-1">
							{$i18n.t('Top up and control spending')}
						</div>
						<div class="mt-1 flex flex-wrap items-center gap-3">
							<button
								type="button"
								class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
								on:click={openHowItWorks}
							>
								<InfoCircle className="size-4" />
								<span>{$i18n.t('How billing works')}</span>
							</button>
							<a
								href="/pricing"
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
								on:click={() => trackEvent('billing_wallet_pricing_click')}
							>
								<span>{$i18n.t('Pricing')}</span>
							</a>
						</div>
					</div>
					<div class="flex items-center gap-2">
						{#if returnTo}
							<a
								href={returnTo}
								on:click={handleReturnToClick}
								class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								{$i18n.t('Back to chat')}
							</a>
						{/if}
						<a
							href={buildBillingPath('/billing/history')}
							on:click={handleHistoryClick}
							class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
						>
							{$i18n.t('View history')}
						</a>
						<button
							type="button"
							on:click={scrollToTopup}
							class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium {isLowBalance
								? 'ring-2 ring-amber-500/40'
								: ''}"
						>
							{$i18n.t('Top up')}
						</button>
					</div>
				</div>

				<div class="mt-4">
					<div class="flex items-center gap-1 text-sm text-gray-500">
						<span>{$i18n.t('Available now')}</span>
						<Tooltip content={$i18n.t('Available now help')} placement="top">
							<span
								class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
							>
								<InfoCircle className="size-4" />
							</span>
						</Tooltip>
					</div>
					<div class="text-3xl font-semibold mt-1">
						{formatMoney(totalBalance, balance.currency)}
					</div>
					<div class="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
						<span>
							{$i18n.t('From wallet')}:{' '}
							{formatMoney(balance.balance_topup_kopeks, balance.currency)}
						</span>
						{#if balance.balance_included_kopeks > 0}
							<span>
								{$i18n.t('From plan')}:{' '}
								{formatMoney(balance.balance_included_kopeks, balance.currency)}
							</span>
							<span>
								{$i18n.t('Included expires')}: {formatDateTime(balance.included_expires_at)}
							</span>
						{/if}
					</div>
					{#if isLowBalance}
						<div class="text-xs text-amber-700 dark:text-amber-300 mt-2">
							{#if freeUsageAvailable}
								{$i18n.t('Wallet is low but free limit is available')}{' '}
								<button
									type="button"
									class="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 transition"
									on:click={scrollToFreeLimit}
								>
									{$i18n.t('Free limit')}
								</button>
							{:else}
								{$i18n.t('Top up to keep working')}
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class={`grid gap-4 ${leadMagnetInfo?.enabled ? 'lg:grid-cols-2' : ''}`}>
			<WalletTopupSection
				currency={balance.currency}
				defaultPackages={topupPackages}
				allowCustom={allowCustomTopup}
				highlightedPackageKopeks={highlightedPackageKopeks}
				highlightedPackageLabel={highlightedPackageLabel}
				creatingTopupAmount={creatingTopupAmount}
				bind:customTopup
				customTopupKopeks={customTopupKopeks}
				onTopup={handleTopup}
			/>

				{#if leadMagnetInfo?.enabled}
					<WalletLeadMagnetSection
						leadMagnetInfo={leadMagnetInfo as LeadMagnetInfo}
						models={leadMagnetModels}
						modelsReady={leadMagnetModelsReady}
					/>
				{/if}
			</div>

			<div id="advanced-settings-section">
				<WalletAdvancedSettings
					bind:open={advancedOpen}
					title={$i18n.t('Manage limits & auto-topup')}
					helper={$i18n.t('Rarely used settings')}
					onToggle={handleAdvancedToggle}
				>
					<div id="auto-topup-section">
						<WalletAutoTopupSection
							bind:autoTopupEnabled
							bind:autoTopupThreshold
							bind:autoTopupAmount
							savingAutoTopup={savingAutoTopup}
							dirty={autoTopupDirty}
							paymentMethodSaved={balance.auto_topup_payment_method_saved ?? false}
							autoTopupFailCount={balance.auto_topup_fail_count ?? 0}
							autoTopupLastFailedAt={balance.auto_topup_last_failed_at}
							onSave={handleSaveAutoTopup}
						/>
					</div>
					<WalletSpendControls
						bind:maxReplyCost
						bind:dailyCap
						currentMaxReply={balance.max_reply_cost_kopeks ?? null}
						currentDailyCap={balance.daily_cap_kopeks ?? null}
						dailySpent={balance.daily_spent_kopeks ?? null}
						dailyResetAt={balance.daily_reset_at ?? null}
						currency={balance.currency}
						savingPreferences={savingPreferences}
						dirty={limitsDirty}
						onSave={() => handleSavePreferences('limits')}
					/>
					<WalletContactsSection
						bind:contactEmail
						bind:contactPhone
						savingPreferences={savingPreferences}
						dirty={contactsDirty}
						onSave={() => handleSavePreferences('contacts')}
					/>
				</WalletAdvancedSettings>
			</div>

			<div
				class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
			>
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium">{$i18n.t('Latest activity')}</div>
					<a
						href={buildBillingPath('/billing/history')}
						on:click={handleHistoryClick}
						class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
					>
						{$i18n.t('View all activity')}
					</a>
				</div>
				<UnifiedTimeline
					pageSize={6}
					maxItems={6}
					showFilters={false}
					showLoadMore={false}
					emptyActionLabel={$i18n.t('Top up')}
					onEmptyAction={scrollToTopup}
					currency={balance.currency}
				/>
			</div>
		</div>
	</div>
{/if}
