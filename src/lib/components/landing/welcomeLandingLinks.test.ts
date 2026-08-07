// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
	fileURLToPath(new URL('./WelcomeProductLanding.svelte', import.meta.url)),
	'utf8'
);

describe('welcome landing links', () => {
	it('keeps marketing navigation on the current landing', () => {
		expect(source).not.toMatch(/href="\/(?:about|contact|features|pricing)/);
		expect(source).toContain("{ href: '#pricing', label: 'Тарифы' }");
		expect(source).toContain("{ href: 'mailto:support@airis.you', label: 'Поддержка' }");
		expect(source).toContain('href="#faq-cost"');
	});
});
