import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const appMockPath = fileURLToPath(new URL('./tests/mocks/app', import.meta.url));
const libPath = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		APP_VERSION: JSON.stringify('0.12.5-test'),
		APP_BUILD_HASH: JSON.stringify('test'),
		APP_BUILD_CHANNEL: JSON.stringify('test')
	},
	resolve: {
		conditions: ['browser'],
		alias: {
			$app: appMockPath,
			$lib: libPath
		}
	},
	test: {
		include: [
			'src/**/*.{test,spec}.{js,ts,tsx}',
			'src/**/*.{test,spec}.svelte',
			'tests/**/*.{test,spec}.{js,ts,tsx}'
		],
		exclude: ['e2e/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']
	}
});
