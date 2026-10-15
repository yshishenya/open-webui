import { enhanceOpenAIChatCompletionBody } from './openai';
import type { ChatHistory } from './chat_history';
import { hasCredential, validComposerDraft, type ComposerSnapshot } from './chat_draft';

export type NativeDispatchAcknowledgement = {
	status?: boolean;
	chat_id?: string;
	task_ids?: string[];
	task_id?: string;
	error?: unknown;
};
export type DispatchReceipt = { status: true; chat_id: string; task_ids: string[] };
export type DispatchState = {
	state: 'absent' | 'unknown' | 'accepted';
	receipt: DispatchReceipt | null;
};
export type PendingDispatch = {
	version: 1;
	actor: string;
	scope: string;
	operationId: string;
	chatId: string;
	parentId: string;
	queueIds: string[];
	intent: string;
	history: ChatHistory;
	body: Record<string, unknown>;
	toolServerDigests: string[];
	composer?: ComposerSnapshot;
};

const key = (actor: string, scope: string): string =>
	`airis-pending-dispatch:${JSON.stringify([actor, scope])}`;
const uuid = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = async (value: unknown): Promise<string> => {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
		b.toString(16).padStart(2, '0')
	).join('');
};

export const validDispatchReceipt = (value: unknown): value is DispatchReceipt =>
	record(value) &&
	value.status === true &&
	typeof value.chat_id === 'string' &&
	value.chat_id.trim().length > 0 &&
	Array.isArray(value.task_ids) &&
	value.task_ids.length > 0 &&
	value.task_ids.every((id: unknown) => typeof id === 'string' && id.trim().length > 0);

export const readPendingDispatch = (
	storage: Storage,
	actor: string,
	scope: string
): PendingDispatch | null => {
	const raw = storage.getItem(key(actor, scope));
	if (raw === null) return null;
	const value: unknown = JSON.parse(raw);
	if (
		!record(value) ||
		value.version !== 1 ||
		value.actor !== actor ||
		value.scope !== scope ||
		!uuid(value.operationId) ||
		typeof value.chatId !== 'string' ||
		typeof value.parentId !== 'string' ||
		typeof value.intent !== 'string' ||
		!Array.isArray(value.queueIds) ||
		!value.queueIds.every((id: unknown) => typeof id === 'string') ||
		!Array.isArray(value.toolServerDigests) ||
		!value.toolServerDigests.every((item: unknown) => typeof item === 'string') ||
		!record(value.body) ||
		value.body.operation_id !== value.operationId ||
		!record(value.history) ||
		!record(value.history.messages) ||
		(value.composer !== undefined &&
			(!record(value.composer) ||
				value.composer.actor !== actor ||
				value.composer.scope !== scope ||
				!validComposerDraft(value.composer.draft)))
	)
		throw new Error('Pending request could not be restored safely');
	return value as PendingDispatch;
};

export const preparePendingDispatch = async (
	storage: Storage,
	context: Pick<
		PendingDispatch,
		'actor' | 'scope' | 'chatId' | 'parentId' | 'intent' | 'history'
	> & { queueIds?: string[]; composer?: ComposerSnapshot },
	request: Record<string, unknown>
): Promise<PendingDispatch> => {
	if (!context.actor || !context.scope)
		throw new Error('Account is required to save a pending request');
	if (
		context.composer &&
		(context.composer.actor !== context.actor ||
			context.composer.scope !== context.scope ||
			!validComposerDraft(context.composer.draft))
	)
		throw new Error('Invalid composer snapshot');
	if (readPendingDispatch(storage, context.actor, context.scope))
		throw new Error('Check the previous request before sending another one');
	const body = JSON.parse(JSON.stringify(enhanceOpenAIChatCompletionBody(request))) as Record<
		string,
		unknown
	>;
	const servers = body.tool_servers ?? [];
	if (!Array.isArray(servers)) throw new Error('Invalid tool connections');
	const toolServerDigests = await Promise.all(servers.map(digest));
	// Direct server settings can contain credentials. Restore them only if their digest is unchanged.
	delete body.tool_servers;
	delete body.session_id;
	if (
		hasCredential(body) ||
		hasCredential(context.history) ||
		(context.composer && !validComposerDraft(context.composer.draft))
	)
		throw new Error('The pending request contains credentials and cannot be saved safely');
	if (!uuid(body.operation_id)) throw new Error('Operation is required');
	// Saved chats are restored from the server; keep only this operation's local messages.
	const ids = new Set([
		context.parentId,
		String(body.id ?? ''),
		...(Array.isArray(body.message_ids)
			? body.message_ids.map((entry) => (record(entry) ? String(entry.message_id ?? '') : ''))
			: [])
	]);
	const pending: PendingDispatch = {
		...context,
		queueIds: [...(context.queueIds ?? [])],
		version: 1,
		operationId: body.operation_id,
		body,
		toolServerDigests,
		history: structuredClone(
			context.scope === 'temporary'
				? context.history
				: {
						currentId: context.history.currentId,
						messages: Object.fromEntries(
							Object.entries(context.history.messages).filter(([id]) => ids.has(id))
						)
					}
		)
	};
	const encoded = JSON.stringify(pending);
	storage.setItem(key(context.actor, context.scope), encoded);
	if (storage.getItem(key(context.actor, context.scope)) !== encoded)
		throw new Error('The pending request could not be saved');
	return pending;
};

export const replayPendingBody = async (
	pending: PendingDispatch,
	sessionId: string,
	toolServers: unknown[]
): Promise<Record<string, unknown>> => {
	if (!sessionId) throw new Error('Connection is required to send the saved request');
	const available = await Promise.all(
		toolServers.map(async (server) => ({ server, hash: await digest(server) }))
	);
	const restored = pending.toolServerDigests.map((hash) => {
		const match = available.find((entry) => entry.hash === hash);
		if (!match)
			throw new Error(
				'Tool connections changed. The saved request was kept; check its status first'
			);
		return match.server;
	});
	return { ...structuredClone(pending.body), tool_servers: restored, session_id: sessionId };
};

export const removePendingDispatch = (storage: Storage, pending: PendingDispatch): void => {
	if (
		readPendingDispatch(storage, pending.actor, pending.scope)?.operationId === pending.operationId
	)
		storage.removeItem(key(pending.actor, pending.scope));
};
