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
		scope?: string;
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
		function exchangeCode(code: string, deviceId: string): Promise<AuthData>;
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
