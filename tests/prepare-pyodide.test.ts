import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Entry = {
	name: string;
	version: string;
	file_name: string;
	sha256: string;
	depends: string[];
};
type Lock = { info: object; packages: Record<string, Entry> };
type Preparation = {
	copyPyodide: () => Promise<void>;
	downloadPackages: (accepted: Lock) => Promise<void>;
	materializePackages: (lock: Lock, installed: string[]) => Promise<void>;
	initNetworkProxyFromEnv: () => void;
};
const bytes = Buffer.from('resolved-wheel');
const checksum = createHash('sha256').update(bytes).digest('hex');
const entry = (name: string, depends: string[] = []): Entry => ({
	name,
	version: '1.0',
	file_name: `https://files.pythonhosted.org/${name}-1.0-py3-none-any.whl`,
	sha256: checksum,
	depends
});
const resolved = (): Lock => ({
	info: {},
	packages: { black: entry('black', ['click']), click: entry('click') }
});

async function setup(proxy = 'https://user:secret@example.test'): Promise<{
	api: Preparation;
	files: Map<string, Buffer>;
	installed: string[][];
	constraints: string[][];
	downloads: string[];
	logs: string[];
	failInstall: () => void;
	badDownload: () => void;
	httpFailure: () => void;
	denyRead: () => void;
}> {
	const sourcePath = process.env.AIRIS_PREPARE_TEST_SOURCE || 'scripts/prepare-pyodide.js';
	const source = (await readFile(sourcePath, 'utf8'))
		.replace(/^import .*;\n/gm, '')
		.split('initNetworkProxyFromEnv();')[0];
	const files = new Map<string, Buffer>([
		['package.json', Buffer.from(JSON.stringify({ dependencies: { pyodide: '314.0.3' } }))],
		['static/pyodide/package.json', Buffer.from(JSON.stringify({ version: '314.0.3' }))]
	]);
	const installed: string[][] = [],
		constraints: string[][] = [],
		downloads: string[] = [],
		logs: string[] = [];
	let installFails = false,
		downloadBad = false,
		downloadFailed = false,
		readDenied = false;
	const context = {
		Buffer,
		basename,
		dirname,
		isAbsolute,
		resolve,
		URL,
		Set,
		AbortSignal,
		createHash,
		process: { env: { HTTPS_PROXY: proxy } },
		console: {
			log: (s: string): void => {
				logs.push(s);
			},
			warn: (s: string): void => {
				logs.push(s);
			},
			error: (s: string): void => {
				logs.push(s);
			}
		},
		ProxyAgent: class {},
		setGlobalDispatcher: (): void => {},
		mkdir: async (): Promise<void> => {},
		readdir: async (): Promise<string[]> => ['pyodide-lock.json'],
		copyFile: async (_from: string, dest: string): Promise<void> => {
			files.set(dest, Buffer.from(JSON.stringify({ info: {}, packages: {} })));
		},
		readFile: async (name: string): Promise<Buffer> => {
			if (readDenied) throw Object.assign(new Error('read denied'), { code: 'EACCES' });
			const value = files.get(name);
			if (!value) throw Object.assign(new Error('absent'), { code: 'ENOENT' });
			return value;
		},
		writeFile: async (name: string, value: string | Buffer): Promise<void> => {
			files.set(name, Buffer.from(value));
		},
		fetch: async (
			url: URL
		): Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<Buffer> }> => {
			downloads.push(String(url));
			return {
				ok: !downloadFailed,
				status: downloadFailed ? 503 : 200,
				arrayBuffer: async () => (downloadBad ? Buffer.from('corrupt') : bytes)
			};
		},
		loadPyodide: async () => ({
			loadedPackages: { black: true, click: true },
			loadPackage: async (): Promise<void> => {},
			pyimport: () => ({
				set_constraints: (values: string[]): void => {
					constraints.push([...values]);
				},
				install: async (values: string[]): Promise<void> => {
					installed.push(values);
					if (installFails) throw new Error('resolver failed');
				},
				freeze: async (): Promise<string> => JSON.stringify(resolved())
			})
		})
	};
	const exports = source.includes('materializePackages')
		? 'materializePackages'
		: 'downloadPyPIWheels: undefined';
	const api = runInNewContext(
		source + `\n({copyPyodide,downloadPackages,${exports},initNetworkProxyFromEnv})`,
		context
	) as Preparation;
	return {
		api,
		files,
		installed,
		constraints,
		downloads,
		logs,
		failInstall: () => {
			installFails = true;
		},
		httpFailure: () => {
			downloadFailed = true;
		},
		badDownload: () => {
			downloadBad = true;
		},
		denyRead: () => {
			readDenied = true;
		}
	};
}

