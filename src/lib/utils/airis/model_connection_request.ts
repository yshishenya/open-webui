import { getErrorMessage } from './error_message';

// Config POSTs must never retry: the server may have saved before the connection failed.
export const requestModelConnection = async <T>(
	url: string,
	options: RequestInit,
	signal?: AbortSignal,
	read: (response: Response) => Promise<T> = (response) => response.json()
): Promise<T> => {
	signal?.throwIfAborted();
	const controller = new AbortController();
	const abort = (): void => controller.abort(signal?.reason);
	signal?.addEventListener('abort', abort, { once: true });
	const timeout = setTimeout(
		() => controller.abort(new DOMException('Connection request timed out.', 'TimeoutError')),
		60_000
	);
	try {
		const response = await fetch(url, { ...options, signal: controller.signal });
		if (!response.ok) {
			const detail: unknown = await response.json().catch(() => null);
			controller.signal.throwIfAborted();
			throw Object.assign(
				new Error(
					detail ? getErrorMessage(detail) : `Connection request failed (${response.status}).`
				),
				{ status: response.status }
			);
		}
		const data = await read(response);
		controller.signal.throwIfAborted();
		if (data === null) throw new Error('Connection request returned no result.');
		return data;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener('abort', abort);
	}
};

export const parseConnectionHeaders = (value: string): Record<string, string> | undefined => {
	if (!value.trim()) return undefined;
	const parsed: unknown = JSON.parse(value);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Headers must be a valid JSON object');
	}
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (typeof value !== 'string') throw new Error('Headers must contain string values');
		headers[key] = value;
	}
	return headers;
};
