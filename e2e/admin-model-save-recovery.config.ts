import { defineConfig } from '@playwright/test';
import fixture from './onboarding-paths.config';

export default defineConfig({
	...fixture,
	testMatch: 'admin-model-save-recovery.spec.ts',
	reporter: [['list'], ['junit', { outputFile: 'artifacts/admin-model-save/results.xml' }]]
});
