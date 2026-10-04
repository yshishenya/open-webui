import type { PublicRateCardModel } from '$lib/apis/billing';

export type EstimateRange = { min: number; max: number };

const hasTextRates = (model: PublicRateCardModel): boolean =>
	model.rates.text_in_1000_tokens !== null && model.rates.text_out_1000_tokens !== null;

export const pickCheapestTextModel = (
	models: PublicRateCardModel[],
	preferredId?: string | null
): PublicRateCardModel | null => {
	const textModels = models.filter(hasTextRates);
	const preferred = preferredId ? textModels.find((model) => model.id === preferredId) : null;
	if (preferred) return preferred;

	return (
		[...textModels].sort(
			(a, b) =>
				(a.rates.text_in_1000_tokens ?? 0) +
				(a.rates.text_out_1000_tokens ?? 0) -
				((b.rates.text_in_1000_tokens ?? 0) + (b.rates.text_out_1000_tokens ?? 0))
		)[0] ?? null
	);
};

export const calculateTextEstimate = (
	model: PublicRateCardModel | null,
	tokensInPerMessage: number,
	tokensOutPerMessage: number,
	messagesPerDay: number,
	uncertainty: { min: number; max: number },
	scenario: 'continuous' | 'separate' = 'continuous'
): EstimateRange | null => {
	if (!model || !hasTextRates(model)) return null;
	if (
		![
			model.rates.text_in_1000_tokens,
			model.rates.text_out_1000_tokens,
			tokensInPerMessage,
			tokensOutPerMessage
		].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
	)
		return null;

	const safeMessagesPerDay = Math.min(
		1000,
		Math.max(0, Math.floor(Number.isFinite(messagesPerDay) ? messagesPerDay : 0))
	);
	const totalMessages = safeMessagesPerDay * 30;
	const rateIn = model.rates.text_in_1000_tokens ?? 0;
	const rateOut = model.rates.text_out_1000_tokens ?? 0;
	let total = 0;

	for (let messageIndex = 0; messageIndex < totalMessages; messageIndex += 1) {
		// Each request sends the previous conversation turns again; billing rounds each request to kopeks.
		const contextTokens =
			tokensInPerMessage +
			(scenario === 'continuous' ? messageIndex : 0) * (tokensInPerMessage + tokensOutPerMessage);
		const costIn = Math.ceil((contextTokens / 1000) * rateIn);
		const costOut = Math.ceil((tokensOutPerMessage / 1000) * rateOut);
		total += costIn + costOut;
	}

	const min = Math.floor(total * uncertainty.min);
	const max = Math.ceil(total * uncertainty.max);
	return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && max >= min
		? { min, max }
		: null;
};

export type EstimateUsageKind = 'image' | 'tts' | 'stt';
/** Bound examples to realistic quantities and reject invalid money before rendering. */
export const calculateUsageEstimate = (
	rate: number | null,
	quantity: number,
	kind: EstimateUsageKind,
	uncertainty: { min: number; max: number }
): EstimateRange | null => {
	const maximum = kind === 'image' ? 10000 : kind === 'tts' ? 10000000 : 43200;
	if (
		rate === null ||
		!Number.isFinite(rate) ||
		rate < 0 ||
		!Number.isFinite(quantity) ||
		quantity <= 0 ||
		quantity > maximum ||
		(kind !== 'stt' && !Number.isSafeInteger(quantity))
	)
		return null;
	const total = Math.ceil((rate * quantity) / (kind === 'tts' ? 1000 : 1));
	const min = Math.floor(total * uncertainty.min);
	const max = Math.ceil(total * uncertainty.max);
	return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && max >= min
		? { min, max }
		: null;
};
