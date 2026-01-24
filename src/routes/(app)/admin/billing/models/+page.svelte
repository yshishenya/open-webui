<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getBaseModels } from '$lib/apis/models';
	import { createRateCard, listRateCards, updateRateCard } from '$lib/apis/admin/billing';
	import type {
		RateCard,
		RateCardCreateRequest,
		RateCardUpdateRequest
	} from '$lib/apis/admin/billing';
	import Modal from '$lib/components/common/Modal.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import {
		buildLatestRateCardIndex,
		buildModelRows,
		getRateCardKey,
		type ModelOption,
		type ModelRow
	} from '$lib/utils/rate-card-models';

	const i18n = getContext('i18n');

	type FormMode = 'add' | 'edit';
	type StatusFilter = 'all' | 'new' | 'configured';
	type ModalityKey = 'text' | 'image' | 'tts' | 'stt';

	type UnitState = {
		unit: string;
		cost: string;
		exists: boolean;
		id?: string;
		isActive?: boolean;
		effectiveFrom?: number;
		effectiveTo?: number | null;
	};

	type ModalityState = {
		enabled: boolean;
		units: Record<string, UnitState>;
	};

	type ModalState = Record<ModalityKey, ModalityState>;
	type PreviewCounts = {
		create: number;
		update: number;
		disable: number;
		total: number;
	};

	const MODALITY_UNITS: Record<ModalityKey, string[]> = {
		text: ['token_in', 'token_out'],
		image: ['image_1024'],
		tts: ['tts_char'],
		stt: ['stt_second']
	};

	let loaded = false;
	let loading = false;
	let errorMessage: string | null = null;

	let availableModels: ModelOption[] = [];
	let rateCards: RateCard[] = [];
	let modelRows: ModelRow[] = [];
	let rateCardIndex: Record<string, Record<string, RateCard>> = {};
	let rateCardKeyIndex = new Set<string>();

	let searchValue = '';
	let statusFilter: StatusFilter = 'all';

	let showModal = false;
	let formMode: FormMode = 'add';
	let selectedModel: ModelRow | null = null;
	let modalState: ModalState = buildDefaultModalState();
	let linkTextPrices = true;
	let modalEffectiveFrom = '';
	let modalEffectiveTo = '';
	let effectiveFromDisplay = '';
	let effectiveToDefault: number | null | undefined = undefined;
	let effectiveToDirty = false;
	let baseEffectiveFrom: number | null = null;
	let saving = false;


	const STATUS_LABELS: Record<ModelRow['status'], string> = {
		new: 'New',
		configured: 'Configured'
	};

	const STATUS_STYLES: Record<ModelRow['status'], string> = {
		new: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		configured: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
	};

	function buildDefaultModalState(): ModalState {
		const state = {} as ModalState;
		(Object.keys(MODALITY_UNITS) as ModalityKey[]).forEach((modality) => {
			const units: Record<string, UnitState> = {};
			MODALITY_UNITS[modality].forEach((unit) => {
				units[unit] = {
					unit,
					cost: '',
					exists: false
				};
			});
			state[modality] = {
				enabled: modality === 'text',
				units
			};
		});
		return state;
	}

	const buildRateCardEffectiveKey = (
		modelId: string,
		modality: string,
		unit: string,
		effectiveFrom: number
	): string => {
		return `${modelId}:${modality}:${unit}:${effectiveFrom}`;
	};

	const getModelDisplayName = (model: ModelOption): string => model.name ?? model.id;

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await loadData();
		loaded = true;
	});

	const loadData = async () => {
		loading = true;
		errorMessage = null;
		try {
			await Promise.all([loadModels(), loadRateCards()]);
			rebuildState();
		} catch (error) {
			console.error('Failed to load rate card data:', error);
			errorMessage = $i18n.t('Failed to load rate cards');
		} finally {
			loading = false;
		}
	};

	const loadModels = async () => {
		const models = ((await getBaseModels(localStorage.token)) ?? []) as ModelOption[];
		availableModels = models
			.map((model: ModelOption) => ({
				id: model.id,
				name: model.name,
				is_active: model.is_active
			}))
			.sort((a: ModelOption, b: ModelOption) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
	};

	const loadRateCards = async () => {
		const entries: RateCard[] = [];
		let page = 1;
		let totalPages = 1;
		const pageSize = 200;
		while (page <= totalPages) {
			const result = await listRateCards(localStorage.token, {
				page,
				page_size: pageSize
			});
			entries.push(...(result.items ?? []));
			totalPages = result.total_pages ?? 1;
			page += 1;
		}
		rateCards = entries;
	};

	const rebuildState = () => {
		rateCardIndex = buildLatestRateCardIndex(rateCards);
		rateCardKeyIndex = buildRateCardKeyIndex(rateCards);
		modelRows = buildModelRows(availableModels, rateCards);
	};

	const buildRateCardKeyIndex = (entries: RateCard[]): Set<string> => {
		const keys = new Set<string>();
		for (const entry of entries) {
			keys.add(
				buildRateCardEffectiveKey(
					entry.model_id,
					entry.modality,
					entry.unit,
					entry.effective_from
				)
			);
		}
		return keys;
	};

	const getModalTitle = (): string => {
		if (!selectedModel) return $i18n.t('Rate Card');
		return `${$i18n.t('Rate Card')} — ${getModelDisplayName(selectedModel)}`;
	};

	const getModalSubtitle = (): string => {
		return formMode === 'add'
			? $i18n.t('Создание новых записей')
			: $i18n.t('Редактирование и добавление модальностей');
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

	const openModal = (model: ModelRow) => {
		selectedModel = model;
		formMode = model.status === 'configured' ? 'edit' : 'add';
		initializeModalState(model.id);
		showModal = true;
	};

	const closeModal = () => {
		showModal = false;
		selectedModel = null;
		resetModalState();
	};

	const resetModalState = () => {
		modalState = buildDefaultModalState();
		linkTextPrices = true;
		modalEffectiveFrom = '';
		modalEffectiveTo = '';
		effectiveFromDisplay = '';
		effectiveToDefault = undefined;
		effectiveToDirty = false;
		baseEffectiveFrom = null;
	};

	const initializeModalState = (modelId: string) => {
		resetModalState();
		if (formMode === 'add') return;
		const entries = rateCards.filter((entry) => entry.model_id === modelId);
		if (entries.length === 0) return;

		const entryByUnit = rateCardIndex[modelId] ?? {};
		const nextState = buildDefaultModalState();
		let tokenInCost = '';
		let tokenOutCost = '';
		let textEnabled = false;
		let textHasEntries = false;

		(Object.keys(MODALITY_UNITS) as ModalityKey[]).forEach((modality) => {
			let hasActive = false;
			let hasEntry = false;
			MODALITY_UNITS[modality].forEach((unit) => {
				const entry = entryByUnit[getRateCardKey(modality, unit)];
				if (!entry) return;
				hasEntry = true;
				hasActive = hasActive || entry.is_active;
				nextState[modality].units[unit] = {
					unit,
					cost: String(entry.raw_cost_per_unit_kopeks ?? 0),
					exists: true,
					id: entry.id,
					isActive: entry.is_active,
					effectiveFrom: entry.effective_from,
					effectiveTo: entry.effective_to ?? null
				};
				if (modality === 'text' && unit === 'token_in') tokenInCost = nextState[modality].units[unit].cost;
				if (modality === 'text' && unit === 'token_out') tokenOutCost = nextState[modality].units[unit].cost;
			});
			nextState[modality].enabled = hasEntry ? hasActive : false;
			if (modality === 'text') {
				textEnabled = hasActive;
				textHasEntries = hasEntry;
			}
		});

		modalState = nextState;
		linkTextPrices = tokenInCost !== '' && tokenInCost === tokenOutCost;
		if (textHasEntries && !textEnabled) {
			modalState.text.enabled = false;
		}

		const effectiveFrom = getCommonNumber(entries.map((entry) => entry.effective_from));
		effectiveFromDisplay =
			effectiveFrom === null || effectiveFrom === undefined ? $i18n.t('Varies') : String(effectiveFrom);
		modalEffectiveFrom = effectiveFrom === null || effectiveFrom === undefined ? '' : String(effectiveFrom);

		const effectiveTo = getCommonNumber(entries.map((entry) => entry.effective_to ?? null));
		effectiveToDefault = effectiveTo === undefined ? undefined : effectiveTo;
		effectiveToDirty = false;
		modalEffectiveTo = effectiveTo === null || effectiveTo === undefined ? '' : String(effectiveTo);

		baseEffectiveFrom = effectiveFrom ?? getLatestEffectiveFrom(entries);
	};

	const getLatestEffectiveFrom = (entries: RateCard[]): number | null => {
		const values = entries.map((entry) => entry.effective_from ?? 0);
		if (values.length === 0) return null;
		return Math.max(...values);
	};

	const getCommonNumber = (values: Array<number | null | undefined>): number | null | undefined => {
		const normalized = values.map((value) => (value === undefined ? null : value));
		const unique = Array.from(new Set(normalized));
		if (unique.length === 1) return unique[0];
		return null;
	};

	const updateTextPriceLink = (nextState: boolean) => {
		linkTextPrices = nextState;
		if (!nextState) return;
		const tokenInCost = modalState.text.units.token_in.cost;
		modalState = {
			...modalState,
			text: {
				...modalState.text,
				units: {
					...modalState.text.units,
					token_out: {
						...modalState.text.units.token_out,
						cost: tokenInCost
					}
				}
			}
		};
	};

	const updateUnitCost = (modality: ModalityKey, unit: string, value: string) => {
		if (modality === 'text' && linkTextPrices) {
			modalState = {
				...modalState,
				text: {
					...modalState.text,
					units: {
						...modalState.text.units,
						token_in: {
							...modalState.text.units.token_in,
							cost: value
						},
						token_out: {
							...modalState.text.units.token_out,
							cost: value
						}
					}
				}
			};
			return;
		}
		modalState = {
			...modalState,
			[modality]: {
				...modalState[modality],
				units: {
					...modalState[modality].units,
					[unit]: {
						...modalState[modality].units[unit],
						cost: value
					}
				}
			}
		};
	};

	const toggleModality = (modality: ModalityKey, nextState: boolean) => {
		modalState = {
			...modalState,
			[modality]: {
				...modalState[modality],
				enabled: nextState
			}
		};
	};

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

	const parseOptionalInt = (
		value: string,
		label: string,
		emptyAsNull: boolean
	): number | null | undefined => {
		if (!value.trim()) return emptyAsNull ? null : undefined;
		const parsed = Number.parseInt(value, 10);
		if (Number.isNaN(parsed) || parsed < 0) {
			toast.error($i18n.t('Invalid value for {label}', { label }));
			return null;
		}
		return parsed;
	};

	const calculatePreviewCounts = (): PreviewCounts => {
		let create = 0;
		let update = 0;
		let disable = 0;
		(Object.keys(modalState) as ModalityKey[]).forEach((modality) => {
			const modalityState = modalState[modality];
			Object.values(modalityState.units).forEach((unitState) => {
				if (modalityState.enabled) {
					if (unitState.exists) {
						update += 1;
					} else {
						create += 1;
					}
					return;
				}
				if (unitState.exists && unitState.isActive) {
					disable += 1;
				}
			});
		});
		return { create, update, disable, total: create + update + disable };
	};

	const handleSave = async () => {
		if (saving || !selectedModel) return;

		const effectiveFromValue =
			formMode === 'add'
				? parseOptionalInt(modalEffectiveFrom, $i18n.t('Effective from'), false)
				: undefined;
		if (effectiveFromValue === null) return;
		const effectiveFromCandidate = formMode === 'edit' ? baseEffectiveFrom : effectiveFromValue;
		if (formMode === 'add' && effectiveFromCandidate === undefined) {
			toast.error($i18n.t('Effective from is required'));
			return;
		}

		const effectiveToValue = parseOptionalInt(
			modalEffectiveTo,
			$i18n.t('Effective to'),
			formMode === 'edit'
		);
		if (effectiveToValue === null) return;

		const updateRequests: Array<{ id: string; data: RateCardUpdateRequest }> = [];
		const createRequests: RateCardCreateRequest[] = [];
		const baseEffectiveTo = effectiveToDirty ? effectiveToValue : effectiveToDefault;
		const effectiveToPayload =
			baseEffectiveTo === undefined ? undefined : baseEffectiveTo;
		const defaultEffectiveFrom = effectiveFromCandidate;
		const shouldUpdateEffectiveTo = effectiveToDirty;

		(Object.keys(modalState) as ModalityKey[]).forEach((modality) => {
			const modalityState = modalState[modality];
			Object.values(modalityState.units).forEach((unitState) => {
				const costValue =
					modality === 'text' && linkTextPrices && unitState.unit === 'token_out'
						? modalityState.units.token_in.cost
						: unitState.cost;
				if (modalityState.enabled) {
					const cost = parseRequiredInt(costValue, getUnitLabel(modality, unitState.unit));
					if (cost === null) return;
					if (unitState.exists) {
						updateRequests.push({
							id: unitState.id as string,
							data: {
								raw_cost_per_unit_kopeks: cost,
								...(shouldUpdateEffectiveTo ? { effective_to: effectiveToPayload } : {}),
								is_active: true
							}
						});
						return;
					}
					createRequests.push({
						model_id: selectedModel.id,
						modality,
						unit: unitState.unit,
						raw_cost_per_unit_kopeks: cost,
						effective_from: defaultEffectiveFrom ?? undefined,
						effective_to: effectiveToPayload,
						is_active: true
					});
					return;
				}
				if (unitState.exists && unitState.isActive) {
					updateRequests.push({
						id: unitState.id as string,
						data: {
							is_active: false,
							...(shouldUpdateEffectiveTo ? { effective_to: effectiveToPayload } : {})
						}
					});
				}
			});
		});

		const duplicates = createRequests.filter((request) => {
			if (typeof request.effective_from !== 'number') return false;
			const key = buildRateCardEffectiveKey(
				request.model_id,
				request.modality,
				request.unit,
				request.effective_from
			);
			return rateCardKeyIndex.has(key);
		});
		if (duplicates.length > 0) {
			toast.error($i18n.t('Rate card already exists. Refreshing list.'));
			await loadData();
			return;
		}

		if (createRequests.length === 0 && updateRequests.length === 0) {
			toast.error($i18n.t('No changes to save'));
			return;
		}

		saving = true;
		try {
			for (const request of createRequests) {
				await createRateCard(localStorage.token, request);
			}
			for (const request of updateRequests) {
				await updateRateCard(localStorage.token, request.id, request.data);
			}
			toast.success(
				$i18n.t(formMode === 'add' ? 'Rate card created' : 'Rate card updated')
			);
			closeModal();
			await loadData();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('already exists')) {
				toast.error($i18n.t('Rate card already exists. Refreshing list.'));
				await loadData();
				return;
			}
			console.error('Failed to save rate card:', error);
			toast.error(
				$i18n.t(formMode === 'add' ? 'Failed to create rate card' : 'Failed to update rate card')
			);
		} finally {
			saving = false;
		}
	};

	$: filteredModelRows = modelRows.filter((model) => {
		const needle = searchValue.trim().toLowerCase();
		const matchesSearch =
			!needle || getModelDisplayName(model).toLowerCase().includes(needle) || model.id
				.toLowerCase()
				.includes(needle);
		const matchesStatus = statusFilter === 'all' ? true : model.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	$: previewCounts = calculatePreviewCounts();
</script>

<svelte:head>
	<title>{$i18n.t('Model Pricing')} • {$WEBUI_NAME}</title>
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
				on:click={loadData}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else}
	<div class="px-4.5 w-full">
		<div class="flex flex-col gap-1 px-1 mt-2.5 mb-4">
			<div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
				<div class="flex items-center text-xl font-medium gap-2">
					<div>{$i18n.t('Model Pricing')}</div>
					<div class="text-lg font-medium text-gray-500 dark:text-gray-500">
						{modelRows.length}
					</div>
				</div>
				<button
					on:click={loadData}
					class="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
					disabled={loading}
				>
					{$i18n.t('Refresh')}
				</button>
			</div>
			<div class="flex flex-col lg:flex-row gap-3">
				<label class="flex-1">
					<span class="sr-only">{$i18n.t('Search models')}</span>
					<input
						type="text"
						bind:value={searchValue}
						placeholder={$i18n.t('Search models')}
						class="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm"
					/>
				</label>
				<select
					bind:value={statusFilter}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm"
				>
					<option value="all">{$i18n.t('All statuses')}</option>
					<option value="new">{$i18n.t('New')}</option>
					<option value="configured">{$i18n.t('Configured')}</option>
				</select>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 overflow-hidden">
			{#if loading}
				<div class="w-full h-full flex justify-center items-center py-16">
					<Spinner className="size-5" />
				</div>
			{:else if filteredModelRows.length === 0}
				<div class="w-full h-full flex flex-col justify-center items-center my-16">
					<div class="max-w-md text-center">
						<div class="text-3xl mb-3">💸</div>
						<div class="text-lg font-medium mb-1">{$i18n.t('No models found')}</div>
						<div class="text-gray-500 text-center text-xs">
							{$i18n.t('Try adjusting your search or status filter.')}
						</div>
					</div>
				</div>
			{:else}
				<div class="divide-y divide-gray-100 dark:divide-gray-800">
					{#each filteredModelRows as model}
						<div class="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
							<div class="flex-1">
								<div class="flex flex-col">
									<span class="text-sm font-medium">
										{getModelDisplayName(model)}
									</span>
									<span class="text-xs text-gray-400">{model.id}</span>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span
									class={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
										STATUS_STYLES[model.status]
									}`}
								>
									{$i18n.t(STATUS_LABELS[model.status])}
								</span>
								<button
									on:click={() => openModal(model)}
									class="px-3 py-1.5 rounded-xl text-sm font-medium bg-black text-white dark:bg-white dark:text-black transition"
								>
									{$i18n.t(model.status === 'configured' ? 'Edit' : 'Add')}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if showModal}
	<Modal size="xl" bind:show={showModal} containerClassName="p-4">
		<div class="px-4 py-3">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div>
					<div class="text-lg font-semibold">{getModalTitle()}</div>
					<div class="text-xs text-gray-500 mt-1">
						{getModalSubtitle()}
					</div>
				</div>
				<button
					type="button"
					on:click={closeModal}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
				>
					<XMark className="size-5" />
				</button>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{#each Object.keys(modalState) as modality}
					{@const modalityKey = modality as ModalityKey}
					{@const modalityState = modalState[modalityKey]}
					<div class="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
						<div class="flex items-start justify-between gap-3 mb-3">
							<div>
								<div class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
									{modalityKey}
								</div>
								<div class="text-[11px] text-gray-400">
									{$i18n.t('Enable modality')}
								</div>
							</div>
							<Switch
								state={modalityState.enabled}
								on:change={(event: CustomEvent<boolean>) => toggleModality(modalityKey, event.detail)}
							/>
						</div>

						{#if modalityKey === 'text'}
							<label class="flex items-center gap-2 text-[11px] text-gray-500 mb-3">
								<input
									type="checkbox"
									checked={linkTextPrices}
									on:change={(event: Event) =>
										updateTextPriceLink((event.currentTarget as HTMLInputElement).checked)}
									class="rounded"
								/>
								{$i18n.t('Link token prices')}
							</label>
						{/if}

						<div class="flex flex-col gap-3">
							{#each Object.values(modalityState.units) as unitState}
								<div class="flex items-start gap-3">
									<div class="flex-1">
										<div class="text-xs font-medium">
											{getUnitLabel(modalityKey, unitState.unit)}
										</div>
										<div class="text-[11px] text-gray-400">
											{$i18n.t('Kopeks per unit')}
										</div>
									</div>
									<input
										type="text"
										inputmode="numeric"
										value={unitState.cost}
										on:input={(event: Event) =>
											updateUnitCost(
												modalityKey,
												unitState.unit,
												(event.currentTarget as HTMLInputElement).value
											)}
										placeholder="0"
										disabled={!modalityState.enabled ||
											(linkTextPrices && modalityKey === 'text' && unitState.unit === 'token_out')}
										class="w-28 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-xs disabled:opacity-50"
									/>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('Effective from')}</span>
					<input
						type="text"
						inputmode="numeric"
						value={formMode === 'edit' ? effectiveFromDisplay : modalEffectiveFrom}
						placeholder={$i18n.t('Unix timestamp')}
						disabled={formMode === 'edit'}
						on:input={(event: Event) => {
							if (formMode === 'edit') return;
							modalEffectiveFrom = (event.currentTarget as HTMLInputElement).value;
						}}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('Effective to')}</span>
					<input
						type="text"
						inputmode="numeric"
						bind:value={modalEffectiveTo}
						placeholder={$i18n.t('Unix timestamp')}
						on:input={() => {
							effectiveToDirty = true;
						}}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
			</div>

			<div class="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div class="text-xs text-gray-500">
					{$i18n.t('Will create {count} entries', { count: previewCounts.create })}
					{#if previewCounts.update > 0}
						<span class="ml-2">
							{$i18n.t('Update {count}', { count: previewCounts.update })}
						</span>
					{/if}
					{#if previewCounts.disable > 0}
						<span class="ml-2">
							{$i18n.t('Disable {count}', { count: previewCounts.disable })}
						</span>
					{/if}
				</div>
				<button
					type="button"
					on:click={handleSave}
					disabled={saving}
					class="px-4 py-2 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full disabled:opacity-50"
				>
					{saving ? $i18n.t('Saving') : $i18n.t('Save')}
				</button>
			</div>
		</div>
	</Modal>
{/if}
