<script lang="ts">
	import hljs from 'highlight.js';
	import { sanitizedHtml } from '$lib/utils/airis/sanitized_html';
	import type { Token } from 'marked';
	import { toast } from 'svelte-sonner';
	import { getContext, onMount, tick, onDestroy } from 'svelte';
	import { config, pyodideWorker as pyodideWorkerStore } from '$lib/stores';

	import { createPyodideWorker } from '$lib/pyodide/createPyodideWorker';
	import { executeCode } from '$lib/apis/utils';
	import {
		copyToClipboard,
		initMermaid,
		renderMermaidDiagram,
		renderVegaVisualization,
		unescapeHtml
	} from '$lib/utils';

	import 'highlight.js/styles/github-dark.min.css';
	import equal from 'fast-deep-equal';

	import CodeEditor from '$lib/components/common/CodeEditor.svelte';
	import SvgPanZoom from '$lib/components/common/SVGPanZoom.svelte';

	import ChevronUpDown from '$lib/components/icons/ChevronUpDown.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	export let id = '';
	export let edit = true;

	export let onSave: (code: string) => unknown = () => {};
	export let onUpdate: (token: Token | null | undefined, codeBlockId: string) => unknown = () => {};
	export let onPreview: (code: string) => unknown = () => {};

	export let save = false;
	export let run = true;
	export let preview = false;
	export let collapsed = false;

	export let token: (Token & { text?: string }) | null | undefined = undefined;
	export let lang = '';
	export let code = '';
	export let attributes: Record<string, unknown> = {};

	export let className = '';
	export let editorClassName = '';
	export let stickyButtonsClassName = 'top-0';

	let localPyodideWorker: Worker | null = null;
	let cleanupExecution: (() => void) | null = null;
	let activeExecution: object | null = null;
	let destroyed = false;

	let _code = '';
	$: if (code) {
		updateCode();
	}

	const updateCode = () => {
		_code = code;
	};

	let _token: typeof token | null = null;

	let renderHTML: string | null = null;
	let renderError: string | null = null;

	let executing = false;

	let stdout: string | null = null;
	let stderr: string | null = null;
	let result: unknown = null;
	$: hasResult = result !== null && result !== undefined;
	let files: { type: string; data: string }[] | null = null;

	let copied = false;
	let saved = false;

	const collapseCodeBlock = () => {
		collapsed = !collapsed;
	};

	const saveCode = () => {
		saved = true;

		code = _code;
		onSave(code);

		setTimeout(() => {
			saved = false;
		}, 1000);
	};

	const copyCode = async () => {
		copied = true;
		await copyToClipboard(_code);

		setTimeout(() => {
			copied = false;
		}, 1000);
	};

	const previewCode = () => {
		onPreview(code);
	};

	const checkPythonCode = (str: string) => {
		// Check if the string contains typical Python syntax characters
		const pythonSyntax = [
			'def ',
			'else:',
			'elif ',
			'try:',
			'except:',
			'finally:',
			'yield ',
			'lambda ',
			'assert ',
			'nonlocal ',
			'del ',
			'True',
			'False',
			'None',
			' and ',
			' or ',
			' not ',
			' in ',
			' is ',
			' with '
		];

		for (let syntax of pythonSyntax) {
			if (str.includes(syntax)) {
				return true;
			}
		}

		// If none of the above conditions met, it's probably not Python code
		return false;
	};

	type ExecutionOutput = { stdout?: unknown; stderr?: unknown; result?: unknown };
	const applyExecutionOutput = (output: ExecutionOutput): void => {
		const extractImages = (text: string): string => {
			for (const line of text.split('\n')) {
				if (line.startsWith('data:image/png;base64')) {
					(files ??= []).push({ type: 'image/png', data: line });
					text = text.replace(`${line}\n`, '').replace(line, '');
				}
			}
			return text;
		};
		stdout =
			typeof output.stdout === 'string' && output.stdout ? extractImages(output.stdout) : null;
		stderr = typeof output.stderr === 'string' && output.stderr ? output.stderr : null;
		result =
			typeof output.result === 'string'
				? extractImages(output.result) || null
				: (output.result ?? null);
	};

	const executePython = async (code: string): Promise<void> => {
		if (executing || destroyed) return;
		cleanupExecution?.();
		const request = {};
		activeExecution = request;
		result = null;
		stdout = null;
		stderr = null;
		files = null;
		executing = true;

		if ($config?.code?.engine === 'jupyter') {
			try {
				const output = await executeCode(localStorage.token, code);
				if (activeExecution === request && !destroyed && output) applyExecutionOutput(output);
			} catch (error) {
				if (activeExecution === request && !destroyed) toast.error(`${error}`);
			} finally {
				if (activeExecution === request) {
					executing = false;
					activeExecution = null;
				}
			}
		} else {
			try {
				await executePythonAsWorker(code, request);
			} catch (error) {
				if (activeExecution === request && !destroyed) {
					cleanupExecution?.();
					stderr = error instanceof Error ? error.message : String(error);
					executing = false;
					activeExecution = null;
				}
			}
		}
	};

	const executePythonAsWorker = async (code: string, request: object): Promise<void> => {
		const packages = [
			/\bimport\s+requests\b|\bfrom\s+requests\b/.test(code) ? 'requests' : null,
			/\bimport\s+bs4\b|\bfrom\s+bs4\b/.test(code) ? 'beautifulsoup4' : null,
			/\bimport\s+numpy\b|\bfrom\s+numpy\b/.test(code) ? 'numpy' : null,
			/\bimport\s+pandas\b|\bfrom\s+pandas\b/.test(code) ? 'pandas' : null,
			/\bimport\s+matplotlib\b|\bfrom\s+matplotlib\b/.test(code) ? 'matplotlib' : null,
			/\bimport\s+seaborn\b|\bfrom\s+seaborn\b/.test(code) ? 'seaborn' : null,
			/\bimport\s+sklearn\b|\bfrom\s+sklearn\b/.test(code) ? 'scikit-learn' : null,
			/\bimport\s+scipy\b|\bfrom\s+scipy\b/.test(code) ? 'scipy' : null,
			/\bimport\s+re\b|\bfrom\s+re\b/.test(code) ? 'regex' : null,
			/\bimport\s+seaborn\b|\bfrom\s+seaborn\b/.test(code) ? 'seaborn' : null,
			/\bimport\s+sympy\b|\bfrom\s+sympy\b/.test(code) ? 'sympy' : null,
			/\bimport\s+tiktoken\b|\bfrom\s+tiktoken\b/.test(code) ? 'tiktoken' : null,
			/\bimport\s+pytz\b|\bfrom\s+pytz\b/.test(code) ? 'pytz' : null
		].filter((name): name is string => name !== null);

		const sharedWorker = $pyodideWorkerStore;
		const worker = sharedWorker ?? createPyodideWorker();
		if (!sharedWorker) localPyodideWorker = worker;
		const requestId = `${id}:${crypto.randomUUID()}`;
		const finish = (): void => {
			cleanupExecution?.();
			executing = false;
			activeExecution = null;
		};
		const handler = (event: MessageEvent<unknown>): void => {
			if (destroyed || activeExecution !== request || !event.data || typeof event.data !== 'object')
				return;
			const data = event.data as Record<string, unknown>;
			if (data.id !== requestId || (typeof data.type === 'string' && data.type.startsWith('fs:')))
				return;
			applyExecutionOutput(data);
			finish();
			window.dispatchEvent(new Event('pyodide:files'));
		};
		const errorHandler = (event: Event): void => {
			if (destroyed || activeExecution !== request) return;
			stderr =
				event instanceof ErrorEvent && event.message
					? event.message
					: $i18n.t('Something went wrong :/');
			finish();
		};
		const timeoutId = setTimeout(() => {
			if (activeExecution !== request || destroyed) return;
			stderr = 'Execution Time Limit Exceeded';
			finish();
		}, 60000);
		cleanupExecution = () => {
			clearTimeout(timeoutId);
			worker.removeEventListener('message', handler);
			worker.removeEventListener('error', errorHandler);
			if (!sharedWorker) {
				worker.terminate();
				localPyodideWorker = null;
			}
			cleanupExecution = null;
		};
		worker.addEventListener('message', handler);
		worker.addEventListener('error', errorHandler);
		worker.postMessage({ id: requestId, code, packages });
	};

	let mermaid: Awaited<ReturnType<typeof initMermaid>> | null = null;
	const renderMermaid = async (code: string) => {
		if (!mermaid) {
			mermaid = await initMermaid();
		}
		return await renderMermaidDiagram(mermaid, code);
	};

	const render = async () => {
		onUpdate(token, id);
		if (lang === 'mermaid' && (token?.raw ?? '').slice(-4).includes('```')) {
			try {
				renderHTML = await renderMermaid(code);
			} catch (error) {
				console.error('Failed to render mermaid diagram:', error);
				const errorMsg = error instanceof Error ? error.message : String(error);
				renderError = $i18n.t('Failed to render diagram') + `: ${errorMsg}`;
				renderHTML = null;
			}
		} else if (
			(lang === 'vega' || lang === 'vega-lite') &&
			(token?.raw ?? '').slice(-4).includes('```')
		) {
			try {
				renderHTML = await renderVegaVisualization(code, lang);
			} catch (error) {
				console.error('Failed to render Vega visualization:', error);
				const errorMsg = error instanceof Error ? error.message : String(error);
				renderError = $i18n.t('Failed to render visualization') + `: ${errorMsg}`;
				renderHTML = null;
			}
		}
	};

	$: if (token) {
		if (token.text !== _token?.text || token.raw !== _token?.raw) {
			_token = token;
		} else if (!equal(token, _token)) {
			_token = token;
		}
	}

	$: if (_token) {
		render();
	}

	$: if (attributes) {
		onAttributesUpdate();
	}

	const onAttributesUpdate = () => {
		if (typeof attributes?.output === 'string' && attributes.output) {
			try {
				const output = JSON.parse(unescapeHtml(attributes.output));
				stdout = output.stdout;
				stderr = output.stderr;
				result = output.result;
			} catch (error) {
				console.error('Error:', error);
			}
		}
	};

	onMount(async () => {
		if (token) {
			onUpdate(token, id);
		}
	});

	onDestroy(() => {
		destroyed = true;
		activeExecution = null;
		cleanupExecution?.();
		executing = false;
		if (localPyodideWorker) {
			localPyodideWorker.terminate();
			localPyodideWorker = null;
		}
	});
