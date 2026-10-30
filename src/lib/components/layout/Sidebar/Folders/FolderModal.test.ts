// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { readable } from 'svelte/store';
import FolderModal from './FolderModal.svelte';

const api = vi.hoisted(() => ({ load: vi.fn(), submit: vi.fn(), error: vi.fn() }));
vi.mock('$lib/apis/folders', () => ({ getFolderById: api.load }));
vi.mock('svelte-sonner', () => ({ toast: { error: api.error } }));
vi.mock('$lib/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		user: readable({ role: 'user', permissions: { chat: { system_prompt: false } } }),
		config: readable({ features: {} }),
		models: readable([]),
		settings: readable({})
	};
});
vi.mock('$lib/components/workspace/Models/Knowledge.svelte', async () => ({
	default: (await import('$lib/components/common/Spinner.svelte')).default
}));
vi.mock('$lib/components/chat/ModelSelector/Selector.svelte', async () => ({
	default: (await import('$lib/components/common/Spinner.svelte')).default
}));
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));
vi.mock('$lib/utils/transitions', () => ({ flyAndScale: () => ({ duration: 0 }) }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));

type Folder = {
	name: string;
	meta: { icon: string } | null;
	data: { system_prompt: string; files: [] } | null;
};
const folder = (name: string): Folder => ({
	name,
	meta: { icon: 'grinning' },
	data: { system_prompt: 'Keep me', files: [] }
});
function deferred(): { promise: Promise<Folder | null>; resolve: (value: Folder | null) => void } {
	let resolve!: (value: Folder | null) => void;
	const promise = new Promise<Folder | null>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe('FolderModal loading', () => {
	let mounted: ReturnType<typeof createClassComponent> | null = null;
	beforeEach(() => {
		vi.resetAllMocks();
		localStorage.token = 'test-token';
		document.body.innerHTML = '';
		api.load.mockImplementation(async () => folder('Existing'));
	});
	afterEach(() => {
		vi.restoreAllMocks();
		mounted?.$destroy();
		mounted = null;
		document.body.innerHTML = '';
	});
	function mount(
		props: { folderId?: string | null; parentId?: string | null; edit?: boolean } = {}
	): void {
		const target = document.createElement('div');
		document.body.appendChild(target);
		mounted = createClassComponent({
			component: FolderModal,
			target,
			context: new Map([['i18n', readable({ t: (key: string) => key })]]),
			props: { show: true, onSubmit: api.submit, ...props }
		});
	}
	function input(): HTMLInputElement {
		const node = document.querySelector<HTMLInputElement>('#folder-name');
		if (!node) throw new Error('Folder name input missing');
		return node;
	}
	async function submit(): Promise<void> {
		document
			.querySelector('form')
			?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await tick();
	}
	async function settleLoad(): Promise<void> {
		await tick();
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
	it('blocks editing and submission until the folder loads, then preserves its data on rename', async () => {
		const pending = deferred();
		api.load.mockReturnValueOnce(pending.promise);
		mount({ folderId: 'a', edit: true });
		await tick();
		expect(input().matches(':disabled')).toBe(true);
		expect(
			document.querySelector<HTMLButtonElement>('button[type="submit"]')?.matches(':disabled')
		).toBe(true);
		await submit();
		expect(api.submit).not.toHaveBeenCalled();
		pending.resolve(folder('Existing'));
		await vi.waitFor(() => expect(input().value).toBe('Existing'));
		expect(input().matches(':disabled')).toBe(false);
		expect(document.activeElement).toBe(input());
		input().value = 'Renamed';
		input().dispatchEvent(new Event('input', { bubbles: true }));
		await submit();
		expect(api.submit).toHaveBeenCalledOnce();
		expect(api.submit).toHaveBeenCalledWith({
			name: 'Renamed',
			meta: { icon: 'grinning' },
			data: { description: '', model_ids: [], system_prompt: 'Keep me', files: [] },
			parent_id: undefined
		});
	});
	it('ignores an earlier response after the selected folder changes', async () => {
		const old = deferred();
		api.load.mockReturnValueOnce(old.promise);
		mount({ folderId: 'a', edit: true });
		await tick();
		mounted?.$set({ folderId: 'b' });
		await vi.waitFor(() => expect(api.load).toHaveBeenLastCalledWith('test-token', 'b'));
		await vi.waitFor(() => expect(input().value).toBe('Existing'));
		old.resolve(folder('Old'));
		await settleLoad();
		expect(input().value).toBe('Existing');
	});
	it('ignores an old request after Escape and reopening the same folder', async () => {
		const old = deferred();
		api.load.mockReturnValueOnce(old.promise);
		mount({ folderId: 'a', edit: true });
		await tick();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await tick();
		mounted?.$set({ show: true });
		await vi.waitFor(() => expect(input().value).toBe('Existing'));
		old.resolve(folder('Old'));
		await settleLoad();
		expect(input().value).toBe('Existing');
	});
	it.each(['null', 'rejected'])(
		'closes safely on a %s load and permits reopening',
		async (failure) => {
			if (failure === 'null') api.load.mockResolvedValueOnce(null);
			else api.load.mockRejectedValueOnce(new Error('Unavailable'));
			mount({ folderId: 'a', edit: true });
			await vi.waitFor(() => expect(api.error).toHaveBeenCalledOnce());
			expect(document.querySelector('form')).toBeNull();
			expect(api.submit).not.toHaveBeenCalled();
			mounted?.$set({ show: true });
			await vi.waitFor(() => expect(input().value).toBe('Existing'));
		}
	);
	it('does not focus a different modal when a destroyed component finishes loading', async () => {
		const old = deferred();
		api.load.mockReturnValueOnce(old.promise);
		mount({ folderId: 'a', edit: true });
		await tick();
		mounted?.$destroy();
		mounted = null;
		mount();
		await vi.waitFor(() => expect(document.activeElement).toBe(input()));
		const focus = vi.spyOn(input(), 'focus');
		old.resolve(folder('Old'));
		await settleLoad();
		expect(focus).not.toHaveBeenCalled();
		expect(api.error).not.toHaveBeenCalled();
		focus.mockRestore();
	});
	it('creates a fresh folder without a GET and preserves the current parent', async () => {
		mount({ parentId: 'parent-a' });
		await tick();
		input().value = 'Discarded';
		input().dispatchEvent(new Event('input', { bubbles: true }));
		mounted?.$set({ show: false });
		await tick();
		mounted?.$set({ show: true, parentId: 'parent-b' });
		await tick();
		expect(input().value).toBe('');
		expect(input().matches(':disabled')).toBe(false);
		input().value = 'New';
		input().dispatchEvent(new Event('input', { bubbles: true }));
		await submit();
		expect(api.load).not.toHaveBeenCalled();
		expect(api.submit).toHaveBeenCalledOnce();
		expect(api.submit).toHaveBeenCalledWith({
			name: 'New',
			meta: { background_image_url: null },
			data: { description: '', model_ids: [], system_prompt: '', files: [] },
			parent_id: 'parent-b'
		});
	});
	it.each(['false', 'rejected'])(
		'retains the draft after a %s save and permits retry',
		async (failure) => {
			if (failure === 'false') api.submit.mockResolvedValueOnce(false);
			else api.submit.mockRejectedValueOnce(new Error('Write unavailable'));
			api.submit.mockResolvedValueOnce(true);
			mount({ parentId: 'parent' });
			await tick();
			input().value = 'Unsaved draft';
			input().dispatchEvent(new Event('input', { bubbles: true }));
			await submit();
			await settleLoad();
			expect(input().value).toBe('Unsaved draft');
			expect(input().matches(':disabled')).toBe(false);
			expect(api.error).toHaveBeenCalledTimes(failure === 'rejected' ? 1 : 0);
			await submit();
			await settleLoad();
			expect(api.submit).toHaveBeenCalledTimes(2);
			expect(api.submit.mock.calls[1][0]).toEqual(api.submit.mock.calls[0][0]);
			expect(document.querySelector('form')).toBeNull();
		}
	);
	it('blocks duplicate saves while pending and ignores completion after closing and reopening', async () => {
		let resolve!: (value: boolean) => void;
		api.submit.mockReturnValueOnce(
			new Promise<boolean>((done) => {
				resolve = done;
			})
		);
		mount({ folderId: 'a', edit: true });
		await settleLoad();
		await submit();
		await submit();
		expect(api.submit).toHaveBeenCalledOnce();
		expect(input().matches(':disabled')).toBe(true);
		mounted?.$set({ show: false });
		await tick();
		mounted?.$set({ show: true, folderId: 'b' });
		await settleLoad();
		resolve(true);
		await settleLoad();
		expect(input().value).toBe('Existing');
		expect(input().matches(':disabled')).toBe(false);
	});
	const imageInput = (): HTMLInputElement => {
		const node = document.querySelector<HTMLInputElement>('#folder-background-image-input');
		if (!node) throw new Error('Background image input missing');
		return node;
	};
	async function chooseImage(file: File | null): Promise<void> {
		Object.defineProperty(imageInput(), 'files', { configurable: true, value: file ? [file] : [] });
		imageInput().dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
	}
	function holdImageRead(): FileReader[] {
		const readers: FileReader[] = [];
		vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
			readers.push(this);
		});
		return readers;
	}
	function completeRead(reader: FileReader, result: string | ArrayBuffer | null): void {
		Object.defineProperty(reader, 'result', { configurable: true, value: result });
		reader.dispatchEvent(new ProgressEvent('load'));
	}
	it('retains folder data when the image picker is canceled', async () => {
		const errors: string[] = [];
		const capture = (event: ErrorEvent): void => {
			errors.push(event.message);
			event.preventDefault();
		};
		window.addEventListener('error', capture);
		try {
			mount({ folderId: 'a', edit: true });
			await settleLoad();
			await chooseImage(null);
			await submit();
			expect(errors).toEqual([]);
			expect(api.submit.mock.calls[0][0].meta).toEqual({ icon: 'grinning' });
		} finally {
			window.removeEventListener('error', capture);
		}
	});
	it('saves a valid image together with the existing folder data', async () => {
		const readers = holdImageRead();
		mount({ folderId: 'a', edit: true });
		await settleLoad();
		await chooseImage(new File(['image'], 'background.png', { type: 'image/png' }));
		completeRead(readers[0], 'data:image/png;base64,aW1hZ2U=');
		await submit();
		expect(api.submit.mock.calls[0][0]).toMatchObject({
			meta: { icon: 'grinning', background_image_url: 'data:image/png;base64,aW1hZ2U=' },
			data: { system_prompt: 'Keep me', files: [] }
		});
	});
	it.each(['error', 'invalid-result'])(
		'reports %s without changing the folder image',
		async (failure) => {
			const readers = holdImageRead();
			mount({ folderId: 'a', edit: true });
			await settleLoad();
			await chooseImage(new File(['image'], 'background.png', { type: 'image/png' }));
			if (failure === 'error') readers[0].dispatchEvent(new ProgressEvent('error'));
			else completeRead(readers[0], null);
			await submit();
			expect(api.error).toHaveBeenCalledWith('Failed to upload file.');
			expect(api.submit.mock.calls[0][0].meta).toEqual({ icon: 'grinning' });
		}
	);
	it.each(['different-folder', 'reopen', 'destroy'])(
		'ignores a late image after %s',
		async (change) => {
			const readers = holdImageRead();
			mount({ folderId: 'a', edit: true });
			await settleLoad();
			await chooseImage(new File(['image'], 'background.png', { type: 'image/png' }));
			if (change === 'destroy') {
				mounted?.$destroy();
				mounted = null;
				mount({ folderId: 'b', edit: true });
			} else if (change === 'reopen') {
				mounted?.$set({ show: false });
				await tick();
				mounted?.$set({ show: true });
			} else mounted?.$set({ folderId: 'b' });
			await settleLoad();
			completeRead(readers[0], 'data:image/png;base64,b2xk');
			await submit();
			expect(api.submit.mock.calls[0][0].meta).toEqual({ icon: 'grinning' });
		}
	);
	it('keeps the latest selected image when reads finish out of order', async () => {
		const readers = holdImageRead();
		mount({ folderId: 'a', edit: true });
		await settleLoad();
		await chooseImage(new File(['old'], 'old.png', { type: 'image/png' }));
		await chooseImage(new File(['new'], 'new.png', { type: 'image/png' }));
		completeRead(readers[1], 'data:image/png;base64,bmV3');
		completeRead(readers[0], 'data:image/png;base64,b2xk');
		await submit();
		expect(api.submit.mock.calls[0][0].meta.background_image_url).toBe(
			'data:image/png;base64,bmV3'
		);
	});
	it('does not restore an image after Reset while reading a replacement', async () => {
		const readers = holdImageRead();
		api.load.mockResolvedValueOnce({
			...folder('Existing'),
			meta: { icon: 'grinning', background_image_url: 'old.png' }
		});
		mount({ folderId: 'a', edit: true });
		await settleLoad();
		await chooseImage(new File(['image'], 'new.png', { type: 'image/png' }));
		const reset = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Reset'
		);
		if (!reset) throw new Error('Reset missing');
		reset.click();
		await tick();
		completeRead(readers[0], 'data:image/png;base64,bmV3');
		await submit();
		expect(api.submit.mock.calls[0][0].meta.background_image_url).toBeNull();
	});
	it('opens Upload for a folder whose image field is absent', async () => {
		mount({ folderId: 'a', edit: true });
		await settleLoad();
		const click = vi.spyOn(imageInput(), 'click');
		const upload = [...document.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Upload'
		);
		if (!upload) throw new Error('Upload missing');
		upload.click();
		expect(click).toHaveBeenCalledOnce();
	});
});
