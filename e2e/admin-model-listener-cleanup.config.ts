import { defineConfig } from '@playwright/test';
import fixture from './onboarding-paths.config';

export default defineConfig({
	...fixture,
	testMatch: 'admin-model-listener-cleanup.spec.ts',
	reporter: [['list'], ['junit', { outputFile: 'artifacts/admin-model-listeners/results.xml' }]]
});
