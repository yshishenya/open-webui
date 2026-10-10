const packages = [
	'micropip',
	'packaging',
	'requests',
	'beautifulsoup4',
	'numpy',
	'pandas',
	'matplotlib',
	'scikit-learn',
	'scipy',
	'regex',
	'sympy',
	'tiktoken',
	'seaborn',
	'pytz',
	'black',
	'openai',
	'openpyxl'
];

import { loadPyodide } from 'pyodide';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import { writeFile, readFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

/** @typedef {{name: string, version: string, file_name: string, sha256: string, depends: string[]}} PackageEntry */
/** @typedef {{info: object, packages: Record<string, PackageEntry>}} PackageLock */

/** @returns {void} */
function initNetworkProxyFromEnv() {
	const proxy =
		process.env.https_proxy ||
		process.env.HTTPS_PROXY ||
		process.env.all_proxy ||
		process.env.ALL_PROXY ||
		process.env.http_proxy ||
		process.env.HTTP_PROXY;
	if (!proxy) return;
	let url;
	try {
		url = new URL(proxy);
	} catch {
		throw new Error('Invalid network proxy URL.');
	}
	if (!['http:', 'https:'].includes(url.protocol)) return;
	setGlobalDispatcher(new ProxyAgent({ uri: url.toString() }));
	console.log('Initialized network proxy from env');
}

/** Copy the pinned runtime before creating the final resolved lock.
 * @returns {Promise<void>}
 */
async function copyPyodide() {
	await mkdir('static/pyodide', { recursive: true });
	for (const entry of await readdir('node_modules/pyodide')) {
		await copyFile(`node_modules/pyodide/${entry}`, `static/pyodide/${entry}`);
	}
}

/** Preserve the resolver's graph and localize only installed package artifacts.
 * @param {PackageLock} lock
 * @param {string[]} installed
 * @returns {Promise<void>}
 */
async function materializePackages(lock, installed) {
	const selected = new Set(installed.map((name) => name.toLowerCase().replace(/[-_.]+/g, '-')));
	for (const entry of Object.values(lock.packages)) {
		const remote = entry.file_name.startsWith('https://');
		if (
			!remote &&
			(!isAbsolute(entry.file_name) ||
				dirname(resolve(entry.file_name)) !== resolve('static/pyodide'))
		)
			throw new Error('Invalid Python package URL.');
		const url = remote ? new URL(entry.file_name) : null;
		const filename = url ? url.pathname.split('/').pop() : basename(entry.file_name);
		if (!filename || !/^[a-zA-Z0-9_.+-]+\.(whl|zip|tar)$/.test(filename))
			throw new Error('Invalid Python package filename.');
		if (selected.has(entry.name.toLowerCase().replace(/[-_.]+/g, '-'))) {
			if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Missing Python wheel checksum.');
			const dest = `static/pyodide/${filename}`;
			let buffer;
			try {
				buffer = await readFile(dest);
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
				if (!url) throw new Error(`Missing local Python artifact: ${filename}`);
				const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
				if (!response.ok) throw new Error(`Python wheel download failed: HTTP ${response.status}`);
				buffer = Buffer.from(await response.arrayBuffer());
			}
			if (createHash('sha256').update(buffer).digest('hex') !== entry.sha256)
				throw new Error(`Python wheel checksum mismatch: ${filename}`);
			await writeFile(dest, buffer);
		}
		entry.file_name = filename;
	}
	await writeFile('static/pyodide/pyodide-lock.json', JSON.stringify(lock, null, 2));
}

/** @param {PackageLock | null} accepted
 * @returns {Promise<void>}
 */
async function downloadPackages(accepted) {
	const pyodide = await loadPyodide({ packageCacheDir: 'static/pyodide' });
	await pyodide.loadPackage('micropip');
	const micropip = pyodide.pyimport('micropip');
	// ponytail: micropip owns dependency resolution; do not duplicate PEP 508 here.
	if (accepted)
		micropip.set_constraints(
			Object.values(accepted.packages).map((entry) => `${entry.name}==${entry.version}`)
		);
	await micropip.install(packages);
	/** @type {PackageLock} */
	const lock = JSON.parse(await micropip.freeze());
	await materializePackages(lock, Object.keys(pyodide.loadedPackages));
}

initNetworkProxyFromEnv();
/** @type {PackageLock | null} */
let accepted = null;
try {
	accepted = JSON.parse(await readFile('static/pyodide/pyodide-lock.json', 'utf-8'));
} catch (error) {
	if (error.code !== 'ENOENT') throw error;
}
await copyPyodide();
await downloadPackages(accepted);
