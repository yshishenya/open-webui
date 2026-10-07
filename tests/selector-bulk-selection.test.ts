// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('announces bulk selection for the currently matched options', () => {
	const source = readFileSync('src/lib/components/workspace/Models/TTSVoiceInput.svelte', 'utf8');
	const option = source.slice(source.indexOf('role="option"'));
	const attributes = option.slice(0, option.indexOf('on:mousedown'));
	const expression = attributes.match(/aria-selected=\{([^]*?)\}/)?.[1];
	if (!expression) throw new Error('Bulk option must announce its selection state');
	const selected = new Function('matchedVoices', 'selectedIds', `return (${expression});`);
	const matched = [{ id: 'a' }, { id: 'b' }];
	expect(selected(matched, [])).toBe(false);
	expect(selected(matched, ['a'])).toBe(false);
	expect(selected(matched, ['a', 'b'])).toBe(true);
	expect(selected([{ id: 'a' }], ['a', 'other'])).toBe(true);
});
