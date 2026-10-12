// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	const APP_VERSION: string;
	const APP_BUILD_HASH: string;

	// Browser SDKs are installed by the existing script loaders.
	let gapi: import('$lib/utils/google-drive-picker').GoogleDriveLoader | undefined;
	const google: import('$lib/utils/google-drive-picker').GoogleDriveSdk;

	// Some parts of the app treat dict as a generic map type.
	type dict = Record<string, unknown>;

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
