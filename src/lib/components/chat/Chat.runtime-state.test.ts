// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./Chat.svelte', import.meta.url)), 'utf8');
const script = source.slice(source.indexOf('>') + 1, source.indexOf('</script>'));
const runtime = ts.transpileModule(script, {}).outputText;

describe('Chat runtime state', () => {
	it('keeps OAuth and message queue state on their current implementations', () => {
		expect(runtime).toContain('var pendingOAuthTools = [];');
		expect(source).toContain('chatRequestQueues.update((queues) => ({');
		expect(source).not.toContain('messageQueue.length');
		expect(source).not.toContain('...messageQueue');
		expect(source).not.toContain('messageQueue = []');
	});
});
