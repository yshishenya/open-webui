import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	timeout: 120_000,
	expect: {
		timeout: 10_000
	},
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	reporter: [['list']]
});
