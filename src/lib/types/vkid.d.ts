// VK ID SDK TypeScript declarations

declare global {
	interface Window {
		VKIDSDK: typeof VKIDSDK;
	}
}

declare namespace VKIDSDK {
	interface ConfigOptions {
		app: number;
		redirectUrl: string;
		responseMode: ConfigResponseMode;
		source: ConfigSource;
		mode?: ConfigAuthMode;
		scope?: string;
	}

	enum ConfigAuthMode {
		Redirect = 'redirect',
		InNewTab = 'new_tab',
		InNewWindow = 'new_window'
	}

	enum ConfigResponseMode {
		Callback = 'callback',
		Redirect = 'redirect'
	}

	enum ConfigSource {
		LOWCODE = 'lowcode'
	}

	namespace Config {
		function init(options: ConfigOptions): void;
	}

	namespace Auth {
		function login(params?: AuthLoginParams): Promise<AuthResponse>;
		function exchangeCode(code: string, deviceId: string): Promise<AuthData>;
	}

	enum OAuthName {
		OK = 'ok_ru',
		MAIL = 'mail_ru',
		VK = 'vkid'
	}

	interface AuthLoginParams {
		scheme?: 'light' | 'dark';
		lang?: string;
		provider?: OAuthName;
	}

	interface AuthResponse {
		code: string;
		type: string;
		state: string;
		device_id: string;
		expires_in: number;
	}

	interface AuthData {
		access_token: string;
		expires_in: number;
		user_id: number;
		email?: string;
	}

	interface OneTapRenderOptions {
		container: HTMLElement;
		scheme?: 'light' | 'dark';
		showAlternativeLogin?: boolean;
		styles?: {
			borderRadius?: number;
		};
		oauthList?: string[];
	}

	interface OAuthListRenderOptions {
		container: HTMLElement;
		oauthList: string[];
	}

	interface WidgetInstance {
		on(event: string, handler: (payload: any) => void): WidgetInstance;
		close(): void;
	}

	class OneTap {
		render(options: OneTapRenderOptions): WidgetInstance;
	}

	class OAuthList {
		render(options: OAuthListRenderOptions): WidgetInstance;
	}

	namespace WidgetEvents {
		const ERROR: string;
	}

	namespace OneTapInternalEvents {
		const LOGIN_SUCCESS: string;
	}

	namespace OAuthListInternalEvents {
		const LOGIN_SUCCESS: string;
	}
}

export {};
