// Isolated browser UI checks against a local Vite server; no global setup or production writes.
import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: '.',
	testMatch: 'analytics_funnel.pw.ts',
	timeout: 45000,
	workers: 1,
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4179',
		channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
		trace: 'retain-on-failure'
	},
	reporter: [['list']]
});
