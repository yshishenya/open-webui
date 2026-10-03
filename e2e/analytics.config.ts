// Isolated browser UI checks against a local production build; no global setup or production writes.
import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: '.',
	testMatch: ['analytics_funnel.pw.ts', 'analytics_billing_ui.pw.ts'],
	timeout: 45000,
	expect: { timeout: 15000 },
	workers: 1,
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4179',
		channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
		trace: 'retain-on-failure'
	},
	reporter: [['list']]
});
