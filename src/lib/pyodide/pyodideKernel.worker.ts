import { loadPyodide, type PyodideInterface } from 'pyodide';

declare global {
	interface Window {
		stdout: string | null;
		stderr: string | null;
		pyodide: PyodideInterface;
		cells: Record<string, CellState>;
		indexURL: string;
	}
}

type CellState = {
	id: string;
	status: 'idle' | 'running' | 'completed' | 'error';
	result: any;
	stdout: string;
	stderr: string;
};

/**
 * Initializes the Pyodide environment by loading it if it is not already loaded.
 * This function ensures that Pyodide is cached in the worker's global scope to prevent
 * redundant loading.
 *
 * It sets up the necessary properties such as `indexURL`, `stdout`, `stderr`, and
 * `cells` in the global scope before loading Pyodide.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when Pyodide has been successfully loaded.
 *
 * @throws {Error} Throws an error if the loading of Pyodide fails.
 *
 * @example
 * // Usage example:
 * initializePyodide().then(() => {
 *   console.log('Pyodide is ready to use.');
 * }).catch((error) => {
 *   console.error('Failed to initialize Pyodide:', error);
 * });
 */
const initializePyodide = async () => {
	// Ensure Pyodide is loaded once and cached in the worker's global scope
	if (!self.pyodide) {
		self.indexURL = '/pyodide/';
		self.stdout = '';
		self.stderr = '';
		self.cells = {};

		self.pyodide = await loadPyodide({
			indexURL: self.indexURL
		});
	}
};

/**
 * Executes a given Python code asynchronously using Pyodide.
 *
 * This function initializes Pyodide if it is not already initialized, updates the cell state to "running",
 * and redirects standard output and error streams to capture messages. It dynamically loads required packages
 * based on the imports in the provided Python code and executes the code. The results, including any output or errors,
 * are communicated back to the parent thread.
 *
 * @param {string} id - The unique identifier for the cell being executed.
 * @param {string} code - The Python code to be executed.
 *
 * @returns {Promise<void>} A promise that resolves when the execution is complete.
 *
 * @throws {Error} Throws an error if there is an issue during package loading or code execution.
 *
 * @example
 * // Example usage of executeCode function
 * executeCode('cell1', 'print("Hello, World!")')
 *   .then(() => console.log('Execution completed'))
 *   .catch(error => console.error('Execution failed:', error));
 */
const executeCode = async (id: string, code: string) => {
	if (!self.pyodide) {
		await initializePyodide();
	}

	// Update the cell state to "running"
	self.cells[id] = {
		id,
		status: 'running',
		result: null,
		stdout: '',
		stderr: ''
	};

	// Redirect stdout/stderr to stream updates
	self.pyodide.setStdout({
		batched: (msg: string) => {
			self.cells[id].stdout += msg;
			self.postMessage({ type: 'stdout', id, message: msg });
		}
	});
	self.pyodide.setStderr({
		batched: (msg: string) => {
			self.cells[id].stderr += msg;
			self.postMessage({ type: 'stderr', id, message: msg });
		}
	});

	try {
		// Dynamically load required packages based on imports in the Python code
		await self.pyodide.loadPackagesFromImports(code, {
			messageCallback: (msg: string) => {
				self.postMessage({ type: 'stdout', id, package: true, message: `[package] ${msg}` });
			},
			errorCallback: (msg: string) => {
				self.postMessage({ type: 'stderr', id, package: true, message: `[package] ${msg}` });
			}
		});

		// Execute the Python code
		const result = await self.pyodide.runPythonAsync(code);
		self.cells[id].result = result;
		self.cells[id].status = 'completed';
	} catch (error) {
		self.cells[id].status = 'error';
		self.cells[id].stderr += `\n${error.toString()}`;
	} finally {
		// Notify parent thread when execution completes
		self.postMessage({
			type: 'result',
			id,
			state: self.cells[id]
		});
	}
};

// Handle messages from the main thread
self.onmessage = async (event) => {
	const { type, id, code, ...args } = event.data;

	switch (type) {
		case 'initialize':
			await initializePyodide();
			self.postMessage({ type: 'initialized' });
			break;

		case 'execute':
			if (id && code) {
				await executeCode(id, code);
			}
			break;

		case 'getState':
			self.postMessage({
				type: 'kernelState',
				state: self.cells
			});
			break;

		case 'terminate':
			// Explicitly clear the worker for cleanup
			for (const key in self.cells) delete self.cells[key];
			self.close();
			break;

		default:
			console.error(`Unknown message type: ${type}`);
	}
};
