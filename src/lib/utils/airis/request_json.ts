import { getErrorMessage } from './error_message';

export const requestJSON = async <T>(
	url: string,
	token: string,
	body?: object,
	signal?: AbortSignal,
	label = 'Request',
	method: 'GET' | 'POST' | 'DELETE' = body === undefined ? 'GET' : 'POST'
): Promise<T> => {
	signal?.throwIfAborted();
	const controller = new AbortController();
	const abort = (): void => controller.abort(signal?.reason);
	signal?.addEventListener('abort', abort, { once: true });
	const timeout = setTimeout(
		() => controller.abort(new DOMException(`${label} timed out.`, 'TimeoutError')),
		60_000
	);
	try {
		const res = await fetch(url, {
			method,
			signal: controller.signal,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		});
		if (!res.ok) {
			const detail: unknown = await res.json().catch(() => null);
			controller.signal.throwIfAborted();
			throw new Error(detail ? getErrorMessage(detail) : `${label} failed (${res.status}).`);
		}
		const data: T = await res.json();
		controller.signal.throwIfAborted();
		return data;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener('abort', abort);
	}
};
