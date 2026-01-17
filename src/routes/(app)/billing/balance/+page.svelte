<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME } from '$lib/stores';
	import {
		createTopup,
		getBalance,
		getLeadMagnetInfo,
		getLedger,
		updateAutoTopup,
		updateBillingSettings
	} from '$lib/apis/billing';
	import { getUserInfo } from '$lib/apis/users';
	import type { Balance, LeadMagnetInfo, LedgerEntry } from '$lib/apis/billing';
	import { formatCompactNumber, getUsagePercentage, getUsageColor, getQuotaLabel } from '$lib/utils/billing-formatters';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';

	const i18n = getContext('i18n');

	const DEFAULT_TOPUP_PACKAGES_KOPEKS = [19900, 49900, 99900, 199900, 499900];
	const RECENT_LEDGER_LIMIT = 5;

	let loading = true;
	let balance: Balance | null = null;
	let errorMessage: string | null = null;
	let creatingTopupAmount: number | null = null;
	let savingAutoTopup = false;
	let leadMagnetInfo: LeadMagnetInfo | null = null;
	let recentEntries: LedgerEntry[] = [];
	let recentError: string | null = null;

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

	type LeadMagnetMetric = {
		key: string;
		used: number;
		limit: number;
		remaining: number;
		percentage: number;
	};

	onMount(async () => {
		await loadBalance();
		await loadRecentActivity();
	});

	const loadBalance = async (): Promise<void> => {
		loading = true;
		errorMessage = null;
		try {
			const [balanceResult, leadMagnetResult] = await Promise.all([
				getBalance(localStorage.token),
				getLeadMagnetInfo(localStorage.token)
			]);
			balance = balanceResult;
			leadMagnetInfo = leadMagnetResult;
			autoTopupEnabled = balance?.auto_topup_enabled ?? false;
			autoTopupThreshold = formatMoneyInput(balance?.auto_topup_threshold_kopeks ?? null);
			autoTopupAmount = formatMoneyInput(balance?.auto_topup_amount_kopeks ?? null);
			maxReplyCost = formatMoneyInput(balance?.max_reply_cost_kopeks ?? null);
			dailyCap = formatMoneyInput(balance?.daily_cap_kopeks ?? null);

			try {
				const infoResult = await getUserInfo(localStorage.token);
				contactEmail = infoResult?.billing_contact_email ?? '';
				contactPhone = infoResult?.billing_contact_phone ?? '';
			} catch (error) {
				console.error('Failed to load billing contacts:', error);
				contactEmail = '';
				contactPhone = '';
			}
		} catch (error) {
			console.error('Failed to load balance:', error);
			errorMessage = $i18n.t('Failed to load balance');
			balance = null;
			leadMagnetInfo = null;
		} finally {
			loading = false;
		}
	};

	const loadRecentActivity = async (): Promise<void> => {
		recentError = null;
		try {
			const result = await getLedger(localStorage.token, RECENT_LEDGER_LIMIT, 0);
			recentEntries = result ?? [];
		} catch (error) {
			console.error('Failed to load recent activity:', error);
			recentError = $i18n.t('Failed to load ledger');
			recentEntries = [];
		}
	};

	const handleTopup = async (amountKopeks: number): Promise<void> => {
		if (creatingTopupAmount !== null) return;
		creatingTopupAmount = amountKopeks;

		try {
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
		await handleTopup(customTopupKopeks);
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
				threshold_kopeks: autoTopupEnabled ? threshold ?? undefined : undefined,
				amount_kopeks: autoTopupEnabled ? amount ?? undefined : undefined
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

	const handleSavePreferences = async (): Promise<void> => {
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

	const getLocalizedQuotaLabel = (key: string): string => {
		return getQuotaLabel(key, (k) => $i18n.t(k));
	};

	const getLeadMagnetMetrics = (leadMagnet?: LeadMagnetInfo | null): LeadMagnetMetric[] => {
		if (!leadMagnet) return [];
		return Object.entries(leadMagnet.quotas ?? {})
			.filter(([, limit]) => typeof limit === 'number' && limit > 0)
			.map(([key, limit]) => {
				const used = leadMagnet.usage?.[key] ?? 0;
				const remaining = leadMagnet.remaining?.[key] ?? Math.max(0, limit - used);
				return {
					key,
					used,
					limit,
					remaining,
					percentage: getUsagePercentage(used, limit)
				};
			});
	};

	$: leadMagnetMetrics = getLeadMagnetMetrics(leadMagnetInfo);
	$: customTopupKopeks = parseMoneyInput(customTopup);
	$: totalBalance =
		(balance?.balance_topup_kopeks ?? 0) + (balance?.balance_included_kopeks ?? 0);

	const formatEntryType = (type: string): string => {
		const labels: Record<string, string> = {
			hold: $i18n.t('Hold'),
			charge: $i18n.t('Charge'),
			refund: $i18n.t('Refund'),
			topup: $i18n.t('Top up'),
			subscription_credit: $i18n.t('Subscription credit'),
			adjustment: $i18n.t('Adjustment'),
			release: $i18n.t('Release')
		};
		return labels[type] || type;
	};

	const getEntryAmount = (entry: LedgerEntry): number => {
		if (entry.type === 'charge') {
			const chargedInput = entry.charged_input_kopeks ?? null;
			const chargedOutput = entry.charged_output_kopeks ?? null;
			if (chargedInput !== null || chargedOutput !== null) {
				const total = (chargedInput ?? 0) + (chargedOutput ?? 0);
				return total > 0 ? -total : total;
			}
			const metadataCharge = entry.metadata_json?.charged_kopeks;
			if (typeof metadataCharge === 'number') {
				return metadataCharge > 0 ? -metadataCharge : metadataCharge;
			}
		}
		return entry.amount_kopeks;
	};

	const getAmountClass = (amount: number): string => {
		if (amount > 0) return 'text-green-600 dark:text-green-400';
		if (amount < 0) return 'text-red-600 dark:text-red-400';
		return 'text-gray-600 dark:text-gray-400';
	};
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
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Wallet')}</div>
				</div>
				<button
					type="button"
					on:click={scrollToTopup}
					class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
				>
					{$i18n.t('Top up')}
				</button>
			</div>
			<div class="text-sm text-gray-500">
				{$i18n.t('Manage your balance and limits')}
			</div>
		</div>

		<div class="space-y-4">
			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-5">
				<div class="text-sm text-gray-500">{$i18n.t('Available now')}</div>
				<div class="text-3xl font-semibold mt-1">
					{formatMoney(totalBalance, balance.currency)}
				</div>
				<div class="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
					<span>
						{$i18n.t('From wallet')}: {formatMoney(balance.balance_topup_kopeks, balance.currency)}
					</span>
					{#if balance.balance_included_kopeks > 0}
						<span>
							{$i18n.t('From plan')}: {formatMoney(balance.balance_included_kopeks, balance.currency)}
						</span>
						<span>
							{$i18n.t('Included expires')}: {formatDateTime(balance.included_expires_at)}
						</span>
					{/if}
				</div>
			</div>

			{#if leadMagnetInfo?.enabled}
				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="flex items-start justify-between mb-3">
						<h3 class="text-sm font-medium">
							{$i18n.t('Free limit')}
						</h3>
						<span
							class="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
						>
							{$i18n.t('Free')}
						</span>
					</div>

					<div class="text-xs text-gray-500 mb-3">
						{$i18n.t('Next reset')}: {formatDateTime(leadMagnetInfo.cycle_end)}
					</div>

					{#if leadMagnetMetrics.length > 0}
						<div class="space-y-4">
							{#each leadMagnetMetrics as metric}
								<div>
									<div class="flex items-center justify-between mb-1.5">
										<span class="text-sm font-medium">
											{getLocalizedQuotaLabel(metric.key)}
										</span>
										<span class="text-sm text-gray-500">
											{formatCompactNumber(metric.remaining)} / {formatCompactNumber(metric.limit)}
										</span>
									</div>
									<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
										<div
											class="{getUsageColor(metric.percentage)} h-1.5 rounded-full transition-all"
											style="width: {metric.percentage}%"
										></div>
									</div>
									<div class="text-xs text-gray-500 mt-1">
										{metric.percentage.toFixed(1)}% {$i18n.t('used')}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-sm text-gray-500">
							{$i18n.t('No free limits configured')}
						</div>
					{/if}
				</div>
			{/if}

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div
					class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
					id="topup-section"
				>
					<div class="flex items-center justify-between mb-3">
						<div class="text-sm font-medium">{$i18n.t('Top up')}</div>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each DEFAULT_TOPUP_PACKAGES_KOPEKS as amount}
							<button
								type="button"
								on:click={() => handleTopup(amount)}
								class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
								disabled={creatingTopupAmount !== null}
							>
								{creatingTopupAmount === amount
									? $i18n.t('Processing')
									: formatMoney(amount, balance.currency)}
							</button>
						{/each}
					</div>
					<div class="mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-gray-500">{$i18n.t('Custom amount')}</span>
							<input
								type="text"
								inputmode="decimal"
								placeholder="0.00"
								bind:value={customTopup}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
								disabled={creatingTopupAmount !== null}
							/>
						</label>
						<button
							type="button"
							on:click={handleCustomTopup}
							disabled={customTopupKopeks === null || customTopupKopeks <= 0 || creatingTopupAmount !== null}
							class="h-fit sm:self-end px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{creatingTopupAmount !== null && customTopupKopeks === creatingTopupAmount
								? $i18n.t('Processing')
								: $i18n.t('Top up')}
						</button>
					</div>
					<div class="text-xs text-gray-500 mt-2">
						{$i18n.t('Top-up packages are charged in')}: {balance.currency}
					</div>
				</div>

				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="flex items-center justify-between mb-3">
						<div class="text-sm font-medium">{$i18n.t('Auto-topup')}</div>
						<Switch state={autoTopupEnabled} on:change={(e) => (autoTopupEnabled = e.detail)} />
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-gray-500">{$i18n.t('Threshold')}</span>
							<input
								type="text"
								inputmode="decimal"
								placeholder="0.00"
								bind:value={autoTopupThreshold}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
								disabled={!autoTopupEnabled}
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-gray-500">{$i18n.t('Amount')}</span>
							<input
								type="text"
								inputmode="decimal"
								placeholder="0.00"
								bind:value={autoTopupAmount}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
								disabled={!autoTopupEnabled}
							/>
						</label>
					</div>
					<div class="flex items-center justify-between mt-3">
						<div class="text-xs text-gray-500">
							{$i18n.t('Failed attempts')}: {balance.auto_topup_fail_count ?? 0}
						</div>
						<button
							type="button"
							on:click={handleSaveAutoTopup}
							disabled={savingAutoTopup}
							class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{savingAutoTopup ? $i18n.t('Saving') : $i18n.t('Save')}
						</button>
					</div>
					<div class="text-xs text-gray-500 mt-2">
						{$i18n.t('Last failed')}: {formatDateTime(balance.auto_topup_last_failed_at)}
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="text-sm font-medium mb-3">{$i18n.t('Spend controls')}</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<label class="flex flex-col gap-1 text-sm">
						<span class="text-gray-500">{$i18n.t('Max reply cost')}</span>
						<input
							type="text"
							inputmode="decimal"
							placeholder="0.00"
							bind:value={maxReplyCost}
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
						<span class="text-xs text-gray-500">
							{$i18n.t('Current')}: {formatMoney(balance.max_reply_cost_kopeks, balance.currency)}
						</span>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="text-gray-500">{$i18n.t('Daily cap')}</span>
						<input
							type="text"
							inputmode="decimal"
							placeholder="0.00"
							bind:value={dailyCap}
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
						<span class="text-xs text-gray-500">
							{$i18n.t('Current')}: {formatMoney(balance.daily_cap_kopeks, balance.currency)}
						</span>
					</label>
				</div>
				<div class="text-xs text-gray-500 mt-2">
					{$i18n.t('Set limits to control spending')}
				</div>

				<div class="border-t border-gray-100/30 dark:border-gray-850/30 mt-4 pt-4">
					<div class="text-sm font-medium mb-3">{$i18n.t('Contacts for receipts')}</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-gray-500">{$i18n.t('Email')}</span>
							<input
								type="email"
								placeholder="you@example.com"
								bind:value={contactEmail}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-gray-500">{$i18n.t('Phone')}</span>
							<input
								type="tel"
								placeholder="+7 900 000 00 00"
								bind:value={contactPhone}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
							/>
						</label>
					</div>
				</div>

				<div class="flex justify-end mt-4">
					<button
						type="button"
						on:click={handleSavePreferences}
						disabled={savingPreferences}
						class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{savingPreferences ? $i18n.t('Saving') : $i18n.t('Save')}
					</button>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium">{$i18n.t('Latest activity')}</div>
					<a
						href="/billing/history"
						class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
					>
						{$i18n.t('View all activity')}
					</a>
				</div>

				{#if recentError}
					<div class="text-sm text-gray-500">{recentError}</div>
				{:else if recentEntries.length === 0}
					<div class="text-sm text-gray-500">{$i18n.t('No recent activity')}</div>
				{:else}
					<div class="space-y-3">
						{#each recentEntries as entry}
							{@const entryAmount = getEntryAmount(entry)}
							<div class="flex items-center justify-between">
								<div>
									<div class="text-sm font-medium">{formatEntryType(entry.type)}</div>
									<div class="text-xs text-gray-500">{formatDateTime(entry.created_at)}</div>
								</div>
								<div class={`text-sm font-semibold ${getAmountClass(entryAmount)}`}>
									{entryAmount > 0 ? '+' : ''}
									{formatMoney(entryAmount, entry.currency)}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
