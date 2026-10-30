// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import PDFViewer from './PDFViewer.svelte';
import { readable } from 'svelte/store';

const mocks = vi.hoisted(() => ({
	getDocument: vi.fn(),
	panzoom: vi.fn()
}));
vi.mock('pdfjs-dist', () => ({
	GlobalWorkerOptions: {},
	getDocument: mocks.getDocument,
	TextLayer: class {
		render = vi.fn().mockResolvedValue(undefined);
		cancel = vi.fn();
	}
}));
vi.mock('panzoom', () => ({ default: mocks.panzoom }));

beforeEach(() => {
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn()
	});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			disconnect(): void {}
		}
	);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
} {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

function start(props: { data?: Uint8Array; url?: string }): {
	component: ReturnType<typeof mount>;
	target: HTMLDivElement;
} {
	const target = document.createElement('div');
	document.body.append(target);
	return {
		component: mount(PDFViewer, {
			target,
			props,
			context: new Map([['i18n', readable({ t: (value: string) => value })]])
		}),
		target
	};
}

it('destroys the loading task when the viewer closes before the PDF is ready', async () => {
	const loaded = deferred<{
		numPages: number;
		getPage: ReturnType<typeof vi.fn>;
		destroy: ReturnType<typeof vi.fn>;
	}>();
	const destroy = vi.fn().mockResolvedValue(undefined);
	mocks.getDocument.mockReturnValue({ promise: loaded.promise, destroy });
	const { component } = start({ data: new Uint8Array([1]) });
	await vi.waitFor(() => expect(mocks.getDocument).toHaveBeenCalled());
	await unmount(component);
	expect(destroy).toHaveBeenCalledOnce();
	const getPage = vi.fn();
	loaded.resolve({ numPages: 1, getPage, destroy });
	await Promise.resolve();
	expect(getPage).not.toHaveBeenCalled();
});

it('aborts authenticated fetching on close and never starts a late PDF load', async () => {
	mocks.getDocument.mockClear();
	const response = deferred<Response>();
	const fetchPdf = vi.fn().mockReturnValue(response.promise);
	vi.stubGlobal('fetch', fetchPdf);
	const { component } = start({ url: '/api/v1/files/id/content' });
	await vi.waitFor(() => expect(fetchPdf).toHaveBeenCalledOnce());
	const options = fetchPdf.mock.calls[0][1] as RequestInit;
	expect(options.credentials).toBe('include');
	await unmount(component);
	expect(options.signal?.aborted).toBe(true);
	response.resolve(new Response(new Uint8Array([1])));
	await Promise.resolve();
	await Promise.resolve();
	expect(mocks.getDocument).not.toHaveBeenCalled();
});

it('cancels the pending canvas render before a newer zoom and on close', async () => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		{} as CanvasRenderingContext2D
	);
	let zoom = (): void => {};
	let scale = 1;
	mocks.panzoom.mockReturnValue({
		dispose: vi.fn(),
		on: (_event: string, callback: () => void): void => {
			zoom = callback;
		},
		getTransform: () => ({ scale }),
		zoomTo: (): void => {
			scale *= 1.25;
			zoom();
		}
	});
	const second = deferred<void>();
	const third = deferred<void>();
	const cancelSecond = vi.fn(() => second.reject(new Error('cancelled')));
	const cancelThird = vi.fn(() => third.reject(new Error('cancelled')));
	const render = vi
		.fn()
		.mockReturnValueOnce({ promise: Promise.resolve(), cancel: vi.fn() })
		.mockReturnValueOnce({ promise: second.promise, cancel: cancelSecond })
		.mockReturnValueOnce({ promise: third.promise, cancel: cancelThird });
	const page = {
		getViewport: ({ scale }: { scale: number }) => ({
			width: 100 * scale,
			height: 100 * scale,
			scale
		}),
		render,
		getTextContent: vi.fn().mockResolvedValue({ items: [] })
	};
	const destroy = vi.fn().mockResolvedValue(undefined);
	mocks.getDocument.mockReturnValue({
		promise: Promise.resolve({ numPages: 1, getPage: vi.fn().mockResolvedValue(page), destroy }),
		destroy
	});
	const { component, target } = start({ data: new Uint8Array([1]) });
	try {
		await vi.waitFor(() => expect(target.querySelector('[aria-label="Zoom in"]')).not.toBeNull());
		target.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2));
		target.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(3));
		expect(cancelSecond).toHaveBeenCalledOnce();
	} finally {
		await unmount(component);
		third.resolve();
		second.resolve();
	}
	expect(cancelThird).toHaveBeenCalledOnce();
	expect(destroy).toHaveBeenCalledOnce();
});
