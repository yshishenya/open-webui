import type { ModelRateDisplay } from '$lib/utils/airis/rate_cards';
import type { PricingFocus } from '$lib/utils/airis/model_pricing_audit';

export type PricingCompleteness = 'missing' | 'partial' | 'ok';

export const getPricingCompletenessForFocus = (
	rates: ModelRateDisplay | undefined,
	focus: PricingFocus
): PricingCompleteness => {
	if (!rates) return 'missing';
	if (focus === 'all') return 'ok';

	if (focus === 'text') {
		const hasIn = rates.text_in_1000_tokens !== undefined;
		const hasOut = rates.text_out_1000_tokens !== undefined;
		if (hasIn && hasOut) return 'ok';
		if (hasIn || hasOut) return 'partial';
		return 'missing';
	}

	if (focus === 'image') {
		return rates.image_1024 !== undefined ? 'ok' : 'missing';
	}

	if (focus === 'audio') {
		const hasTts = rates.tts_1000_chars !== undefined;
		const hasStt = rates.stt_minute !== undefined;
		if (hasTts && hasStt) return 'ok';
		if (hasTts || hasStt) return 'partial';
		return 'missing';
	}

	return 'missing';
};

export const hasZeroPriceForFocus = (
	rates: ModelRateDisplay | undefined,
	focus: PricingFocus
): boolean => {
	if (!rates) return false;
	if (focus === 'all') return false;

	if (focus === 'text') {
		return (
			rates.text_in_1000_tokens === 0 ||
			rates.text_out_1000_tokens === 0
		);
	}

	if (focus === 'image') {
		return rates.image_1024 === 0;
	}

	if (focus === 'audio') {
		return rates.tts_1000_chars === 0 || rates.stt_minute === 0;
	}

	return false;
};

