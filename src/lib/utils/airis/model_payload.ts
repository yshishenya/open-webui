type ModelRecord = Record<string, unknown>;

const isModelRecord = (value: unknown): value is ModelRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Build the shared mutation payload for model create/update requests.
 *
 * A missing access_grants field means "leave existing grants unchanged" on
 * update. An explicit empty array still means "clear all grants". Filtering
 * null/non-object entries keeps malformed UI state from reaching Pydantic.
 */
export const buildModelMutationPayload = (model: object, id?: string): ModelRecord => {
	const source = model as ModelRecord;
	const payload: ModelRecord = {
		id: id ?? source.id,
		base_model_id: source.base_model_id,
		name: source.name,
		meta: source.meta,
		params: source.params,
		is_active: source.is_active
	};

	if (Array.isArray(source.access_grants)) {
		payload.access_grants = source.access_grants.filter(isModelRecord);
	}

	return payload;
};
