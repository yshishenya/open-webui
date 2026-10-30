import { WEBUI_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';

export type AdminConfig = {
	ENABLE_LOGIN_FORM: boolean;
	ENABLE_MFA: boolean;
	ENABLE_ENCRYPTED_CHANNELS: boolean;
	ENABLE_APPS: boolean;
	ENABLE_SKILL_LAZY_LOADING: boolean;
	SKILL_CONTENT_MAX_CHARS?: number | null;
	SKILL_PREVIEW_MAX_CHARS?: number | null;
	MFA_ALLOW_OAUTH_BYPASS: boolean;
	MFA_ALLOW_TRUSTED_HEADER_BYPASS: boolean;
	sessions_revoked?: boolean;
	I18N?: Record<string, Record<string, string>>;
	DEFAULT_INTERFACE_SETTINGS?: Record<string, unknown>;
	SHOW_ADMIN_DETAILS: boolean;
	ADMIN_EMAIL: string | null;
	WEBUI_URL: string;
	ENABLE_SIGNUP: boolean;
	ENABLE_API_KEYS: boolean;
	ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS: boolean;
	API_KEYS_ALLOWED_ENDPOINTS: string;
	DEFAULT_USER_ROLE: string;
	DEFAULT_GROUP_ID: string;
	JWT_EXPIRES_IN: string;
	ENABLE_COMMUNITY_SHARING: boolean;
	ENABLE_MESSAGE_RATING: boolean;
	ENABLE_FOLDERS: boolean;
	FOLDER_MAX_FILE_COUNT: number | string | null;
	AUTOMATION_MAX_COUNT: number | string | null;
	AUTOMATION_MIN_INTERVAL: number | string | null;
	ENABLE_AUTOMATIONS: boolean;
	ENABLE_CHANNELS: boolean;
	CHANNEL_MODEL_RESPONSE_MODE: string;
	ENABLE_CALENDAR: boolean;
	ENABLE_MEMORIES: boolean;
	ENABLE_MEMORY_SYSTEM_CONTEXT: boolean;
	ENABLE_NOTES: boolean;
	ENABLE_USER_WEBHOOKS: boolean;
	ENABLE_USER_STATUS: boolean;
	PENDING_USER_OVERLAY_TITLE: string | null;
	PENDING_USER_OVERLAY_CONTENT: string | null;
	RESPONSE_WATERMARK: string | null;
};

export type OAuthConfig = {
	ENABLE_OAUTH_PERSISTENT_CONFIG?: boolean;
	ENABLE_OAUTH: boolean | null;
	ENABLE_OAUTH_SIGNUP: boolean | null;
	OAUTH_MERGE_ACCOUNTS_BY_EMAIL: boolean | null;
	OAUTH_AUTO_REDIRECT: boolean | null;
	OAUTH_ALLOWED_DOMAINS: string | null;
	OAUTH_BLOCKED_GROUPS: string | null;
	ENABLE_OAUTH_ROLE_MANAGEMENT: boolean | null;
	OAUTH_ROLES_CLAIM: string | null;
	OAUTH_ADMIN_ROLES: string | null;
	OAUTH_ALLOWED_ROLES: string | null;
	ENABLE_OAUTH_GROUP_MANAGEMENT: boolean | null;
	ENABLE_OAUTH_GROUP_CREATION: boolean | null;
	OAUTH_GROUP_CLAIM: string | null;
	OAUTH_GROUP_DEFAULT_SHARE: boolean | string | null;
	OAUTH_PROVIDER_NAME: string | null;
	OPENID_PROVIDER_URL: string | null;
	OAUTH_CLIENT_ID: string | null;
	OAUTH_CLIENT_SECRET: string | null;
	OPENID_REDIRECT_URI: string | null;
	OAUTH_SCOPES: string | null;
	OAUTH_CODE_CHALLENGE_METHOD: string | null;
	OAUTH_TOKEN_ENDPOINT_AUTH_METHOD: string | null;
	OPENID_END_SESSION_ENDPOINT: string | null;
	OAUTH_TIMEOUT: number | string | null;
	OAUTH_CLIENT_TIMEOUT: number | string | null;
	OAUTH_EMAIL_CLAIM: string | null;
	OAUTH_USERNAME_CLAIM: string | null;
	OAUTH_PICTURE_CLAIM: string | null;
	OAUTH_SUB_CLAIM: string | null;
	OAUTH_AUDIENCE: string | null;
	OAUTH_UPDATE_EMAIL_ON_LOGIN: boolean | null;
	OAUTH_UPDATE_NAME_ON_LOGIN: boolean | null;
	OAUTH_UPDATE_PICTURE_ON_LOGIN: boolean | null;
	OAUTH_REFRESH_TOKEN_INCLUDE_SCOPE: boolean | null;
};

export type AdminDetails = { name: string | null; email: string | null };

export const getAdminDetails = async (token: string): Promise<AdminDetails | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/details`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getAdminConfig = async (token: string): Promise<AdminConfig | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateAdminConfig = async (
	token: string,
	body: AdminConfig
): Promise<AdminConfig | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(body)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getSessionUser = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		credentials: 'include'
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const ldapUserSignIn = async (user: string, password: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/ldap`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({
			user: user,
			password: password
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);

			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getLdapConfig = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config/ldap`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateLdapConfig = async (token: string = '', enable_ldap: boolean) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config/ldap`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({
			enable_ldap: enable_ldap
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getLdapServer = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config/ldap/server`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateLdapServer = async (token: string = '', body: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config/ldap/server`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify(body)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getOAuthConfig = async (token: string): Promise<OAuthConfig | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config/oauth`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateOAuthConfig = async (
	token: string,
	body: Partial<OAuthConfig>
): Promise<OAuthConfig | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/admin/config/oauth`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(body)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const userSignIn = async (email: string, password: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/signin`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({
			email: email,
			password: password
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);

			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const userSignUp = async (
	name: string,
	email: string,
	password: string,
	profile_image_url: string,
	legalAccepted: boolean,
	productEmailsOptIn: boolean = false
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/signup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({
			name: name,
			email: email,
			password: password,
			profile_image_url: profile_image_url,
			terms_accepted: legalAccepted,
			privacy_accepted: legalAccepted,
			product_emails_opt_in: productEmailsOptIn
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getTelegramAuthState = async () => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/telegram/state`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include'
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const telegramSignIn = async (state: string, payload: Record<string, unknown>) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/telegram/signin`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({ state, payload })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const telegramSignUp = async (
	state: string,
	payload: Record<string, unknown>,
	legalAccepted: boolean
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/telegram/signup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({
			state,
			payload,
			terms_accepted: legalAccepted,
			privacy_accepted: legalAccepted
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const telegramLink = async (state: string, payload: Record<string, unknown>) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/telegram/link`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({ state, payload })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const telegramUnlink = async (state: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/telegram/link`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({ state })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const userSignOut = async () => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/signout`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include'
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	sessionStorage.clear();
	return res;
};

export const getLogoutRedirectUrl = (redirectUrl?: string | null) => {
	const logoutUrl = new URL('/auth?state=logout', window.location.origin);
	const postLogoutUrl = new URL('/auth', window.location.origin);
	if (!redirectUrl) {
		return logoutUrl.href;
	}

	const url = new URL(redirectUrl, window.location.origin);
	if (url.origin === window.location.origin && url.pathname === '/auth') {
		url.searchParams.set('state', 'logout');
		return url.href;
	}

	const postLogoutRedirectUri = url.searchParams.get('post_logout_redirect_uri');
	if (postLogoutRedirectUri) {
		const configuredPostLogoutUrl = new URL(postLogoutRedirectUri, window.location.origin);
		if (
			configuredPostLogoutUrl.origin === window.location.origin &&
			configuredPostLogoutUrl.pathname === '/auth'
		) {
			url.searchParams.set('state', 'logout');
		}
		return url.href;
	}

	url.searchParams.set('post_logout_redirect_uri', postLogoutUrl.href);
	url.searchParams.set('state', 'logout');
	return url.href;
};

export const addUser = async (
	token: string,
	name: string,
	email: string,
	password: string,
	role: string = 'pending',
	profile_image_url: null | string = null
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/add`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({
			name: name,
			email: email,
			password: password,
			role: role,
			...(profile_image_url && { profile_image_url: profile_image_url })
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateUserProfile = async (token: string, profile: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/update/profile`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({
			...profile
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			if (Array.isArray(error)) {
				error = error.map((e: { msg?: string }) => e.msg).join('; ');
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateUserTimezone = async (token: string, timezone: string) => {
	await fetch(`${WEBUI_API_BASE_URL}/auths/update/timezone`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({ timezone })
	}).catch((err) => {
		console.error('Failed to update timezone:', err);
	});
};

export const updateUserPassword = async (token: string, password: string, newPassword: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/update/password`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({
			password: password,
			new_password: newPassword
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const createAPIKey = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/api_key`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});
	if (error) {
		throw error;
	}
	return res.api_key;
};

export const getAPIKey = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/api_key`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});
	if (error) {
		throw error;
	}
	return res.api_key;
};

export const deleteAPIKey = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/auths/api_key`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});
	if (error) {
		throw error;
	}
	return res;
};

export const deleteOAuthSession = async (
	token: string,
	provider: string,
	signal?: AbortSignal
): Promise<boolean> => {
	const result = await requestJSON<boolean>(
		`${WEBUI_API_BASE_URL}/auths/oauth/sessions/${encodeURIComponent(provider)}`,
		token,
		undefined,
		signal,
		'OAuth disconnect request',
		'DELETE'
	);
	if (result !== true) throw new Error('Failed to disconnect');
	return result;
};
