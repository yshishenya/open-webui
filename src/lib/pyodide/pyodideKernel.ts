import PyodideWorker from '$lib/pyodide/pyodideKernel.worker?worker';

export type CellState = {
	id: string;
	status: 'idle' | 'running' | 'completed' | 'error';
	result: any;
	stdout: string;
	stderr: string;
};

export class PyodideKernel {
	private worker: Worker;
	private listeners: Map<string, (data: any) => void>;

	constructor() {
		this.worker = new PyodideWorker();
		this.listeners = new Map();

		// Listen to messages from the worker
		this.worker.onmessage = (event) => {
			const { type, id, ...data } = event.data;

			if ((type === 'stdout' || type === 'stderr') && this.listeners.has(id)) {
				this.listeners.get(id)?.({ type, id, ...data });
			} else if (type === 'result' && this.listeners.has(id)) {
				this.listeners.get(id)?.({ type, id, ...data });
				// Remove the listener once the result is delivered
				this.listeners.delete(id);
			} else if (type === 'kernelState') {
				this.listeners.forEach((listener) => listener({ type, ...data }));
			}
		};

		// Initialize the worker
		this.worker.postMessage({ type: 'initialize' });
	}

	/**
	 * Executes the provided code in a worker and returns the state of the cell after execution.
	 *
	 * This method sets up listeners to capture standard output, standard error, and the final result
	 * of the code execution. It returns a promise that resolves with the final state of the cell.
	 *
	 * @param {string} id - The unique identifier for the cell being executed.
	 * @param {string} code - The code to be executed in the worker.
	 * @returns {Promise<CellState>} A promise that resolves to the state of the cell after execution.
	 *
	 * @throws {Error} Throws an error if the execution fails or if there are issues with the worker.
	 *
	 * @example
	 * const cellId = 'cell1';
	 * const codeToExecute = 'console.log("Hello, World!");';
	 * execute(cellId, codeToExecute)
	 *   .then(state => {
	 *     console.log('Execution completed with state:', state);
	 *   })
	 *   .catch(error => {
	 *     console.error('Execution failed:', error);
	 *   });
	 */
	async execute(id: string, code: string): Promise<CellState> {
		return new Promise((resolve, reject) => {
			// Set up the listener for streaming and execution result
			const state: CellState = {
				id,
				status: 'running',
				result: null,
				stdout: '',
				stderr: ''
			};

			this.listeners.set(id, (data) => {
				if (data.type === 'stdout') {
					state.stdout += data.message;
				} else if (data.type === 'stderr') {
					state.stderr += data.message;
				} else if (data.type === 'result') {
					// Final result
					const { state: finalState } = data;
					resolve(finalState);
				}
			});

			// Send execute request to the worker
			this.worker.postMessage({ type: 'execute', id, code });
		});
	}

	/**
	 * Asynchronously retrieves the current state of the kernel.
	 *
	 * This method sends a message to the worker to request the current state.
	 * It listens for a response and resolves a promise with the state data once received.
	 *
	 * @returns {Promise<Record<string, CellState>>} A promise that resolves to an object representing the current state of the kernel,
	 * where the keys are string identifiers and the values are instances of `CellState`.
	 *
	 * @example
	 * const state = await getState();
	 * console.log(state);
	 *
	 * @throws {Error} Throws an error if the worker fails to respond or if there is an issue retrieving the state.
	 */
	async getState() {
		return new Promise<Record<string, CellState>>((resolve) => {
			this.worker.postMessage({ type: 'getState' });
			this.listeners.set('kernelState', (data) => {
				if (data.type === 'kernelState') {
					resolve(data.state);
				}
			});
		});
	}

	/**
	 * Terminates the worker by sending a termination message and then calling the terminate method on the worker instance.
	 *
	 * This method is used to gracefully stop the worker process, ensuring that any ongoing tasks are halted and resources are released.
	 *
	 * @throws {Error} Throws an error if the worker is not initialized or if there is an issue during termination.
	 *
	 * @example
	 * const workerManager = new WorkerManager();
	 * // ... some operations with the worker
	 * workerManager.terminate();
	 */
	terminate() {
		this.worker.postMessage({ type: 'terminate' });
		this.worker.terminate();
	}
}
