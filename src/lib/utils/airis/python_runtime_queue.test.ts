import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const deferred = () => {
	let resolve!: () => void;
	return {
		promise: new Promise<void>((yes) => {
			resolve = yes;
		}),
		resolve: () => resolve()
	};
};
const flush = async (): Promise<void> => {
	for (let i = 0; i < 40; i++) await Promise.resolve();
};
type Reply = {
	id: string;
	type?: string;
	result?: unknown;
	stdout?: string;
	stderr?: string;
	error?: string;
	success?: boolean;
	data?: ArrayBuffer;
};

function setup(mode: string) {
	const replies: Reply[] = [],
		calls: string[] = [],
		failures: unknown[] = [];
	let streams!: { stdout: (text: string) => void; stderr: (text: string) => void };
	const writes = vi.fn(),
		readDir = vi.fn(() => [] as string[]),
		unlink = vi.fn();
	const sync = vi.fn<[boolean, (error?: Error) => void], void>((populate, done) => {
		done();
	});
	const fs = {
		mkdirTree: vi.fn(),
		mount: vi.fn(),
		stat: vi.fn(() => ({ mode: 0, size: 0 })),
		filesystems: { IDBFS: {} },
		syncfs: sync,
		writeFile: writes,
		readdir: readDir,
		readFile: vi.fn(() => new Uint8Array([1, 2])),
		isDir: () => false,
		unlink,
		rmdir: vi.fn()
	};
	const install = vi.fn<[string[]], Promise<void>>(async () => {});
	const run = vi.fn<[string], Promise<unknown>>(async (code) => {
		calls.push(code);
		streams.stdout(code);
		return code;
	});
	const load = vi.fn(async (options: typeof streams) => {
		streams = options;
		return { FS: fs, pyimport: () => ({ install }), runPythonAsync: run };
	});
	let handler!: (event: { source: object; data: Record<string, unknown> }) => Promise<void> | void;
	const parent = {
		postMessage: (data: Reply): void => {
			replies.push(data);
		}
	};
	const self = { postMessage: parent.postMessage, onmessage: handler };
	const log = vi.fn();
	const context = {
		self,
		parent,
		loadPyodide: load,
		Uint8Array,
		ArrayBuffer,
		Error,
		console: { log, error: log, warn: log },
		window: {
			addEventListener: (name: string, callback: typeof handler): void => {
				handler = callback;
			}
		}
	};
	if (mode === 'native') {
		const source = readFileSync(
			process.env.AIRIS_NATIVE_RUNTIME_SOURCE ?? 'src/lib/workers/pyodide.worker.ts',
			'utf8'
		);
		const ast = ts.createSourceFile('worker.ts', source, ts.ScriptTarget.Latest, true);
		const nodes = ast.statements.filter(
			(s) => !ts.isImportDeclaration(s) && !ts.isExportAssignment(s) && !ts.isModuleDeclaration(s)
		);
		const script = ts
			.createPrinter()
			.printList(ts.ListFormat.MultiLine, ts.factory.createNodeArray(nodes), ast);
		runInNewContext(
			ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
				.outputText,
			context
		);
		handler = (event) => self.onmessage(event);
	} else {
		const source = readFileSync(
			process.env.AIRIS_SANDBOX_RUNTIME_SOURCE ?? 'src/lib/pyodide/pyodideSandboxHost.ts',
			'utf8'
		);
		const ast = ts.createSourceFile('sandbox.ts', source, ts.ScriptTarget.Latest, true);
		const script = ast.statements.find(
			(s) =>
				ts.isVariableStatement(s) &&
				s.declarationList.declarations.some((d) => d.name.getText(ast) === 'sandboxScript')
		);
		if (!script) throw new Error('Missing actual sandbox script');
		const text = runInNewContext(script.getText(ast) + '\nsandboxScript', {}) as string;
		runInNewContext(text, context);
	}
	const submit = (data: Record<string, unknown>): Promise<void> =>
		Promise.resolve(handler({ source: parent, data })).catch((error: unknown) => {
			failures.push(error);
		});
	return {
		replies,
		calls,
		submit,
		run,
		load,
		fs,
		install,
		sync,
		failures,
		log,
		streams: () => streams
	};
}

