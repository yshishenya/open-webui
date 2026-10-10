// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Node from '../src/lib/components/chat/Overview/Node.svelte';
import type { ChatHistoryMessage } from '../src/lib/utils/airis/chat_history';

vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});

// Connection handles need the graph provider; this checks the actual message card.
vi.mock('@xyflow/svelte', () => ({
	Handle: () => {},
	Position: { Top: 'top', Bottom: 'bottom' }
}));

let target: HTMLDivElement;
let component: ReturnType<typeof mount> | undefined;
beforeEach(() => {
	target = document.createElement('div');
	document.body.append(target);
});
afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	target.remove();
});

const render = async (
	message: ChatHistoryMessage,
	user: { id: string; name: string } | null
): Promise<void> => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	component = mount(Node, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			id: message.id,
			type: 'custom',
			data: { message, user, model: null },
			dragging: false,
			draggable: false,
			selectable: false,
			deletable: false,
			selected: false,
			isConnectable: false,
			zIndex: 0,
			positionAbsoluteX: 0,
			positionAbsoluteY: 0
		}
	});
	await tick();
};

it('shows legacy error text stored in the message content', async () => {
	await render(
		{
			id: 'a',
			role: 'assistant',
			parentId: null,
			childrenIds: [],
			error: true,
			content: 'Legacy response error'
		},
		null
	);
	expect(target.textContent).toContain('Legacy response error');
});

it('renders a user message while the session user is absent', async () => {
	await render({ id: 'u', role: 'user', parentId: null, childrenIds: [], content: 'Draft' }, null);
	expect(target.textContent).toContain('User');
	expect(target.textContent).toContain('Draft');
	expect(target.querySelector('img')?.getAttribute('src')).toContain('/static/favicon.svg');
	expect(target.querySelector('img')?.closest('.w-full')).not.toBeNull();
});

it('uses the existing error formatter for structured provider errors', async () => {
	await render(
		{
			id: 'a',
			role: 'assistant',
			parentId: null,
			childrenIds: [],
			error: { content: { detail: 'Provider unavailable' } }
		},
		null
	);
	expect(target.textContent).toContain('Provider unavailable');
	expect(target.textContent).not.toContain('[object Object]');
});

it('keeps structured response text and favorite toggling', async () => {
	const message: ChatHistoryMessage = {
		id: 'a',
		role: 'assistant',
		parentId: null,
		childrenIds: [],
		content: 'Response',
		favorite: null
	};
	await render(message, { id: 'u', name: 'User' });
	expect(target.textContent).toContain('Response');
	const button = target.querySelector('button');
	button?.click();
	await tick();
	expect(message.favorite).toBe(true);
	button?.click();
	await tick();
	expect(message.favorite).toBe(false);
});
