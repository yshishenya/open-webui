import { test, expect } from '@playwright/test';
import prepareOrdinary from './global-setup';
import prepareOnboarding from './onboarding-paths.setup';

test('prepare ordinary', async () => {
	await prepareOrdinary();
});

test('prepare onboarding', async ({ request }, info) => {
	expect((await request.get('/health')).ok()).toBe(true);
	await prepareOnboarding({ ...info.config, projects: [info.project] });
});
