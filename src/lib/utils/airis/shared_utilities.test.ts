// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import {
	bestMatchingLanguage,
	convertOpenAIChats,
	convertOpenApiToToolPayload,
	getGravatarURL,
	getImportOrigin,
	getPromptVariables
} from '$lib/utils';

vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});

it('uses the documented hash export and preserves email normalization', () => {
	expect(getGravatarURL(' TEST@Example.com ')).toBe(
		'https://www.gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
	);
});

it('keeps browser preference order and the default language', () => {
	const supported = [{ code: 'ru-RU' }, { code: 'en-US' }, { code: 'en-GB' }];
	expect(bestMatchingLanguage(supported, ['en', 'ru'], 'de-DE')).toBe('en-US');
	expect(bestMatchingLanguage(supported, ['ru'], 'en-US')).toBe('ru-RU');
	expect(bestMatchingLanguage(supported, ['tr'], 'en-US')).toBe('en-US');
	expect(bestMatchingLanguage([], [], 'en-US')).toBe('en-US');
});

it('preserves the optional user variables and locale fallback sent by Chat', () => {
	localStorage.removeItem('locale');
	const missing = getPromptVariables(undefined, null);
	expect(missing['{{USER_NAME}}']).toBeUndefined();
	expect(missing['{{USER_LOCATION}}']).toBe('Unknown');
	expect(missing['{{USER_EMAIL}}']).toBe('Unknown');
	expect(missing['{{USER_LANGUAGE}}']).toBe('en-US');
	localStorage.setItem('locale', 'ru-RU');
	const values = getPromptVariables('User', '55.000, 37.000 (lat, long)', 'user@example.test');
	expect(values['{{USER_NAME}}']).toBe('User');
	expect(values['{{USER_LOCATION}}']).toBe('55.000, 37.000 (lat, long)');
	expect(values['{{USER_LANGUAGE}}']).toBe('ru-RU');
	localStorage.removeItem('locale');
});

it('converts a mixed ChatGPT export without importing folder metadata or image parts', () => {
	const entries = [
		{ id: 'folder', title: 'Folder' },
		{
			id: 'chat',
			title: 'Imported',
			create_time: 10.8,
			update_time: 20.9,
			mapping: {
				root: { message: null, children: ['user'] },
				user: {
					children: ['assistant'],
					message: {
						author: { role: 'user' },
						content: { parts: ['First', { image: 'skip' }, 'Second'] },
						create_time: 11.9
					}
				},
				assistant: {
					children: [],
					message: {
						author: { role: 'assistant' },
						content: { text: 'Answer' },
						metadata: { model_slug: 'model' },
						create_time: 12.9
					}
				}
			}
		}
	];
	const before = structuredClone(entries);
	expect(getImportOrigin(entries)).toBe('openai');
	expect(getImportOrigin([{ chat: {} }])).toBe('webui');
	const rows = convertOpenAIChats(entries);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ id: 'chat', created_at: 10, updated_at: 20 });
	expect(rows[0].chat.models).toEqual(['model']);
	expect(rows[0].chat.history.currentId).toBe('assistant');
	expect(rows[0].chat.messages.map((m) => [m.id, m.parentId, m.content, m.timestamp])).toEqual([
		['user', null, 'First\nSecond', 11],
		['assistant', 'user', 'Answer', 12]
	]);
	expect(entries).toEqual(before);
});

it('does not import empty conversations and retains the creation-time update fallback', () => {
	expect(convertOpenAIChats([{ mapping: {} }])).toEqual([]);
	const rows = convertOpenAIChats([
		{
			create_time: 50.5,
			mapping: { one: { message: { author: { role: 'user' }, content: { parts: ['Text'] } } } }
		}
	]);
	expect(rows[0]).toMatchObject({ created_at: 50, updated_at: 50 });
	expect(rows[0].chat.title).toBe('New Chat');
});

it('keeps operation overrides, body references, required fields and ignores path metadata', () => {
	const spec = {
		components: {
			schemas: {
				Body: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
			}
		},
		paths: {
			'/resource': {
				summary: 'Path metadata',
				'x-extension': { operationId: 'ignore' },
				parameters: [{ name: 'kind', in: 'query', required: true, schema: { type: 'string' } }],
				post: {
					operationId: 'create',
					summary: 'Create',
					parameters: [{ name: 'kind', in: 'query', schema: { type: 'string', enum: ['a', 'b'] } }],
					requestBody: {
						content: { 'application/json': { schema: { $ref: '#/components/schemas/Body' } } }
					}
				}
			}
		}
	};
	const before = structuredClone(spec);
	expect(convertOpenApiToToolPayload(spec)).toEqual([
		{
			name: 'create',
			description: 'Create',
			parameters: {
				type: 'object',
				required: ['text'],
				properties: {
					kind: { type: 'string', description: '. Possible values: a, b' },
					text: { type: 'string' }
				}
			}
		}
	]);
	expect(spec).toEqual(before);
});

it('preserves root arrays, composition and the existing empty-spec result', () => {
	const payload = convertOpenApiToToolPayload({
		paths: {
			'/batch': {
				post: {
					operationId: 'batch',
					requestBody: {
						content: {
							'application/json': {
								schema: {
									type: 'array',
									items: { oneOf: [{ type: 'string' }, { type: 'integer' }] }
								}
							}
						}
					}
				}
			}
		}
	});
	expect(payload[0]).toMatchObject({
		parameters: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'integer' }] } }
	});
	expect(convertOpenApiToToolPayload(null)).toEqual([]);
	expect(convertOpenApiToToolPayload({})).toEqual([]);
});