it.each(['native', 'sandbox'])(
	'%s keeps stdout/stderr and ordering per execution',
	async (mode) => {
		const r = setup(mode),
			first = deferred();
		r.run.mockImplementation(async (code) => {
			r.calls.push(code);
			r.streams().stdout(code);
			r.streams().stderr(code + '-stderr');
			if (code === 'first') await first.promise;
			return code;
		});
		const a = r.submit({ id: 'a', code: 'first', packages: [] });
		await flush();
		const b = r.submit({ id: 'b', code: 'second', packages: [] });
		await flush();
		first.resolve();
		await Promise.all([a, b]);
		await flush();
		expect(r.replies).toEqual([
			{ id: 'a', stdout: 'first\n', stderr: 'first-stderr\n', result: 'first' },
			{ id: 'b', stdout: 'second\n', stderr: 'second-stderr\n', result: 'second' }
		]);
		expect(r.failures).toEqual([]);
	}
);

it.each(['native', 'sandbox'])(
	'%s queues filesystem operations behind running code',
	async (mode) => {
		const r = setup(mode),
			first = deferred();
		r.run.mockImplementationOnce(async () => {
			await first.promise;
			return 0;
		});
		const a = r.submit({ id: 'a', type: 'execute', code: 'waiting' });
		await flush();
		const b = r.submit({ id: 'b', type: 'fs:list', path: '/mnt/uploads' });
		await flush();
		const calledEarly = r.fs.readdir.mock.calls.length;
		first.resolve();
		await Promise.all([a, b]);
		await flush();
		expect(calledEarly).toBe(0);
		expect(r.replies.map((row) => row.id)).toEqual(['a', 'b']);
	}
);

it.each(['native', 'sandbox'])(
	'%s reports bootstrap failure and accepts a later fresh request',
	async (mode) => {
		const r = setup(mode);
		r.load.mockRejectedValueOnce(new Error('private runtime credential'));
		await r.submit({ id: 'bad', type: 'fs:list', path: '/' });
		await flush();
		await r.submit({ id: 'next', code: 'recovered' });
		await flush();
		expect(r.failures).toEqual([]);
		expect(r.replies[0]).toMatchObject({
			id: 'bad',
			type: 'fs:list',
			success: false,
			error: expect.any(String)
		});
		expect(r.replies[1]).toMatchObject({ id: 'next', result: 'recovered' });
		expect(JSON.stringify(r.log.mock.calls)).not.toContain('private runtime credential');
	}
);

it.each(['native', 'sandbox'])(
	'%s package failure responds once and does not poison the queue',
	async (mode) => {
		const r = setup(mode);
		await r.submit({ id: 'warm', code: 'warm' });
		await flush();
		r.install.mockRejectedValueOnce(new Error('private package URL'));
		await r.submit({ id: 'bad', code: 'unavailable', packages: ['numpy'] });
		await flush();
		await r.submit({ id: 'next', code: 'next' });
		await flush();
		expect(r.replies.filter((row) => row.id === 'bad')).toHaveLength(1);
		expect(r.replies.find((row) => row.id === 'bad')?.stderr).toEqual(expect.any(String));
		expect(r.calls).not.toContain('unavailable');
		expect(r.replies.find((row) => row.id === 'next')?.result).toBe('next');
		expect(r.failures).toEqual([]);
	}
);

it.each(['native', 'sandbox'])(
	'%s reports upload failure before executing incomplete files',
	async (mode) => {
		const r = setup(mode);
		r.fs.writeFile.mockImplementationOnce(() => {
			throw new Error('private file path');
		});
		await r.submit({
			id: 'bad',
			code: 'must not run',
			files: [{ name: 'sample.csv', data: new ArrayBuffer(0) }]
		});
		await flush();
		expect(r.calls).toEqual([]);
		expect(r.replies).toHaveLength(1);
		expect(r.replies[0].stderr).toEqual(expect.any(String));
		expect(r.failures).toEqual([]);
	}
);

