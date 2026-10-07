import type { ChatCodeExecution, ChatHistoryMessage, ChatStatus } from './chat_history';
import type { SavedChat } from './frontend-contracts';

export type ChatCompletionEvent = {
	id?: string;
	done?: boolean;
	choices?: { message?: { content?: string }; delta?: { content?: string } }[];
	content?: string;
	output?: ChatHistoryMessage['output'];
	sources?: ChatHistoryMessage['sources'];
	selected_model_id?: string;
	error?: unknown;
	usage?: ChatHistoryMessage['usage'];
};

type Confirmation = { title: string; message: string };
type Input = Confirmation & {
	placeholder: string;
	value?: string;
	type?: string;
	options?: ({ label?: string; value: string } | string)[];
	input?: { type?: string; options?: Input['options'] };
};
type Source = Partial<ChatCodeExecution> & { type?: string; [key: string]: unknown };
type Payloads = {
	'chat:reload': unknown;
	'chat:list': unknown;
	status: ChatStatus;
	context_compaction: ChatStatus;
	'chat:active': { active: boolean };
	'chat:completion': ChatCompletionEvent;
	'chat:tasks:cancel': unknown;
	'chat:message:delta': { content: string };
	message: { content: string };
	'chat:message': { content: string };
	replace: { content: string };
	'chat:message:files': { files: ChatHistoryMessage['files'] };
	files: { files: ChatHistoryMessage['files'] };
	'chat:message:tasks': { tasks: NonNullable<SavedChat['tasks']> };
	'chat:message:embeds': { embeds: string[] };
	embeds: { embeds: string[] };
	'chat:message:error': { error: ChatHistoryMessage['error'] };
	'chat:message:follow_ups': { follow_ups: string[] };
	'chat:outlet': { messages?: (Partial<ChatHistoryMessage> & { id: string })[] };
	'chat:message:favorite': { favorite: boolean };
	'chat:title': string;
	'chat:tags': unknown;
	source: Source;
	citation: Source;
	notification: { type?: string; content?: string };
	confirmation: Confirmation;
	execute: { code: string };
	input: Input;
	'terminal:display_file': { path?: string };
	'terminal:write_file': { path?: string };
	'terminal:replace_file_content': { path?: string };
	'terminal:run_command': unknown;
};

/** Existing Socket.IO chat event envelopes emitted by the backend. */
export type ChatSocketEvent = {
	chat_id: string;
	message_id: string;
	data: { [Kind in keyof Payloads]: { type: Kind; data: Payloads[Kind] } }[keyof Payloads];
};
