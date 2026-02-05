import type { RateCard } from '$lib/apis/admin/billing';
import { getRateCardKey } from '$lib/utils/rate-card-models';

export type ModelRateDisplay = {
	text_in_1000_tokens?: number;
	text_out_1000_tokens?: number;
	image_1024?: number;
	tts_1000_chars?: number;
	stt_minute?: number;
};

const normalizeKopeks = (value: unknown): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return Math.max(0, Math.trunc(value));
};

const getLatestActive = (
	modelEntries: Record<string, RateCard> | undefined,
	modality: string,
	unit: string
): RateCard | null => {
	if (!modelEntries) return null;
	const entry = modelEntries[getRateCardKey(modality, unit)];
	if (!entry || !entry.is_active) return null;
	return entry;
};

/**
 * Builds a display-oriented price index from the latest rate-card index.
 *
 * Notes on units:
 * - text token rates are stored "per 1k tokens" (billing divides tokens by 1000)
 * - tts rates are stored per char → display per 1k chars
 * - stt rates are stored per second → display per minute
 * - image rates are stored per image (image_1024)
 */
export const buildModelRateDisplayIndex = (
	rateCardIndex: Record<string, Record<string, RateCard>>
): Record<string, ModelRateDisplay> => {
	const result: Record<string, ModelRateDisplay> = {};

	for (const [modelId, modelEntries] of Object.entries(rateCardIndex)) {
		const display: ModelRateDisplay = {};

		const textIn = getLatestActive(modelEntries, 'text', 'token_in');
		const textOut = getLatestActive(modelEntries, 'text', 'token_out');
		const image = getLatestActive(modelEntries, 'image', 'image_1024');
		const tts = getLatestActive(modelEntries, 'tts', 'tts_char');
		const stt = getLatestActive(modelEntries, 'stt', 'stt_second');

		const textInKopeks = normalizeKopeks(textIn?.raw_cost_per_unit_kopeks);
		if (textInKopeks !== null) display.text_in_1000_tokens = textInKopeks;

		const textOutKopeks = normalizeKopeks(textOut?.raw_cost_per_unit_kopeks);
		if (textOutKopeks !== null) display.text_out_1000_tokens = textOutKopeks;

		const imageKopeks = normalizeKopeks(image?.raw_cost_per_unit_kopeks);
		if (imageKopeks !== null) display.image_1024 = imageKopeks;

		const ttsPerChar = normalizeKopeks(tts?.raw_cost_per_unit_kopeks);
		if (ttsPerChar !== null) display.tts_1000_chars = ttsPerChar * 1000;

		const sttPerSecond = normalizeKopeks(stt?.raw_cost_per_unit_kopeks);
		if (sttPerSecond !== null) display.stt_minute = sttPerSecond * 60;

		result[modelId] = display;
	}

	return result;
};

