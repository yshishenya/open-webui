<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, user } from '$lib/stores';
	import {
		createRateCard,
		listRateCards,
		syncRateCards,
		updateRateCard
	} from '$lib/apis/admin/billing';
	import type { RateCard, RateCardCreateRequest, RateCardUpdateRequest } from '$lib/apis/admin/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ChevronLeft from '$lib/components/icons/ChevronLeft.svelte';
	import ChevronRight from '$lib/components/icons/ChevronRight.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Reset from '$lib/components/icons/Reset.svelte';

	const i18n = getContext('i18n');

	type FormMode = 'create' | 'edit';

	let loaded = false;
	let loading = false;
	let errorMessage: string | null = null;

	let rateCards: RateCard[] = [];
	let total = 0;
	let page = 1;
	let pageSize = 50;
	let totalPages = 1;

	let filterModelId = '';
	let filterModality = '';
	let filterUnit = '';
	let filterVersion = '';
	let filterProvider = '';
	let filterActive = 'all';

	let showForm = false;
	let formMode: FormMode = 'create';
	let editingId: string | null = null;
	let saving = false;
	let actionInProgress = false;

	let formModelId = '';
	let formModality = '';
	let formUnit = '';
	let formRawCost = '0';
	let formPlatformFactor = '1.0';
	let formFixedFee = '0';
	let formMinCharge = '0';
	let formEffectiveFrom = '';
	let formEffectiveTo = '';
	let formIsActive = true;

	const MODALITY_UNITS: Record<string, string[]> = {
		text: ['token_in', 'token_out'],
		image: ['image_1024'],
		tts: ['tts_char'],
		stt: ['stt_second']
	};

	const getRawCostHint = (modality: string, unit: string): string => {
		if (modality === 'text') return $i18n.t('Raw cost hint (text)');
		if (modality === 'image') return $i18n.t('Raw cost hint (image)');
		if (modality === 'tts') return $i18n.t('Raw cost hint (tts)');
		if (modality === 'stt') return $i18n.t('Raw cost hint (stt)');
		if (unit) return unit;
		return '';
	};

	const getUnitLabel = (modality: string, unit: string): string => {
		const hint = getRawCostHint(modality, unit);
		if (!hint) return unit;
		return `${unit} — ${hint}`;
	};

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await loadRateCards();
		loaded = true;
	});

	const loadRateCards = async () => {
		loading = true;
		errorMessage = null;
		try {
			const isActive =
				filterActive === 'all' ? undefined : filterActive === 'active';
			const safePageSize = Number(pageSize) || 50;
			const result = await listRateCards(localStorage.token, {
				model_id: filterModelId.trim() || undefined,
				modality: filterModality.trim() || undefined,
				unit: filterUnit.trim() || undefined,
				version: filterVersion.trim() || undefined,
				provider: filterProvider.trim() || undefined,
				is_active: isActive,
				page,
				page_size: safePageSize
			});
			rateCards = result.items ?? [];
			total = result.total ?? 0;
			totalPages = result.total_pages ?? 1;
		} catch (error) {
			console.error('Failed to load rate cards:', error);
			errorMessage = $i18n.t('Failed to load rate cards');
		} finally {
			loading = false;
		}
	};

	const applyFilters = async () => {
		page = 1;
		await loadRateCards();
	};

	const resetFilters = async () => {
		filterModelId = '';
		filterModality = '';
		filterUnit = '';
		filterVersion = '';
		filterProvider = '';
		filterActive = 'all';
		page = 1;
		await loadRateCards();
	};

	const goToPage = async (newPage: number) => {
		if (newPage < 1 || newPage > totalPages) return;
		page = newPage;
		await loadRateCards();
	};

	const formatMoney = (kopeks: number): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency: 'RUB',
				minimumFractionDigits: 2,
				maximumFractionDigits: 4
			}).format(amount);
		} catch (error) {
			return `${amount.toFixed(4)} RUB`;
		}
	};

	const formatDate = (timestamp?: number | null): string => {
		if (!timestamp) return $i18n.t('Never');
		return new Date(timestamp * 1000).toLocaleDateString($i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const resetForm = () => {
		formMode = 'create';
		editingId = null;
		formModelId = '';
		formModality = 'text';
		formUnit = 'token_in';
		formRawCost = '0';
		formPlatformFactor = '1.0';
		formFixedFee = '0';
		formMinCharge = '0';
		formEffectiveFrom = '';
		formEffectiveTo = '';
		formIsActive = true;
	};

	const openCreateForm = () => {
		resetForm();
		showForm = true;
	};

	const openEditForm = (entry: RateCard) => {
		formMode = 'edit';
		editingId = entry.id;
		formModelId = entry.model_id;
		formModality = entry.modality || 'text';
		formUnit = entry.unit;
		formRawCost = String(entry.raw_cost_per_unit_kopeks ?? 0);
		formPlatformFactor = String(entry.platform_factor ?? 1);
		formFixedFee = String(entry.fixed_fee_kopeks ?? 0);
		formMinCharge = String(entry.min_charge_kopeks ?? 0);
		formEffectiveFrom = String(entry.effective_from ?? '');
		formEffectiveTo = entry.effective_to ? String(entry.effective_to) : '';
		formIsActive = entry.is_active;
		showForm = true;
	};

	$: allowedUnits = MODALITY_UNITS[formModality] ?? [];
	$: if (allowedUnits.length > 0 && !allowedUnits.includes(formUnit)) {
		formUnit = allowedUnits[0];
	}

	const parseRequiredInt = (value: string, label: string): number | null => {
		if (!value.trim()) {
			toast.error($i18n.t('{label} is required', { label }));
			return null;
		}
		const parsed = Number.parseInt(value, 10);
		if (Number.isNaN(parsed) || parsed < 0) {
			toast.error($i18n.t('Invalid value for {label}', { label }));
			return null;
		}
		return parsed;
	};

	const parseRequiredFloat = (value: string, label: string): number | null => {
		if (!value.trim()) {
			toast.error($i18n.t('{label} is required', { label }));
			return null;
		}
		const parsed = Number.parseFloat(value);
		if (Number.isNaN(parsed) || parsed < 0) {
			toast.error($i18n.t('Invalid value for {label}', { label }));
			return null;
		}
		return parsed;
	};

	const parseOptionalInt = (value: string, label: string): number | undefined | null => {
		if (!value.trim()) return undefined;
		const parsed = Number.parseInt(value, 10);
		if (Number.isNaN(parsed) || parsed < 0) {
			toast.error($i18n.t('Invalid value for {label}', { label }));
			return null;
		}
		return parsed;
	};

	const buildCreatePayload = (): RateCardCreateRequest | null => {
		const modelId = formModelId.trim();
		const modality = formModality.trim();
		const unit = formUnit.trim();

		if (!modelId || !modality || !unit) {
			toast.error($i18n.t('Model ID, modality, and unit are required'));
			return null;
		}

		const rawCost = parseRequiredInt(formRawCost, $i18n.t('Raw cost'));
		const platformFactor = parseRequiredFloat(formPlatformFactor, $i18n.t('Platform factor'));
		const fixedFee = parseRequiredInt(formFixedFee, $i18n.t('Fixed fee'));
		const minCharge = parseRequiredInt(formMinCharge, $i18n.t('Min charge'));
		if (
			rawCost === null ||
			platformFactor === null ||
			fixedFee === null ||
			minCharge === null
		) {
			return null;
		}

		const effectiveFrom = parseOptionalInt(formEffectiveFrom, $i18n.t('Effective from'));
		if (effectiveFrom === null) return null;
		const effectiveTo = parseOptionalInt(formEffectiveTo, $i18n.t('Effective to'));
		if (effectiveTo === null) return null;

		return {
			model_id: modelId,
			modality,
			unit,
			raw_cost_per_unit_kopeks: rawCost,
			platform_factor: platformFactor,
			fixed_fee_kopeks: fixedFee,
			min_charge_kopeks: minCharge,
			effective_from: effectiveFrom,
			effective_to: effectiveTo,
			is_active: formIsActive
		};
	};

	const buildUpdatePayload = (): RateCardUpdateRequest | null => {
		const rawCost = parseRequiredInt(formRawCost, $i18n.t('Raw cost'));
		const platformFactor = parseRequiredFloat(formPlatformFactor, $i18n.t('Platform factor'));
		const fixedFee = parseRequiredInt(formFixedFee, $i18n.t('Fixed fee'));
		const minCharge = parseRequiredInt(formMinCharge, $i18n.t('Min charge'));
		if (
			rawCost === null ||
			platformFactor === null ||
			fixedFee === null ||
			minCharge === null
		) {
			return null;
		}

		let effectiveTo: number | null | undefined;
		if (!formEffectiveTo.trim()) {
			effectiveTo = null;
		} else {
			const parsed = parseOptionalInt(formEffectiveTo, $i18n.t('Effective to'));
			if (parsed === null) return null;
			effectiveTo = parsed;
		}

		return {
			raw_cost_per_unit_kopeks: rawCost,
			platform_factor: platformFactor,
			fixed_fee_kopeks: fixedFee,
			min_charge_kopeks: minCharge,
			effective_to: effectiveTo,
			is_active: formIsActive
		};
	};

	const handleSave = async () => {
		if (saving) return;
		if (formMode === 'edit' && !editingId) return;

		const payload =
			formMode === 'create' ? buildCreatePayload() : buildUpdatePayload();
		if (!payload) return;

		saving = true;
		try {
			if (formMode === 'create') {
				await createRateCard(localStorage.token, payload as RateCardCreateRequest);
				toast.success($i18n.t('Rate card created'));
			} else {
				await updateRateCard(localStorage.token, editingId as string, payload);
				toast.success($i18n.t('Rate card updated'));
			}
			showForm = false;
			resetForm();
			await loadRateCards();
		} catch (error) {
			console.error('Failed to save rate card:', error);
			toast.error(
				formMode === 'create'
					? $i18n.t('Failed to create rate card')
					: $i18n.t('Failed to update rate card')
			);
		} finally {
			saving = false;
		}
	};

	const handleCancel = () => {
		showForm = false;
		resetForm();
	};

	const handleToggleActive = async (entry: RateCard, nextState: boolean) => {
		if (actionInProgress) return;
		actionInProgress = true;
		try {
			await updateRateCard(localStorage.token, entry.id, { is_active: nextState });
			await loadRateCards();
		} catch (error) {
			console.error('Failed to update rate card status:', error);
			toast.error($i18n.t('Failed to update rate card'));
			await loadRateCards();
		} finally {
			actionInProgress = false;
		}
	};

	const handleSyncDefaults = async () => {
		if (actionInProgress) return;
		actionInProgress = true;
		try {
			const result = await syncRateCards(localStorage.token, {});
			toast.success(
				$i18n.t('Sync completed: {created} created, {skipped} skipped', {
					created: result.created,
					skipped: result.skipped
				})
			);
			await loadRateCards();
		} catch (error) {
			console.error('Failed to sync rate cards:', error);
			toast.error($i18n.t('Failed to sync rate cards'));
		} finally {
			actionInProgress = false;
		}
	};
</script>

<svelte:head>
	<title>
		{$i18n.t('Model Pricing')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if !loaded}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else if errorMessage}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">{errorMessage}</div>
			<button
				type="button"
				on:click={loadRateCards}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else}
	<div class="px-4.5 w-full">
		<div class="flex flex-col gap-1 px-1 mt-2.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center md:self-center text-xl font-medium px-0.5 gap-2">
					<div>{$i18n.t('Model Pricing')}</div>
					<div class="text-lg font-medium text-gray-500 dark:text-gray-500">{total}</div>
				</div>
				<div class="flex gap-1.5">
					<button
						class="px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50"
						on:click={handleSyncDefaults}
						disabled={actionInProgress}
					>
						{$i18n.t('Sync Defaults')}
					</button>
					<button
						class="px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition font-medium text-sm flex items-center"
						on:click={openCreateForm}
					>
						<Plus className="size-3" strokeWidth="2.5" />
						<div class="hidden md:block md:ml-1 text-xs">{$i18n.t('New Rate Card')}</div>
					</button>
				</div>
			</div>
		</div>

		{#if showForm}
			<div class="mb-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium">
						{formMode === 'create'
							? $i18n.t('Create rate card')
							: $i18n.t('Update rate card')}
					</div>
					<button
						type="button"
						on:click={handleCancel}
						class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
					>
						{$i18n.t('Cancel')}
					</button>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Model ID')}</span>
						<input
							type="text"
							bind:value={formModelId}
							disabled={formMode === 'edit'}
							placeholder="gpt-4o-mini"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Modality')}</span>
						<select
							bind:value={formModality}
							disabled={formMode === 'edit'}
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
						>
							<option value="" disabled>{$i18n.t('Select modality')}</option>
							<option value="text">text</option>
							<option value="image">image</option>
							<option value="tts">tts</option>
							<option value="stt">stt</option>
						</select>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Unit')}</span>
						{#if allowedUnits.length > 1}
							<select
								bind:value={formUnit}
								disabled={formMode === 'edit'}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
							>
								{#each allowedUnits as unit}
									<option value={unit}>{getUnitLabel(formModality, unit)}</option>
								{/each}
							</select>
						{:else}
							<div class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm text-gray-700 dark:text-gray-200">
								{allowedUnits[0] ? getUnitLabel(formModality, allowedUnits[0]) : '—'}
							</div>
						{/if}
					</label>

					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Raw cost')}</span>
						<input
							type="text"
							inputmode="numeric"
							bind:value={formRawCost}
							placeholder="0"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
						<span class="text-[11px] text-gray-400">{$i18n.t('Kopeks per unit')}</span>
						{#if getRawCostHint(formModality, formUnit)}
							<span class="text-[11px] text-gray-400">{getRawCostHint(formModality, formUnit)}</span>
						{/if}
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Platform factor')}</span>
						<input
							type="text"
							inputmode="decimal"
							bind:value={formPlatformFactor}
							placeholder="1.0"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Fixed fee')}</span>
						<input
							type="text"
							inputmode="numeric"
							bind:value={formFixedFee}
							placeholder="0"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
						<span class="text-[11px] text-gray-400">{$i18n.t('Kopeks')}</span>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Min charge')}</span>
						<input
							type="text"
							inputmode="numeric"
							bind:value={formMinCharge}
							placeholder="0"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
						<span class="text-[11px] text-gray-400">{$i18n.t('Kopeks')}</span>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Effective from')}</span>
						<input
							type="text"
							inputmode="numeric"
							bind:value={formEffectiveFrom}
							disabled={formMode === 'edit'}
							placeholder="Unix timestamp"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs text-gray-500">{$i18n.t('Effective to')}</span>
						<input
							type="text"
							inputmode="numeric"
							bind:value={formEffectiveTo}
							placeholder="Unix timestamp"
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
						/>
					</label>
				</div>

				<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
					<label class="flex items-center gap-2 text-xs text-gray-500">
						<Switch state={formIsActive} on:change={(e) => (formIsActive = e.detail)} />
						{$i18n.t('Active')}
					</label>
					<button
						type="button"
						on:click={handleSave}
						disabled={saving}
						class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full disabled:opacity-50"
					>
						{saving ? $i18n.t('Saving') : $i18n.t('Save')}
					</button>
				</div>
			</div>
		{/if}

		<div class="mb-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="flex items-center gap-2 text-sm font-medium mb-3">
				<div>{$i18n.t('Filters')}</div>
				<button
					type="button"
					on:click={resetFilters}
					class="ml-auto px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
				>
					<Reset className="size-3" />
				</button>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 text-sm">
				<input
					type="text"
					bind:value={filterModelId}
					placeholder={$i18n.t('Model ID (exact)')}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				/>
				<input
					type="text"
					bind:value={filterModality}
					placeholder={$i18n.t('Modality')}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				/>
				<input
					type="text"
					bind:value={filterUnit}
					placeholder={$i18n.t('Unit')}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				/>
				<input
					type="text"
					bind:value={filterVersion}
					placeholder={$i18n.t('Version')}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				/>
				<input
					type="text"
					bind:value={filterProvider}
					placeholder={$i18n.t('Provider')}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				/>
				<select
					bind:value={filterActive}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				>
					<option value="all">{$i18n.t('All statuses')}</option>
					<option value="active">{$i18n.t('Active only')}</option>
					<option value="inactive">{$i18n.t('Inactive only')}</option>
				</select>
			</div>
			<div class="flex justify-end mt-3">
				<button
					type="button"
					on:click={applyFilters}
					class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
				>
					{$i18n.t('Apply filters')}
				</button>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 overflow-hidden">
			{#if loading}
				<div class="w-full h-full flex justify-center items-center py-16">
					<Spinner className="size-5" />
				</div>
			{:else if rateCards.length === 0}
				<div class="w-full h-full flex flex-col justify-center items-center my-16">
					<div class="max-w-md text-center">
						<div class="text-3xl mb-3">💸</div>
						<div class="text-lg font-medium mb-1">{$i18n.t('No rate cards found')}</div>
						<div class="text-gray-500 text-center text-xs">
							{$i18n.t('Try adjusting your filters or sync defaults to create missing entries.')}
						</div>
					</div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Model')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Modality')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Unit')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Raw cost')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Platform factor')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Fixed fee')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Min charge')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Version')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Effective')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Provider')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Default pricing')}</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Active')}</th>
								<th class="text-right px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{$i18n.t('Actions')}</th>
							</tr>
						</thead>
						<tbody>
							{#each rateCards as entry (entry.id)}
								<tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
									<td class="px-4 py-2">
										<div class="font-medium">{entry.model_id}</div>
										<div class="text-[11px] text-gray-400">{entry.model_tier || '—'}</div>
									</td>
									<td class="px-4 py-2">{entry.modality}</td>
									<td class="px-4 py-2">{entry.unit}</td>
									<td class="px-4 py-2">{formatMoney(entry.raw_cost_per_unit_kopeks)}</td>
									<td class="px-4 py-2">{entry.platform_factor.toFixed(2)}x</td>
									<td class="px-4 py-2">{formatMoney(entry.fixed_fee_kopeks)}</td>
									<td class="px-4 py-2">{formatMoney(entry.min_charge_kopeks)}</td>
									<td class="px-4 py-2">{entry.version}</td>
									<td class="px-4 py-2">
										<div>{formatDate(entry.effective_from)}</div>
										<div class="text-[11px] text-gray-400">
											{entry.effective_to ? formatDate(entry.effective_to) : $i18n.t('Never')}
										</div>
									</td>
									<td class="px-4 py-2">{entry.provider || '—'}</td>
									<td class="px-4 py-2">
										{#if entry.is_default}
											<span class="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">
												{$i18n.t('Default')}
											</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td class="px-4 py-2">
										<Switch
											state={entry.is_active}
											on:change={(e) => handleToggleActive(entry, e.detail)}
										/>
									</td>
									<td class="px-4 py-2 text-right">
										<Tooltip content={$i18n.t('Edit')}>
											<button
												type="button"
												on:click={() => openEditForm(entry)}
												class="px-2 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
											>
												{$i18n.t('Edit')}
											</button>
										</Tooltip>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if totalPages > 1}
					<div class="flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-700">
						<div class="text-sm text-gray-500">
							{$i18n.t('Page')} {page} {$i18n.t('of')} {totalPages}
						</div>
						<div class="flex items-center gap-2 text-sm">
							<select
								bind:value={pageSize}
								on:change={() => applyFilters()}
								class="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent"
							>
								<option value="25">25</option>
								<option value="50">50</option>
								<option value="100">100</option>
							</select>
							<button
								class="px-3 py-1.5 rounded-lg text-sm font-medium transition
									{page === 1
										? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
										: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}"
								disabled={page === 1}
								on:click={() => goToPage(page - 1)}
							>
								<ChevronLeft className="size-4" />
							</button>
							<button
								class="px-3 py-1.5 rounded-lg text-sm font-medium transition
									{page === totalPages
										? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
										: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}"
								disabled={page === totalPages}
								on:click={() => goToPage(page + 1)}
							>
								<ChevronRight className="size-4" />
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
