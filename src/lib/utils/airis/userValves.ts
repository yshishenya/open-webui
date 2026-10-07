export type ValveValues = Record<string, unknown>;
export type ValveSpec = {
	properties?: Record<string, { type?: string; input?: { type?: string } | null }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

/** Successful null is distinct from a failed request, including a network error. */
export async function requestUserValves(
	url: string,
	token: string,
	values?: object
): Promise<ValveValues | null> {
	const response = await fetch(url, {
		method: values === undefined ? 'GET' : 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		signal: AbortSignal.timeout(25000),
		...(values === undefined ? {} : { body: JSON.stringify(values) })
	});
	if (!response.ok) throw new Error(`Settings request failed (${response.status})`);
	const result: unknown = await response.json();
	if (result !== null && !isRecord(result)) throw new Error('Invalid settings response');
	return result;
}

export function readValveSpec(value: ValveValues | null): ValveSpec | null {
	if (value === null) return null;
	if (value.properties !== undefined) {
		if (!isRecord(value.properties)) throw new Error('Invalid settings schema');
		for (const property of Object.values(value.properties)) {
			if (!isRecord(property)) throw new Error('Invalid settings property');
			if (property.type !== undefined && typeof property.type !== 'string') {
				throw new Error('Invalid settings type');
			}
			if (
				property.input != null &&
				(!isRecord(property.input) ||
					(property.input.type !== undefined && typeof property.input.type !== 'string'))
			) {
				throw new Error('Invalid settings input');
			}
		}
	}
	return value as ValveSpec;
}

/** Keep defaults (null/absent), empty arrays and multiselects distinct. */
export function convertValveArrays(
	values: ValveValues | null,
	spec: ValveSpec | null,
	toEditor: boolean
): ValveValues {
	const result = { ...values };
	for (const [key, property] of Object.entries(spec?.properties ?? {})) {
		if (property.type !== 'array' || property.input?.type === 'multiselect') continue;
		const value = result[key];
		if (value == null) continue;
		if (toEditor && Array.isArray(value)) result[key] = value.join(',');
		else if (!toEditor && typeof value === 'string') {
			result[key] = value
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		} else if (!(toEditor && typeof value === 'string') && !(!toEditor && Array.isArray(value))) {
			throw new Error('Invalid settings array');
		}
	}
	return result;
}
