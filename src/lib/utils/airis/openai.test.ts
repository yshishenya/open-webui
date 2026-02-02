import { describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({ v4: () => 'uuid_test' }));

import { enhanceOpenAIChatCompletionBody } from './openai';

describe('airis/openai', () => {
	it('returns non-record values unchanged', () => {
		expect(enhanceOpenAIChatCompletionBody(null)).toBeNull();
		expect(enhanceOpenAIChatCompletionBody('test')).toBe('test');
		expect(enhanceOpenAIChatCompletionBody([1, 2, 3])).toEqual([1, 2, 3]);
	});

	it('adds request_id when missing', () => {
		const input = { model: 'gpt', stream: true };
		const output = enhanceOpenAIChatCompletionBody(input) as Record<string, unknown>;

		expect(output).toMatchObject({
			model: 'gpt',
			stream: true,
			metadata: { request_id: 'uuid_test' }
		});
	});

	it('preserves existing request_id', () => {
		const input = { metadata: { request_id: 'req_1', foo: 'bar' } };
		const output = enhanceOpenAIChatCompletionBody(input) as Record<string, unknown>;

		expect(output).toMatchObject({
			metadata: { request_id: 'req_1', foo: 'bar' }
		});
	});

	it('fills chat_id and message_id when available', () => {
		const input = { chat_id: 'chat_1', id: 'msg_1' };
		const output = enhanceOpenAIChatCompletionBody(input) as Record<string, unknown>;

		expect(output).toMatchObject({
			chat_id: 'chat_1',
			id: 'msg_1',
			metadata: {
				request_id: 'uuid_test',
				chat_id: 'chat_1',
				message_id: 'msg_1'
			}
		});
	});

	it('does not overwrite non-empty metadata fields', () => {
		const input = {
			chat_id: 'chat_1',
			id: 'msg_1',
			metadata: {
				request_id: 'req_existing',
				chat_id: 'chat_existing',
				message_id: 'msg_existing'
			}
		};
		const output = enhanceOpenAIChatCompletionBody(input) as Record<string, unknown>;

		expect(output).toMatchObject({
			metadata: {
				request_id: 'req_existing',
				chat_id: 'chat_existing',
				message_id: 'msg_existing'
			}
		});
	});

	it('replaces empty request_id', () => {
		const input = { metadata: { request_id: '' } };
		const output = enhanceOpenAIChatCompletionBody(input) as Record<string, unknown>;

		expect(output).toMatchObject({
			metadata: { request_id: 'uuid_test' }
		});
	});
});

