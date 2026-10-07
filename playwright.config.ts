import { defineConfig } from '@playwright/test';
import onboarding, { onboardingTestFiles } from './e2e/onboarding-paths.config';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const onboardingURL = process.env.PLAYWRIGHT_ONBOARDING_BASE_URL ?? 'http://localhost:8082';

export default defineConfig({
	testDir: './e2e',
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
	projects: [
		{
			name: 'ordinary-setup',
			testMatch: 'environment.setup.ts',
			grep: /prepare ordinary$/
		},
		{
			name: 'onboarding-setup',
			testMatch: 'environment.setup.ts',
			grep: /prepare onboarding$/,
			use: { baseURL: onboardingURL }
		},
		{
			name: 'ordinary',
			testMatch: '**/*.spec.ts',
			testIgnore: onboardingTestFiles,
			dependencies: ['ordinary-setup']
		},
		...onboarding.projects!.map((project) => ({
			...project,
			name: `onboarding-${project.name}`,
			testMatch: onboardingTestFiles,
			dependencies: ['onboarding-setup'],
			timeout: onboarding.timeout,
			expect: onboarding.expect,
			retries: 0,
			use: { ...onboarding.use, ...project.use, baseURL: onboardingURL }
		}))
	],
	reporter: [['list']]
});
