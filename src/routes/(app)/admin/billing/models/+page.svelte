<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getBaseModels } from '$lib/apis/models';
	import {
		bulkDeleteRateCards,
		createRateCard,
		deleteRateCard,
		deleteRateCardsByModel,
		listRateCards,
		syncRateCards,
		updateRateCard
	} from '$lib/apis/admin/billing';
	import type {
		RateCard,
		RateCardCreateRequest,
		RateCardUpdateRequest
	} from '$lib/apis/admin/billing';

	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ChevronLeft from '$lib/components/icons/ChevronLeft.svelte';
	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';
	import ChevronRight from '$lib/components/icons/ChevronRight.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Reset from '$lib/components/icons/Reset.svelte';

	const i18n = getContext('i18n');

	type FormMode = 'create' | 'edit';

	type RateCardGroup = {
		model_id: string;
		model_tier?: string | null;
		entries: RateCard[];
	};

	type RateCardGroupStats = {
		modalities: string[];
		units: string[];
		version: string | null;
		provider: string | null;
		effective: string;
		has_default: boolean;
		active_state: 'active' | 'inactive' | 'mixed';
	};

	type ModelOption = {
		id: string;
		name?: string | null;
		is_active?: boolean | null;
	};

	type UnitPricingState = {
		selected: boolean;
		cost: string;
	};

	type ModalityPricingState = Record<string, UnitPricingState>;

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
	let showDeleteConfirm = false;
	let pendingDeleteMode: 'entries' | 'models' = 'entries';
	let pendingDeleteRateCardIds: string[] = [];
	let pendingDeleteModelIds: string[] = [];
	let selectedRateCardIds: string[] = [];
	let expandedModelIds: string[] = [];
	let groupCheckboxRefs: Record<string, HTMLInputElement> = {};

	const DELETE_CONFIRM_TEXT = 'DELETE';

	let formModelId = '';
	let formModality = '';
	let formUnit = '';
	let formRawCost = '0';
	let formEffectiveFrom = '';
	let formEffectiveTo = '';
	let formIsActive = true;
	let availableModels: ModelOption[] = [];
	let filteredModels: ModelOption[] = [];
	let modelSearchValue = '';
	let selectedCreateModelIds: string[] = [];
	let createUnitPricing: Record<string, ModalityPricingState> = {};
	let linkTextUnitPrices = true;

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

	const getDefaultUnitPricing = (): Record<string, ModalityPricingState> => {
		const pricing: Record<string, ModalityPricingState> = {};
		for (const [modality, units] of Object.entries(MODALITY_UNITS)) {
			pricing[modality] = {};
			for (const unit of units) {
				pricing[modality][unit] = {
					selected: modality === 'text',
					cost: ''
				};
			}
		}
		return pricing;
	};

	createUnitPricing = getDefaultUnitPricing();

	const updateUnitPricing = (
		modality: string,
		unit: string,
		updates: Partial<UnitPricingState>
	) => {
		const nextModality = {
			...createUnitPricing[modality],
			[unit]: {
				...createUnitPricing[modality][unit],
				...updates
			}
		};
		createUnitPricing = {
			...createUnitPricing,
			[modality]: nextModality
		};
	};

	const handleLinkTextPrices = (nextState: boolean) => {
		linkTextUnitPrices = nextState;
		if (!nextState) {
			return;
		}
		const tokenInCost = createUnitPricing.text?.token_in?.cost ?? '';
		const tokenOutSelected = createUnitPricing.text?.token_out?.selected ?? false;
		const tokenInSelected = createUnitPricing.text?.token_in?.selected ?? false;
		createUnitPricing = {
			...createUnitPricing,
			text: {
				...createUnitPricing.text,
				token_in: {
					...createUnitPricing.text.token_in,
					selected: tokenInSelected || tokenOutSelected
				},
				token_out: {
					...createUnitPricing.text.token_out,
					selected: tokenOutSelected,
					cost: tokenInCost
				}
			}
		};
	};

	const toggleUnitSelection = (modality: string, unit: string) => {
		const current = createUnitPricing[modality][unit];
		const nextSelected = !current.selected;
		if (modality === 'text' && linkTextUnitPrices) {
			if (unit === 'token_in' && current.selected) {
				updateUnitPricing(modality, 'token_out', { selected: false });
			}
			if (unit === 'token_out' && nextSelected) {
				updateUnitPricing(modality, 'token_in', { selected: true });
			}
		}
		updateUnitPricing(modality, unit, { selected: nextSelected });
	};

	const updateUnitCost = (modality: string, unit: string, value: string) => {
		if (modality === 'text' && linkTextUnitPrices) {
			updateUnitPricing(modality, 'token_in', { cost: value });
			updateUnitPricing(modality, 'token_out', { cost: value });
			return;
		}
		updateUnitPricing(modality, unit, { cost: value });
	};

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await loadRateCards();
		await loadAvailableModels();
		loaded = true;
	});

	const loadAvailableModels = async () => {
		try {
			const models = ((await getBaseModels(localStorage.token)) ?? []) as ModelOption[];
			availableModels = models
				.map((model: ModelOption) => ({
					id: model.id,
					name: model.name,
					is_active: model.is_active
				}))
				.sort((a: ModelOption, b: ModelOption) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
		} catch (error) {
			console.error('Failed to load models:', error);
			toast.error($i18n.t('Failed to fetch models'));
		}
	};

	const toggleCreateModelSelection = (modelId: string) => {
		if (selectedCreateModelIds.includes(modelId)) {
			selectedCreateModelIds = selectedCreateModelIds.filter((id) => id !== modelId);
			return;
		}
		selectedCreateModelIds = [...selectedCreateModelIds, modelId];
	};

	const toggleSelectAllCreateModels = () => {
		if (selectedCreateModelIds.length === availableModels.length) {
			selectedCreateModelIds = [];
			return;
		}
		selectedCreateModelIds = availableModels.map((model) => model.id);
	};

	const loadRateCards = async () => {
		loading = true;
		errorMessage = null;
		try {
			const isActive = filterActive === 'all' ? undefined : filterActive === 'active';
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
			syncExpandedModelIds(rateCards);
			selectedRateCardIds = selectedRateCardIds.filter((rateCardId) =>
				rateCards.some((entry) => entry.id === rateCardId)
			);
		} catch (error) {
			console.error('Failed to load rate cards:', error);
			errorMessage = $i18n.t('Failed to load rate cards');
		} finally {
			loading = false;
		}
	};

	const applyFilters = async () => {
		selectedRateCardIds = [];
		expandedModelIds = [];
		page = 1;
		await loadRateCards();
	};

	const resetFilters = async () => {
		selectedRateCardIds = [];
		expandedModelIds = [];
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
		selectedRateCardIds = [];
		expandedModelIds = [];
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

	const getGroupString = (values: Array<string | null | undefined>): string | null => {
		const normalized = values.map((value) => (value ?? '').trim());
		const unique = Array.from(new Set(normalized));
		if (unique.length === 1) {
			return unique[0] || null;
		}
		return null;
	};

	const getGroupNullableNumber = (
		values: Array<number | null | undefined>
	): number | null | undefined => {
		const normalized = values.map((value) => value ?? null);
		const unique = Array.from(new Set(normalized));
		if (unique.length === 1) {
			return unique[0];
		}
		return undefined;
	};

	const buildRateCardGroups = (entries: RateCard[]): RateCardGroup[] => {
		const groups = new Map<string, RateCardGroup>();
		for (const entry of entries) {
			const existing = groups.get(entry.model_id);
			if (existing) {
				existing.entries.push(entry);
				continue;
			}
			groups.set(entry.model_id, {
				model_id: entry.model_id,
				model_tier: entry.model_tier ?? null,
				entries: [entry]
			});
		}
		return Array.from(groups.values());
	};

	const getGroupEffectiveLabel = (group: RateCardGroup): string => {
		const effectiveFrom = getGroupNullableNumber(
			group.entries.map((entry) => entry.effective_from ?? null)
		);
		const effectiveTo = getGroupNullableNumber(
			group.entries.map((entry) => entry.effective_to ?? null)
		);
		if (effectiveFrom === undefined || effectiveTo === undefined || effectiveFrom === null) {
			return '—';
		}
		const start = formatDate(effectiveFrom);
		const end = effectiveTo === null ? $i18n.t('Never') : formatDate(effectiveTo);
		return `${start} → ${end}`;
	};

	const getGroupStats = (group: RateCardGroup): RateCardGroupStats => {
		const modalities = Array.from(new Set(group.entries.map((entry) => entry.modality))).sort();
		const units = Array.from(new Set(group.entries.map((entry) => entry.unit))).sort();
		const version = getGroupString(group.entries.map((entry) => entry.version));
		const provider = getGroupString(group.entries.map((entry) => entry.provider));
		const activeCount = group.entries.filter((entry) => entry.is_active).length;
		return {
			modalities,
			units,
			version,
			provider,
			effective: getGroupEffectiveLabel(group),
			has_default: group.entries.some((entry) => entry.is_default),
			active_state:
				activeCount === 0 ? 'inactive' : activeCount === group.entries.length ? 'active' : 'mixed'
		};
	};

	const syncExpandedModelIds = (entries: RateCard[]) => {
		const modelIds = Array.from(new Set(entries.map((entry) => entry.model_id)));
		expandedModelIds = expandedModelIds.filter((modelId) => modelIds.includes(modelId));
	};

	const toggleModelExpansion = (modelId: string) => {
		if (expandedModelIds.includes(modelId)) {
			expandedModelIds = expandedModelIds.filter((id) => id !== modelId);
			return;
		}
		expandedModelIds = [...expandedModelIds, modelId];
	};

	const registerGroupCheckbox = (node: HTMLInputElement, modelId: string) => {
		groupCheckboxRefs = { ...groupCheckboxRefs, [modelId]: node };
		return {
			destroy() {
				const { [modelId]: _, ...rest } = groupCheckboxRefs;
				groupCheckboxRefs = rest;
			}
		};
	};

	const resetForm = () => {
		formMode = 'create';
		editingId = null;
		formModelId = '';
		formModality = 'text';
		formUnit = 'token_in';
		formRawCost = '0';
		formEffectiveFrom = '';
		formEffectiveTo = '';
		formIsActive = true;
		modelSearchValue = '';
		selectedCreateModelIds = [];
		createUnitPricing = getDefaultUnitPricing();
		linkTextUnitPrices = true;
	};

	const openCreateForm = () => {
		resetForm();
		if (availableModels.length === 0) {
			void loadAvailableModels();
		}
		showForm = true;
	};

	const openEditForm = (entry: RateCard) => {
		formMode = 'edit';
		editingId = entry.id;
		formModelId = entry.model_id;
		formModality = entry.modality || 'text';
		formUnit = entry.unit;
		formRawCost = String(entry.raw_cost_per_unit_kopeks ?? 0);
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

	const parseOptionalInt = (value: string, label: string): number | undefined | null => {
		if (!value.trim()) return undefined;
		const parsed = Number.parseInt(value, 10);
		if (Number.isNaN(parsed) || parsed < 0) {
			toast.error($i18n.t('Invalid value for {label}', { label }));
			return null;
		}
		return parsed;
	};

	const buildCreatePayloads = (): RateCardCreateRequest[] | null => {
		if (selectedCreateModelIds.length === 0) {
			toast.error($i18n.t('No models selected'));
			return null;
		}

		const selectedModels = Array.from(new Set(selectedCreateModelIds))
			.map((modelId) => modelId.trim())
			.filter((modelId) => modelId);
		if (selectedModels.length === 0) {
			toast.error($i18n.t('No models selected'));
			return null;
		}
		const selectedUnits: Array<{ modality: string; unit: string; cost: number }> = [];
		for (const [modality, units] of Object.entries(createUnitPricing)) {
			for (const [unit, state] of Object.entries(units)) {
				if (!state.selected) continue;
				const label = getUnitLabel(modality, unit);
				const costValue =
					modality === 'text' && unit === 'token_out' && linkTextUnitPrices
						? (createUnitPricing.text?.token_in?.cost ?? '')
						: state.cost;
				const parsedCost = parseRequiredInt(costValue, label);
				if (parsedCost === null) return null;
				selectedUnits.push({ modality, unit, cost: parsedCost });
			}
		}

		if (selectedUnits.length === 0) {
			toast.error($i18n.t('No units selected'));
			return null;
		}

		const effectiveFrom = parseOptionalInt(formEffectiveFrom, $i18n.t('Effective from'));
		if (effectiveFrom === null) return null;
		const effectiveTo = parseOptionalInt(formEffectiveTo, $i18n.t('Effective to'));
		if (effectiveTo === null) return null;

		const basePayload = {
			effective_from: effectiveFrom,
			effective_to: effectiveTo,
			is_active: formIsActive
		} satisfies Omit<
			RateCardCreateRequest,
			'model_id' | 'modality' | 'unit' | 'raw_cost_per_unit_kopeks'
		>;

		return selectedModels.flatMap((modelId) =>
			selectedUnits.map((unitSelection) => ({
				...basePayload,
				model_id: modelId,
				modality: unitSelection.modality,
				unit: unitSelection.unit,
				raw_cost_per_unit_kopeks: unitSelection.cost
			}))
		);
	};

	const buildUpdatePayload = (): RateCardUpdateRequest | null => {
		const rawCost = parseRequiredInt(formRawCost, $i18n.t('Raw cost'));
		if (rawCost === null) {
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
			effective_to: effectiveTo,
			is_active: formIsActive
		};
	};

	const handleSave = async () => {
		if (saving) return;
		if (formMode === 'edit' && !editingId) return;

		if (formMode === 'create') {
			const payloads = buildCreatePayloads();
			if (!payloads) return;

			saving = true;
			try {
				for (const payload of payloads) {
					await createRateCard(localStorage.token, payload);
				}
				toast.success($i18n.t('Rate card created'));
				showForm = false;
				resetForm();
				await loadRateCards();
			} catch (error) {
				console.error('Failed to save rate card:', error);
				toast.error($i18n.t('Failed to create rate card'));
			} finally {
				saving = false;
			}
			return;
		}

		const payload = buildUpdatePayload();
		if (!payload) return;

		saving = true;
		try {
			await updateRateCard(localStorage.token, editingId as string, payload);
			toast.success($i18n.t('Rate card updated'));
			showForm = false;
			resetForm();
			await loadRateCards();
		} catch (error) {
			console.error('Failed to save rate card:', error);
			toast.error($i18n.t('Failed to update rate card'));
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
				$i18n.t('Sync completed: {{created}} created, {{skipped}} skipped', {
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

	const toggleSelection = (rateCardId: string) => {
		if (selectedRateCardIds.includes(rateCardId)) {
			selectedRateCardIds = selectedRateCardIds.filter((id) => id !== rateCardId);
			return;
		}
		selectedRateCardIds = [...selectedRateCardIds, rateCardId];
	};

	const toggleSelectAll = () => {
		if (selectedRateCardIds.length === rateCards.length) {
			selectedRateCardIds = [];
			return;
		}
		selectedRateCardIds = rateCards.map((entry) => entry.id);
	};

	const toggleGroupSelection = (group: RateCardGroup) => {
		const groupIds = group.entries.map((entry) => entry.id);
		const allSelected = groupIds.every((id) => selectedRateCardIds.includes(id));
		if (allSelected) {
			selectedRateCardIds = selectedRateCardIds.filter((id) => !groupIds.includes(id));
			return;
		}
		const next = new Set(selectedRateCardIds);
		groupIds.forEach((id) => next.add(id));
		selectedRateCardIds = Array.from(next);
	};

	const openDeleteEntries = (rateCardIds: string[]) => {
		if (rateCardIds.length === 0) return;
		pendingDeleteMode = 'entries';
		pendingDeleteRateCardIds = Array.from(new Set(rateCardIds));
		pendingDeleteModelIds = [];
		showDeleteConfirm = true;
	};

	const openDeleteModels = (modelIds: string[]) => {
		if (modelIds.length === 0) return;
		pendingDeleteMode = 'models';
		pendingDeleteModelIds = Array.from(new Set(modelIds));
		pendingDeleteRateCardIds = [];
		showDeleteConfirm = true;
	};

	const handleDeleteConfirm = async (inputValue: string) => {
		const normalized = inputValue.trim().toUpperCase();
		if (normalized !== DELETE_CONFIRM_TEXT) {
			toast.error($i18n.t('Type DELETE to confirm.'));
			showDeleteConfirm = true;
			return;
		}
		if (actionInProgress) return;
		actionInProgress = true;
		try {
			if (pendingDeleteMode === 'entries') {
				const rateCardIds = Array.from(new Set(pendingDeleteRateCardIds));
				if (rateCardIds.length === 1) {
					await deleteRateCard(localStorage.token, rateCardIds[0]);
					toast.success($i18n.t('Deleted {count} rate cards', { count: rateCardIds.length }));
				} else {
					const result = await bulkDeleteRateCards(localStorage.token, {
						rate_card_ids: rateCardIds
					});
					toast.success($i18n.t('Deleted {count} rate cards', { count: result.deleted }));
				}
			} else {
				const modelIds = Array.from(new Set(pendingDeleteModelIds));
				await deleteRateCardsByModel(localStorage.token, {
					model_ids: modelIds
				});
				toast.success($i18n.t('Deleted rate cards for {count} models', { count: modelIds.length }));
			}
			selectedRateCardIds = [];
			await loadRateCards();
		} catch (error) {
			console.error('Failed to delete rate cards:', error);
			toast.error($i18n.t('Failed to delete rate cards'));
		} finally {
			actionInProgress = false;
			pendingDeleteRateCardIds = [];
			pendingDeleteModelIds = [];
		}
	};

	$: filteredModels = availableModels
		.filter((model) => {
			const needle = modelSearchValue.trim().toLowerCase();
			if (!needle) return true;
			return (model.name ?? model.id).toLowerCase().includes(needle);
		})
		.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
	$: selectedUnitCount = Object.values(createUnitPricing).reduce((count, units) => {
		return count + Object.values(units).filter((unit) => unit.selected).length;
	}, 0);
	$: createEntryCount = selectedCreateModelIds.length * selectedUnitCount;
	$: allCreateModelsSelected =
		availableModels.length > 0 && selectedCreateModelIds.length === availableModels.length;

	$: selectedEntries = rateCards.filter((entry) => selectedRateCardIds.includes(entry.id));
	$: selectedModelIds = Array.from(new Set(selectedEntries.map((entry) => entry.model_id)));
	$: allSelected = rateCards.length > 0 && selectedRateCardIds.length === rateCards.length;
	$: groupedRateCards = buildRateCardGroups(rateCards);
	$: {
		for (const group of groupedRateCards) {
			const checkbox = groupCheckboxRefs[group.model_id];
			if (!checkbox) continue;
			const selectedCount = group.entries.filter((entry) =>
				selectedRateCardIds.includes(entry.id)
			).length;
			checkbox.indeterminate = selectedCount > 0 && selectedCount < group.entries.length;
		}
	}
	$: deleteConfirmTitle =
		pendingDeleteMode === 'entries'
			? $i18n.t('Delete selected entries?')
			: $i18n.t('Delete model pricing?');
	$: deleteConfirmMessage =
		pendingDeleteMode === 'entries'
			? $i18n.t('This will permanently delete {count} rate card entries.', {
					count: pendingDeleteRateCardIds.length
				}) +
				'\n\n' +
				$i18n.t('Type DELETE to confirm.')
			: $i18n.t('This will permanently delete all rate cards for {count} models.', {
					count: pendingDeleteModelIds.length
				}) +
				'\n\n' +
				$i18n.t('Type DELETE to confirm.');
</script>

<svelte:head>
	<title>
		{$i18n.t('Model Pricing')} • {$WEBUI_NAME}
	</title>
</svelte:head>

<ConfirmDialog
	bind:show={showDeleteConfirm}
	title={deleteConfirmTitle}
	message={deleteConfirmMessage}
	input
	inputPlaceholder={$i18n.t('Type DELETE')}
	confirmLabel={$i18n.t('Delete')}
	on:confirm={(event) => handleDeleteConfirm(event.detail)}
/>

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
			<div
				class="mb-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
			>
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium">
						{formMode === 'create' ? $i18n.t('Create rate card') : $i18n.t('Update rate card')}
					</div>
					<button
						type="button"
						on:click={handleCancel}
						class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
					>
						{$i18n.t('Cancel')}
					</button>
				</div>

				{#if formMode === 'create'}
					<div class="grid grid-cols-1 xl:grid-cols-3 gap-3 text-sm">
						<div
							class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-3 flex flex-col gap-2 xl:row-span-2"
						>
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-500">{$i18n.t('Models')}</span>
								<button
									type="button"
									class="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition disabled:opacity-50"
									on:click={toggleSelectAllCreateModels}
									disabled={availableModels.length === 0}
								>
									{allCreateModelsSelected ? $i18n.t('Clear selection') : $i18n.t('Select all')}
								</button>
							</div>
							<input
								type="text"
								bind:value={modelSearchValue}
								placeholder={$i18n.t('Search models')}
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm"
							/>
							{#if filteredModels.length === 0}
								<div class="text-xs text-gray-500">{$i18n.t('No models found')}</div>
							{:else}
								<div class="max-h-44 overflow-y-auto flex flex-col gap-1 pr-1">
									{#each filteredModels as model}
										<label
											class="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
										>
											<input
												type="checkbox"
												checked={selectedCreateModelIds.includes(model.id)}
												on:change={() => toggleCreateModelSelection(model.id)}
												class="rounded"
											/>
											<div class="flex flex-col">
												<span class="text-xs font-medium">
													{model.name || model.id}
												</span>
												<span class="text-[11px] text-gray-400">{model.id}</span>
											</div>
											{#if model.is_active === false}
												<span class="ml-auto text-[10px] text-gray-400">
													{$i18n.t('Disabled')}
												</span>
											{/if}
										</label>
									{/each}
								</div>
							{/if}
							<div class="text-[11px] text-gray-400">
								{$i18n.t('Selected {count} models', { count: selectedCreateModelIds.length })}
							</div>
						</div>
						<div
							class="xl:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-3 flex flex-col gap-3"
						>
							<div class="text-xs font-medium text-gray-500">{$i18n.t('Pricing units')}</div>
							<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
								{#each Object.entries(createUnitPricing) as [modality, units]}
									<div
										class="rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent p-3 flex flex-col gap-2"
									>
										{#if modality === 'text'}
											<div class="flex flex-col gap-1">
												<div
													class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 whitespace-nowrap"
												>
													{modality}
												</div>
												<label class="flex items-center gap-1 text-[11px] text-gray-500">
													<input
														type="checkbox"
														checked={linkTextUnitPrices}
														on:change={(event) => handleLinkTextPrices(event.currentTarget.checked)}
														class="rounded"
													/>
													{$i18n.t('Link token prices')}
												</label>
											</div>
										{:else}
											<div
												class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 whitespace-nowrap"
											>
												{modality}
											</div>
										{/if}
										<div class="flex flex-col gap-2">
											{#each Object.entries(units) as [unitKey, unitState]}
												<div class="flex items-start gap-2">
													<input
														type="checkbox"
														checked={unitState.selected}
														on:change={() => toggleUnitSelection(modality, unitKey)}
														class="rounded mt-1"
													/>
													<div class="flex-1 min-w-0">
														<div class="text-xs font-medium leading-snug break-words">
															{getUnitLabel(modality, unitKey)}
														</div>
														<div class="text-[11px] text-gray-400">
															{$i18n.t('Kopeks per unit')}
														</div>
													</div>
													<input
														type="text"
														inputmode="numeric"
														value={unitState.cost}
														disabled={!unitState.selected ||
															(linkTextUnitPrices &&
																modality === 'text' &&
																unitKey === 'token_out')}
														on:input={(event) =>
															updateUnitCost(modality, unitKey, event.currentTarget.value)}
														placeholder="0"
														class="w-24 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-xs disabled:opacity-50 mt-1"
													/>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
						<div class="xl:col-span-2 xl:col-start-2 grid grid-cols-1 md:grid-cols-2 gap-3">
							<label class="flex flex-col gap-1">
								<span class="text-xs text-gray-500">{$i18n.t('Effective from')}</span>
								<input
									type="text"
									inputmode="numeric"
									bind:value={formEffectiveFrom}
									placeholder="Unix timestamp"
									class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
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
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
						<label class="flex flex-col gap-1">
							<span class="text-xs text-gray-500">{$i18n.t('Model ID')}</span>
							<input
								type="text"
								bind:value={formModelId}
								disabled
								placeholder="gpt-4o-mini"
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs text-gray-500">{$i18n.t('Modality')}</span>
							<select
								bind:value={formModality}
								disabled
								class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
							>
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
									disabled
									class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent disabled:opacity-60"
								>
									{#each allowedUnits as unit}
										<option value={unit}>{getUnitLabel(formModality, unit)}</option>
									{/each}
								</select>
							{:else}
								<div
									class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm text-gray-700 dark:text-gray-200"
								>
									{allowedUnits[0] ? getUnitLabel(formModality, allowedUnits[0]) : formUnit || '—'}
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
								<span class="text-[11px] text-gray-400">
									{getRawCostHint(formModality, formUnit)}
								</span>
							{/if}
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs text-gray-500">{$i18n.t('Effective from')}</span>
							<input
								type="text"
								inputmode="numeric"
								bind:value={formEffectiveFrom}
								disabled
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
				{/if}

				<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-col gap-1 text-xs text-gray-500">
						<label class="flex items-center gap-2">
							<Switch state={formIsActive} on:change={(e) => (formIsActive = e.detail)} />
							{$i18n.t('Active')}
						</label>
						{#if formMode === 'create'}
							<div class="text-[11px] text-gray-400">
								{$i18n.t('Will create {count} entries', { count: createEntryCount })}
							</div>
						{/if}
					</div>
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

		<div
			class="mb-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
		>
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

		<div
			class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 overflow-hidden"
		>
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
					{#if selectedRateCardIds.length > 0}
						<div
							class="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/50"
						>
							<div class="text-xs text-gray-500">
								{$i18n.t('Selected {count} entries', { count: selectedRateCardIds.length })}
							</div>
							<div class="flex items-center gap-2">
								<button
									class="px-2 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/60 dark:text-red-200 dark:hover:bg-red-900/20 text-xs font-medium transition disabled:opacity-50"
									on:click={() => openDeleteEntries(selectedRateCardIds)}
									disabled={actionInProgress}
								>
									<GarbageBin className="size-3" />
									<span class="ml-1">{$i18n.t('Delete entries')}</span>
								</button>
								<button
									class="px-2 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/60 dark:text-red-200 dark:hover:bg-red-900/20 text-xs font-medium transition disabled:opacity-50"
									on:click={() => openDeleteModels(selectedModelIds)}
									disabled={actionInProgress}
								>
									<GarbageBin className="size-3" />
									<span class="ml-1">{$i18n.t('Delete models')}</span>
								</button>
							</div>
						</div>
					{/if}
					<table class="w-full text-xs">
						<thead
							class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
						>
							<tr>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">
									<input
										type="checkbox"
										checked={allSelected}
										on:change={toggleSelectAll}
										class="rounded"
									/>
								</th>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Model')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Modality')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Unit')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Raw cost')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Version')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Effective')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Provider')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Default pricing')}</th
								>
								<th class="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Active')}</th
								>
								<th class="text-right px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Actions')}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each groupedRateCards as group (group.model_id)}
								{@const groupStats = getGroupStats(group)}
								{@const groupEntryIds = group.entries.map((entry) => entry.id)}
								{@const groupAllSelected =
									groupEntryIds.length > 0 &&
									groupEntryIds.every((id) => selectedRateCardIds.includes(id))}
								{@const isExpanded = expandedModelIds.includes(group.model_id)}
								<tr
									class="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/50"
								>
									<td class="px-4 py-2">
										<input
											type="checkbox"
											checked={groupAllSelected}
											on:change={() => toggleGroupSelection(group)}
											use:registerGroupCheckbox={group.model_id}
											class="rounded"
										/>
									</td>
									<td class="px-4 py-2">
										<div class="flex items-center gap-2">
											<button
												type="button"
												class="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
												aria-label={isExpanded ? $i18n.t('Collapse') : $i18n.t('Expand')}
												on:click={() => toggleModelExpansion(group.model_id)}
											>
												<ChevronDown
													className={`size-4 transition-transform ${
														isExpanded ? 'rotate-180' : ''
													}`}
												/>
											</button>
											<div>
												<div class="font-medium">{group.model_id}</div>
												<div class="text-[11px] text-gray-400">{group.model_tier || '—'}</div>
											</div>
										</div>
									</td>
									<td class="px-4 py-2">
										<div class="flex flex-wrap gap-1">
											{#each groupStats.modalities as modality}
												<span
													class="text-[10px] px-2 py-0.5 rounded-full bg-gray-200/70 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
												>
													{modality}
												</span>
											{/each}
										</div>
									</td>
									<td class="px-4 py-2">
										<div class="flex flex-wrap gap-1">
											{#each groupStats.units as unit}
												<span
													class="text-[10px] px-2 py-0.5 rounded-full bg-gray-200/70 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
												>
													{unit}
												</span>
											{/each}
										</div>
									</td>
									<td class="px-4 py-2 text-gray-400">—</td>
									<td class="px-4 py-2">{groupStats.version || '—'}</td>
									<td class="px-4 py-2">{groupStats.effective}</td>
									<td class="px-4 py-2">{groupStats.provider || '—'}</td>
									<td class="px-4 py-2">
										{#if groupStats.has_default}
											<span
												class="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300"
											>
												{$i18n.t('Default')}
											</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td class="px-4 py-2">
										{#if groupStats.active_state === 'active'}
											<span
												class="text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-200"
											>
												{$i18n.t('Active')}
											</span>
										{:else if groupStats.active_state === 'inactive'}
											<span
												class="text-[11px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-700 dark:text-gray-200"
											>
												{$i18n.t('Disabled')}
											</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td class="px-4 py-2 text-right">
										<Tooltip content={$i18n.t('Delete model pricing?')}>
											<button
												type="button"
												on:click={() => openDeleteModels([group.model_id])}
												class="px-2 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
											>
												{$i18n.t('Delete')}
											</button>
										</Tooltip>
									</td>
								</tr>
								{#if isExpanded}
									{#each group.entries as entry (entry.id)}
										<tr
											class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
										>
											<td class="px-4 py-2">
												<input
													type="checkbox"
													checked={selectedRateCardIds.includes(entry.id)}
													on:change={() => toggleSelection(entry.id)}
													class="rounded"
												/>
											</td>
											<td class="px-4 py-2">
												<div class="pl-6 text-gray-600 dark:text-gray-300">
													{entry.model_id}
												</div>
											</td>
											<td class="px-4 py-2">{entry.modality}</td>
											<td class="px-4 py-2">{entry.unit}</td>
											<td class="px-4 py-2">{formatMoney(entry.raw_cost_per_unit_kopeks)}</td>
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
													<span
														class="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300"
													>
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
												<Tooltip content={$i18n.t('Delete entry')}>
													<button
														type="button"
														on:click={() => openDeleteEntries([entry.id])}
														class="px-2 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
													>
														{$i18n.t('Delete')}
													</button>
												</Tooltip>
											</td>
										</tr>
									{/each}
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				{#if totalPages > 1}
					<div
						class="flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-700"
					>
						<div class="text-sm text-gray-500">
							{$i18n.t('Page')}
							{page}
							{$i18n.t('of')}
							{totalPages}
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
