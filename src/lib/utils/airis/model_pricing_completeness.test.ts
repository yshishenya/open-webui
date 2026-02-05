import { describe, expect, it } from 'vitest';

import type { ModelRateDisplay } from '$lib/utils/airis/rate_cards';
import { getPricingCompletenessForFocus, hasZeroPriceForFocus } from './model_pricing_completeness';

describe('airis/model_pricing_completeness', () => {
	it('returns missing when rates are absent', () => {
		expect(getPricingCompletenessForFocus(undefined, 'text')).toBe('missing');
	});

	it('text focus: missing/partial/ok', () => {
		const base: ModelRateDisplay = {};
		expect(getPricingCompletenessForFocus(base, 'text')).toBe('missing');
		expect(getPricingCompletenessForFocus({ ...base, text_in_1000_tokens: 10 }, 'text')).toBe('partial');
		expect(getPricingCompletenessForFocus({ ...base, text_out_1000_tokens: 10 }, 'text')).toBe('partial');
		expect(
			getPricingCompletenessForFocus(
				{ ...base, text_in_1000_tokens: 10, text_out_1000_tokens: 20 },
				'text'
			)
		).toBe('ok');
	});

	it('image focus: ok only when image price present', () => {
		expect(getPricingCompletenessForFocus({}, 'image')).toBe('missing');
		expect(getPricingCompletenessForFocus({ image_1024: 123 }, 'image')).toBe('ok');
	});

	it('audio focus: missing/partial/ok', () => {
		expect(getPricingCompletenessForFocus({}, 'audio')).toBe('missing');
		expect(getPricingCompletenessForFocus({ tts_1000_chars: 1 }, 'audio')).toBe('partial');
		expect(getPricingCompletenessForFocus({ stt_minute: 1 }, 'audio')).toBe('partial');
		expect(getPricingCompletenessForFocus({ tts_1000_chars: 1, stt_minute: 1 }, 'audio')).toBe('ok');
	});

	it('zero filter: detects any zero in focus fields', () => {
		expect(hasZeroPriceForFocus({ text_in_1000_tokens: 0, text_out_1000_tokens: 10 }, 'text')).toBe(true);
		expect(hasZeroPriceForFocus({ image_1024: 0 }, 'image')).toBe(true);
		expect(hasZeroPriceForFocus({ tts_1000_chars: 0, stt_minute: 1 }, 'audio')).toBe(true);
		expect(hasZeroPriceForFocus(undefined, 'text')).toBe(false);
	});
});

