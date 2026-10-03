<script lang="ts">
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { browserTracksPayments } from '$lib/utils/airis/funnelAnalytics';
	import { onDestroy, onMount, getContext, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';

	import { WEBUI_NAME, models } from '$lib/stores';
	import {
		createTopup,
		getBalance,
		getLeadMagnetInfo,
		getPublicPricingConfig,
		reconcileTopup,
		updateAutoTopup,
		updateBillingSettings
	} from '$lib/apis/billing';
	import { getUserInfo } from '$lib/apis/users';
	import type { Balance, LeadMagnetInfo } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import UnifiedTimeline from '$lib/components/billing/UnifiedTimeline.svelte';
	import WalletPeriodSummary from '$lib/components/billing/WalletPeriodSummary.svelte';
	import WalletTopupSection from '$lib/components/billing/WalletTopupSection.svelte';
	import WalletAutoTopupSection from '$lib/components/billing/WalletAutoTopupSection.svelte';
	import WalletSpendControls from '$lib/components/billing/WalletSpendControls.svelte';
	import WalletContactsSection from '$lib/components/billing/WalletContactsSection.svelte';
	import WalletLeadMagnetSection from '$lib/components/billing/WalletLeadMagnetSection.svelte';
	import WalletHowItWorksModal from '$lib/components/billing/WalletHowItWorksModal.svelte';
	import InfoCircle from '$lib/components/icons/InfoCircle.svelte';
	import { trackEcommercePurchase, trackEvent } from '$lib/utils/analytics';
	import {
		buildTopupReturnUrl,
		normalizeBillingReturnPath,
		withBasePath
	} from '$lib/utils/airis/billing_return_url';
	import { sanitizeReturnTo } from '$lib/utils/airis/return_to';
	import {
		parseBillingMoney,
		hasFreeTextQuota,
		paymentReturnState,
		type PaymentReturnState
	} from '$lib/utils/airis/billing_ui';

	const i18n = getContext<Readable<I18nType>>('i18n');

	const DEFAULT_TOPUP_PACKAGES_KOPEKS = [50000, 100000, 200000];
	const LOW_BALANCE_THRESHOLD_KOPEKS = 10000;
	let destroyed = false;
	let balanceRequest = 0;
	let checkingTopup = false;
	let reconcileInFlight: Promise<boolean> | null = null;
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
	let normalizedReturnTo: string | null = null;
	let settingsView = false;
	let selectedFrom = '';
	let selectedTo = '';
	let focusHint: 'topup' | 'limits' | 'auto_topup' | null = null;
	let topupPackages = DEFAULT_TOPUP_PACKAGES_KOPEKS;
	let allowCustomTopup = true;
	let highlightedPackageKopeks: number | null = null;
	let highlightedPackageLabel: string | null = null;
	let lastTopupKopeks: number | null = null;
	let topupFlow: TopupFlow | null = null;
	let topupReturnStatus: PaymentReturnState = 'idle';
	let leadMagnetError = false;
	let contactsError = false;
	let saveResult = '';
	let saveSource: 'limits' | 'contacts' | 'auto' | '' = '';
	let limitsError = '';
	let autoTopupError = '';
	let contactsSaveError = '';
	let topupReturnAttempts = 0;
	let topupReturnTimer: ReturnType<typeof setTimeout> | null = null;
	let topupReturnDismissed = false;
	let recentActivityRevision = 0;
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
	$: settingsView =
		$page.url.pathname === '/billing/balance' &&
		['limits', 'auto_topup'].includes($page.url.searchParams.get('focus') ?? '');
	$: normalizedReturnTo = normalizeBillingReturnPath(returnTo, {
		origin: $page.url.origin,
		basePath: base
	});
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

		await loadBalance();
		if (destroyed) return;
		await tick();
		if (destroyed) return;
		applyFocusHint();
		await startTopupReturnCheck();
	});

	onDestroy(() => {
		destroyed = true;
		balanceRequest++;
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
		// Keep the UI aligned with the server allowlist when pricing discovery is unavailable.
		allowCustomTopup = false;
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
			const shortfall = Math.max(0, requiredKopeksHint - totalBalance);
			const match = sorted.find((amount) => amount >= shortfall) ?? null;
			highlightedPackageKopeks = match ?? sorted.at(-1) ?? null;
			highlightedPackageLabel = $i18n.t('Recommended top-up');
		} else if (lastTopupKopeks !== null && topupPackages.includes(lastTopupKopeks)) {
			highlightedPackageKopeks = lastTopupKopeks;
			highlightedPackageLabel = $i18n.t('Last selected amount');
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

	const getTotalBalanceKopeks = (current: Balance | null): number => {
		return (current?.balance_topup_kopeks ?? 0) + (current?.balance_included_kopeks ?? 0);
	};

	const reconcileStoredTopup = async (): Promise<boolean> => {
		if (reconcileInFlight) return reconcileInFlight;
		const paymentId = topupFlow?.payment_id;
		if (!paymentId) return false;
		reconcileInFlight = (async () => {
			try {
				const result = await reconcileTopup(localStorage.token, paymentId);
				if (destroyed || paymentId !== topupFlow?.payment_id) return false;
				topupReturnStatus = paymentReturnState(result);
				const credited = topupReturnStatus === 'success';
				if (credited) recentActivityRevision += 1;
				return credited;
			} finally {
				reconcileInFlight = null;
			}
		})();
		return reconcileInFlight;
	};

	const trackTopupCompleted = (): void => {
		if (destroyed || !topupFlow) return;
		const completed = { ...topupFlow };
		const currency = balance?.currency ?? 'RUB';
		// Resolve the authoritative transport before emitting; analytics never delays wallet UI.
		void browserTracksPayments().then((browserEnabled) => {
			if (!browserEnabled) return;
			trackEvent('billing_topup_completed', { amount_kopeks: completed.amount_kopeks });
			trackEcommercePurchase({
				id: completed.payment_id,
				revenue: completed.amount_kopeks / 100,
				currency
			});
		});
	};

	const handleTopupReturnRefresh = async (): Promise<void> => {
		if (checkingTopup || refreshing || destroyed) return;
		checkingTopup = true;
		try {
			let credited = false;
			if (topupFlow?.payment_id) {
				try {
					credited = await reconcileStoredTopup();
				} catch (error) {
					console.warn('Failed to reconcile topup on manual refresh:', error);
					topupReturnStatus = 'unknown';
				}
			}
			await loadBalance({ showLoader: false });
			if (topupFlow && credited) {
				trackTopupCompleted();
				topupReturnStatus = 'success';
				clearTopupFlow();
				if (topupReturnTimer) {
					clearTimeout(topupReturnTimer);
					topupReturnTimer = null;
				}
			}
		} finally {
			checkingTopup = false;
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
		if (destroyed) return;
		if (!topupFlow || topupReturnDismissed) return;
		if (topupReturnStatus === 'canceled' || topupReturnAttempts >= TOPUP_RETURN_POLL_MAX_ATTEMPTS)
			return;
		if (topupReturnTimer) {
			clearTimeout(topupReturnTimer);
			topupReturnTimer = null;
		}
		topupReturnTimer = setTimeout(async () => {
			if (destroyed) return;
			if (checkingTopup) {
				scheduleTopupReturnCheck();
				return;
			}
			topupReturnAttempts += 1;
			let credited = false;
			if (topupFlow?.payment_id) {
				try {
					credited = await reconcileStoredTopup();
				} catch (error) {
					console.warn('Failed to reconcile topup during polling:', error);
					topupReturnStatus = 'unknown';
				}
			}
			await loadBalance({ showLoader: false });
			if (destroyed || !topupFlow) return;
			if (credited) {
				trackTopupCompleted();
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
		if (destroyed || topupReturnDismissed) return;
		const flow = readTopupFlowFromStorage();
		if (!flow) return;
		topupFlow = flow;
		topupReturnStatus = 'checking';
		topupReturnAttempts = 0;
		scheduleTopupReturnCheck();
	};

	const loadBalance = async (options: { showLoader?: boolean } = {}): Promise<void> => {
		const version = ++balanceRequest;
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
			if (destroyed || version !== balanceRequest) return;
			balance = balanceResult;
			if (!autoTopupDirty) {
				autoTopupEnabled = balance?.auto_topup_enabled ?? false;
				autoTopupThreshold = formatMoneyInput(balance?.auto_topup_threshold_kopeks ?? null);
				autoTopupAmount = formatMoneyInput(balance?.auto_topup_amount_kopeks ?? null);
				autoTopupBaseline = {
					enabled: autoTopupEnabled,
					threshold: autoTopupThreshold,
					amount: autoTopupAmount
				};
			}
			if (!limitsDirty) {
				maxReplyCost = formatMoneyInput(balance?.max_reply_cost_kopeks ?? null);
				dailyCap = formatMoneyInput(balance?.daily_cap_kopeks ?? null);
				limitsBaseline = { maxReplyCost, dailyCap };
			}

			try {
				const leadMagnetResult = await getLeadMagnetInfo(localStorage.token);
				if (destroyed || version !== balanceRequest) return;
				leadMagnetInfo = leadMagnetResult;
				leadMagnetError = !leadMagnetResult;
			} catch (error) {
				if (destroyed || version !== balanceRequest) return;
				console.error('Failed to load lead magnet info:', error);
				leadMagnetError = true;
				if (showLoader) {
					leadMagnetInfo = null;
				}
			}

			try {
				const infoResult = await getUserInfo(localStorage.token);
				if (destroyed || version !== balanceRequest) return;
				contactsError = !infoResult;
				if (!contactsDirty) {
					contactEmail = infoResult?.billing_contact_email ?? '';
					contactPhone = infoResult?.billing_contact_phone ?? '';
					contactsBaseline = { email: contactEmail, phone: contactPhone };
				}
			} catch (error) {
				if (destroyed || version !== balanceRequest) return;
				console.error('Failed to load billing contacts:', error);
				contactsError = true;
				if (showLoader) {
					contactEmail = '';
					contactPhone = '';
				}
			}

			if (lastTrackedStatus !== 'success') {
				trackEvent('billing_wallet_view', { status: 'success' });
				lastTrackedStatus = 'success';
			}
		} catch (error) {
			if (destroyed || version !== balanceRequest) return;
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
			if (version === balanceRequest && !destroyed) {
				loading = false;
				refreshing = false;
			}
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
			const returnUrl = buildTopupReturnUrl({
				origin: window.location.origin,
				basePath: base,
				returnTo
			});
			const result = await createTopup(localStorage.token, amountKopeks, returnUrl);
			if (result?.confirmation_url) {
				void browserTracksPayments().then((browserEnabled) => {
					if (browserEnabled)
						trackEvent('billing_topup_payment_created', { amount_kopeks: amountKopeks });
				});
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
						previous_total_kopeks: getTotalBalanceKopeks(balance),
						payment_id: result.payment_id,
						return_to: returnTo
					};
					try {
						localStorage.setItem(TOPUP_FLOW_STORAGE_KEY, JSON.stringify(flow));
					} catch {
						// ignore
					}
				}
				if (!destroyed) window.location.href = result.confirmation_url;
				return;
			}
			toast.error($i18n.t('Failed to create topup'));
		} catch (error) {
			console.error('Failed to create topup:', error);
			const errorDetail = extractApiErrorDetail(error);
			toast.error($i18n.t(errorDetail ?? 'Failed to create topup'));
		} finally {
			creatingTopupAmount = null;
		}
	};

	const handleSaveAutoTopup = async (): Promise<void> => {
		if (!balance || savingAutoTopup || destroyed) return;
		const snapshot = {
			enabled: autoTopupEnabled,
			threshold: autoTopupThreshold,
			amount: autoTopupAmount
		};
		savingAutoTopup = true;
		autoTopupError = '';
		saveResult = '';
		try {
			const threshold = parseMoneyInput(snapshot.threshold);
			const amount = parseMoneyInput(snapshot.amount);

			if (
				snapshot.enabled &&
				(threshold === null || amount === null || !topupPackages.includes(amount))
			) {
				autoTopupError = $i18n.t('Enter a valid threshold and choose a top-up amount');
				toast.error(autoTopupError);
				return;
			}

			await updateAutoTopup(localStorage.token, {
				enabled: snapshot.enabled,
				threshold_kopeks: snapshot.enabled ? (threshold ?? undefined) : undefined,
				amount_kopeks: snapshot.enabled ? (amount ?? undefined) : undefined
			});

			if (destroyed) return;
			trackEvent('billing_wallet_auto_topup_save', {
				enabled: snapshot.enabled,
				...(snapshot.enabled && threshold !== null ? { threshold_kopeks: threshold } : {}),
				...(snapshot.enabled && amount !== null ? { amount_kopeks: amount } : {})
			});
			saveSource = 'auto';
			saveResult = $i18n.t('Auto-topup settings saved');
			toast.success(saveResult);
			autoTopupBaseline = {
				enabled: snapshot.enabled,
				threshold: snapshot.threshold,
				amount: snapshot.amount
			};
			// Avoid wiping other unsaved inputs (contacts/limits) by reloading the whole page state.
			// Balance is updated optimistically; a full refresh will still reconcile with backend state.
			balance = {
				...balance,
				auto_topup_enabled: snapshot.enabled,
				auto_topup_threshold_kopeks: snapshot.enabled
					? (threshold ?? balance.auto_topup_threshold_kopeks)
					: balance.auto_topup_threshold_kopeks,
				auto_topup_amount_kopeks: snapshot.enabled
					? (amount ?? balance.auto_topup_amount_kopeks)
					: balance.auto_topup_amount_kopeks
			};
		} catch (error) {
			if (destroyed) return;
			console.error('Failed to update auto-topup:', error);
			autoTopupError = $i18n.t('Failed to update auto-topup');
			toast.error(autoTopupError);
		} finally {
			savingAutoTopup = false;
		}
	};

	const handleSavePreferences = async (source: 'limits' | 'contacts'): Promise<void> => {
		if (!balance || savingPreferences || destroyed) return;
		const savedLimits = { maxReplyCost, dailyCap };
		const savedContacts = { email: contactEmail, phone: contactPhone };
		savingPreferences = true;
		limitsError = '';
		contactsSaveError = '';
		saveResult = '';
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
					limitsError = $i18n.t('Enter a non-negative amount with up to two decimal places');
					toast.error(limitsError);
					return;
				}
				if (dailyCap && daily === null) {
					limitsError = $i18n.t('Enter a non-negative amount with up to two decimal places');
					toast.error(limitsError);
					return;
				}

				payload.max_reply_cost_kopeks = maxReply;
				payload.daily_cap_kopeks = daily;

				trackEvent('billing_wallet_limits_save', {
					...(maxReply !== null ? { max_reply_cost_kopeks: maxReply } : {}),
					...(daily !== null ? { daily_cap_kopeks: daily } : {})
				});
			} else {
				if (contactsError) {
					contactsSaveError = $i18n.t('Load saved contacts before changing them');
					return;
				}
				if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
					contactsSaveError = $i18n.t('Enter a valid email address');
					return;
				}
				if (contactPhone && !/^\+?[\d ()-]{7,20}$/.test(contactPhone)) {
					contactsSaveError = $i18n.t('Enter a valid phone number');
					return;
				}
				payload.billing_contact_email = contactEmail ? contactEmail : null;
				payload.billing_contact_phone = contactPhone ? contactPhone : null;

				trackEvent('billing_wallet_contacts_save', {
					has_email: Boolean(contactEmail),
					has_phone: Boolean(contactPhone)
				});
			}

			await updateBillingSettings(localStorage.token, payload);
			if (destroyed) return;
			saveSource = source;
			saveResult = $i18n.t('Billing settings saved');
			toast.success(saveResult);
			if (source === 'limits') {
				limitsBaseline = savedLimits;
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
				contactsBaseline = savedContacts;
			}
		} catch (error) {
			if (destroyed) return;
			console.error('Failed to update billing settings:', error);
			if (source === 'limits') limitsError = $i18n.t('Failed to update billing settings');
			else contactsSaveError = $i18n.t('Failed to update billing settings');
			toast.error($i18n.t('Failed to update billing settings'));
		} finally {
			savingPreferences = false;
		}
	};

	const formatMoney = (
		kopeks: number | null | undefined,
		currency: string,
		locale: string = getI18nLocale($i18n)
	): string => {
		if (kopeks === null || kopeks === undefined) {
			return $i18n.t('Not set');
		}
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat(locale, {
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

	const parseMoneyInput = parseBillingMoney;

	const extractApiErrorDetail = (error: unknown): string | null => {
		if (typeof error === 'string') {
			const trimmed = error.trim();
			return trimmed.length > 0 ? trimmed : null;
		}

		if (error && typeof error === 'object') {
			const maybeDetail = (error as { detail?: unknown }).detail;
			if (typeof maybeDetail === 'string') {
				const trimmed = maybeDetail.trim();
				return trimmed.length > 0 ? trimmed : null;
			}
		}

		return null;
	};

	const scrollToTopup = () => {
		const target = document.getElementById('topup-section');
		target?.scrollIntoView?.({
			behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start'
		});
	};

	const scrollToFreeLimit = () => {
		const target = document.getElementById('free-limit-section');
		target?.scrollIntoView?.({
			behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start'
		});
	};

	const scrollToAdvanced = () => {
		const target = document.getElementById('advanced-settings-section');
		target?.scrollIntoView?.({
			behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start'
		});
	};

	const scrollToAutoTopup = () => {
		const target = document.getElementById('auto-topup-section');
		target?.scrollIntoView?.({
			behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start'
		});
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

	const openHowItWorks = (): void => {
		howItWorksOpen = true;
		trackEvent('billing_wallet_how_it_works_open');
	};

	const handleHowItWorksLimits = async (): Promise<void> => {
		const target = new URL(buildBillingPath('/billing/balance'), $page.url.origin);
		target.searchParams.set('focus', 'limits');
		await goto(`${target.pathname}${target.search}`);
		if (destroyed) return;
		await tick();
		scrollToAdvanced();
	};

	const buildBillingPath = (pathname: string): string => {
		const prefixedPath = withBasePath(pathname, base);
		const params = new URLSearchParams();
		if (normalizedReturnTo) params.set('return_to', normalizedReturnTo);
		if (selectedFrom) params.set('from_date', selectedFrom);
		if (selectedTo) params.set('to_date', selectedTo);
		return params.size ? `${prefixedPath}?${params.toString()}` : prefixedPath;
	};

	const handleHistoryClick = async (event: MouseEvent): Promise<void> => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
			return;
		}
		event.preventDefault();
		trackEvent('billing_wallet_history_click');
		await goto(buildBillingPath('/billing/history'));
	};

	const handleReturnToClick = async (event: MouseEvent): Promise<void> => {
		if (!normalizedReturnTo) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
			return;
		}
		event.preventDefault();
		trackEvent('billing_wallet_return_to_chat_click');
		await goto(normalizedReturnTo);
	};

	const formatDateTime = (
		timestamp: number | null | undefined,
		locale: string = getI18nLocale($i18n)
	): string => {
		if (!timestamp) return $i18n.t('Never');
		return new Date(timestamp * 1000).toLocaleString(locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	$: customTopupKopeks = parseMoneyInput(customTopup);
	$: totalBalance = getTotalBalanceKopeks(balance);
	$: isLowBalance = totalBalance < LOW_BALANCE_THRESHOLD_KOPEKS && !freeUsageAvailable;

	$: leadMagnetModels =
		$models
			?.filter((model) => model.info?.meta?.lead_magnet)
			.map((model) => ({ id: model.id, name: model.name ?? model.id })) ?? [];
	const leadMagnetModelsReady = true;
	$: leadMagnetModelsAvailable = leadMagnetModels.length > 0;
	$: freeUsageAvailable = hasFreeTextQuota(leadMagnetInfo) && leadMagnetModelsAvailable;
</script>

<svelte:head>
	<title>
		{$i18n.t(settingsView ? 'Payment settings' : 'Balance')} • {$WEBUI_NAME}
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
				on:click={() => loadBalance()}
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
	<div class="w-full max-w-5xl mx-auto">
		<div class="space-y-3">
			<WalletHowItWorksModal
				bind:open={howItWorksOpen}
				onTopup={scrollToTopup}
				onLimits={handleHowItWorksLimits}
			/>

			{#if topupReturnStatus !== 'idle' && !topupReturnDismissed && topupFlow}
				<div
					role="status"
					aria-live="polite"
					class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4"
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
									{:else if topupReturnStatus === 'canceled'}
										{$i18n.t('Payment canceled; balance was not topped up')}
									{:else if topupReturnStatus === 'unknown'}
										{$i18n.t('Payment status could not be checked')}
									{:else if topupReturnStatus === 'uncredited'}
										{$i18n.t('Payment confirmed; awaiting balance credit')}
									{:else}
										{$i18n.t('Awaiting payment confirmation')}
									{/if}
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{$i18n.t('Top-up')}: {formatMoney(
										topupFlow.amount_kopeks,
										balance.currency,
										getI18nLocale($i18n)
									)}
									{#if ['checking', 'pending', 'uncredited'].includes(topupReturnStatus)}
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
							class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition min-h-11 min-w-11 px-2 -my-1"
						>
							&times;
						</button>
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						{#if topupReturnStatus !== 'success'}
							<button
								type="button"
								on:click={handleTopupReturnRefresh}
								disabled={refreshing || checkingTopup || reconcileInFlight !== null}
								class="inline-flex min-h-11 items-center px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							>
								{refreshing || checkingTopup || reconcileInFlight !== null
									? $i18n.t('Loading…')
									: $i18n.t('Refresh')}
							</button>
						{/if}
						{#if normalizedReturnTo}
							<a
								href={normalizedReturnTo}
								on:click={handleReturnToClick}
								class="inline-flex min-h-11 items-center px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							>
								{$i18n.t('Back to chat')}
							</a>
						{/if}
					</div>
				</div>
			{/if}

			{#if !settingsView}
				<div
					class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4 sm:p-5"
				>
					<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<div class="flex flex-wrap items-center gap-2">
								<h1 class="text-xl font-medium">{$i18n.t('Balance and spending')}</h1>
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
									class="inline-flex min-h-11 items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
									on:click={openHowItWorks}
								>
									<InfoCircle className="size-4" />
									<span>{$i18n.t('How billing works')}</span>
								</button>
								<a
									href={buildBillingPath('/billing/cost')}
									class="inline-flex min-h-11 items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
									on:click={() => trackEvent('billing_wallet_pricing_click')}
								>
									<span>{$i18n.t('Pricing')}</span>
								</a>
							</div>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							{#if normalizedReturnTo}
								<a
									href={normalizedReturnTo}
									on:click={handleReturnToClick}
									class="inline-flex min-h-11 items-center px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
								>
									{$i18n.t('Back to chat')}
								</a>
							{/if}
							<a
								href={buildBillingPath('/billing/history')}
								on:click={handleHistoryClick}
								class="inline-flex min-h-11 items-center px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								{$i18n.t('View history')}
							</a>
							<button
								type="button"
								data-testid="wallet-hero-topup"
								aria-controls="topup-section"
								on:click={scrollToTopup}
								class="inline-flex min-h-11 items-center px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium {isLowBalance
									? 'ring-2 ring-amber-500/40'
									: ''}"
							>
								{$i18n.t('Top up balance')}
							</button>
						</div>
					</div>

					<div class="mt-5">
						<div class="flex items-center gap-1 text-sm text-gray-500">
							<span>{$i18n.t('Available for paid models')}</span>
							<Tooltip content={$i18n.t('Available now help')} placement="top">
								<button
									type="button"
									aria-label={$i18n.t('Available now help')}
									class="min-h-11 min-w-11 inline-flex items-center justify-center text-gray-500 focus-visible:ring-2"
									><InfoCircle className="size-4" /></button
								>
							</Tooltip>
						</div>
						<div class="text-3xl font-semibold mt-1">
							{formatMoney(totalBalance, balance.currency, getI18nLocale($i18n))}
						</div>
						<div class="mt-3 text-sm" role="status">
							{#if leadMagnetError}<span>{$i18n.t('Free availability could not be checked')}</span
								><button
									type="button"
									class="ml-2 underline min-h-11"
									on:click={() => loadBalance({ showLoader: false })}>{$i18n.t('Retry')}</button
								>
							{:else if freeUsageAvailable}<span class="text-emerald-700 dark:text-emerald-300"
									>{$i18n.t('Free usage is available on marked models')}</span
								>
							{:else if leadMagnetInfo?.enabled}<span
									>{$i18n.t('Free usage is currently unavailable')}</span
								>{/if}
						</div>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							{$i18n.t('Spent today')}: {formatMoney(balance.daily_spent_kopeks, balance.currency)}
						</p>
						{#if balance.topup_expires_at}<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
								{$i18n.t('Paid balance valid until')}: {formatDateTime(balance.topup_expires_at)}
							</p>{/if}
						{#if balance.daily_reserved_kopeks && balance.daily_reserved_kopeks > 0}<p
								class="mt-2 text-sm text-gray-600 dark:text-gray-300"
							>
								{$i18n.t('Reserved today')}: {formatMoney(
									balance.daily_reserved_kopeks,
									balance.currency
								)}
							</p>{/if}
						<div class="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
							<span>
								{$i18n.t('From wallet')}:{' '}
								{formatMoney(balance.balance_topup_kopeks, balance.currency, getI18nLocale($i18n))}
							</span>
							{#if balance.balance_included_kopeks > 0}
								<span>
									{$i18n.t('Included funds')}:{' '}
									{formatMoney(
										balance.balance_included_kopeks,
										balance.currency,
										getI18nLocale($i18n)
									)}
								</span>
								<span>
									{$i18n.t('Included expires')}: {formatDateTime(
										balance.included_expires_at,
										getI18nLocale($i18n)
									)}
								</span>
							{/if}
						</div>
						{#if isLowBalance}
							<div
								class="text-xs text-amber-700 dark:text-amber-300 mt-2"
								data-testid="wallet-low-balance-hint"
							>
								{#if freeUsageAvailable}
									<span data-testid="wallet-low-balance-hint-free">
										{$i18n.t('Wallet is low but free limit is available')}
									</span>{' '}
									<button
										type="button"
										data-testid="wallet-low-balance-free-limit-link"
										class="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 transition"
										on:click={scrollToFreeLimit}
									>
										{$i18n.t('Free limit')}
									</button>
								{:else}
									<span data-testid="wallet-low-balance-hint-topup">
										{$i18n.t('Top up to keep working')}
									</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				{#if !settingsView}<WalletPeriodSummary
						refreshRevision={recentActivityRevision}
						initialFrom={$page.url.searchParams.get('from_date') ?? ''}
						initialTo={$page.url.searchParams.get('to_date') ?? ''}
						onPeriodChange={(from, to) => {
							selectedFrom = new Date(from * 1000).toISOString().slice(0, 10);
							selectedTo = new Date((to - 86400) * 1000).toISOString().slice(0, 10);
						}}
					/>{/if}
				<div class={`grid gap-3 ${leadMagnetInfo?.enabled ? 'lg:grid-cols-2' : ''}`}>
					{#if leadMagnetInfo?.enabled}
						<WalletLeadMagnetSection
							leadMagnetInfo={leadMagnetInfo as LeadMagnetInfo}
							models={leadMagnetModels}
							modelsReady={leadMagnetModelsReady}
						/>
					{/if}
					<WalletTopupSection
						currency={balance.currency}
						defaultPackages={topupPackages}
						allowCustom={allowCustomTopup}
						autoSelectFirst={isLowBalance}
						{highlightedPackageKopeks}
						{highlightedPackageLabel}
						{creatingTopupAmount}
						bind:customTopup
						{customTopupKopeks}
						onTopup={handleTopup}
					/>
				</div>
			{/if}
			{#if settingsView}
				<div id="advanced-settings-section">
					{#if settingsView}
						<div class="px-1 pb-1">
							<h1 class="text-xl font-medium">{$i18n.t('Payment settings')}</h1>
							<div class="mt-1 text-sm text-gray-500">
								{$i18n.t('Control spending and payment behavior')}
							</div>
						</div>
					{/if}
					<div class="space-y-4">
						<div id="auto-topup-section">
							<WalletAutoTopupSection
								packages={topupPackages}
								currency={balance.currency}
								successMessage={saveSource === 'auto' && !autoTopupDirty ? saveResult : ''}
								errorMessage={autoTopupError}
								bind:autoTopupEnabled
								bind:autoTopupThreshold
								bind:autoTopupAmount
								{savingAutoTopup}
								dirty={autoTopupDirty}
								paymentMethodSaved={balance.auto_topup_payment_method_saved ?? false}
								autoTopupFailCount={balance.auto_topup_fail_count ?? 0}
								autoTopupLastFailedAt={balance.auto_topup_last_failed_at}
								onSave={handleSaveAutoTopup}
							/>
						</div>
						<WalletSpendControls
							successMessage={saveSource === 'limits' && !limitsDirty ? saveResult : ''}
							errorMessage={limitsError}
							bind:maxReplyCost
							bind:dailyCap
							currentMaxReply={balance.max_reply_cost_kopeks ?? null}
							currentDailyCap={balance.daily_cap_kopeks ?? null}
							dailyReserved={balance.daily_reserved_kopeks ?? 0}
							dailySpent={balance.daily_spent_kopeks ?? null}
							dailyResetAt={balance.daily_reset_at ?? null}
							currency={balance.currency}
							{savingPreferences}
							dirty={limitsDirty}
							onSave={() => handleSavePreferences('limits')}
						/>
						<WalletContactsSection
							loadFailed={contactsError}
							successMessage={saveSource === 'contacts' && !contactsDirty ? saveResult : ''}
							errorMessage={contactsSaveError}
							onRetry={() => loadBalance({ showLoader: false })}
							bind:contactEmail
							bind:contactPhone
							{savingPreferences}
							dirty={contactsDirty}
							onSave={() => handleSavePreferences('contacts')}
						/>
					</div>
				</div>
			{/if}

			{#if !settingsView}
				<div
					class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4"
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
					{#key recentActivityRevision}
						<UnifiedTimeline
							pageSize={5}
							maxItems={5}
							showFilters={false}
							showLoadMore={false}
							emptyActionLabel={$i18n.t('View all activity')}
							onEmptyAction={() => goto(buildBillingPath('/billing/history'))}
							currency={balance.currency}
						/>
					{/key}
				</div>
			{/if}
		</div>
	</div>
{/if}
