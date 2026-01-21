import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const appMockPath = fileURLToPath(new URL('./tests/mocks/app', import.meta.url));
const libPath = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
	resolve: {
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
