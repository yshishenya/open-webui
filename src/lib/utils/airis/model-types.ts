import type { ModelConfig, ModelMeta } from '$lib/apis';

export type ModelTag = { name: string };
export type SuggestionPrompt = { id?: string; content: string; title?: string | string[] | null };

// Catalog builders return metadata alone for defaults/arena and omit preset params.
export type CatalogModelInfo = Omit<Partial<ModelConfig>, 'meta'> & {
	meta?: ModelMeta | null;
};

export type ModelAction = {
	id: string;
	name: string;
	description?: string | null;
	icon?: string | null;
};
export type ModelFilter = ModelAction & { has_user_valves?: boolean };

// Raw /ollama/api/tags records; the common catalog nests these under `ollama`.
export type OllamaModelRecord = {
	model: string;
	name?: string;
	modified_at: string;
	size: number;
	digest: string;
	details?: {
		parent_model?: string;
		format?: string;
		family?: string;
		families?: string[] | null;
		parameter_size?: string;
		quantization_level?: string;
	};
	urls?: number[];
	expires_at?: number;
	connection_type?: string;
	tags?: ModelTag[];
};

export type Model = {
	id: string;
	name: string;
	// Direct providers may omit owned_by or supply their own owner name.
	owned_by?: string;
	info?: CatalogModelInfo | null;
	object?: string;
	created?: number;
	external?: boolean;
	source?: string;
	provider?: string;
	connection_type?: string | null;
	tags?: ModelTag[];
	direct?: boolean;
	preset?: boolean;
	arena?: boolean;
	loaded?: boolean;
	has_user_valves?: boolean;
	pipe?: { type: string };
	actions?: ModelAction[];
	filters?: ModelFilter[];
	openai?: { id: string; [key: string]: unknown };
	ollama?: OllamaModelRecord;
	urlIdx?: number | string;
};

export type OpenAIModel = Model & { owned_by: 'openai' };
export type OllamaModel = Model & { owned_by: 'ollama' };
export type DirectProviderModel = Omit<Model, 'name'> & { name?: string | null };
export type DirectProviderModelsResponse =
	| DirectProviderModel[]
	| { data?: DirectProviderModel[] | null; object?: string; urlIdx?: string | number }
	| null;

export type ModelDownload = {
	urlIdx: string;
	abortController: AbortController;
	reader: ReadableStreamDefaultReader<string>;
	done: boolean;
	cancelled: boolean;
	pullProgress?: number;
	digest?: string;
};
