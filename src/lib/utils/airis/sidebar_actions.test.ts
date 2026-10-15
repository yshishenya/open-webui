// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { createMessagesList } from '$lib/utils';
import { getOutputText } from '$lib/components/chat/Messages/structuredOutput';

vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: '' }));

const source = readFileSync('src/lib/components/layout/Sidebar/ChatItem.svelte', 'utf8');
const instance = parse(source).instance;
if (!instance) throw new Error('Missing chat item script');
const parsed = ts.createSourceFile(
	'chat-item.ts',
	source.slice(instance.content.start, instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const handler = (name: string): string => {
	for (const statement of parsed.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const declaration = statement.declarationList.declarations.find(
			(d) => d.name.getText(parsed) === name
		);
		if (declaration?.initializer)
			return `const ${name} = ${declaration.initializer.getText(parsed)};`;
	}
	throw new Error(`Missing actual handler: ${name}`);
};
const setup = (selectedModels = '[]', active = false) => {
	const getChatById = vi.fn().mockResolvedValue({
		chat: {
			models: ['old-model'],
			history: {
				currentId: 'answer',
				messages: {
					question: {
						id: 'question',
						parentId: null,
						childrenIds: ['answer', 'other'],
						role: 'user',
						content: 'Topic'
					},
					answer: {
						id: 'answer',
						parentId: 'question',
						childrenIds: [],
						role: 'assistant',
						content: 'Answer',
						model: 'branch-model'
					},
					other: {
						id: 'other',
						parentId: 'question',
						childrenIds: [],
						role: 'assistant',
						content: 'Wrong branch',
						model: 'other-model'
					}
				}
			}
		}
	});
	const generateTitle = vi.fn().mockResolvedValue('New title');
	const updateChatById = vi.fn().mockResolvedValue({ id: 'chat' });
	const refreshChatList = vi.fn();
	const dispatch = vi.fn();
	const error = vi.fn();
	const result = runInNewContext(
		ts.transpileModule(
			`(() => {
		let generating = false, chat = null, chatTitle = 'Original', confirmEdit = true;
		${handler('editChatTitle')}
		${handler('generateTitleHandler')}
		return { run: generateTitleHandler, state: () => ({ generating, chatTitle, confirmEdit }) };
	})()`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			id: 'chat',
			title: 'Original',
			$chatId: active ? 'chat' : '',
			localStorage: { token: 'fixture' },
			sessionStorage: { selectedModels },
			getChatById,
			generateTitle,
			updateChatById,
			refreshChatList,
			dispatch,
			createMessagesList,
			getOutputText,
			toast: { error },
			$i18n: { t: (s: string) => s },
			_chatTitle: { set: vi.fn() }
		}
	) as {
		run: () => Promise<void>;
		state: () => { generating: boolean; chatTitle: string; confirmEdit: boolean };
	};
	return {
		...result,
		getChatById,
		generateTitle,
		updateChatById,
		refreshChatList,
		dispatch,
		error
	};
};

it.each(['read', 'empty', 'generation', 'save', 'empty-save'])(
	'failed %s keeps the original title, reports failure and releases the button',
	async (stage) => {
		const c = setup();
		const failure = new Error('Unavailable');
		if (stage === 'read') c.getChatById.mockRejectedValue(failure);
		if (stage === 'empty') c.getChatById.mockResolvedValue(null);
		if (stage === 'generation') c.generateTitle.mockRejectedValue(failure);
		if (stage === 'save') c.updateChatById.mockRejectedValue(failure);
		if (stage === 'empty-save') c.updateChatById.mockResolvedValue(null);
		await expect(c.run()).resolves.toBeUndefined();
		expect(c.state()).toEqual({ generating: false, chatTitle: 'Original', confirmEdit: true });
		expect(c.error).toHaveBeenCalledOnce();
		expect(c.dispatch).not.toHaveBeenCalled();
		if (stage !== 'save' && stage !== 'empty-save') expect(c.updateChatById).not.toHaveBeenCalled();
	}
);

it.each(['{}', 'null', 'true', '[null, 12, {}, ""]', 'invalid'])(
	'invalid stored selection %s falls back to the actual assistant branch',
	async (selection) => {
		const c = setup(selection, true);
		await c.run();
		expect(c.generateTitle).toHaveBeenCalledWith('fixture', 'branch-model', [
			{ role: 'user', content: 'Topic' },
			{ role: 'assistant', content: 'Answer' }
		]);
		expect(c.updateChatById).toHaveBeenCalledWith('fixture', 'chat', { title: 'New title' });
		expect(c.state()).toEqual({ generating: false, chatTitle: 'New title', confirmEdit: false });
	}
);

it('uses the live string model for the active chat and rejects a duplicate pending click', async () => {
	const c = setup('[null, 12, "live-model"]', true);
	let release: (value: string) => void = () => {
		throw new Error('Not initialized');
	};
	c.generateTitle.mockReturnValue(
		new Promise((resolve) => {
			release = resolve;
		})
	);
	const first = c.run();
	await vi.waitFor(() => expect(c.generateTitle).toHaveBeenCalledOnce());
	await c.run();
	expect(c.getChatById).toHaveBeenCalledOnce();
	expect(c.generateTitle.mock.calls[0][1]).toBe('live-model');
	release('New title');
	await first;
	expect(c.updateChatById).toHaveBeenCalledOnce();
});

it('keeps the legacy message/model fallback and does not save an empty generated title', async () => {
	const c = setup();
	c.getChatById.mockResolvedValue({
		chat: { models: ['legacy-model'], messages: [{ role: 'user', content: 'Legacy question' }] }
	});
	c.generateTitle.mockResolvedValue(null);
	await c.run();
	expect(c.generateTitle).toHaveBeenCalledWith('fixture', 'legacy-model', [
		{ role: 'user', content: 'Legacy question' }
	]);
	expect(c.updateChatById).not.toHaveBeenCalled();
	expect(c.state()).toEqual({ generating: false, chatTitle: 'Original', confirmEdit: true });
});
