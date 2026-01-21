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

vi.mock('$app/navigation', () => ({ goto: gotoMock }), { virtual: true });
vi.mock('$app/environment', () => ({ browser: true }), { virtual: true });
vi.mock('$lib/stores', () => ({ user: userStore }), { virtual: true });

import { buildChatUrl, buildSignupUrl, openCta, openPreset } from './welcomeNavigation';

const parseUrl = (url: string) => new URL(url, 'http://localhost');

describe('welcomeNavigation', () => {
	beforeEach(() => {
		gotoMock.mockReset();
		sessionStorage.clear();
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
});
