// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const initializer = (path: string, name: string): string => {
	const file = readFileSync(path, 'utf8');
	const source = ts.createSourceFile(
		path,
		file.includes('<script lang="ts">')
			? file.split('<script lang="ts">')[1].split('</script>')[0]
			: file,
		ts.ScriptTarget.Latest
	);
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const declaration = statement.declarationList.declarations.find(
			(item) => item.name.getText(source) === name
		);
		if (declaration?.initializer) return declaration.initializer.getText(source);
	}
	throw new Error(`Missing ${name} in ${path}`);
};

const setup = (fetch: typeof globalThis.fetch, title: string = 'Исходный заголовок') => {
	const note = { title, data: { content: { md: 'Текст заметки', html: '<p>Текст заметки</p>' } } };
	const context = {
		note,
		titleGenerating: false,
		selectedModelId: 'test-model',
		localStorage: { token: 'test-token' },
		WEBUI_BASE_URL: '',
		fetch,
		enhanceOpenAIChatCompletionBody: (body: object): object => body,
		toast: { error: vi.fn() },
		$i18n: { t: (text: string): string => text },
		console: { error: vi.fn() },
		tick: vi.fn().mockResolvedValue(undefined),
		changeDebounceHandler: vi.fn()
	};
	const code = `const generateOpenAIChatCompletion = ${initializer('src/lib/apis/openai/index.ts', 'generateOpenAIChatCompletion')}; (${initializer('src/lib/components/notes/NoteEditor.svelte', 'generateTitleHandler')})`;
	const handler = runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	) as () => Promise<void>;
	return { context, handler };
};

it.each(['network', 'quota', 'invalid-json'])(
	'restores editing and preserves note after %s failure',
	async (failure) => {
		const fetch = vi
			.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
			.mockImplementation(async () => {
				if (failure === 'network') throw new TypeError('Failed to fetch');
				if (failure === 'quota')
					return new Response(JSON.stringify({ detail: 'Quota exceeded' }), { status: 403 });
				return new Response(JSON.stringify({ choices: [{ message: { content: '{invalid}' } }] }));
			});
		const { context, handler } = setup(fetch);
		const before = structuredClone(context.note);
		await expect(handler()).resolves.toBeUndefined();
		expect(context.note).toEqual(before);
		expect(context.titleGenerating).toBe(false);
		expect(context.toast.error).toHaveBeenCalledOnce();
	}
);

it('keeps title while awaiting the model, then saves the trimmed title', async () => {
	let resolve!: (response: Response) => void;
	const fetch = vi
		.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
		.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
	const { context, handler } = setup(fetch);
	const pending = handler();
	expect(context.titleGenerating).toBe(true);
	expect(context.note.title).toBe('Исходный заголовок');
	resolve(
		new Response(
			JSON.stringify({ choices: [{ message: { content: '{"title":" Новый заголовок "}' } }] })
		)
	);
	await pending;
	expect(context.note.title).toBe('Новый заголовок');
	expect(context.note.data.content.md).toBe('Текст заметки');
	expect(context.titleGenerating).toBe(false);
	expect(context.changeDebounceHandler).toHaveBeenCalledOnce();
});

it('ignores a second click and a late response after changing notes', async () => {
	let resolve!: (response: Response) => void;
	const fetch = vi
		.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
		.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
	const { context, handler } = setup(fetch);
	const original = context.note;
	const pending = handler();
	await handler();
	expect(fetch).toHaveBeenCalledOnce();
	context.note = {
		title: 'Другая заметка',
		data: { content: { md: 'Другой текст', html: '<p>Другой текст</p>' } }
	};
	const before = structuredClone(context.note);
	resolve(
		new Response(
			JSON.stringify({ choices: [{ message: { content: '{"title":"Поздний ответ"}' } }] })
		)
	);
	await pending;
	expect(context.note).toEqual(before);
	expect(original.title).toBe('Исходный заголовок');
	expect(context.titleGenerating).toBe(false);
	expect(context.changeDebounceHandler).not.toHaveBeenCalled();
});

