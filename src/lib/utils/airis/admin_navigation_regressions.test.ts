import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readText = async (path: string): Promise<string> => {
	return await readFile(path, 'utf8');
};

describe('Admin navigation regressions', () => {
	it('keeps Airis billing and analytics sections discoverable', async () => {
		const layout = await readText('src/routes/(app)/admin/+layout.svelte');

		expect(layout).toContain('href="/admin/billing"');
		expect(layout).toContain("{$i18n.t('Billing')}");
		expect(layout).toContain('href="/admin/analytics"');
		expect(layout).toContain('$config?.features.enable_admin_analytics ?? true');
	});
});
