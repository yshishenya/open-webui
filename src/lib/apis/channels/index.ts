import { requestJSON } from '$lib/utils/airis/request_json';
import { WEBUI_API_BASE_URL } from '$lib/constants';
import type {
	ChannelListItem,
	ChannelDetail,
	ChannelListMessage,
	ChannelPinnedMessage,
	ChannelMessageData,
	ChannelMessageForm,
	ChannelMessageResponse,
	ChannelWebhook,
	ChannelMemberList,
	ChannelMembership
} from '$lib/utils/airis/channel-types';

type ChannelForm = {
	type?: string;
	name: string;
	is_private?: boolean | null;
	data?: object;
	meta?: object;
	access_grants?: object[];
	group_ids?: string[];
	user_ids?: string[];
};

export const createNewChannel = async (token: string = '', channel: ChannelForm) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/create`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ ...channel })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChannels = async (token: string = ''): Promise<ChannelListItem[] | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChannelById = async (
	token: string = '',
	channel_id: string
): Promise<ChannelDetail | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/${channel_id}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getDMChannelByUserId = async (token: string = '', user_id: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/users/${user_id}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChannelMembersById = async (
	token: string,
	channel_id: string,
	query?: string,
	orderBy?: string,
	direction?: string,
	page = 1
): Promise<ChannelMemberList> => {
	const searchParams = new URLSearchParams({ page: `${page}` });
	if (query) searchParams.set('query', query);
	if (orderBy) searchParams.set('order_by', orderBy);
	if (direction) searchParams.set('direction', direction);
	const result = await requestJSON<ChannelMemberList>(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/members?${searchParams}`,
		token
	);
	if (
		!result ||
		!Array.isArray(result.users) ||
		!Number.isInteger(result.total) ||
		result.total < 0 ||
		result.users.some(
			(user) =>
				!user ||
				typeof user.id !== 'string' ||
				typeof user.name !== 'string' ||
				typeof user.email !== 'string' ||
				typeof user.role !== 'string'
		)
	)
		throw new Error('Invalid channel members response');
	return result;
};

export const updateChannelMemberActiveStatusById = async (
	token: string = '',
	channel_id: string,
	is_active: boolean
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/${channel_id}/members/active`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ is_active })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

type UpdateMembersForm = {
	user_ids?: string[];
	group_ids?: string[];
};

export const addMembersById = async (
	token: string = '',
	channel_id: string,
	formData: UpdateMembersForm
): Promise<ChannelMembership[]> => {
	const result = await requestJSON<ChannelMembership[]>(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/update/members/add`,
		token,
		formData
	);
	if (
		!Array.isArray(result) ||
		result.some(
			(member) =>
				!member ||
				typeof member.id !== 'string' ||
				member.channel_id !== channel_id ||
				typeof member.user_id !== 'string'
		)
	)
		throw new Error('Invalid membership acknowledgement');
	return result;
};

type RemoveMembersForm = {
	user_ids?: string[];
	group_ids?: string[];
};

export const removeMembersById = async (
	token: string = '',
	channel_id: string,
	formData: RemoveMembersForm
): Promise<number> => {
	const result = await requestJSON<number>(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/update/members/remove`,
		token,
		formData
	);
	if (!Number.isInteger(result) || result < 0)
		throw new Error('Invalid membership removal acknowledgement');
	return result;
};

export const updateChannelById = async (
	token: string = '',
	channel_id: string,
	channel: ChannelForm
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/${channel_id}/update`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ ...channel })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteChannelById = async (token: string = '', channel_id: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/${channel_id}/delete`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChannelMessages = async (
	token: string = '',
	channel_id: string,
	skip: number = 0,
	limit: number = 50
): Promise<ChannelListMessage[] | null> => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages?skip=${skip}&limit=${limit}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChannelPinnedMessages = async (
	token: string = '',
	channel_id: string,
	page: number = 1
): Promise<ChannelPinnedMessage[] | null> => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/pinned?page=${page}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChannelThreadMessages = async (
	token: string = '',
	channel_id: string,
	message_id: string,
	skip: number = 0,
	limit: number = 50
): Promise<ChannelListMessage[] | null> => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/thread?skip=${skip}&limit=${limit}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getMessageData = async (
	token: string = '',
	channel_id: string,
	message_id: string
): Promise<ChannelMessageData | null> => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/data`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const sendMessage = async (
	token: string = '',
	channel_id: string,
	message: ChannelMessageForm
): Promise<ChannelMessageResponse | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/post`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ ...message })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const pinMessage = async (
	token: string = '',
	channel_id: string,
	message_id: string,
	is_pinned: boolean
) => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/pin`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ is_pinned })
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateMessage = async (
	token: string = '',
	channel_id: string,
	message_id: string,
	message: ChannelMessageForm
) => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/update`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ ...message })
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const addReaction = async (
	token: string = '',
	channel_id: string,
	message_id: string,
	name: string
) => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/reactions/add`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ name })
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const removeReaction = async (
	token: string = '',
	channel_id: string,
	message_id: string,
	name: string
) => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/reactions/remove`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ name })
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteMessage = async (token: string = '', channel_id: string, message_id: string) => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/messages/${message_id}/delete`,
		{
			method: 'DELETE',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

// Webhook API functions

export type WebhookForm = { name: string; profile_image_url?: string | null };
const readChannelWebhook = (
	value: ChannelWebhook,
	channelId: string,
	webhookId?: string
): ChannelWebhook => {
	if (
		!value ||
		typeof value.id !== 'string' ||
		value.channel_id !== channelId ||
		(webhookId !== undefined && value.id !== webhookId) ||
		typeof value.user_id !== 'string' ||
		typeof value.name !== 'string' ||
		typeof value.token !== 'string' ||
		!Number.isFinite(value.created_at) ||
		!Number.isFinite(value.updated_at)
	)
		throw new Error('Invalid channel webhook response');
	return value;
};
export const getChannelWebhooks = async (
	token: string = '',
	channel_id: string
): Promise<ChannelWebhook[]> => {
	const result = await requestJSON<ChannelWebhook[]>(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/webhooks`,
		token
	);
	if (!Array.isArray(result)) throw new Error('Invalid channel webhook list');
	result.forEach((webhook) => readChannelWebhook(webhook, channel_id));
	return result;
};
export const createChannelWebhook = async (
	token: string = '',
	channel_id: string,
	formData: WebhookForm
): Promise<ChannelWebhook> =>
	readChannelWebhook(
		await requestJSON<ChannelWebhook>(
			`${WEBUI_API_BASE_URL}/channels/${channel_id}/webhooks/create`,
			token,
			formData
		),
		channel_id
	);
export const updateChannelWebhook = async (
	token: string = '',
	channel_id: string,
	webhook_id: string,
	formData: WebhookForm
): Promise<ChannelWebhook> =>
	readChannelWebhook(
		await requestJSON<ChannelWebhook>(
			`${WEBUI_API_BASE_URL}/channels/${channel_id}/webhooks/${webhook_id}/update`,
			token,
			formData
		),
		channel_id,
		webhook_id
	);
export const deleteChannelWebhook = async (
	token: string = '',
	channel_id: string,
	webhook_id: string
): Promise<boolean> => {
	const result = await requestJSON<boolean>(
		`${WEBUI_API_BASE_URL}/channels/${channel_id}/webhooks/${webhook_id}/delete`,
		token,
		undefined,
		undefined,
		'Webhook deletion',
		'DELETE'
	);
	if (typeof result !== 'boolean') throw new Error('Invalid webhook deletion acknowledgement');
	return result;
};
