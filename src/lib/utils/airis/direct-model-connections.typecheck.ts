import type { getModels } from '$lib/apis';
import type { settings } from '$lib/stores';
import type { Writable } from 'svelte/store';

type Connections = Parameters<typeof getModels>[1];
type Settings = typeof settings extends Writable<infer Value> ? Value : never;
type Accepts<Value extends Connections> = Value;
type Stored<Value extends Settings['directConnections']> = Value;

export type EmptyConnections = Accepts<{
	OPENAI_API_BASE_URLS: [];
	OPENAI_API_KEYS: [];
	OPENAI_API_CONFIGS: Record<string, never>;
}>;
export type ProviderConnections = Accepts<{
	OPENAI_API_BASE_URLS: ['https://example.invalid/v1'];
	OPENAI_API_KEYS: [''];
	OPENAI_API_CONFIGS: {
		'0': {
			enable: true;
			model_ids: ['model'];
			prefix_id: 'custom';
			tags: [{ name: 'tag' }];
			headers: { 'X-Example': 'value' };
			auth_type: 'bearer';
		};
	};
}>;
export type StoredConnections = Stored<ProviderConnections>;
export type ClearedConnections = Stored<null | undefined>;
export type DisabledConnections = Accepts<false | null | undefined>;
export type FeatureFlagConnections = Accepts<
	false | null | undefined | NonNullable<Settings['directConnections']>
>;
export type NullableConfig = Accepts<{
	OPENAI_API_BASE_URLS: ['https://example.invalid/v1'];
	OPENAI_API_KEYS: [''];
	OPENAI_API_CONFIGS: {
		'0': null;
		'1': { enable: null; model_ids: null; prefix_id: null; tags: null };
	};
}>;

// @ts-expect-error URLs must be an array of strings.
export type InvalidUrls = Accepts<{
	OPENAI_API_BASE_URLS: [1];
	OPENAI_API_KEYS: [];
	OPENAI_API_CONFIGS: Record<string, never>;
}>;
// @ts-expect-error Keys must be an array of strings.
export type InvalidKeys = Accepts<{
	OPENAI_API_BASE_URLS: [];
	OPENAI_API_KEYS: [1];
	OPENAI_API_CONFIGS: Record<string, never>;
}>;
// @ts-expect-error The enabled flag is boolean or null.
export type InvalidFlag = Accepts<{
	OPENAI_API_BASE_URLS: [];
	OPENAI_API_KEYS: [];
	OPENAI_API_CONFIGS: { '0': { enable: 'yes' } };
}>;
// @ts-expect-error Model identifiers must be strings.
export type InvalidModels = Accepts<{
	OPENAI_API_BASE_URLS: [];
	OPENAI_API_KEYS: [];
	OPENAI_API_CONFIGS: { '0': { model_ids: [1] } };
}>;
// @ts-expect-error A true flag is not a connection configuration.
export type InvalidEnabledState = Accepts<true>;
