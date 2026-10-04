export type InputVariable = Record<string, unknown> & {
	type?: string;
	label?: string;
	placeholder?: string;
	required: boolean;
	options: unknown[];
};

// Definitions also come from model schemas, not just the template parser.
export const normalizeInputVariables = (
	variables: Record<string, Record<string, unknown> | null>
): Record<string, InputVariable> =>
	Object.fromEntries(
		Object.entries(variables ?? {}).map(([key, raw]) => [
			key,
			{
				...raw,
				type: typeof raw?.type === 'string' ? raw.type : undefined,
				label: typeof raw?.label === 'string' ? raw.label : undefined,
				placeholder: typeof raw?.placeholder === 'string' ? raw.placeholder : undefined,
				required: Boolean(raw?.required),
				options: Array.isArray(raw?.options) ? raw.options : []
			}
		])
	);

export const getInputValue = (value: unknown): string | number | undefined =>
	typeof value === 'string' || typeof value === 'number' || value === undefined
		? value
		: typeof value === 'boolean'
			? String(value)
			: '';

export const isInputChecked = (value: unknown): boolean => value === true || value === 'true';

export const getMapLocation = (value: unknown): [number, number] | null => {
	if (typeof value !== 'string') return null;
	const parts = value.split(',').map((part) => part.trim());
	if (parts.length !== 2 || parts.some((part) => part === '')) return null;
	const [lat, lng] = parts.map(Number);
	return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
		? [lat, lng]
		: null;
};
