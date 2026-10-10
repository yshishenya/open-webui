import { loadPyodide, type PyodideInterface } from 'pyodide';

declare global {
	interface Window {
		stdout: string | null;
		stderr: string | null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		result: any;
		pyodide: PyodideInterface;
		packages: string[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	}
}

// ---------------------------------------------------------------------------
// Pyodide bootstrap
// ---------------------------------------------------------------------------

let pyodideReady: Promise<void> | null = null;

async function loadPyodideAndPackages(): Promise<void> {
	self.stdout = null;
	self.stderr = null;
	self.result = null;

	self.pyodide = await loadPyodide({
		indexURL: '/pyodide/',
		stdout: (text) => {
			if (self.stdout) {
				self.stdout += `${text}\n`;
			} else {
				self.stdout = `${text}\n`;
			}
		},
		stderr: (text) => {
			if (self.stderr) {
				self.stderr += `${text}\n`;
			} else {
				self.stderr = `${text}\n`;
			}
		},
		packages: ['micropip']
	});

	// Create the upload directory and mount IDBFS for persistence
	const uploadDir = '/mnt/uploads';
	self.pyodide.FS.mkdirTree(uploadDir);
	// Pyodide documents FS.filesystems; the bundled Emscripten declaration omits it.
	const fs = self.pyodide.FS as typeof self.pyodide.FS & {
		filesystems: { IDBFS: Parameters<typeof self.pyodide.FS.mount>[0] };
	};
	fs.mount(fs.filesystems.IDBFS, {}, '/mnt');

	// Load persisted files from IndexedDB
	await syncFS(true);

	// Ensure /mnt/uploads still exists after sync (first-time init)
	try {
		self.pyodide.FS.stat(uploadDir);
	} catch {
		self.pyodide.FS.mkdirTree(uploadDir);
	}
}

/**
 * Ensure Pyodide is loaded. On the first call, loads and installs packages.
 * Subsequent calls reuse the already-loaded instance (persistent worker).
 */
async function ensurePyodide(packages: string[] = []): Promise<void> {
	if (!pyodideReady) {
		pyodideReady = loadPyodideAndPackages();
	}
	try {
		await pyodideReady;
	} catch (error: unknown) {
		pyodideReady = null;
		throw error;
	}

	// Install any additional packages not loaded on init
	if (packages.length > 0 && self.pyodide) {
		const micropip = self.pyodide.pyimport('micropip');
		await micropip.install(packages);
	}
}

/** Finish the selected IndexedDB sync before responding or accepting another operation. */
async function syncFS(populate: boolean): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		self.pyodide.FS.syncfs(populate, (error: unknown): void => {
			if (error) reject(new Error('Python filesystem synchronization failed.'));
			else resolve();
		});
	});
}

// ---------------------------------------------------------------------------
// FS operations
// ---------------------------------------------------------------------------

function fsUploadFiles(files: { name: string; data: ArrayBuffer }[], dir = '/mnt/uploads'): void {
	if (!Array.isArray(files)) throw new Error('Invalid Python file payload.');
	try {
		self.pyodide.FS.stat(dir);
	} catch {
		self.pyodide.FS.mkdirTree(dir);
	}

	for (const file of files) {
		if (!file || typeof file.name !== 'string' || !(file.data instanceof ArrayBuffer))
			throw new Error('Invalid Python file payload.');
		self.pyodide.FS.writeFile(`${dir}/${file.name}`, new Uint8Array(file.data));
	}
}

function fsList(path: string): { name: string; type: 'file' | 'directory'; size: number }[] {
	return self.pyodide.FS.readdir(path)
		.filter((name: string) => name !== '.' && name !== '..')
		.map((name: string) => {
			const stat = self.pyodide.FS.stat(`${path}/${name}`);
			const isDir = self.pyodide.FS.isDir(stat.mode);
			return { name, type: isDir ? 'directory' : 'file', size: isDir ? 0 : stat.size };
		});
}

function fsRead(path: string): ArrayBuffer {
	const data = self.pyodide.FS.readFile(path);
	return data.slice().buffer as ArrayBuffer;
}

function fsDelete(path: string): void {
	const stat = self.pyodide.FS.stat(path);
	if (self.pyodide.FS.isDir(stat.mode)) {
		for (const item of self.pyodide.FS.readdir(path).filter(
			(name: string) => name !== '.' && name !== '..'
		)) {
			fsDelete(`${path}/${item}`);
		}
		self.pyodide.FS.rmdir(path);
	} else {
		self.pyodide.FS.unlink(path);
	}
}

function fsMkdir(path: string): void {
	self.pyodide.FS.mkdirTree(path);
}

// ---------------------------------------------------------------------------
// Code execution
// ---------------------------------------------------------------------------

