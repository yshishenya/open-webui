// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
import Photo from '$lib/components/chat/Settings/Account/UserProfileImage.svelte';
const api = vi.hoisted(() => ({ gravatar: vi.fn(), error: vi.fn() }));
vi.mock('$lib/apis/utils', () => ({ getGravatarUrl: api.gravatar }));
vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: '' }));
vi.mock('$lib/utils', () => ({
	canvasPixelTest: () => true,
	generateInitialsImage: () => '/initials.png'
}));
vi.mock('svelte-sonner', () => ({ toast: { error: api.error, info: vi.fn() } }));
let readers: Reader[] = [];
let images: DecodedImage[] = [];
class Reader {
	result: string | null = 'data:image/png;fixture';
	readyState = 1;
	aborted = false;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor() {
		readers.push(this);
	}
	readAsDataURL(): void {}
	abort(): void {
		this.aborted = true;
		this.readyState = 2;
	}
	finish(): void {
		this.readyState = 2;
		this.onload?.();
	}
}
class DecodedImage {
	width = 500;
	height = 250;
	src = '';
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor() {
		images.push(this);
	}
	finish(): void {
		this.onload?.();
	}
}
beforeEach(() => {
	readers = [];
	images = [];
	vi.clearAllMocks();
	vi.stubGlobal('FileReader', Reader);
	vi.stubGlobal('Image', DecodedImage);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		drawImage: vi.fn()
	} as unknown as CanvasRenderingContext2D);
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;new');
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
async function context(): Promise<Map<string, object>> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}
async function photo(variant = 'default') {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Photo, {
		target,
		context: await context(),
		props: {
			profileImageUrl: '/cached.png',
			user: { id: 'user', name: 'Name', email: 'user@example.test' },
			variant
		}
	});
	await tick();
	const button = (text: string): HTMLButtonElement => {
		const b = [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
		if (!b) throw Error('Missing ' + text);
		return b;
	};
	const select = (): void => {
		const input = target.querySelector('input')!;
		Object.defineProperty(input, 'files', {
			value: [new File(['fixture'], 'photo.png', { type: 'image/png' })],
			configurable: true
		});
		input.dispatchEvent(new Event('change', { bubbles: true }));
	};
	return {
		target,
		component,
		button,
		select,
		src: () => target.querySelector('img')?.getAttribute('src'),
		close: async () => {
			await unmount(component);
			target.remove();
		}
	};
}
it('forwards explicit native input label and preserves password/autofill/form behavior', async () => {
	const target = document.createElement('form');
	document.body.append(target);
	const submit = vi.fn();
	target.addEventListener('submit', submit);
	const component = mount(SensitiveInput, {
		target,
		context: await context(),
		props: {
			id: 'password',
			name: 'password',
			type: 'password',
			value: 'secret',
			autocomplete: 'new-password',
			ariaLabel: 'New Password',
			placeholder: 'Enter Password'
		}
	});
	try {
		const input = target.querySelector('input')!;
		expect(input.getAttribute('aria-label')).toBe('New Password');
		expect(input.autocomplete).toBe('new-password');
		expect(input.required).toBe(true);
		expect(input.name).toBe('password');
		target.querySelector('button')?.click();
		await tick();
		expect(input.type).toBe('text');
		expect(input.value).toBe('secret');
		expect(submit).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
		target.remove();
	}
});
it('preserves disabled read-only and settings field semantics', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(SensitiveInput, {
		target,
		context: await context(),
		props: { readOnly: true, variant: 'settings', value: 'token', required: true }
	});
	try {
		const input = target.querySelector('input')!;
		expect(input.disabled).toBe(true);
		expect(input.required).toBe(false);
		expect(target.querySelector('label')?.getAttribute('for')).toBe(input.id);
		target.querySelector('button')?.click();
		await tick();
		expect(input.value).toBe('token');
		expect(target.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
	} finally {
		await unmount(component);
		target.remove();
	}
});
it.each(['default', 'account'])('%s ignores a late Gravatar after Remove', async (variant) => {
	let resolve: ((url: string) => void) | undefined;
	api.gravatar.mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	const s = await photo(variant);
	try {
		s.button('Gravatar').click();
		await tick();
		s.button('Remove').click();
		await tick();
		resolve?.('/late.png');
		await tick();
		await tick();
		expect(s.src()).toBe('/user.png');
		expect(api.gravatar.mock.calls[0][2]?.aborted).toBe(true);
		expect(api.error).not.toHaveBeenCalled();
	} finally {
		await s.close();
	}
});
it('ignores a late decoded upload after Remove', async () => {
	const s = await photo();
	try {
		s.select();
		readers[0].finish();
		s.button('Remove').click();
		await tick();
		images[0].finish();
		await tick();
		expect(s.src()).toBe('/user.png');
	} finally {
		await s.close();
	}
});
it('accepts only the newest selected upload', async () => {
	const s = await photo();
	try {
		s.select();
		s.select();
		readers[1].finish();
		images[0].finish();
		await tick();
		readers[0].finish();
		expect(images).toHaveLength(1);
		expect(s.src()).toBe('data:image/webp;new');
		expect(readers[0].aborted).toBe(true);
	} finally {
		await s.close();
	}
});
it('reports read failure while preserving the previous photo', async () => {
	const s = await photo();
	try {
		s.select();
		readers[0].onerror?.();
		await tick();
		expect(api.error).toHaveBeenCalledOnce();
		expect(s.src()).toBe('/cached.png');
	} finally {
		await s.close();
	}
});
it('contains canvas export failure without replacing the photo', async () => {
	const s = await photo();
	try {
		s.select();
		readers[0].finish();
		vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementationOnce(() => {
			throw Error('private');
		});
		expect(() => images[0].finish()).not.toThrow();
		await tick();
		expect(api.error).toHaveBeenCalledOnce();
		expect(JSON.stringify(api.error.mock.calls)).not.toContain('private');
		expect(s.src()).toBe('/cached.png');
	} finally {
		await s.close();
	}
});
it('aborts the file read on unmount and does not start stale decoding', async () => {
	const s = await photo();
	s.select();
	await s.close();
	expect(readers[0].aborted).toBe(true);
	readers[0].finish();
	expect(images).toHaveLength(0);
	expect(api.error).not.toHaveBeenCalled();
});

it.each(['default', 'account'])(
	'%s accepts Gravatar and preserves the photo on refusal',
	async (variant) => {
		const s = await photo(variant);
		try {
			api.gravatar.mockResolvedValueOnce('/gravatar.png');
			s.button('Gravatar').click();
			await tick();
			await tick();
			await vi.waitFor(() => expect(s.src()).toBe('/gravatar.png'));
			api.gravatar.mockRejectedValueOnce(Error('private'));
			s.button('Gravatar').click();
			await tick();
			await tick();
			await vi.waitFor(() => expect(s.src()).toBe('/gravatar.png'));
			expect(api.error).toHaveBeenCalledOnce();
			expect(JSON.stringify(api.error.mock.calls)).not.toContain('private');
		} finally {
			await s.close();
		}
	}
);
