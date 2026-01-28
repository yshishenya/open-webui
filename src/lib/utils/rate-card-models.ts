import type { RateCard } from '$lib/apis/admin/billing';

export type ModelStatus = 'new' | 'configured';

export type ModalityKey = 'text' | 'image' | 'tts' | 'stt';

export type ModelMeta = {
	lead_magnet?: boolean;
};

export type ModelOption = {
	id: string;
	name?: string | null;
	is_active?: boolean | null;
	base_model_id?: string | null;
	meta?: ModelMeta | null;
	params?: Record<string, unknown> | null;
	access_control?: Record<string, unknown> | null;
};

export type ModelRow = ModelOption & {
	status: ModelStatus;
	modalities: ModalityKey[];
};

export const getRateCardKey = (modality: string, unit: string): string => {
	return `${modality}:${unit}`;
};

export const buildLatestRateCardIndex = (
	rateCards: RateCard[]
): Record<string, Record<string, RateCard>> => {
	const index: Record<string, Record<string, RateCard>> = {};
	for (const entry of rateCards) {
		const key = getRateCardKey(entry.modality, entry.unit);
		const modelEntries = index[entry.model_id] ?? {};
		const existing = modelEntries[key];
		if (!existing) {
			modelEntries[key] = entry;
		} else if (entry.is_active && !existing.is_active) {
			modelEntries[key] = entry;
		} else if (entry.is_active === existing.is_active) {
			if (entry.created_at >= existing.created_at) {
				modelEntries[key] = entry;
			}
		}
		index[entry.model_id] = modelEntries;
	}
	return index;
};

export const buildModelRows = (models: ModelOption[], rateCards: RateCard[]): ModelRow[] => {
	const existingModelIds = new Set(rateCards.map((entry) => entry.model_id));
	const modelModalities = new Map<string, Set<ModalityKey>>();

	rateCards.forEach((entry) => {
		if (!entry.is_active) return;
		const modality = entry.modality as ModalityKey;
		if (!['text', 'image', 'tts', 'stt'].includes(modality)) return;
		const entrySet = modelModalities.get(entry.model_id) ?? new Set<ModalityKey>();
		entrySet.add(modality);
		modelModalities.set(entry.model_id, entrySet);
	});

	return models
		.map((model) => {
			const modalities = Array.from(modelModalities.get(model.id) ?? new Set<ModalityKey>());
			const orderedModalities = ['text', 'image', 'tts', 'stt'].filter((modality) =>
				modalities.includes(modality as ModalityKey)
			) as ModalityKey[];
			const status: ModelStatus = existingModelIds.has(model.id) ? 'configured' : 'new';
			return {
				...model,
				status,
				modalities: orderedModalities
			};
		})
		.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
};
