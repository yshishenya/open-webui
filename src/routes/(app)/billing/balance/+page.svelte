<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME, models } from '$lib/stores';
	import {
		createTopup,
		getBalance,
		getLeadMagnetInfo,
		updateAutoTopup,
		updateBillingSettings
	} from '$lib/apis/billing';
	import { getUserInfo } from '$lib/apis/users';
	import type { Balance, LeadMagnetInfo } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import UnifiedTimeline from '$lib/components/billing/UnifiedTimeline.svelte';
	import WalletTopupSection from '$lib/components/billing/WalletTopupSection.svelte';
	import WalletAutoTopupSection from '$lib/components/billing/WalletAutoTopupSection.svelte';
	import WalletSpendControls from '$lib/components/billing/WalletSpendControls.svelte';
	import WalletContactsSection from '$lib/components/billing/WalletContactsSection.svelte';
	import WalletLeadMagnetSection from '$lib/components/billing/WalletLeadMagnetSection.svelte';
	import WalletAdvancedSettings from '$lib/components/billing/WalletAdvancedSettings.svelte';
	import { trackEvent } from '$lib/utils/analytics';

	const i18n = getContext('i18n');

	const DEFAULT_TOPUP_PACKAGES_KOPEKS = [100000, 150000, 500000, 1000000];
	const LOW_BALANCE_THRESHOLD_KOPEKS = 10000;

	let loading = true;
	let balance: Balance | null = null;
	let errorMessage: string | null = null;
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

	onMount(async () => {
		await loadBalance();
	});

	const loadBalance = async (): Promise<void> => {
		loading = true;
		errorMessage = null;
		leadMagnetInfo = null;
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
				leadMagnetInfo = null;
			}

			try {
				const infoResult = await getUserInfo(localStorage.token);
				contactEmail = infoResult?.billing_contact_email ?? '';
				contactPhone = infoResult?.billing_contact_phone ?? '';
			} catch (error) {
				console.error('Failed to load billing contacts:', error);
				contactEmail = '';
				contactPhone = '';
			}
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
			errorMessage = $i18n.t('Failed to load balance');
			balance = null;
			leadMagnetInfo = null;
			if (lastTrackedStatus !== 'error') {
				trackEvent('billing_wallet_view', { status: 'error' });
				lastTrackedStatus = 'error';
			}
		} finally {
			loading = false;
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
			const returnUrl = `${window.location.origin}/billing/balance`;
			const result = await createTopup(localStorage.token, amountKopeks, returnUrl);
			if (result?.confirmation_url) {
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

	const handleCustomTopup = async (): Promise<void> => {
		if (customTopupKopeks === null || customTopupKopeks <= 0) {
			return;
		}
		await handleTopup(customTopupKopeks, 'custom');
		customTopup = '';
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
			await loadBalance();
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
			const maxReply = parseMoneyInput(maxReplyCost);
			const daily = parseMoneyInput(dailyCap);

			if (maxReplyCost && maxReply === null) {
				toast.error($i18n.t('Invalid value for {label}', { label: $i18n.t('Max reply cost') }));
				return;
			}
			if (dailyCap && daily === null) {
				toast.error($i18n.t('Invalid value for {label}', { label: $i18n.t('Daily cap') }));
				return;
			}

			await updateBillingSettings(localStorage.token, {
				max_reply_cost_kopeks: maxReply ?? undefined,
				daily_cap_kopeks: daily ?? undefined,
				billing_contact_email: contactEmail || undefined,
				billing_contact_phone: contactPhone || undefined
			});

			if (source === 'limits') {
				trackEvent('billing_wallet_limits_save', {
					max_reply_cost_kopeks: maxReply ?? null,
					daily_cap_kopeks: daily ?? null
				});
			}
			if (source === 'contacts') {
				trackEvent('billing_wallet_contacts_save', {
					has_email: Boolean(contactEmail),
					has_phone: Boolean(contactPhone)
				});
			}
			toast.success($i18n.t('Billing settings saved'));
			await loadBalance();
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
	const handleAdvancedToggle = (open: boolean): void => {
		advancedOpen = open;
		advancedAutoLock = true;
		trackEvent('billing_wallet_advanced_toggle', { open });
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
		await goto('/billing/history');
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
					</div>
					<div class="flex items-center gap-2">
						<a
							href="/billing/history"
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
					<div class="text-sm text-gray-500">{$i18n.t('Available now')}</div>
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
							{$i18n.t('Top up to keep working')}
						</div>
					{/if}
				</div>
			</div>

			<WalletTopupSection
				currency={balance.currency}
				defaultPackages={DEFAULT_TOPUP_PACKAGES_KOPEKS}
				creatingTopupAmount={creatingTopupAmount}
				bind:customTopup
				customTopupKopeks={customTopupKopeks}
				onTopup={handleTopup}
				onCustomTopup={handleCustomTopup}
			/>

			{#if leadMagnetInfo?.enabled}
				<WalletLeadMagnetSection
					leadMagnetInfo={leadMagnetInfo as LeadMagnetInfo}
					models={leadMagnetModels}
					modelsReady={leadMagnetModelsReady}
				/>
			{/if}

			<div id="advanced-settings-section">
				<WalletAdvancedSettings
					bind:open={advancedOpen}
					title={$i18n.t('Manage limits & auto-topup')}
					helper={$i18n.t('Rarely used settings')}
					onToggle={handleAdvancedToggle}
				>
					<WalletAutoTopupSection
						bind:autoTopupEnabled
						bind:autoTopupThreshold
						bind:autoTopupAmount
						savingAutoTopup={savingAutoTopup}
						autoTopupFailCount={balance.auto_topup_fail_count ?? 0}
						autoTopupLastFailedAt={balance.auto_topup_last_failed_at}
						onSave={handleSaveAutoTopup}
					/>
					<WalletSpendControls
						bind:maxReplyCost
						bind:dailyCap
						currentMaxReply={balance.max_reply_cost_kopeks ?? null}
						currentDailyCap={balance.daily_cap_kopeks ?? null}
						currency={balance.currency}
						savingPreferences={savingPreferences}
						onSave={() => handleSavePreferences('limits')}
					/>
					<WalletContactsSection
						bind:contactEmail
						bind:contactPhone
						savingPreferences={savingPreferences}
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
						href="/billing/history"
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
					currency={balance.currency}
				/>
			</div>
		</div>
	</div>
{/if}
