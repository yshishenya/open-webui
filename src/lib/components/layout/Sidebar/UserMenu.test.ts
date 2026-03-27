// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';

import UserMenu from './UserMenu.svelte';

type I18nValue = {
	locale: string;
	t: (key: string, vars?: Record<string, string | number>) => string;
};

type MockStore<T> = {
	subscribe: (run: (value: T) => void) => () => void;
	set: (value: T) => void;
	get: () => T;
};

type UserValue = {
	id: string;
	name: string;
	role: string;
	is_active: boolean;
	permissions?: {
		workspace?: {
			models?: boolean;
			knowledge?: boolean;
			prompts?: boolean;
			tools?: boolean;
		};
	};
};

const mocks = vi.hoisted(() => {
	const createStore = <T>(initial: T): MockStore<T> => {
		let value = initial;
		const subscribers = new Set<(value: T) => void>();
		return {
			subscribe: (run: (next: T) => void) => {
				run(value);
				subscribers.add(run);
				return () => subscribers.delete(run);
			},
			set: (next: T) => {
				value = next;
				subscribers.forEach((run) => run(value));
			},
			get: () => value
		};
	};

	const gotoMock = vi.fn();
	const getUsageMock = vi.fn().mockResolvedValue(null);
	const getSessionUserMock = vi.fn().mockResolvedValue(null);
	const userSignOutMock = vi.fn().mockResolvedValue({ redirect_url: '/auth' });
	const updateUserStatusMock = vi.fn().mockResolvedValue(true);
	const showSettingsStore = createStore(false);
	const mobileStore = createStore(false);
	const showSidebarStore = createStore(true);
	const showShortcutsStore = createStore(false);
	const userStore = createStore<UserValue | null>({
		id: 'user-1',
		name: 'Yan',
		role: 'admin',
		is_active: true
	});
	const configStore = createStore({
		features: {
			enable_public_active_users_count: false,
			enable_user_status: false
		}
	});
	const settingsStore = createStore({ highContrastMode: false });
	const i18nStore = createStore<I18nValue>({
		locale: 'en',
		t: (key: string) => key
	});

	return {
		gotoMock,
		getUsageMock,
		getSessionUserMock,
		userSignOutMock,
		updateUserStatusMock,
		showSettingsStore,
		mobileStore,
		showSidebarStore,
		showShortcutsStore,
		userStore,
		configStore,
		settingsStore,
		i18nStore
	};
});

vi.mock('$app/navigation', () => ({ goto: mocks.gotoMock }), { virtual: true });
vi.mock(
	'$lib/constants',
	() => ({
		WEBUI_API_BASE_URL: '/api/v1'
	}),
	{ virtual: true }
);
vi.mock('$lib/apis', () => ({ getUsage: mocks.getUsageMock }), { virtual: true });
vi.mock(
	'$lib/apis/auths',
	() => ({
		getSessionUser: mocks.getSessionUserMock,
		userSignOut: mocks.userSignOutMock
	}),
	{ virtual: true }
);
vi.mock('$lib/apis/users', () => ({ updateUserStatus: mocks.updateUserStatusMock }), {
	virtual: true
});
vi.mock(
	'$lib/stores',
	() => ({
		showSettings: mocks.showSettingsStore,
		mobile: mocks.mobileStore,
		showSidebar: mocks.showSidebarStore,
		showShortcuts: mocks.showShortcutsStore,
		user: mocks.userStore,
		config: mocks.configStore,
		settings: mocks.settingsStore
	}),
	{ virtual: true }
);
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }), {
	virtual: true
});

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

describe('UserMenu', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		localStorage.token = 'test-token';
		mocks.gotoMock.mockReset();
		mocks.getUsageMock.mockReset().mockResolvedValue(null);
		mocks.getSessionUserMock.mockReset().mockResolvedValue(null);
		mocks.userSignOutMock.mockReset().mockResolvedValue({ redirect_url: '/auth' });
		mocks.updateUserStatusMock.mockReset().mockResolvedValue(true);
		mocks.showSettingsStore.set(false);
		mocks.mobileStore.set(false);
		mocks.showSidebarStore.set(true);
		mocks.showShortcutsStore.set(false);
		mocks.userStore.set({
			id: 'user-1',
			name: 'Yan',
			role: 'admin',
			is_active: true
		});
		mocks.configStore.set({
			features: {
				enable_public_active_users_count: false,
				enable_user_status: false
			}
		});
		mocks.settingsStore.set({ highContrastMode: false });
		if (!Element.prototype.animate) {
			Object.defineProperty(Element.prototype, 'animate', {
				configurable: true,
				value: vi.fn(() => ({
					cancel: vi.fn(),
					finished: Promise.resolve(),
					finish: vi.fn(),
					pause: vi.fn(),
					play: vi.fn()
				}))
			});
		}
	});

	afterEach(async () => {
		if (mounted) {
			await unmount(mounted);
		}
		mounted = null;
		if (target) {
			target.remove();
		}
		target = null;
		document.body.innerHTML = '';
	});

	const renderMenu = (props: Partial<{ help: boolean; role: string }> = {}): void => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(UserMenu, {
			target,
			context: createContext(),
			props: {
				show: true,
				profile: false,
				help: false,
				showActiveUsers: false,
				role: 'admin',
				...props
			}
		});
	};

	it('opens settings when the settings item is selected', async () => {
		renderMenu();
		await flushPromises();

		const content = document.body.querySelector('.no-drag-region');
		const settingsItem = document.body.querySelector('[data-testid="user-menu-settings"]');

		expect(content).toBeTruthy();
		expect(content instanceof HTMLElement ? content.className : '').toContain('no-drag-region');
		expect(settingsItem).toBeTruthy();

		settingsItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flushPromises();

		expect(mocks.showSettingsStore.get()).toBe(true);
	});

	it('navigates to the billing dashboard when the billing item is selected', async () => {
		renderMenu();
		await flushPromises();

		const billingItem = document.body.querySelector('[data-testid="user-menu-billing"]');
		expect(billingItem).toBeTruthy();

		billingItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flushPromises();

		expect(mocks.gotoMock).toHaveBeenCalledWith('/billing/dashboard');
	});
});