async function executeCode(
	id: string,
	code: string,
	files?: { name: string; data: ArrayBuffer }[]
): Promise<void> {
	self.stdout = null;
	self.stderr = null;
	self.result = null;

	// Upload any accompanying files before execution
	if (files && files.length > 0) {
		fsUploadFiles(files);
	}

	try {
		// check if matplotlib is imported in the code
		if (code.includes('matplotlib')) {
			// Override plt.show() to return base64 image
			await self.pyodide.runPythonAsync(`import base64
import os
from io import BytesIO

# before importing matplotlib
# to avoid the wasm backend (which needs js.document', not available in worker)
os.environ["MPLBACKEND"] = "AGG"

import matplotlib.pyplot

_old_show = matplotlib.pyplot.show
assert _old_show, "matplotlib.pyplot.show"

def show(*, block=None):
	buf = BytesIO()
	matplotlib.pyplot.savefig(buf, format="png")
	buf.seek(0)
	# encode to a base64 str
	img_str = base64.b64encode(buf.read()).decode('utf-8')
	matplotlib.pyplot.clf()
	buf.close()
	print(f"data:image/png;base64,{img_str}")

matplotlib.pyplot.show = show`);
		}

		self.result = await self.pyodide.runPythonAsync(code);

		// Safely process and recursively serialize the result
		self.result = processResult(self.result);
	} catch (error: unknown) {
		self.stderr = error instanceof Error ? error.message : String(error);
	}

	await syncFS(false);
	self.postMessage({ id, result: self.result, stdout: self.stdout, stderr: self.stderr });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

type ExecuteRequest = {
	id: string;
	type?: 'execute';
	code: string;
	packages?: string[];
	files?: { name: string; data: ArrayBuffer }[];
};
type FSRequest =
	| { id: string; type: 'fs:upload'; files: { name: string; data: ArrayBuffer }[]; dir?: string }
	| { id: string; type: 'fs:list' | 'fs:read' | 'fs:delete' | 'fs:mkdir'; path: string }
	| { id: string; type: 'fs:sync' };

// ponytail: one interpreter and filesystem, so all requests share one queue.
// Use separate runtimes only if parallel Python execution becomes a requirement.
let requestQueue = Promise.resolve();
self.onmessage = (event: MessageEvent<ExecuteRequest | FSRequest>): Promise<void> => {
	const data = event.data;
	if (!data || typeof data.id !== 'string') return Promise.resolve();
	requestQueue = requestQueue.then(() => handleRequest(data));
	return requestQueue;
};

async function handleRequest(data: ExecuteRequest | FSRequest): Promise<void> {
	const { id, type } = data;
	try {
		// Legacy code block and formatter requests have no type.
		if (type === undefined || type === 'execute') {
			if (
				typeof data.code !== 'string' ||
				(data.packages &&
					(!Array.isArray(data.packages) || data.packages.some((name) => typeof name !== 'string')))
			)
				throw new Error('Invalid Python execution request.');
			if (data.files && !Array.isArray(data.files)) throw new Error('Invalid Python file payload.');
			await ensurePyodide(data.packages ?? []);
			await executeCode(id, data.code, data.files);
			return;
		}
		if (!['fs:upload', 'fs:list', 'fs:read', 'fs:delete', 'fs:mkdir', 'fs:sync'].includes(type))
			throw new Error('Invalid Python filesystem request.');
		if (
			type !== 'fs:upload' &&
			type !== 'fs:sync' &&
			(!('path' in data) || typeof data.path !== 'string')
		)
			throw new Error('Invalid Python filesystem path.');
		await ensurePyodide();
		switch (type) {
			case 'fs:upload':
				fsUploadFiles(data.files, data.dir);
				await syncFS(false);
				self.postMessage({ id, type, success: true });
				break;
			case 'fs:list':
				self.postMessage({ id, type, entries: fsList(data.path) });
				break;
			case 'fs:read': {
				const buffer = fsRead(data.path);
				self.postMessage({ id, type, data: buffer }, { transfer: [buffer] });
				break;
			}
			case 'fs:delete':
				fsDelete(data.path);
				await syncFS(false);
				self.postMessage({ id, type, success: true });
				break;
			case 'fs:mkdir':
				fsMkdir(data.path);
				await syncFS(false);
				self.postMessage({ id, type, success: true });
				break;
			case 'fs:sync':
				await syncFS(true);
				self.postMessage({ id, type, success: true });
		}
	} catch {
		if (type === undefined || type === 'execute') {
			self.postMessage({
				id,
				stdout: null,
				stderr: 'Python execution request failed.',
				result: null
			});
		} else {
			self.postMessage({ id, type, success: false, error: 'Python filesystem request failed.' });
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function processResult(result: any): any {
	// Catch and always return JSON-safe string representations
	try {
		if (result == null) {
			// Handle null and undefined
			return null;
		}
		if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
			// Handle primitive types directly
			return result;
		}
		if (typeof result === 'bigint') {
			// Convert BigInt to a string for JSON-safe representation
			return result.toString();
		}
		if (Array.isArray(result)) {
			// If it's an array, recursively process items
			return result.map((item) => processResult(item));
		}
		if (typeof result.toJs === 'function') {
			// If it's a Pyodide proxy object (e.g., Pandas DF, Numpy Array), convert to JS and process recursively
			return processResult(result.toJs());
		}
		if (typeof result === 'object') {
			// Convert JS objects to a recursively serialized representation
			const processedObject: { [key: string]: any } = {};
			for (const key in result) {
				if (Object.prototype.hasOwnProperty.call(result, key)) {
					processedObject[key] = processResult(result[key]);
				}
			}
			return processedObject;
		}
		// Stringify anything that's left (e.g., Proxy objects that cannot be directly processed)
		return JSON.stringify(result);
	} catch (err: unknown) {
		// In case something unexpected happens, we return a stringified fallback
		return `[processResult error]: ${err instanceof Error ? err.message : String(err)}`;
	}
}

export default {};
