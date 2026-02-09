const VKID_SDK_URL = 'https://unpkg.com/@vkid/sdk@2.6.0/dist-sdk/umd/index.js';

export type VkIdProvider = 'vk' | 'ok' | 'mail';

let vkidLoadPromise: Promise<void> | null = null;
let vkidConfigKey: string | null = null;

const getOAuthName = (sdk: typeof window.VKIDSDK, provider: VkIdProvider): VKIDSDK.OAuthName => {
	switch (provider) {
		case 'vk':
			return sdk.OAuthName.VK;
		case 'ok':
			return sdk.OAuthName.OK;
		case 'mail':
			return sdk.OAuthName.MAIL;
	}
};

const isAuthResponse = (value: unknown): value is VKIDSDK.AuthResponse => {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return typeof v.code === 'string' && typeof v.device_id === 'string';
};

const loadVkIdSdk = async (): Promise<void> => {
	if (typeof window === 'undefined') return;
	if (window.VKIDSDK) return;
	if (vkidLoadPromise) return vkidLoadPromise;

	vkidLoadPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = VKID_SDK_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Failed to load VK ID SDK'));
		document.head.appendChild(script);
	});

	return vkidLoadPromise;
};

const initVkIdConfig = (sdk: typeof window.VKIDSDK, appId: string, redirectUrl: string): void => {
	const parsedAppId = Number.parseInt(appId, 10);
	if (!Number.isFinite(parsedAppId)) {
		throw new Error('VK ID is not configured');
	}

	const resolvedRedirectUrl = redirectUrl || window.location.origin;
	const nextKey = `${parsedAppId}|${resolvedRedirectUrl}`;
	if (vkidConfigKey === nextKey) return;

	sdk.Config.init({
		app: parsedAppId,
		redirectUrl: resolvedRedirectUrl,
		mode: sdk.ConfigAuthMode.InNewWindow,
		responseMode: sdk.ConfigResponseMode.Callback,
		source: sdk.ConfigSource.LOWCODE,
		scope: 'email'
	});

	vkidConfigKey = nextKey;
};

export const vkIdLogin = async (
	provider: VkIdProvider,
	appId: string,
	redirectUrl: string
): Promise<{ authResponse: VKIDSDK.AuthResponse; authData: VKIDSDK.AuthData | null }> => {
	await loadVkIdSdk();

	if (!window.VKIDSDK) {
		throw new Error('VK ID SDK is not available');
	}

	const sdk = window.VKIDSDK;
	initVkIdConfig(sdk, appId, redirectUrl);

	const authResponseRaw = await sdk.Auth.login({
		provider: getOAuthName(sdk, provider),
		scheme: 'dark'
	});

	if (!isAuthResponse(authResponseRaw)) {
		throw new Error('VK ID authentication failed');
	}

	let authData: VKIDSDK.AuthData | null = null;
	try {
		authData = await sdk.Auth.exchangeCode(authResponseRaw.code, authResponseRaw.device_id);
	} catch {
		authData = null;
	}

	return { authResponse: authResponseRaw, authData };
};

