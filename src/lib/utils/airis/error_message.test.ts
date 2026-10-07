import { expect, it } from 'vitest';
import { getErrorMessage } from './error_message';

it('extracts provider and FastAPI errors while accepting legacy unknown values', () => {
	for (const [value, expected] of [
		['plain', 'plain'],
		[{ error: 'provider' }, 'provider'],
		[{ error: { message: 'provider' } }, 'provider'],
		[{ detail: 'api' }, 'api'],
		[{ message: 'local' }, 'local'],
		[null, 'null'],
		[undefined, 'undefined'],
		[{ status: 500 }, '{"status":500}']
	] as const) {
		expect(getErrorMessage(value)).toBe(expected);
	}
});
