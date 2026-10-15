function parseDropObject(raw: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(raw);
		return value !== null && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

/** Reject the whole selection before any move when one path is malformed. */
export function parseTerminalDropPaths(raw: string): string[] {
	const data = parseDropObject(raw);
	if (!data) return [];
	const paths = data.paths ?? (data.path ? [data.path] : []);
	return Array.isArray(paths) && paths.every(isNonEmptyString) ? paths : [];
}

export function parseKnowledgeDropId(raw: string, field: 'fileId' | 'dirId'): string | null {
	const id = parseDropObject(raw)?.[field];
	return isNonEmptyString(id) ? id : null;
}
