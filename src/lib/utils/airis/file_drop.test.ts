import { expect, it } from 'vitest';
import { parseKnowledgeDropId, parseTerminalDropPaths } from './file_drop';

it('accepts the existing move formats and rejects malformed payloads without partial moves', () => {
	for (const raw of [
		'{',
		'null',
		'7',
		'[]',
		'{}',
		'{"paths":"/a"}',
		'{"paths":["/a",7]}',
		'{"path":7}',
		'{"paths":[""]}'
	]) {
		expect(parseTerminalDropPaths(raw)).toEqual([]);
	}
	expect(parseTerminalDropPaths('{"path":"/a"}')).toEqual(['/a']);
	expect(parseTerminalDropPaths('{"paths":["/a","/b"]}')).toEqual(['/a', '/b']);
	for (const field of ['fileId', 'dirId'] as const) {
		for (const value of [null, 7, {}, [], '']) {
			expect(parseKnowledgeDropId(JSON.stringify({ [field]: value }), field)).toBeNull();
		}
		expect(parseKnowledgeDropId('{', field)).toBeNull();
		expect(parseKnowledgeDropId(JSON.stringify({ [field]: 'id-1' }), field)).toBe('id-1');
	}
});
