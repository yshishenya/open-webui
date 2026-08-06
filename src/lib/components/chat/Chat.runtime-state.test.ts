// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./Chat.svelte', import.meta.url)), 'utf8');

describe('Chat runtime state', () => {
	it('keeps OAuth and message queue state on their current implementations', () => {
		expect(source).toContain('let pendingOAuthTools = [];');
		expect(source).toContain('chatRequestQueues.update((queues) => ({');
		expect(source).not.toContain('messageQueue.length');
		expect(source).not.toContain('...messageQueue');
		expect(source).not.toContain('messageQueue = []');
	});
});
