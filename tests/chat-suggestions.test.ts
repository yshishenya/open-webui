// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import Suggestions from '../src/lib/components/chat/Suggestions.svelte';
import ChatPlaceholder from '../src/lib/components/chat/ChatPlaceholder.svelte';
import { config, models, user } from '../src/lib/stores';
import type { Model, SuggestionPrompt } from '../src/lib/utils/airis/model-types';
import type { FrontendConfig } from '../src/lib/utils/airis/frontend-contracts';

vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});

if (!Element.prototype.animate)
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		value: () => ({
			cancel: () => {},
			finished: Promise.resolve(),
			finish: () => {},
			pause: () => {},
			play: () => {}
		})
	});

async function context(): Promise<Map<string, object>> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}

const suggestions: SuggestionPrompt[] = [
	{ id: 'text', title: ['Write text', 'An email'], content: 'Write an email' },
	{ id: 'plan', title: ['Make a plan', 'For the week'], content: 'Make a weekly plan' },
	{ id: 'topic', title: null, content: 'Explain a topic' }
];

it('filters actual suggestions, inserts the complete prompt and hides them for long input', async () => {
	for (const inputValue of ['', '  weekly plan  ', 'x'.repeat(501)]) {
		const target = document.createElement('div');
		document.body.append(target);
		const onSelect = vi.fn();
		const component = mount(Suggestions, {
			target,
			context: await context(),
			props: { suggestionPrompts: suggestions, inputValue, onSelect }
		});
		try {
			await tick();
			const buttons = Array.from(target.querySelectorAll('button'));
			expect(buttons.length).toBe(inputValue.length > 500 ? 0 : inputValue ? 1 : 3);
			if (inputValue.length <= 500) {
				const button = buttons.find((item) => item.textContent?.includes('Make a plan'));
				expect(button).toBeDefined();
				button!.click();
				expect(onSelect).toHaveBeenCalledOnce();
				expect(onSelect).toHaveBeenCalledWith({ type: 'prompt', data: 'Make a weekly plan' });
			}
		} finally {
			await unmount(component);
			target.remove();
		}
	}
});

it('selects active model, catalog model or configured defaults on the actual empty screen', async () => {
	const defaults: FrontendConfig = {
		status: true,
		name: 'AIRIS',
		version: 'test',
		default_locale: 'en',
		oauth: { providers: {} },
		telegram: { enabled: false, bot_username: '' },
		features: {
			auth: true,
			auth_trusted_header: false,
			enable_signup: true,
			enable_signup_password_confirmation: false,
			enable_login_form: true,
			enable_ldap: false,
			enable_websocket: false,
			enable_billing_subscriptions: false
		},
		default_prompt_suggestions: [{ title: ['Default task', ''], content: 'Default content' }]
	};
	config.set(defaults);
	user.set(null);
	models.set([
		{
			id: 'catalog',
			name: 'Catalog',
			info: {
				meta: { suggestion_prompts: [{ title: ['Catalog task', ''], content: 'Catalog content' }] }
			}
		}
	]);
	const cases: [string[], Model | null, string, string][] = [
		[[], null, 'Default task', 'Default content'],
		[['catalog'], null, 'Catalog task', 'Catalog content'],
		[
			['catalog'],
			{
				id: 'active',
				name: 'Active',
				info: {
					meta: { suggestion_prompts: [{ title: ['Active task', ''], content: 'Active content' }] }
				}
			},
			'Active task',
			'Active content'
		],
		[
			['catalog'],
			{ id: 'empty', name: 'Empty', info: { meta: { suggestion_prompts: [] } } },
			'',
			''
		]
	];
	for (const [modelIds, atSelectedModel, label, content] of cases) {
		const target = document.createElement('div');
		document.body.append(target);
		const onSelect = vi.fn();
		const component = mount(ChatPlaceholder, {
			target,
			context: await context(),
			props: { modelIds: [...modelIds], atSelectedModel, onSelect }
		});
		try {
			await tick();
			const buttons = Array.from(
				target.querySelectorAll<HTMLButtonElement>('button[role="listitem"]')
			);
			expect(buttons.length).toBe(label ? 1 : 0);
			if (label) {
				expect(buttons[0].textContent).toContain(label);
				buttons[0].click();
				expect(onSelect).toHaveBeenCalledWith({ type: 'prompt', data: content });
			}
		} finally {
			await unmount(component);
			target.remove();
		}
	}
});