it('allows retry after a rejected request', async () => {
	const fetch = vi
		.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
		.mockRejectedValueOnce(new TypeError('Failed to fetch'))
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ choices: [{ message: { content: '{"title":"После повтора"}' } }] })
			)
		);
	const { context, handler } = setup(fetch);
	await handler();
	expect(context.titleGenerating).toBe(false);
	expect(context.changeDebounceHandler).not.toHaveBeenCalled();
	await handler();
	expect(context.note.title).toBe('После повтора');
	expect(context.titleGenerating).toBe(false);
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(context.changeDebounceHandler).toHaveBeenCalledOnce();
});

it('preserves a title updated by collaboration when the model returns whitespace', async () => {
	let resolve!: (response: Response) => void;
	const fetch = vi
		.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
		.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
	const { context, handler } = setup(fetch);
	const pending = handler();
	context.note.title = 'Совместное изменение';
	resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{"title":"   "}' } }] })));
	await pending;
	expect(context.note.title).toBe('Совместное изменение');
	expect(context.titleGenerating).toBe(false);
});

it.each(['', '{}', '{"title":"   "}', '{"title":123}'])(
	'preserves title for an unusable response %s',
	async (content) => {
		const fetch = vi
			.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
			.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] })));
		const { context, handler } = setup(fetch);
		await handler();
		expect(context.note.title).toBe('Исходный заголовок');
		expect(context.titleGenerating).toBe(false);
	}
);

it.each(['png', 'heic', 'conversion-error', 'read-error', 'compression-error', 'array-error'])(
	'settles image upload for %s without adding failed files',
	async (mode) => {
		class ImageReader {
			onload: ((event: { target: { result: string } }) => Promise<void>) | null = null;
			onerror: (() => void) | null = null;
			error = new Error('Read failed');
			readAsDataURL(): void {
				if (mode === 'read-error') this.onerror?.();
				else void this.onload?.({ target: { result: 'data:image/png;base64,TEST' } });
			}
		}
		const converted = new File(['image'], 'converted.jpg', { type: 'image/jpeg' });
		const context = {
			id: 'A',
			loadGeneration: 1,
			destroyed: false,
			localStorage: { token: 'test' },
			FileReader: ImageReader,
			console: { log: vi.fn() },
			$config: {},
			$settings: {},
			$i18n: { t: (text: string): string => text },
			toast: { error: vi.fn() },
			uuidv4: (): string => 'image-id',
			files: [] as { id: string; type: string; url: string }[],
			note: { id: 'A', data: { files: [] as { id: string; type: string; url: string }[] } },
			editor: { storage: { files: [] as { id: string; type: string; url: string }[] } },
			changeDebounceHandler: vi.fn(),
			convertHeicToJpeg: vi.fn().mockImplementation(async (): Promise<Blob | Blob[]> => {
				if (mode === 'conversion-error') throw new Error('Conversion failed');
				return mode === 'array-error' ? [converted] : converted;
			}),
			compressImageHandler: vi.fn().mockImplementation(async (url: string): Promise<string> => {
				if (mode === 'compression-error') throw new Error('Compression failed');
				return url;
			})
		};
		const code = `(${initializer('src/lib/components/notes/NoteEditor.svelte', 'inputFileHandler')})`;
		const handler = runInNewContext(
			ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
			context
		) as (file: File) => Promise<unknown>;
		const file = new File(['image'], 'image', {
			type:
				mode === 'heic' || mode === 'conversion-error' || mode === 'array-error'
					? 'image/heic'
					: 'image/png'
		});
		const pending = handler(file);
		if (mode.endsWith('-error')) {
			await expect(pending).rejects.toThrow();
			expect(context.files).toEqual([]);
			expect(context.note.data.files).toEqual([]);
			expect(context.changeDebounceHandler).not.toHaveBeenCalled();
		} else {
			const expected = { id: 'image-id', type: 'image', url: 'data:image/png;base64,TEST' };
			await expect(pending).resolves.toEqual(expected);
			expect(context.files).toEqual([expected]);
			expect(context.note.data.files).toEqual([expected]);
			expect(context.editor.storage.files).toEqual([expected]);
			expect(context.changeDebounceHandler).toHaveBeenCalledOnce();
		}
	}
);

