// @vitest-environment jsdom
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { beforeEach, expect, it, vi } from 'vitest';
import NotificationToast from '$lib/components/NotificationToast.svelte';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('$lib/stores', () => ({
	settings: writable({ notificationSound: false }),
	playingNotificationSound: writable(false),
	isLastActiveTab: writable(true)
}));
beforeEach(() => {
	Object.defineProperty(navigator, 'userActivation', {
		configurable: true,
		value: { hasBeenActive: false }
	});
});

async function withToast(
	check: (
		root: HTMLElement,
		onClick: ReturnType<typeof vi.fn>,
		close: ReturnType<typeof vi.fn>
	) => void | Promise<void>,
	content = '**Ready** [Link](https://example.test)'
): Promise<void> {
	const target = document.createElement('div');
	document.body.append(target);
	const onClick = vi.fn(),
		close = vi.fn();
	const component = mount(NotificationToast, {
		target,
		context: new Map([['i18n', writable({ t: (text: string) => text })]]),
		props: { title: '', content, onClick },
		events: { closeToast: close }
	});
	try {
		await tick();
		const root = target.querySelector<HTMLElement>('[role="status"]')!;
		Object.assign(root, {
			setPointerCapture: vi.fn(),
			releasePointerCapture: vi.fn(),
			hasPointerCapture: () => true
		});
		await check(root, onClick, close);
	} finally {
		await unmount(component);
		target.remove();
	}
}
function pointer(
	target: Element,
	type: string,
	values: Partial<{
		pointerId: number;
		clientX: number;
		clientY: number;
		button: number;
		isPrimary: boolean;
	}> = {}
): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, {
		pointerId: 1,
		clientX: 0,
		clientY: 0,
		button: 0,
		isPrimary: true,
		...values
	});
	target.dispatchEvent(event);
}

it.each(['Enter', ' '])('dismisses with %s without opening the notification', async (key) => {
	await withToast((root, open, close) => {
		const button = root.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!;
		button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		button.click();
		expect(open).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
	});
});
it('does not capture or open a dismiss pointer gesture', async () => {
	await withToast((root, open, close) => {
		const button = root.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!;
		pointer(button, 'pointerdown');
		// Pointer capture would retarget the release to the root.
		pointer(root, 'pointerup');
		button.click();
		expect(root.setPointerCapture).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
	});
});
it.each(['keyboard', 'pointer', 'drag'])('uses the native open button for %s', async (mode) => {
	await withToast((root, open, close) => {
		const button = root.querySelector<HTMLButtonElement>('[aria-label="Open notification"]')!;
		expect(button?.type).toBe('button');
		expect(button?.tabIndex).toBe(0);
		if (mode === 'keyboard') button.click();
		else {
			pointer(button, 'pointerdown');
			if (mode === 'drag') pointer(root, 'pointermove', { clientX: 7 });
			pointer(root, 'pointerup');
			button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		}
		expect(open).toHaveBeenCalledTimes(mode === 'drag' ? 0 : 1);
		expect(close).toHaveBeenCalledTimes(mode === 'drag' ? 0 : 1);
		expect(root.getAttribute('aria-live')).toBe('polite');
	});
});
it.each([6, 7])('keeps the drag threshold at 6px: %s', async (distance) => {
	await withToast((root, open, close) => {
		pointer(root, 'pointerdown');
		pointer(root, 'pointermove', { clientX: distance });
		pointer(root, 'pointerup', { clientX: distance });
		expect(open).toHaveBeenCalledTimes(distance === 6 ? 1 : 0);
		expect(close).toHaveBeenCalledTimes(distance === 6 ? 1 : 0);
	});
});
it.each(['without-down', 'right-button', 'secondary-pointer', 'other-id', 'cancelled'])(
	'ignores %s releases',
	async (mode) => {
		await withToast((root, open) => {
			const values =
				mode === 'right-button'
					? { button: 2 }
					: mode === 'secondary-pointer'
						? { isPrimary: false }
						: {};
			if (mode !== 'without-down') pointer(root, 'pointerdown', values);
			if (mode === 'cancelled') pointer(root, 'pointercancel');
			pointer(root, 'pointerup', mode === 'other-id' ? { pointerId: 2 } : values);
			expect(open).not.toHaveBeenCalled();
		});
	}
);
it('keeps markdown links independent of notification navigation', async () => {
	await withToast((root, open) => {
		const link = root.querySelector('a')!;
		expect(link.href).toBe('https://example.test/');
		expect(root.querySelector('strong')?.textContent).toBe('Ready');
		pointer(link, 'pointerdown');
		pointer(link, 'pointerup');
		expect(root.setPointerCapture).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();
	});
});

it('keeps sanitization before and after markdown parsing', async () => {
	await withToast((root) => {
		expect(root.querySelector('strong')?.textContent).toBe('Safe');
		expect(
			root.querySelector('script, img[src="x"], [onerror], a[href^="javascript:"]')
		).toBeNull();
	}, '**Safe** <script>bad()</script><img src=x onerror="bad()"> [Bad](javascript:bad())');
});

it('recovers after lost capture or cancellation', async () => {
	await withToast((root, open) => {
		for (const cancel of ['lostpointercapture', 'pointercancel']) {
			open.mockClear();
			pointer(root, 'pointerdown');
			pointer(root, cancel);
			pointer(root, 'pointerup');
			expect(open).not.toHaveBeenCalled();
			pointer(root, 'pointerdown');
			pointer(root, 'pointerup');
			expect(open).toHaveBeenCalledOnce();
		}
	});
});

it('ignores lost capture bubbling from a child', async () => {
	await withToast((root, open) => {
		pointer(root, 'pointerdown');
		pointer(root.querySelector('[aria-label="Open notification"]')!, 'lostpointercapture');
		pointer(root, 'pointerup');
		expect(open).toHaveBeenCalledOnce();
	});
});
