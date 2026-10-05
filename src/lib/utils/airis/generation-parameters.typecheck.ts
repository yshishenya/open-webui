import type { ModelParams } from '../../apis';

export const empty: ModelParams = {};
export const edited: ModelParams = {
	system: 'Answer briefly',
	stop: 'END,DONE',
	stream_response: false,
	compact_token_threshold: null,
	temperature: 0,
	provider_option: { enabled: true }
};
export const restored: ModelParams = { stop: ['END'], system: null, stream_response: null };

// @ts-expect-error System instructions are text or null.
export const invalidSystem: ModelParams = { system: false };
// @ts-expect-error Stop sequences are text, an array of text, or null.
export const invalidStop: ModelParams = { stop: [123] };
// @ts-expect-error Streaming is a nullable boolean, not a string.
export const invalidStream: ModelParams = { stream_response: 'false' };
// @ts-expect-error Context threshold is a nullable number, not a string.
export const invalidThreshold: ModelParams = { compact_token_threshold: '100' };
