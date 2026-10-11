// @vitest-environment jsdom
import { tick } from 'svelte';
import { createClassComponent } from 'svelte/legacy';
import { expect, it, vi } from 'vitest';
import Loader from '../src/lib/components/common/Loader.svelte';

it('keeps one visible timer and releases it when hidden or destroyed', async () => {
	vi.useFakeTimers();
	let report: (visible: boolean) => void = () => {};
	const observe = vi.fn();
	const disconnect = vi.fn();
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe = observe;
			disconnect = disconnect;
			constructor(
				callback: (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void
			) {
				report = (visible) => callback([{ isIntersecting: visible }]);
			}
		}
	);
	const target = document.createElement('div');
	document.body.append(target);
	const component = createClassComponent({ component: Loader, target });
	const visible = vi.fn();
	let remainingTimers = 0;
	component.$on('visible', visible);
	try {
		await tick();
		expect(observe).toHaveBeenCalledWith(target.firstElementChild);
		report(true);
		report(true);
		vi.advanceTimersByTime(100);
		expect(visible).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(1);
		report(false);
		vi.advanceTimersByTime(200);
		expect(visible).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		report(true);
		vi.advanceTimersByTime(100);
		expect(visible).toHaveBeenCalledTimes(2);
	} finally {
		component.$destroy();
		remainingTimers = vi.getTimerCount();
		target.remove();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	}
	expect(disconnect).toHaveBeenCalledOnce();
	expect(remainingTimers).toBe(0);
});
