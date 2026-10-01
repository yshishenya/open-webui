// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = { id: string };
type MockStore<T> = {
	subscribe: (run: (value: T) => void) => () => void;
	set: (value: T) => void;
};

const { gotoMock, userStore } = vi.hoisted(() => {
	const gotoMock = vi.fn();
	const createStore = <T>(initial: T): MockStore<T> => {
		let value = initial;
		const subscribers = new Set<(value: T) => void>();
		const subscribe = (run: (value: T) => void) => {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		};
		const set = (next: T) => {
			value = next;
			subscribers.forEach((run) => run(value));
		};
		return { subscribe, set };
	};
	const userStore = createStore<TestUser | null>(null);
	return { gotoMock, userStore };
});

vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores', () => ({ user: userStore }));
vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));

import { buildChatUrl, buildSignupUrl, openCta, openPreset } from './welcomeNavigation';

const parseUrl = (url: string) => new URL(url, 'http://localhost');

describe('welcomeNavigation', () => {
	beforeEach(() => {
		gotoMock.mockReset();
		sessionStorage.clear();
		localStorage.removeItem('token');
		userStore.set(null);
	});

	it('buildChatUrl includes source and params', () => {
		const url = buildChatUrl('welcome_test', { preset: 'social_post', q: 'Hello world' });
		const parsed = parseUrl(url);

		expect(parsed.pathname).toBe('/');
		expect(parsed.searchParams.get('src')).toBe('welcome_test');
		expect(parsed.searchParams.get('preset')).toBe('social_post');
		expect(parsed.searchParams.get('q')).toBe('Hello world');
	});

	it('buildSignupUrl includes redirect and params', () => {
		const url = buildSignupUrl('welcome_test', {
			preset: 'social_post',
			q: 'Hello world',
			submit: 'false'
		});
		const parsed = parseUrl(url);

		expect(parsed.pathname).toBe('/signup');
		expect(parsed.searchParams.get('src')).toBe('welcome_test');
		expect(parsed.searchParams.get('preset')).toBe('social_post');
		expect(parsed.searchParams.get('q')).toBe('Hello world');
		expect(parsed.searchParams.get('submit')).toBe('false');

		const redirect = parsed.searchParams.get('redirect');
		expect(redirect).not.toBeNull();

		const redirectUrl = parseUrl(redirect ?? '');
		expect(redirectUrl.pathname).toBe('/');
		expect(redirectUrl.searchParams.get('src')).toBe('welcome_test');
		expect(redirectUrl.searchParams.get('preset')).toBe('social_post');
		expect(redirectUrl.searchParams.get('q')).toBe('Hello world');
		expect(redirectUrl.searchParams.get('submit')).toBe('false');
	});

	it('openCta sends authenticated users to chat', () => {
		userStore.set({ id: 'user_1' });

		openCta('welcome_cta');

		expect(gotoMock).toHaveBeenCalledTimes(1);
		const parsed = parseUrl(gotoMock.mock.calls[0][0] as string);
		expect(parsed.pathname).toBe('/');
		expect(parsed.searchParams.get('src')).toBe('welcome_cta');
	});

	it('openCta sends guests to signup with redirect', () => {
		openCta('welcome_cta');

		expect(gotoMock).toHaveBeenCalledTimes(1);
		const parsed = parseUrl(gotoMock.mock.calls[0][0] as string);
		expect(parsed.pathname).toBe('/signup');
		expect(parsed.searchParams.get('src')).toBe('welcome_cta');

		const redirect = parsed.searchParams.get('redirect');
		const redirectUrl = parseUrl(redirect ?? '');
		expect(redirectUrl.searchParams.get('src')).toBe('welcome_cta');
	});

	it('openCta uses an existing token before session hydration completes', () => {
		localStorage.setItem('token', 'session-token');

		openCta('welcome_cta');

		expect(gotoMock).toHaveBeenCalledWith('/?src=welcome_cta');
	});

	it('openPreset stores guest prompt and redirects to signup', () => {
		const prompt = 'Write a post about a product launch';

		openPreset('welcome_examples', 'social_post', prompt);

		const stored = sessionStorage.getItem('welcome_preset_prompt');
		expect(stored).not.toBeNull();

		const payload = JSON.parse(stored ?? '{}') as Record<string, unknown>;
		expect(payload.preset).toBe('social_post');
		expect(payload.prompt).toBe(prompt);
		expect(payload.source).toBe('welcome_examples');
		expect(typeof payload.createdAt).toBe('number');

		expect(gotoMock).toHaveBeenCalledTimes(1);
		const parsed = parseUrl(gotoMock.mock.calls[0][0] as string);
		expect(parsed.pathname).toBe('/signup');
		expect(parsed.searchParams.get('preset')).toBe('social_post');
		expect(parsed.searchParams.get('q')).toBe(prompt);
		expect(parsed.searchParams.get('submit')).toBe('false');
	});

	it('openPreset sends authenticated users to chat without storage', () => {
		userStore.set({ id: 'user_1' });
		const prompt = 'Write a short summary';

		openPreset('welcome_examples', 'summarize_notes', prompt);

		expect(sessionStorage.getItem('welcome_preset_prompt')).toBeNull();
		expect(gotoMock).toHaveBeenCalledTimes(1);

		const parsed = parseUrl(gotoMock.mock.calls[0][0] as string);
		expect(parsed.pathname).toBe('/');
		expect(parsed.searchParams.get('src')).toBe('welcome_examples');
		expect(parsed.searchParams.get('preset')).toBe('summarize_notes');
		expect(parsed.searchParams.get('q')).toBe(prompt);
		expect(parsed.searchParams.get('submit')).toBe('false');
	});
	it('preserves an explicit model and an unsent draft through signup', () => {
		openPreset('guide_examples', 'letter', 'Письмо & план?', 'gpt-5.6-luna');
		const signup = parseUrl(gotoMock.mock.calls[0][0] as string);
		const redirect = parseUrl(signup.searchParams.get('redirect') ?? '');
		expect(signup.searchParams.get('model')).toBe('gpt-5.6-luna');
		expect(redirect.searchParams.get('model')).toBe('gpt-5.6-luna');
		expect(redirect.searchParams.get('q')).toBe('Письмо & план?');
		expect(redirect.searchParams.get('submit')).toBe('false');
	});

	it('opens the same explicit model for an existing session', () => {
		userStore.set({ id: 'user_1' });
		openPreset('guide_examples', 'plan', 'Составь план', 'gpt-5.6-luna');
		const target = parseUrl(gotoMock.mock.calls[0][0] as string);
		expect(target.pathname).toBe('/');
		expect(target.searchParams.get('model')).toBe('gpt-5.6-luna');
		expect(target.searchParams.get('submit')).toBe('false');
	});

	it('keeps navigation functional when browser storage is blocked', () => {
		const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('Storage blocked', 'SecurityError');
		});
		try {
			openPreset('guide_examples', 'topic', 'Объясни тему', 'gpt-5.6-luna');
			const signup = parseUrl(gotoMock.mock.calls[0][0] as string);
			const redirect = parseUrl(signup.searchParams.get('redirect') ?? '');
			expect(redirect.searchParams.get('q')).toBe('Объясни тему');
			expect(redirect.searchParams.get('model')).toBe('gpt-5.6-luna');
		} finally {
			storage.mockRestore();
		}
	});
});
