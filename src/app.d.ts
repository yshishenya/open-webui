// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	const APP_VERSION: string;
	const APP_BUILD_HASH: string;

	// NOTE: some browser SDKs are loaded via <script> tags. We type them as any
	// to keep TypeScript checks usable without pulling extra dependencies.
	var gapi: any;
	var google: any;

	// Some parts of the app treat dict as a generic map type.
	type dict = Record<string, unknown>;

	type TippyInstance = any;

	interface Navigator {
		gpu?: unknown;
	}

	interface Window {
		pdfjsLib?: unknown;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
