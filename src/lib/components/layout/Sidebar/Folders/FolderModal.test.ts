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
		config: readable({ features: {} })
	};
});
vi.mock('$lib/components/workspace/Models/Knowledge.svelte', async () => ({
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
		api.load.mockResolvedValue(folder('Existing'));
	});
	afterEach(() => {
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
			data: { system_prompt: 'Keep me', files: [] },
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
			data: { system_prompt: '', files: [] },
			parent_id: 'parent-b'
		});
	});
});
