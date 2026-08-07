// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./ModelItem.svelte', import.meta.url)), 'utf8');

describe('ModelItem free-quota badge contract', () => {
	it('keeps the badge gated by lead_magnet metadata and accessible', () => {
		expect(source).toContain('{#if item.model?.info?.meta?.lead_magnet}');
		expect(source).toContain('data-testid="model-free-badge"');
		expect(source).toContain("$i18n.t('Free usage')");
		expect(source).toContain("$i18n.t('Free limit applies to select models')");
	});
});
