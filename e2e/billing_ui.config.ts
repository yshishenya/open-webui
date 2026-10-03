import { defineConfig } from '@playwright/test';
// The normal Billing Confidence suite keeps its global-setup authentication.
process.env.BILLING_UI_DISPOSABLE_AUTH = '1';
export default defineConfig({
	testDir: '.',
	testMatch: [
		'billing_ui.pw.ts',
		'billing_wallet.spec.ts',
		'billing_wallet_recovery.spec.ts',
		'billing_lead_magnet.spec.ts'
	],
	timeout: 45000,
	expect: { timeout: 15000 },
	workers: 1,
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8194',
		channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
		trace: 'retain-on-failure'
	},
	reporter: [['list']]
});
