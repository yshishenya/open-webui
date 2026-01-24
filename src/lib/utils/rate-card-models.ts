import type { RateCard } from '$lib/apis/admin/billing';

export type ModelStatus = 'new' | 'configured';

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

export type ModelRow = ModelOption & { status: ModelStatus };

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
			if (entry.effective_from >= existing.effective_from) {
				modelEntries[key] = entry;
			}
		}
		index[entry.model_id] = modelEntries;
	}
	return index;
};

export const buildModelRows = (models: ModelOption[], rateCards: RateCard[]): ModelRow[] => {
	const existingModelIds = new Set(rateCards.map((entry) => entry.model_id));
	return models
		.map((model) => ({
			...model,
			status: existingModelIds.has(model.id) ? 'configured' : 'new'
		}))
		.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
};
