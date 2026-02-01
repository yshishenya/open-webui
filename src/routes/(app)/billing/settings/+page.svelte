<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME } from '$lib/stores';
	import { getBalance, updateBillingSettings } from '$lib/apis/billing';
	import { getUserInfo } from '$lib/apis/users';
	import type { Balance } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let saving = false;
	let balance: Balance | null = null;
	let errorMessage: string | null = null;

	let maxReplyCost = '';
	let dailyCap = '';
	let contactEmail = '';
	let contactPhone = '';

	onMount(async () => {
		await loadSettings();
	});

	const loadSettings = async (): Promise<void> => {
		loading = true;
		errorMessage = null;
		try {
			const [balanceResult, infoResult] = await Promise.all([
				getBalance(localStorage.token),
				getUserInfo(localStorage.token)
			]);
			balance = balanceResult;
			maxReplyCost = formatMoneyInput(balanceResult?.max_reply_cost_kopeks ?? null);
			dailyCap = formatMoneyInput(balanceResult?.daily_cap_kopeks ?? null);
			contactEmail = infoResult?.billing_contact_email ?? '';
			contactPhone = infoResult?.billing_contact_phone ?? '';
		} catch (error) {
			console.error('Failed to load billing settings:', error);
			errorMessage = $i18n.t('Failed to load billing settings');
		} finally {
			loading = false;
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

	const handleSave = async (): Promise<void> => {
		saving = true;
		try {
			const maxReply = parseMoneyInput(maxReplyCost);
			const daily = parseMoneyInput(dailyCap);

			await updateBillingSettings(localStorage.token, {
				max_reply_cost_kopeks: maxReply ?? undefined,
				daily_cap_kopeks: daily ?? undefined,
				billing_contact_email: contactEmail || undefined,
				billing_contact_phone: contactPhone || undefined
			});

			toast.success($i18n.t('Billing settings saved'));
			await loadSettings();
		} catch (error) {
			console.error('Failed to update billing settings:', error);
			toast.error($i18n.t('Failed to update billing settings'));
		} finally {
			saving = false;
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
</script>

<svelte:head>
	<title>
		{$i18n.t('Billing Settings')} • {$WEBUI_NAME}
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
				on:click={loadSettings}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else}
	<div class="w-full">
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Billing Settings')}</div>
				</div>
			</div>
		</div>

		<div
			class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4"
		>
			<div class="text-sm font-medium mb-3">{$i18n.t('Limits')}</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{$i18n.t('Max reply cost')}</span>
					<input
						type="text"
						inputmode="decimal"
						placeholder={$i18n.t('0.00')}
						bind:value={maxReplyCost}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
					{#if balance}
						<span class="text-xs text-gray-500">
							{$i18n.t('Current')}: {formatMoney(balance.max_reply_cost_kopeks, balance.currency)}
						</span>
					{/if}
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{$i18n.t('Daily cap')}</span>
					<input
						type="text"
						inputmode="decimal"
						placeholder={$i18n.t('0.00')}
						bind:value={dailyCap}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
					{#if balance}
						<span class="text-xs text-gray-500">
							{$i18n.t('Current')}: {formatMoney(balance.daily_cap_kopeks, balance.currency)}
						</span>
					{/if}
				</label>
			</div>
		</div>

		<div
			class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
		>
			<div class="text-sm font-medium mb-3">{$i18n.t('Billing contacts')}</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{$i18n.t('Email')}</span>
					<input
						type="email"
						placeholder={$i18n.t('you@example.com')}
						bind:value={contactEmail}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{$i18n.t('Phone')}</span>
					<input
						type="tel"
						placeholder={$i18n.t('+7 900 000 00 00')}
						bind:value={contactPhone}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
			</div>
		</div>

		<div class="flex justify-end mt-4">
			<button
				type="button"
				on:click={handleSave}
				disabled={saving}
				class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{saving ? $i18n.t('Saving') : $i18n.t('Save')}
			</button>
		</div>
	</div>
{/if}
