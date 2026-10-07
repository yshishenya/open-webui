export const getErrorMessage = (value: unknown): string => {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'object' && value !== null) {
		const error = 'error' in value ? value.error : null;

		if (typeof error === 'string') return error;

		if (
			typeof error === 'object' &&
			error !== null &&
			'message' in error &&
			typeof error.message === 'string'
		) {
			return error.message;
		}

		if ('detail' in value && typeof value.detail === 'string') {
			return value.detail;
		}

		if ('message' in value && typeof value.message === 'string') {
			return value.message;
		}

		return JSON.stringify(value) ?? String(value);
	}

	return JSON.stringify(value) ?? String(value);
};
