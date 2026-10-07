import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { onboardingTestFiles } from './onboarding-paths.config';

test('every guarded suite has its own environment and setup in the default configuration', async ({
	baseURL,
	page
}, info) => {
	const projects = info.config.projects;
	const ordinary = projects.find((project) => project.name === 'ordinary')!;
	expect(ordinary.use.baseURL).toBe(baseURL);
	expect(ordinary.dependencies).toEqual(['ordinary-setup']);
	expect(ordinary.testIgnore).toEqual(onboardingTestFiles);
	for (const environment of ['ordinary', 'onboarding']) {
		const setup = projects.find((project) => project.name === `${environment}-setup`)!;
		expect(setup.testMatch).toBe('environment.setup.ts');
		expect(
			(setup.grep as RegExp).test(`${setup.name} environment.setup.ts prepare ${environment}`)
		).toBe(true);
	}
	const guarded = projects.filter(
		(project) => project.name.startsWith('onboarding-') && project.name !== 'onboarding-setup'
	);
	expect(guarded).toHaveLength(2);
	for (const project of guarded) {
		expect(project.dependencies).toEqual(['onboarding-setup']);
		expect(project.use.baseURL).toBe('http://localhost:8082');
		expect(project.testMatch).toEqual(onboardingTestFiles);
	}
	const required: string[] = [];
	for (const file of await readdir(info.project.testDir)) {
		if (!file.endsWith('.spec.ts') || file === 'suite-routing.spec.ts') continue;
		const source = await readFile(`${info.project.testDir}/${file}`, 'utf8');
		if (/onboarding-paths\.fixture|Requires disposable onboarding-paths fixture/.test(source))
			required.push(file);
	}
	expect([...onboardingTestFiles].sort()).toEqual(required.sort());
	await page.goto('/health');
	expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
	expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('function');
});
