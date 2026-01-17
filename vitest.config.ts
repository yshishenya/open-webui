import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'src/**/*.{test,spec}.{js,ts,tsx}',
			'src/**/*.{test,spec}.svelte',
			'tests/**/*.{test,spec}.{js,ts,tsx}'
		],
		exclude: ['e2e/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']
	}
});
