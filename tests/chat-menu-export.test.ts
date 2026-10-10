// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { convertMessagesToHistory, createMessagesList } from '../src/lib/utils';
import { getOutputText } from '../src/lib/components/chat/Messages/structuredOutput';
import { getChatExportText } from '../src/lib/utils/airis/chat-export';
import type { SavedChat } from '../src/lib/utils/airis/frontend-contracts';

vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});

const menus = ['Sidebar/ChatMenu', 'Navbar/Menu'];
const record = (): SavedChat => ({
	id: 'saved',
	user_id: 'owner',
	title: 'Разговор',
	created_at: 1,
	updated_at: 1,
	archived: false,
	chat: {
		title: 'Разговор',
		messages: [
			{ id: 'q', role: 'user', content: 'Вопрос', parentId: null, childrenIds: [] },
			{ id: 'a', role: 'assistant', content: 'Ответ', parentId: 'q', childrenIds: [] }
		]
	}
});

function initializer(menu: string, name: string): string {
	const content = readFileSync(`src/lib/components/layout/${menu}.svelte`, 'utf8');
	const source = ts.createSourceFile(
		'menu.ts',
		content.split('<script lang="ts">')[1].split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const item = statement.declarationList.declarations.find(
			(node) => node.name.getText(source) === name
		);
		if (item?.initializer) return item.initializer.getText(source);
	}
	throw new Error(`Missing ${menu}.${name}`);
}

function run<T>(code: string, context: object): T {
	return runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	) as T;
}

for (const menu of menus) {
	it(`${menu}: exports legacy and selected history without mutating saved messages`, async () => {
		const chat = record();
		const before = JSON.stringify(chat);
		const asText = run<(chat: SavedChat) => Promise<string>>(
			`(${initializer(menu, 'getChatAsText')})`,
			{ chat, convertMessagesToHistory, createMessagesList, getOutputText, getChatExportText }
		);
		expect(await asText(chat)).toBe('### USER\nВопрос\n\n### ASSISTANT\nОтвет');
		expect(JSON.stringify(chat)).toBe(before);
		chat.chat.history = convertMessagesToHistory(chat.chat.messages);
		chat.current_message_id = 'q';
		expect(await asText(chat)).toBe('### USER\nВопрос');
		chat.current_message_id = 'missing';
		expect(await asText(chat)).toContain('Ответ');
	});

	for (const failure of ['capture', 'context', 'save', 'missing', 'none']) {
		it(`${menu}: PDF ${failure} leaves no clone or active preview`, async () => {
			document.body.innerHTML =
				failure === 'missing'
					? ''
					: '<div id="full-messages-container"><div class="message-listitem">Вопрос — Ответ</div></div>';
			const count = document.body.children.length;
			const toast = { error: vi.fn() };
			const save = vi.fn(() => {
				if (failure === 'save') throw new Error('save failed');
			});
			const canvas = { width: 1600, height: 2400 };
			const capture = vi.fn(async (node: HTMLElement) => {
				expect(document.body.contains(node)).toBe(true);
				expect(node.textContent).toBe('Вопрос — Ответ');
				if (failure === 'capture') throw new Error('capture failed');
				return canvas;
			});
			const drawImage = vi.fn();
			const page = {
				getContext: () => (failure === 'context' ? null : { drawImage }),
				toDataURL: () => 'data:image/jpeg;base64,TEST'
			};
			const doc = {
				getElementById: document.getElementById.bind(document),
				documentElement: document.documentElement,
				body: document.body,
				createElement: () => page
			};
			const modules = {
				pdf: {
					default: class {
						save = save;
						addImage = vi.fn();
						addPage = vi.fn();
					}
				},
				canvas: { default: capture }
			};
			const code = initializer(menu, 'downloadPdf')
				.replace("import('jspdf')", 'Promise.resolve(modules.pdf)')
				.replace("import('html2canvas-pro')", 'Promise.resolve(modules.canvas)');
			const handler = run<{ downloadPdf: () => Promise<void>; state: () => boolean }>(
				`let showFullMessages = false; const downloadPdf = ${code}; ({downloadPdf, state: () => showFullMessages})`,
				{
					chatId: 'saved',
					chat: record(),
					getChatById: async () => record(),
					localStorage: { token: 'test' },
					modules,
					$settings: { stylizedPdfExport: true },
					tick: async () => {},
					requestAnimationFrame: (fn: FrameRequestCallback) => fn(0),
					document: doc,
					toast,
					$i18n: { t: (text: string) => text },
					console: { error: vi.fn() }
				}
			);
			await handler.downloadPdf();
			expect(handler.state()).toBe(false);
			expect(document.body.children.length).toBe(count);
			if (failure === 'none') {
				expect(save).toHaveBeenCalledWith('chat-Разговор.pdf');
				expect(drawImage).toHaveBeenCalledTimes(2);
				expect(toast.error).not.toHaveBeenCalled();
			} else expect(toast.error).toHaveBeenCalledTimes(1);
		});
	}
}
