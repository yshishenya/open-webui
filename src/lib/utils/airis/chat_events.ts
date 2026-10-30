import type { ChatCodeExecution, ChatHistoryMessage, ChatStatus, ChatVoiceMetadata } from './chat_history';
import type { SavedChat } from './frontend-contracts';

export type ChatCompletionEvent = {
	type?: string;
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

type Confirmation = { title: string; message: string; interaction_id?: string; tool_call?: boolean | Record<string, unknown> };
type Input = Confirmation & {
	placeholder: string;
	value?: string;
	type?: string;
	options?: ({ label?: string; value: string } | string)[];
	input?: { type?: string; options?: Input['options'] };
};
type Source = Partial<ChatCodeExecution> & { type?: string; [key: string]: unknown };
type Payloads = {
	'chat:presence': { users: { id: string; name: string }[] };
	typing: { typing: boolean };
	'chat:messages': import('./chat_history').ChatHistory;
	'chat:access': { active?: boolean };
	'voice:play_animation': { name?: string; model_id?: string };
	'request:user_input': Input & { questions?: Record<string, unknown>[] };
	'request:elicitation': Input & { schema?: Record<string, unknown> };
	'request:interaction:done': { interaction_id?: string };
	'response:completion': Record<string, unknown>;
	'chat:message:voice': { voice: ChatVoiceMetadata };

	'billing:reservation': unknown;
	'chat:reload': unknown;
	'chat:list': unknown;
	status: ChatStatus;
	context_compaction: ChatStatus & { checkpoint_message_id?: string; context_summary?: string };
	'chat:active': { active: boolean };
	'chat:completion': ChatCompletionEvent;
	'chat:tasks:cancel': { output?: ChatHistoryMessage['output'] };
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
	shared?: boolean;
	user_id?: string;
	user?: { id: string; name: string };
	chat_id: string;
	message_id: string;
	data: { [Kind in keyof Payloads]: { type: Kind; data: Payloads[Kind] } }[keyof Payloads];
};
