import { WEBUI_BASE_URL } from '$lib/constants';
import { validDispatchReceipt, type DispatchState } from '$lib/utils/airis/chat_dispatch';

export const getChatDispatch = async (
	token: string,
	operationId: string
): Promise<DispatchState> => {
	const response = await fetch(
		`${WEBUI_BASE_URL}/api/v1/chat/dispatches/${encodeURIComponent(operationId)}`,
		{
			credentials: 'include',
			cache: 'no-store',
			signal: AbortSignal.timeout(10000),
			headers: { Authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw new Error('The request status could not be checked');
	const value: unknown = await response.json();
	if (
		typeof value !== 'object' ||
		value === null ||
		!('state' in value) ||
		!('receipt' in value) ||
		!['absent', 'unknown', 'accepted'].includes(String(value.state)) ||
		(value.state === 'accepted' ? !validDispatchReceipt(value.receipt) : value.receipt !== null)
	)
		throw new Error('The server returned an invalid request status');
	return value as DispatchState;
};
