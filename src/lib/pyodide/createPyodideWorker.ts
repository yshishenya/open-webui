import { get } from 'svelte/store';

import { config } from '$lib/stores';
import { PyodideSandboxHost } from '$lib/pyodide/pyodideSandboxHost';
import PyodideWorker from '$lib/workers/pyodide.worker?worker';

export const createPyodideWorker = (): Worker => {
	const worker = get(config)?.features?.enable_pyodide_file_persistence
		? new PyodideWorker()
		: (new PyodideSandboxHost() as unknown as Worker);
	const terminate = worker.terminate.bind(worker);
	let stopped = false;
	worker.terminate = (): void => {
		if (stopped) return;
		stopped = true;
		try {
			// Every consumer must finish waiting when the shared runtime stops.
			worker.dispatchEvent(new ErrorEvent('error', { message: 'Python worker stopped.' }));
		} finally {
			terminate();
		}
	};
	return worker;
};