describe('prepared Python packages', () => {
	it('keeps resolved dependencies, versions and local wheels after copying the runtime', async () => {
		const s = await setup();
		await s.api.copyPyodide();
		await s.api.downloadPackages(resolved());
		const lock = JSON.parse(s.files.get('static/pyodide/pyodide-lock.json')!.toString()) as Lock;
		expect(lock.packages.black.depends).toEqual(['click']);
		expect(lock.packages.black.version).toBe('1.0');
		expect(s.constraints).toEqual([['black==1.0', 'click==1.0']]);
		expect(lock.packages.black.file_name).toBe('black-1.0-py3-none-any.whl');
		expect(s.files.get('static/pyodide/click-1.0-py3-none-any.whl')).toEqual(bytes);
	});
	it('rejects resolver failures', async () => {
		const s = await setup();
		s.failInstall();
		await expect(s.api.downloadPackages(resolved())).rejects.toThrow('resolver failed');
	});
	it('rejects corrupted downloaded and cached artifacts before publishing the lock', async () => {
		const s = await setup();
		s.badDownload();
		await expect(s.api.materializePackages(resolved(), ['black'])).rejects.toThrow(
			'checksum mismatch'
		);
		expect(s.files.has('static/pyodide/pyodide-lock.json')).toBe(false);
		const h = await setup();
		h.httpFailure();
		await expect(h.api.materializePackages(resolved(), ['black'])).rejects.toThrow('HTTP 503');
		expect(h.files.has('static/pyodide/pyodide-lock.json')).toBe(false);
		const c = await setup();
		c.files.set('static/pyodide/black-1.0-py3-none-any.whl', Buffer.from('corrupt'));
		await expect(c.api.materializePackages(resolved(), ['black'])).rejects.toThrow(
			'checksum mismatch'
		);
		expect(c.downloads).toEqual([]);
	});
	it('does not hide permission failures or accept unsafe package names', async () => {
		const s = await setup();
		s.denyRead();
		await expect(s.api.materializePackages(resolved(), ['black'])).rejects.toThrow('read denied');
		const c = await setup(),
			lock = resolved();
		lock.packages.black.file_name = 'https://example.test/bad%2Fname.whl';
		await expect(c.api.materializePackages(lock, ['black'])).rejects.toThrow('filename');
	});
	it('preserves unused distribution artifacts and native dependency archives', async () => {
		const s = await setup(),
			lock = resolved();
		lock.packages.extra = entry('extra');
		lock.packages.click.file_name = resolve('static/pyodide/click.zip');
		s.files.set('static/pyodide/click.zip', bytes);
		await s.api.materializePackages(lock, ['click']);
		expect(s.downloads).toEqual([]);
		expect(lock.packages.extra.file_name).toBe('extra-1.0-py3-none-any.whl');
	});
	it('does not print proxy credentials', async () => {
		const s = await setup();
		s.api.initNetworkProxyFromEnv();
		expect(s.logs.join('\n')).not.toContain('secret');
		const invalid = await setup('://secret example');
		expect(() => invalid.api.initNetworkProxyFromEnv()).toThrow('Invalid network proxy URL.');
		expect(invalid.logs.join('\n')).not.toContain('secret');
	});
});
