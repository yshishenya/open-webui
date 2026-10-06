import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	testMatch: ['onboarding-paths.spec.ts', 'billing-full-path-recovery.spec.ts'],
	globalSetup: './onboarding-paths.setup.ts',
	workers: 1,
	retries: 0,
	timeout: 90000,
	expect: { timeout: 20000 },
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://onboarding-paths:8080',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{
			name: 'firefox-narrow',
			use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 } }
		}
	],
	reporter: [['list'], ['junit', { outputFile: 'artifacts/onboarding-paths/results.xml' }]]
});
