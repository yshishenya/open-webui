import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('lints the affected Svelte components without crashing or suppressing unused vars', async () => {
	const root = fileURLToPath(new URL('../', import.meta.url));
	const { stdout } = await promisify(execFile)(
		process.execPath,
		[
			'node_modules/eslint/bin/eslint.js',
			'--format',
			'json',
			'src/lib/components/chat/FileNav/FilePreview.svelte',
			'src/lib/components/chat/MessageInput.svelte',
			'src/lib/components/chat/Placeholder.svelte',
			'src/lib/components/chat/Messages/Markdown/ConsecutiveDetailsGroup.svelte'
		],
		{ cwd: root, maxBuffer: 1024 * 1024 }
	);
	const results = JSON.parse(stdout) as { errorCount: number; warningCount: number }[];
	expect(results).toHaveLength(4);
	for (const result of results) {
		expect(result.errorCount).toBe(0);
		expect(result.warningCount).toBe(0);
	}
}, 15_000);