</script>

<div>
	<div
		class="relative {className} flex flex-col rounded-2xl border border-gray-100/30 dark:border-gray-850/30 my-0.5"
		dir="ltr"
	>
		{#if ['mermaid', 'vega', 'vega-lite'].includes(lang)}
			{#if renderHTML}
				<SvgPanZoom
					className=" rounded-2xl max-h-fit overflow-hidden"
					svg={renderHTML}
					content={_token?.text ?? ''}
				/>
			{:else}
				<div class="p-3">
					{#if renderError}
						<div
							class="flex gap-2.5 border px-4 py-3 border-red-600/10 bg-red-600/10 rounded-2xl mb-2"
						>
							{renderError}
						</div>
					{/if}
					<pre>{code}</pre>
				</div>
			{/if}
		{:else}
			<div
				class="sticky {stickyButtonsClassName} left-0 right-0 py-1.5 px-3.5 gap-2 flex items-center justify-end w-full z-10 text-xs text-black dark:text-white bg-white dark:bg-black rounded-t-2xl"
			>
				<div class="flex-1 truncate">
					<Tooltip content={lang} placement="top-start">
						<span class=" truncate text-ellipsis">
							{lang}
						</span>
					</Tooltip>
				</div>

				<div class="flex items-center gap-0.5 shrink-0">
					<button
						class="flex gap-1 items-center bg-none border-none transition rounded-md px-1.5 py-0.5 bg-white dark:bg-black"
						on:click={collapseCodeBlock}
					>
						<div class=" -translate-y-[0.5px]">
							<ChevronUpDown className="size-3" />
						</div>

						<div>
							{collapsed ? $i18n.t('Expand') : $i18n.t('Collapse')}
						</div>
					</button>

					{#if ($config?.features?.enable_code_execution ?? true) && (lang.toLowerCase() === 'python' || lang.toLowerCase() === 'py' || (lang === '' && checkPythonCode(code)))}
						{#if executing}
							<div
								class="run-code-button bg-none border-none p-0.5 cursor-not-allowed bg-white dark:bg-black"
							>
								{$i18n.t('Running')}
							</div>
						{:else if run}
							<button
								class="flex gap-1 items-center run-code-button bg-none border-none transition rounded-md px-1.5 py-0.5 bg-white dark:bg-black"
								on:click={async () => {
									code = _code;
									await tick();
									executePython(code);
								}}
							>
								<div>
									{$i18n.t('Run')}
								</div>
							</button>
						{/if}
					{/if}

					{#if save}
						<button
							class="save-code-button bg-none border-none transition rounded-md px-1.5 py-0.5 bg-white dark:bg-black"
							on:click={saveCode}
						>
							{saved ? $i18n.t('Saved') : $i18n.t('Save')}
						</button>
					{/if}

					<button
						class="copy-code-button bg-none border-none transition rounded-md px-1.5 py-0.5 bg-white dark:bg-black"
						on:click={copyCode}>{copied ? $i18n.t('Copied') : $i18n.t('Copy')}</button
					>

					{#if preview && ['html', 'svg'].includes(lang)}
						<button
							class="flex gap-1 items-center run-code-button bg-none border-none transition rounded-md px-1.5 py-0.5 bg-white dark:bg-black"
							on:click={previewCode}
						>
							<div>
								{$i18n.t('Preview')}
							</div>
						</button>
					{/if}
				</div>
			</div>

			<div
				class="language-{lang} rounded-t-2xl -mt-8 {editorClassName
					? editorClassName
					: executing || stdout || stderr || hasResult
						? ''
						: 'rounded-b-2xl'} overflow-hidden"
			>
				<div class=" pt-6.5 bg-white dark:bg-black"></div>

				{#if !collapsed}
					{#if edit}
						<CodeEditor
							value={code}
							{id}
							{lang}
							onSave={() => {
								saveCode();
							}}
							onChange={(value) => {
								_code = value;
							}}
						/>
					{:else}
						<pre
							class=" hljs p-4 px-5 overflow-x-auto"
							style="border-top-left-radius: 0px; border-top-right-radius: 0px; {(executing ||
								stdout ||
								stderr ||
								hasResult) &&
								'border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;'}">{#if lang && hljs.getLanguage(lang)}<code
									class="language-{lang} rounded-t-none whitespace-pre text-sm"
									use:sanitizedHtml={hljs.highlight(code, { language: lang, ignoreIllegals: true })
										.value}></code>{:else}<code
									class="language-{lang} rounded-t-none whitespace-pre text-sm">{code}</code
								>{/if}</pre>
					{/if}
				{:else}
					<div
						class="bg-white dark:bg-black dark:text-white rounded-b-2xl! pt-1 pb-2 px-4 flex flex-col gap-2 text-xs"
					>
						<span class="text-gray-500 italic">
							{$i18n.t('{{COUNT}} hidden lines', {
								COUNT: code.split('\n').length
							})}
						</span>
					</div>
				{/if}
			</div>

			{#if !collapsed}
				<div
					id="plt-canvas-{id}"
					class="bg-gray-50 dark:bg-black dark:text-white max-w-full overflow-x-auto scrollbar-hidden"
				></div>

				{#if executing || stdout || stderr || hasResult || files}
					<div
						class="bg-gray-50 dark:bg-black dark:text-white rounded-b-2xl! pt-2 pb-3 px-3.5 flex flex-col gap-2"
					>
						{#if executing}
							<div class=" ">
								<div class=" text-gray-500 text-xs mb-1">{$i18n.t('STDOUT/STDERR')}</div>
								<div class="text-sm">{$i18n.t('Running...')}</div>
							</div>
						{:else}
							{#if stdout || stderr}
								<div class=" ">
									<div class=" text-gray-500 text-xs mb-1">{$i18n.t('STDOUT/STDERR')}</div>
									<div
										class="text-sm font-mono whitespace-pre-wrap {(stdout?.split('\n')?.length ??
											0) > 100
											? `max-h-96`
											: ''}  overflow-y-auto"
									>
										{stdout || stderr}
									</div>
								</div>
							{/if}
							{#if hasResult || files}
								<div class=" ">
									<div class=" text-gray-500 text-xs mb-1">{$i18n.t('RESULT')}</div>
									{#if hasResult}
										<div class="text-sm">{`${JSON.stringify(result)}`}</div>
									{/if}
									{#if files}
										<div class="flex flex-col gap-2">
											{#each files as file}
												{#if file.type.startsWith('image')}
													<img src={file.data} alt="Output" class=" w-full max-w-[36rem]" />
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>
