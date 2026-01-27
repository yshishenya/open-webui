<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getBaseModels, updateModelById } from '$lib/apis/models';
	import {
		createRateCard,
		deleteRateCardsByModel,
		listRateCards,
		updateRateCard
	} from '$lib/apis/admin/billing';
	import type {
		RateCard,
		RateCardCreateRequest,
		RateCardUpdateRequest
	} from '$lib/apis/admin/billing';
	import Modal from '$lib/components/common/Modal.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import ChatBubble from '$lib/components/icons/ChatBubble.svelte';
	import PhotoSolid from '$lib/components/icons/PhotoSolid.svelte';
	import SoundHigh from '$lib/components/icons/SoundHigh.svelte';
	import MicSolid from '$lib/components/icons/MicSolid.svelte';
	import ChevronUpDown from '$lib/components/icons/ChevronUpDown.svelte';
	import ChevronUp from '$lib/components/icons/ChevronUp.svelte';
	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import PencilSquare from '$lib/components/icons/PencilSquare.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import {
		buildLatestRateCardIndex,
		buildModelRows,
		getRateCardKey,
		type ModalityKey,
		type ModelOption,
		type ModelRow
	} from '$lib/utils/rate-card-models';

	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	const i18n: Writable<i18nType> = getContext('i18n');

	type FormMode = 'add' | 'edit';
	type StatusFilter = 'all' | 'new' | 'configured';

	type UnitState = {
		unit: string;
		cost: string;
		originalCost?: number | null;
		exists: boolean;
		id?: string;
		isActive?: boolean;
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
	let sortKey: SortKey = 'model';
	let sortDirection: SortDirection = 'asc';

	let showModal = false;
	let formMode: FormMode = 'add';
	let selectedModel: ModelRow | null = null;
	let modalState: ModalState = buildDefaultModalState();
	let linkTextPrices = true;
	let leadMagnetEnabled = false;
	let saving = false;

	let selectedModelIds = new Set<string>();
	let showDeleteModelsConfirm = false;

	const STATUS_LABELS: Record<ModelRow['status'], string> = {
		new: 'New',
		configured: 'Configured'
	};

	const STATUS_STYLES: Record<ModelRow['status'], string> = {
		new: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		configured: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
	};

	type SortKey = 'model' | 'status' | 'lead';
	type SortDirection = 'asc' | 'desc';

	const STATUS_ORDER: Record<ModelRow['status'], number> = {
		configured: 0,
		new: 1
	};

	const LEAD_ORDER: Record<'enabled' | 'disabled', number> = {
		enabled: 0,
		disabled: 1
	};

	const MODALITY_ORDER: ModalityKey[] = ['text', 'image', 'tts', 'stt'];

	type ModalityDetail = {
		label: string;
		shortDescription: string;
		icon: typeof ChatBubble;
		tone: string;
	};

	const MODALITY_DETAILS: Record<ModalityKey, ModalityDetail> = {
		text: {
			label: 'Text',
			shortDescription: 'Tokens · in/out (per 1k)',
			icon: ChatBubble,
			tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200'
		},
		image: {
			label: 'Image',
			shortDescription: 'Images · per image',
			icon: PhotoSolid,
			tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
		},
		tts: {
			label: 'TTS',
			shortDescription: 'Speech · per 1k chars',
			icon: SoundHigh,
			tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200'
		},
		stt: {
			label: 'STT',
			shortDescription: 'Speech · per minute',
			icon: MicSolid,
			tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
		}
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

	const buildRateCardKey = (modelId: string, modality: string, unit: string): string => {
		return `${modelId}:${modality}:${unit}`;
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
				is_active: model.is_active,
				base_model_id: model.base_model_id,
				meta: model.meta,
				params: model.params,
				access_control: model.access_control
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
			if (!entry.is_active) continue;
			keys.add(buildRateCardKey(entry.model_id, entry.modality, entry.unit));
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

	const getModalityLabel = (modality: ModalityKey): string => {
		return $i18n.t(MODALITY_DETAILS[modality].label);
	};

	const getModalityTone = (modality: ModalityKey): string => MODALITY_DETAILS[modality].tone;

	const getModalityIcon = (modality: ModalityKey): typeof ChatBubble => {
		return MODALITY_DETAILS[modality].icon;
	};

	const getModalityTooltipSummary = (modalities: ModalityKey[]): string => {
		if (modalities.length === 0) return $i18n.t('No modalities configured');
		return $i18n.t('Modalities: {list}', {
			list: modalities.map((modality) => getModalityLabel(modality)).join(', ')
		});
	};

	const getSortLabel = (key: SortKey): string => {
		if (key === 'model') return $i18n.t('Model');
		if (key === 'lead') return $i18n.t('Lead magnet');
		return $i18n.t('Status');
	};

	const getModalityShortDescription = (modality: ModalityKey): string => {
		return $i18n.t(MODALITY_DETAILS[modality].shortDescription);
	};

	const getSwitchDetail = (event: Event): boolean => {
		return Boolean((event as Event & { detail?: unknown }).detail);
	};

	type InputLikeEvent = Event & {
		currentTarget: EventTarget & { checked?: boolean; value?: string };
	};

	const getInputChecked = (event: Event): boolean => {
		return Boolean((event as InputLikeEvent).currentTarget.checked);
	};

	const getInputValue = (event: Event): string => {
		return String((event as InputLikeEvent).currentTarget.value ?? '');
	};

	const getModalityTooltipContent = (modalities: ModalityKey[]): string => {
		if (modalities.length === 0) return $i18n.t('No modalities configured');
		const lines = modalities.map((modality) => {
			return `${getModalityLabel(modality)} — ${getModalityShortDescription(modality)}`;
		});
		return lines.join('<br />');
	};

	const compareStrings = (left: string, right: string): number => {
		return left.localeCompare(right, undefined, { sensitivity: 'base' });
	};

	const toggleSort = (nextKey: SortKey) => {
		if (sortKey === nextKey) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortKey = nextKey;
		sortDirection = 'asc';
	};

	const getSortButtonLabel = (key: SortKey): string => {
		if (sortKey !== key) return $i18n.t('Sort by {label}', { label: getSortLabel(key) });
		return $i18n.t('Sort by {label} ({direction})', {
			label: getSortLabel(key),
			direction: sortDirection === 'asc' ? $i18n.t('Ascending') : $i18n.t('Descending')
		});
	};

	const sortModelRows = (rows: ModelRow[], key: SortKey, direction: SortDirection): ModelRow[] => {
		const multiplier = direction === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => {
			const nameA = getModelDisplayName(a);
			const nameB = getModelDisplayName(b);

			if (key === 'status') {
				const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
				if (statusDelta !== 0) return statusDelta * multiplier;
				return compareStrings(nameA, nameB) * multiplier;
			}

			if (key === 'lead') {
				const leadA = a.meta?.lead_magnet ? 'enabled' : 'disabled';
				const leadB = b.meta?.lead_magnet ? 'enabled' : 'disabled';
				const leadDelta = LEAD_ORDER[leadA] - LEAD_ORDER[leadB];
				if (leadDelta !== 0) return leadDelta * multiplier;
				return compareStrings(nameA, nameB) * multiplier;
			}

			return compareStrings(nameA, nameB) * multiplier;
		});
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

	const handleDeleteSelectedModels = async () => {
		if (saving) return;
		const modelIds = Array.from(selectedModelIds);
		if (modelIds.length === 0) return;

		saving = true;
		try {
			const result = await deleteRateCardsByModel(localStorage.token, {
				model_ids: modelIds
			});
			toast.success(
				$i18n.t('Deleted rate cards for {count} models', {
					count: modelIds.length
				})
			);
			selectedModelIds = new Set();
			showDeleteModelsConfirm = false;
			await loadData();
			return result;
		} catch (error) {
			console.error('Failed to delete model rate cards:', error);
			toast.error($i18n.t('Failed to delete rate cards'));
		} finally {
			saving = false;
		}
	};

	const resetModalState = () => {
		modalState = buildDefaultModalState();
		linkTextPrices = true;
		leadMagnetEnabled = false;
	};

	const initializeModalState = (modelId: string) => {
		resetModalState();
		if (formMode === 'add') {
			leadMagnetEnabled = selectedModel?.meta?.lead_magnet ?? false;
			return;
		}
		leadMagnetEnabled = selectedModel?.meta?.lead_magnet ?? false;
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
						originalCost: entry.raw_cost_per_unit_kopeks ?? null,
						exists: true,
						id: entry.id,
						isActive: entry.is_active
					};


				if (modality === 'text' && unit === 'token_in')
					tokenInCost = nextState[modality].units[unit].cost;
				if (modality === 'text' && unit === 'token_out')
					tokenOutCost = nextState[modality].units[unit].cost;
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
			toast.error($i18n.t('{{label}} is required', { label }));
			return null;
		}
		const parsed = Number.parseInt(value, 10);
		if (Number.isNaN(parsed) || parsed < 0) {
			toast.error($i18n.t('Invalid value for {{label}}', { label }));
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
		const activeModel = selectedModel;

		const updateRequests: Array<{ id: string; data: RateCardUpdateRequest }> = [];
		const createRequests: RateCardCreateRequest[] = [];
		const deactivatedKeys = new Set<string>();
		const leadMagnetChanged = Boolean(activeModel.meta?.lead_magnet) !== Boolean(leadMagnetEnabled);
		let hasValidationError = false;

		(Object.keys(modalState) as ModalityKey[]).forEach((modality) => {
			const modalityState = modalState[modality];
			Object.values(modalityState.units).forEach((unitState) => {
				const costValue =
					modality === 'text' && linkTextPrices && unitState.unit === 'token_out'
						? modalityState.units.token_in.cost
						: unitState.cost;
				if (modalityState.enabled) {
					const cost = parseRequiredInt(costValue, getUnitLabel(modality, unitState.unit));
					if (cost === null) {
						hasValidationError = true;
						return;
					}
					if (unitState.exists) {
						const previousCost = unitState.originalCost ?? Number.parseInt(unitState.cost, 10);
						if (cost === previousCost) {
							updateRequests.push({
								id: unitState.id as string,
								data: {
									is_active: true
								}
							});
							return;
						}
						createRequests.push({
							model_id: activeModel.id,
							modality,
							unit: unitState.unit,
							raw_cost_per_unit_kopeks: cost,
							is_active: true
						});
						updateRequests.push({
							id: unitState.id as string,
							data: {
								is_active: false
							}
						});
						deactivatedKeys.add(buildRateCardKey(activeModel.id, modality, unitState.unit));
						return;
					}
					createRequests.push({
						model_id: activeModel.id,
						modality,
						unit: unitState.unit,
						raw_cost_per_unit_kopeks: cost,
						is_active: true
					});
					return;
				}
				if (unitState.exists && unitState.isActive) {
					updateRequests.push({
						id: unitState.id as string,
						data: {
							is_active: false
						}
					});
				}
			});
		});

		if (hasValidationError) return;

		const duplicates = createRequests.filter((request) => {
			const key = buildRateCardKey(request.model_id, request.modality, request.unit);
			return rateCardKeyIndex.has(key) && !deactivatedKeys.has(key);
		});
		if (duplicates.length > 0) {
			toast.error($i18n.t('Rate card already exists. Refreshing list.'));
			await loadData();
			return;
		}

		if (createRequests.length === 0 && updateRequests.length === 0 && !leadMagnetChanged) {
			toast.error($i18n.t('No changes to save'));
			return;
		}

		saving = true;
		try {
			if (leadMagnetChanged) {
				const nextMeta = { ...(selectedModel.meta ?? {}) };
				if (leadMagnetEnabled) {
					nextMeta.lead_magnet = true;
				} else {
					delete nextMeta.lead_magnet;
				}
				const updatedModel = await updateModelById(localStorage.token, selectedModel.id, {
					id: selectedModel.id,
					name: selectedModel.name ?? selectedModel.id,
					base_model_id: selectedModel.base_model_id ?? null,
					params: selectedModel.params ?? {},
					access_control: selectedModel.access_control ?? null,
					is_active: selectedModel.is_active ?? true,
					meta: nextMeta
				});
				if (!updatedModel) {
					throw new Error('Failed to update model');
				}
			}
			for (const request of createRequests) {
				await createRateCard(localStorage.token, request);
			}
			for (const request of updateRequests) {
				await updateRateCard(localStorage.token, request.id, request.data);
			}
			toast.success($i18n.t(formMode === 'add' ? 'Rate card created' : 'Rate card updated'));
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

	$: filteredModelRows = sortModelRows(
		modelRows.filter((model) => {
			const needle = searchValue.trim().toLowerCase();
			const matchesSearch =
				!needle ||
				getModelDisplayName(model).toLowerCase().includes(needle) ||
				model.id.toLowerCase().includes(needle);
			const matchesStatus = statusFilter === 'all' ? true : model.status === statusFilter;
			return matchesSearch && matchesStatus;
		}),
		sortKey,
		sortDirection
	);

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
		<ConfirmDialog
			bind:show={showDeleteModelsConfirm}
			title={$i18n.t('Delete model pricing?')}
			message={$i18n.t('This will permanently delete all rate cards for {count} models.', {
				count: selectedModelIds.size
			})}
			on:confirm={handleDeleteSelectedModels}
		/>
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

				{#if selectedModelIds.size > 0}
					<button
						type="button"
						on:click={() => (showDeleteModelsConfirm = true)}
						class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
						aria-label={$i18n.t('Delete models')}
						title={$i18n.t('Delete models')}
					>
						<GarbageBin className="size-4" />
						<span class="whitespace-nowrap">
							{$i18n.t('Delete models')} ({selectedModelIds.size})
						</span>
					</button>
				{/if}
			</div>
		</div>

		<div
			class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 overflow-hidden"
		>
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
				<div class="hidden md:block">
					<table class="w-full border-separate border-spacing-0">
						<thead class="bg-gray-50/70 dark:bg-gray-900/60 sticky top-0 z-10">
							<tr class="text-[11px] uppercase tracking-wide text-gray-500">
								<th class="px-4 py-2 text-left font-semibold w-10">
									<span class="sr-only">{$i18n.t('Select')}</span>
								</th>
								<th class="px-4 py-2 text-left font-semibold">
									<button
										type="button"
										on:click={() => toggleSort('model')}
										class={`inline-flex items-center gap-1.5 transition ${
											sortKey === 'model'
												? 'text-gray-700 dark:text-gray-100'
												: 'text-gray-500 dark:text-gray-400'
										}`}
										aria-label={getSortButtonLabel('model')}
										title={getSortButtonLabel('model')}
									>
										{$i18n.t('Model')}
										{#if sortKey === 'model'}
											{#if sortDirection === 'asc'}
												<ChevronUp className="size-3.5" />
											{:else}
												<ChevronDown className="size-3.5" />
											{/if}
										{:else}
											<ChevronUpDown className="size-3.5" />
										{/if}
									</button>
								</th>
								<th class="px-4 py-2 text-left font-semibold">{$i18n.t('Modalities')}</th>
								<th class="px-4 py-2 text-left font-semibold">
									<button
										type="button"
										on:click={() => toggleSort('status')}
										class={`inline-flex items-center gap-1.5 transition ${
											sortKey === 'status'
												? 'text-gray-700 dark:text-gray-100'
												: 'text-gray-500 dark:text-gray-400'
										}`}
										aria-label={getSortButtonLabel('status')}
										title={getSortButtonLabel('status')}
									>
										{$i18n.t('Status')}
										{#if sortKey === 'status'}
											{#if sortDirection === 'asc'}
												<ChevronUp className="size-3.5" />
											{:else}
												<ChevronDown className="size-3.5" />
											{/if}
										{:else}
											<ChevronUpDown className="size-3.5" />
										{/if}
									</button>
								</th>
								<th class="px-4 py-2 text-left font-semibold">
									<button
										type="button"
										on:click={() => toggleSort('lead')}
										class={`inline-flex items-center gap-1.5 transition ${
											sortKey === 'lead'
												? 'text-gray-700 dark:text-gray-100'
												: 'text-gray-500 dark:text-gray-400'
										}`}
										aria-label={getSortButtonLabel('lead')}
										title={getSortButtonLabel('lead')}
									>
										{$i18n.t('Lead magnet')}
										{#if sortKey === 'lead'}
											{#if sortDirection === 'asc'}
												<ChevronUp className="size-3.5" />
											{:else}
												<ChevronDown className="size-3.5" />
											{/if}
										{:else}
											<ChevronUpDown className="size-3.5" />
										{/if}
									</button>
								</th>
								<th class="px-4 py-2 text-right font-semibold">{$i18n.t('Actions')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							{#each filteredModelRows as model}
								<tr class="hover:bg-black/5 dark:hover:bg-white/5">
									<td class="px-4 py-3">
										<input
											type="checkbox"
											class="rounded"
											checked={selectedModelIds.has(model.id)}
											on:change={(event) => {
												const checked = getInputChecked(event);
												if (checked) {
													selectedModelIds.add(model.id);
												} else {
													selectedModelIds.delete(model.id);
												}
												selectedModelIds = new Set(selectedModelIds);
											}}
										/>
									</td>
									<td class="px-4 py-3">
										<div class="flex flex-col">
											<span class="text-sm font-medium line-clamp-1">
												{getModelDisplayName(model)}
											</span>
											<span class="text-xs text-gray-400 line-clamp-1">{model.id}</span>
										</div>
									</td>
									<td class="px-4 py-3">
										<Tooltip
											content={getModalityTooltipContent(model.modalities)}
											placement="top-start"
											tippyOptions={{ maxWidth: 260, appendTo: () => document.body }}
										>
											<div
												class="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400"
												aria-label={getModalityTooltipSummary(model.modalities)}
											>
												{#if model.modalities.length === 0}
													<span class="text-[11px] text-gray-400">—</span>
												{:else}
													{#each MODALITY_ORDER as modality}
														{#if model.modalities.includes(modality)}
															{@const Icon = getModalityIcon(modality)}
															<span
																class={`inline-flex items-center justify-center rounded-full px-2 py-1 font-medium ${getModalityTone(
																	modality
																)}`}
															>
																<Icon className="size-3" />
															</span>
														{/if}
													{/each}
												{/if}
											</div>
										</Tooltip>
									</td>
									<td class="px-4 py-3">
										<span
											class={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
												STATUS_STYLES[model.status]
											}`}
										>
											{$i18n.t(STATUS_LABELS[model.status])}
										</span>
									</td>
									<td class="px-4 py-3">
										{#if model.meta?.lead_magnet}
											<span
												class="text-[11px] px-2 py-0.5 rounded-full font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300"
											>
												{$i18n.t('Lead magnet')}
											</span>
										{:else}
											<span class="text-[11px] text-gray-400">—</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-right">
										<Tooltip content={$i18n.t(model.status === 'configured' ? 'Edit' : 'Add')}>
											<button
												on:click={() => openModal(model)}
												class="inline-flex items-center justify-center rounded-xl p-2 text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10 transition"
											>
												{#if model.status === 'configured'}
													<PencilSquare className="size-4" />
												{:else}
													<Plus className="size-4" />
												{/if}
											</button>
										</Tooltip>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="grid gap-3 md:hidden px-3 py-3">
					{#each filteredModelRows as model}
						<div class="rounded-2xl border border-gray-100/60 dark:border-gray-800/70 p-4">
							<label class="flex items-center gap-2 text-xs text-gray-500 mb-3">
								<input
									type="checkbox"
									class="rounded"
									checked={selectedModelIds.has(model.id)}
									on:change={(event) => {
										const checked = getInputChecked(event);
										if (checked) {
											selectedModelIds.add(model.id);
										} else {
											selectedModelIds.delete(model.id);
										}
										selectedModelIds = new Set(selectedModelIds);
									}}
								/>
								{$i18n.t('Select')}
							</label>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="text-sm font-medium line-clamp-1">
										{getModelDisplayName(model)}
									</div>
									<div class="text-xs text-gray-400 line-clamp-1">{model.id}</div>
								</div>
								<Tooltip content={$i18n.t(model.status === 'configured' ? 'Edit' : 'Add')}>
									<button
										on:click={() => openModal(model)}
										class="inline-flex items-center justify-center rounded-xl p-2 text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10 transition"
									>
										{#if model.status === 'configured'}
											<PencilSquare className="size-4" />
										{:else}
											<Plus className="size-4" />
										{/if}
									</button>
								</Tooltip>
							</div>
							<div
								class="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400"
							>
								<Tooltip
									content={getModalityTooltipContent(model.modalities)}
									placement="top-start"
									tippyOptions={{ maxWidth: 260, appendTo: () => document.body }}
								>
									<div class="flex flex-wrap items-center gap-1.5">
										{#if model.modalities.length === 0}
											<span class="text-[11px] text-gray-400">—</span>
										{:else}
											{#each MODALITY_ORDER as modality}
												{#if model.modalities.includes(modality)}
													{@const Icon = getModalityIcon(modality)}
													<span
														class={`inline-flex items-center justify-center rounded-full px-2 py-1 font-medium ${getModalityTone(
															modality
														)}`}
													>
														<Icon className="size-3" />
													</span>
												{/if}
											{/each}
										{/if}
									</div>
								</Tooltip>
							</div>
							<div class="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
								<span class={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[model.status]}`}>
									{$i18n.t(STATUS_LABELS[model.status])}
								</span>
								{#if model.meta?.lead_magnet}
									<span
										class="text-[11px] px-2 py-0.5 rounded-full font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300"
									>
										{$i18n.t('Lead magnet')}
									</span>
								{:else}
									<span class="text-[11px] text-gray-400">—</span>
								{/if}
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

			<div class="flex items-center justify-between gap-3 mb-4">
				<div>
					<div class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
						{$i18n.t('Lead magnet')}
					</div>
					<div class="text-[11px] text-gray-400">
						{$i18n.t('Allow free usage via lead magnet quotas for this model')}
					</div>
				</div>
				<Switch
					state={leadMagnetEnabled}
					on:change={(event) => {
						leadMagnetEnabled = getSwitchDetail(event);
					}}
				/>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{#each MODALITY_ORDER as modalityKey}
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
								on:change={(event) => toggleModality(modalityKey, getSwitchDetail(event))}
							/>
						</div>

						{#if modalityKey === 'text'}
							<label class="flex items-center gap-2 text-[11px] text-gray-500 mb-3">
								<input
									type="checkbox"
									checked={linkTextPrices}
									on:change={(event) => {
										updateTextPriceLink(getInputChecked(event));
									}}
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
										on:input={(event) => {
											updateUnitCost(modalityKey, unitState.unit, getInputValue(event));
										}}
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
