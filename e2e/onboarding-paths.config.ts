import { defineConfig, devices } from '@playwright/test';

export const onboardingTestFiles = [
	'admin-model-listener-cleanup.spec.ts',
	'admin-model-save-recovery.spec.ts',
	'admin-model-settings-save.spec.ts',
	'billing-full-path-recovery.spec.ts',
	'browser-history-state.spec.ts',
	'chat-cancel-history.spec.ts',
	'folder-api-failure.spec.ts',
	'markdown-media-source.spec.ts',
	'model-editor-save-recovery.spec.ts',
	'note-record-state.spec.ts',
	'onboarding-paths.spec.ts',
	'rich_text_insertion.spec.ts'
];

export default defineConfig({
	testDir: '.',
	testMatch: onboardingTestFiles,
	globalSetup: './onboarding-paths.setup.ts',
	workers: 1,
	retries: 0,
	timeout: 90000,
	expect: { timeout: 20000 },
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8082',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chromium'
			}
		},
		{
			name: 'firefox-narrow',
			use: {
				...devices['Desktop Firefox'],
				viewport: { width: 390, height: 844 }
			}
		}
	],
	reporter: [['list'], ['junit', { outputFile: 'artifacts/onboarding-paths/results.xml' }]]
});
