import { WEBUI_API_BASE_URL } from '$lib/constants';

export interface ProductEmailPreference {
	subscribed: boolean;
	email_verified: boolean;
	can_receive: boolean;
	reason: string;
	consent_version: string;
}

export async function getProductEmailPreference(token: string): Promise<ProductEmailPreference> {
	const response = await fetch(`${WEBUI_API_BASE_URL}/email-preferences`, {
		credentials: 'include',
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!response.ok) throw new Error('Не удалось загрузить настройку писем. Попробуйте ещё раз.');
	return response.json();
}

export async function saveProductEmailPreference(
	token: string,
	subscribed: boolean
): Promise<ProductEmailPreference> {
	const response = await fetch(`${WEBUI_API_BASE_URL}/email-preferences`, {
		method: 'POST',
		credentials: 'include',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ subscribed })
	});
	if (!response.ok) throw new Error('Не удалось сохранить выбор. Попробуйте ещё раз.');
	return response.json();
}

export async function unsubscribeProductEmail(token: string): Promise<void> {
	const response = await fetch(`${WEBUI_API_BASE_URL}/email-preferences/unsubscribe`, {
		method: 'POST',
		credentials: 'omit',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	if (!response.ok) throw new Error('Не удалось обработать отписку. Попробуйте ещё раз.');
}
