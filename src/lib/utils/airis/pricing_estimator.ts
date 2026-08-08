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
	uncertainty: { min: number; max: number }
): EstimateRange | null => {
	if (!model || !hasTextRates(model)) return null;

	const safeMessagesPerDay = Math.max(0, Math.floor(Number(messagesPerDay) || 0));
	const totalMessages = safeMessagesPerDay * 30;
	const rateIn = model.rates.text_in_1000_tokens ?? 0;
	const rateOut = model.rates.text_out_1000_tokens ?? 0;
	let total = 0;

	for (let messageIndex = 0; messageIndex < totalMessages; messageIndex += 1) {
		// Each request sends the previous conversation turns again; billing rounds each request to kopeks.
		const contextTokens =
			tokensInPerMessage + messageIndex * (tokensInPerMessage + tokensOutPerMessage);
		const costIn = Math.ceil((contextTokens / 1000) * rateIn);
		const costOut = Math.ceil((tokensOutPerMessage / 1000) * rateOut);
		total += costIn + costOut;
	}

	return {
		min: Math.floor(total * uncertainty.min),
		max: Math.ceil(total * uncertainty.max)
	};
};