it.each(['native', 'sandbox'])(
	'%s reports listing and deletion failures explicitly',
	async (mode) => {
		const r = setup(mode);
		r.fs.readdir.mockImplementationOnce(() => {
			throw new Error('permission denied');
		});
		r.fs.unlink.mockImplementationOnce(() => {
			throw new Error('permission denied');
		});
		await r.submit({ id: 'list', type: 'fs:list', path: '/' });
		await flush();
		await r.submit({ id: 'delete', type: 'fs:delete', path: '/file' });
		await flush();
		expect(r.replies).toHaveLength(2);
		for (const row of r.replies)
			expect(row).toMatchObject({ success: false, error: expect.any(String) });
		expect(r.failures).toEqual([]);
	}
);

it.each(['native', 'sandbox'])('%s reads only the bytes of a typed-array view', async (mode) => {
	const r = setup(mode);
	r.fs.readFile.mockReturnValueOnce(new Uint8Array([99, 1, 2, 88]).subarray(1, 3));
	await r.submit({ id: 'read', type: 'fs:read', path: '/sample' });
	await flush();
	expect([...new Uint8Array(r.replies[0].data!)]).toEqual([1, 2]);
});

it.each(['native', 'sandbox'])(
	'%s replies to unsupported request without starting Python',
	async (mode) => {
		const r = setup(mode);
		await r.submit({ id: 'invalid', type: 'fs:invalid' });
		await flush();
		expect(r.load).not.toHaveBeenCalled();
		expect(r.replies[0]).toMatchObject({
			id: 'invalid',
			type: 'fs:invalid',
			success: false,
			error: expect.any(String)
		});
	}
);

it.each(['native', 'sandbox'])('%s never logs user output or results', async (mode) => {
	const r = setup(mode);
	await r.submit({ id: 'private', code: 'private user output' });
	await flush();
	expect(r.replies[0]).toMatchObject({
		result: 'private user output',
		stdout: 'private user output\n'
	});
	expect(JSON.stringify(r.log.mock.calls)).not.toContain('private user output');
});

it('native ignores unrelated context fields that would overwrite the runtime', async () => {
	const r = setup('native');
	await r.submit({ id: 'warm', code: 'warm' });
	await flush();
	await r.submit({ id: 'next', code: 'next', pyodide: 'private unexpected context' });
	await flush();
	expect(r.replies[1]).toMatchObject({ id: 'next', result: 'next', stderr: null });
});

it('native waits for persistent writes and refresh before starting the next request', async () => {
	const r = setup('native');
	await r.submit({ id: 'warm', code: 'warm' });
	await flush();
	let complete!: () => void;
	r.sync.mockImplementationOnce((populate, done) => {
		complete = () => done();
	});
	const a = r.submit({
		id: 'write',
		type: 'fs:upload',
		files: [{ name: 'sample', data: new ArrayBuffer(0) }]
	});
	await flush();
	const b = r.submit({ id: 'next', code: 'next' });
	await flush();
	const before = r.replies.map((row) => row.id);
	complete();
	await Promise.all([a, b]);
	await flush();
	expect(before).toEqual(['warm']);
	expect(r.replies.map((row) => row.id)).toEqual(['warm', 'write', 'next']);
});

it('native persistent sync failure is an error instead of successful upload', async () => {
	const r = setup('native');
	await r.submit({ id: 'warm', code: 'warm' });
	await flush();
	r.sync.mockImplementationOnce((populate, done) => {
		done(new Error('private database failure'));
	});
	await r.submit({
		id: 'write',
		type: 'fs:upload',
		files: [{ name: 'sample', data: new ArrayBuffer(0) }]
	});
	await flush();
	expect(r.replies[1]).toMatchObject({
		id: 'write',
		type: 'fs:upload',
		success: false,
		error: expect.any(String)
	});
	expect(JSON.stringify(r.log.mock.calls)).not.toContain('private database failure');
});