it.each(['upload', 'lookup'])(
	'does not attach a late %s result to a different note',
	async (stage) => {
		let done!: (value: object) => void;
		const waiting = new Promise<object>((resolve) => {
			done = resolve;
		});
		const original = { id: 'A', data: { files: [] } };
		const replacement = { id: 'B', data: { files: [] } };
		const context = {
			note: original,
			id: 'A',
			files: [] as object[],
			editor: { storage: { files: [] } },
			loadGeneration: 1,
			destroyed: false,
			localStorage: { token: 'test' },
			uuidv4: () => 'temp',
			$settings: {},
			console: { log: vi.fn(), warn: vi.fn() },
			$i18n: { t: (s: string) => s },
			toast: { error: vi.fn(), warning: vi.fn() },
			changeDebounceHandler: vi.fn(),
			uploadFile: vi
				.fn()
				.mockImplementation(() => (stage === 'upload' ? waiting : Promise.resolve({ id: 'file' }))),
			getFileById: vi.fn().mockImplementation(() => waiting)
		};
		const handler = runInNewContext(
			ts.transpileModule(
				`(${initializer('src/lib/components/notes/NoteEditor.svelte', 'uploadFileHandler')})`,
				{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
			).outputText,
			context
		) as (f: File) => Promise<unknown>;
		const pending = handler(new File(['content'], 'test.txt'));
		for (let n = 0; n < 10; n++) await Promise.resolve();
		context.note = replacement;
		context.id = 'B';
		context.files = [];
		context.loadGeneration++;
		done({ id: 'file' });
		await pending;
		expect(replacement.data.files).toEqual([]);
		expect(context.files).toEqual([]);
		expect(context.changeDebounceHandler).not.toHaveBeenCalled();
	}
);

it.each(['note', 'session', 'destroyed', 'reload'])(
	'discards a late image after %s changes',
	async (mode) => {
		let done!: (value: string) => void;
		const waiting = new Promise<string>((resolve) => {
			done = resolve;
		});
		class Reader {
			onload: ((event: { target: { result: string } }) => Promise<void>) | null = null;
			readAsDataURL(): void {
				void this.onload?.({ target: { result: 'data:image/png;base64,TEST' } });
			}
		}
		const original = { id: 'A', data: { files: [] } };
		const context = {
			note: original,
			id: 'A',
			files: [] as object[],
			loadGeneration: 1,
			destroyed: false,
			localStorage: { token: 'test' },
			FileReader: Reader,
			console: { log: vi.fn() },
			$settings: {},
			$config: {},
			uuidv4: () => 'image',
			editor: { storage: { files: [] } },
			changeDebounceHandler: vi.fn(),
			compressImageHandler: vi.fn().mockImplementation(() => waiting)
		};
		const handler = runInNewContext(
			ts.transpileModule(
				`(${initializer('src/lib/components/notes/NoteEditor.svelte', 'inputFileHandler')})`,
				{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
			).outputText,
			context
		) as (f: File) => Promise<unknown>;
		const pending = handler(new File(['image'], 'test.png', { type: 'image/png' }));
		if (mode === 'note') {
			context.note = { id: 'B', data: { files: [] } };
			context.id = 'B';
			context.files = [];
		}
		if (mode === 'session') context.localStorage.token = 'other';
		if (mode === 'destroyed') context.destroyed = true;
		if (mode === 'reload') context.loadGeneration++;
		done('data:image/png;base64,TEST');
		await pending;
		expect(context.files).toEqual([]);
		expect(context.note.data.files).toEqual([]);
		expect(context.changeDebounceHandler).not.toHaveBeenCalled();
	}
);
