import type { getModels, ModelConfig } from '$lib/apis';
import type { getOpenAIModelsDirect } from '$lib/apis/openai';
import type { Model, DirectProviderModel, DirectProviderModelsResponse } from './model-types';

type Expect<T extends true> = T;
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

export type CatalogItemsAreConcrete = Expect<
	Equal<IsAny<Awaited<ReturnType<typeof getModels>>[number]>, false>
>;
export type CatalogReturnMatchesStore = Expect<
	Equal<Awaited<ReturnType<typeof getModels>>, Model[]>
>;
export type DirectProviderReturnIsConcrete = Expect<
	Equal<IsAny<Awaited<ReturnType<typeof getOpenAIModelsDirect>>>, false>
>;
export type DirectProviderReturnPreservesVariants = Expect<
	Equal<Awaited<ReturnType<typeof getOpenAIModelsDirect>>, DirectProviderModelsResponse>
>;
export type MetadataOnlyArenaFitsCatalog = Expect<
	{
		id: 'arena';
		name: 'Arena';
		owned_by: 'arena';
		arena: true;
		info: { meta: Record<string, never> };
	} extends Model
		? true
		: false
>;
export type PresetWithoutParamsFitsCatalog = Expect<
	{
		id: 'preset';
		name: 'Preset';
		owned_by: 'ollama';
		preset: true;
		info: { id: 'preset'; name: 'Preset'; base_model_id: null; meta: { description: null } };
	} extends Model
		? true
		: false
>;
export type NestedOllamaFitsCatalog = Expect<
	{
		id: 'local';
		name: 'Local';
		owned_by: 'ollama';
		ollama: { model: 'local'; name: 'Local'; modified_at: string; size: number; digest: string };
	} extends Model
		? true
		: false
>;
export type NamelessOwnerlessProviderFitsInput = Expect<
	{ id: 'provider' } extends DirectProviderModel ? true : false
>;
export type NamelessProviderCannotBeCatalogOutput = Expect<
	Equal<{ id: 'provider' } extends Model ? true : false, false>
>;
export type MetadataOnlyCannotBeEditorConfig = Expect<
	Equal<{ meta: Record<string, never> } extends ModelConfig ? true : false, false>
>;
export type NumericTagNamesAreRejected = Expect<
	Equal<{ id: 'bad'; name: 'Bad'; tags: { name: number }[] } extends Model ? true : false, false>
>;
