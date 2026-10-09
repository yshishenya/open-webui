<script lang="ts">
	import '$lib/utils/codemirror';

	import { basicSetup, EditorView } from 'codemirror';
	import { keymap, placeholder } from '@codemirror/view';
	import { Compartment, EditorState, type ChangeSpec, type Extension } from '@codemirror/state';

	import { acceptCompletion } from '@codemirror/autocomplete';
	import { indentWithTab } from '@codemirror/commands';

	import { indentUnit, type LanguageSupport } from '@codemirror/language';
	import { languages } from '@codemirror/language-data';

	import { oneDark } from '@codemirror/theme-one-dark';

	import { onMount, getContext, tick, onDestroy } from 'svelte';

	import { createPyodideWorker } from '$lib/pyodide/createPyodideWorker';

	import { formatPythonCode } from '$lib/apis/utils';
	import { toast } from 'svelte-sonner';
	import { user } from '$lib/stores';

	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	const i18n = getContext<Readable<I18n>>('i18n');

	export let boilerplate = '';
	export let value = '';
	export let className = 'text-sm';

	export let onSave: () => unknown = () => {};
	export let onChange: (value: string) => unknown = () => {};

	let _value = '';

	$: updateValue(value);

	const updateValue = (nextValue: string): void => {
		if (_value !== nextValue) {
			const changes = findChanges(_value, nextValue);
			_value = nextValue;

			if (codeEditor && changes.length > 0) {
				codeEditor.dispatch({ changes });
			}
		}
	};

	/**
	 * Finds multiple diffs in two strings and generates minimal change edits.
	 */
	function findChanges(oldStr: string, newStr: string): ChangeSpec[] {
		// Find the start of the difference
		let start = 0;
		while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
			start++;
		}
		// If equal, nothing to change
		if (oldStr === newStr) return [];
		// Find the end of the difference by comparing backwards
		let endOld = oldStr.length,
			endNew = newStr.length;
		while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
			endOld--;
			endNew--;
		}
		return [
			{
				from: start,
				to: endOld,
				insert: newStr.slice(start, endNew)
			}
		];
	}

	export let id = '';
	export let lang = '';

	let codeEditor: EditorView | null = null;
	let container: HTMLDivElement;
	let activeFormat: object | null = null;
	let cancelFormatting: (() => void) | null = null;

	export const focus = (): void => {
		codeEditor?.focus();
	};

	let isDarkMode = false;
	let editorTheme = new Compartment();
	let editorLanguage = new Compartment();

	const getLang = async (): Promise<LanguageSupport | undefined> => {
		const language = languages.find((l) => l.alias.includes(lang));
		return await language?.load();
	};

	let pyodideWorkerInstance: Worker | null = null;

	const getPyodideWorker = (): Worker => {
		if (!pyodideWorkerInstance) {
			pyodideWorkerInstance = createPyodideWorker();
		}
		return pyodideWorkerInstance;
	};

	// Generate unique IDs for requests
	let _formatReqId = 0;

	const formatPythonCodePyodide = (code: string): Promise<{ code: string | null }> => {
		cancelFormatting?.();
		return new Promise((resolve, reject) => {
			const id = `format-${++_formatReqId}`;
			let timeout: ReturnType<typeof setTimeout>;
			const worker = getPyodideWorker();

			const startTag = `--||CODE-START-${id}||--`;
			const endTag = `--||CODE-END-${id}||--`;

			const script = `
import black
print("${startTag}")
print(black.format_str("""${code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/"/g, '\\"')}""", mode=black.Mode()))
print("${endTag}")
`;

			const packages = ['black'];

			const cleanup = (): void => {
				clearTimeout(timeout);
				worker.removeEventListener('message', handleMessage);
				worker.removeEventListener('error', handleError);
				if (cancelFormatting === cancel) cancelFormatting = null;
			};
			const cancel = (): void => {
				cleanup();
				resolve({ code: null });
			};
			cancelFormatting = cancel;

			function handleMessage(event: MessageEvent<unknown>): void {
				if (!event.data || typeof event.data !== 'object') return;
				const { id: eventId, stdout, stderr } = event.data as Record<string, unknown>;
				if (eventId !== id) return; // Only handle our message
				cleanup();

				if (stderr) {
					reject(stderr);
				} else {
					const extractBetweenDelimiters = (
						stdout: string,
						start: string,
						end: string
					): string | null => {
						const startIdx = stdout.indexOf(start);
						const endIdx = stdout.indexOf(end, startIdx + start.length);
						if (startIdx === -1 || endIdx === -1) return null;
						return stdout.slice(startIdx + start.length, endIdx).trim();
					};

					const formatted = extractBetweenDelimiters(
						stdout && typeof stdout === 'string' ? stdout : '',
						startTag,
						endTag
					);

					resolve({ code: formatted });
				}
			}

			function handleError(event: ErrorEvent): void {
				cleanup();
				reject(event.message || 'Pyodide worker error');
			}

			worker.addEventListener('message', handleMessage);
			worker.addEventListener('error', handleError);

			// Timeout
			timeout = setTimeout(() => {
				cleanup();
				try {
					worker.terminate();
				} catch {
					console.warn('Failed to terminate formatter worker');
				}
				pyodideWorkerInstance = null;
				reject('Execution Time Limit Exceeded');
			}, 60000);
			try {
				worker.postMessage({ id, code: script, packages });
			} catch (error) {
				cleanup();
				reject(error);
			}
		});
	};

	export const formatPythonCodeHandler = async (): Promise<boolean> => {
		if (codeEditor) {
			const editor = codeEditor;
			const original = _value;
			const request = {};
			activeFormat = request;
			const res = await (
				$user?.role === 'admin'
					? formatPythonCode(localStorage.token, _value)
					: formatPythonCodePyodide(_value)
			).catch((error) => {
				if (activeFormat === request && codeEditor === editor) toast.error(`${error}`);
				return null;
			});
			if (activeFormat !== request || codeEditor !== editor || _value !== original) return false;
			activeFormat = null;
			if (res && typeof res.code === 'string' && res.code) {
				const formattedCode = res.code;
				editor.dispatch({
					changes: [{ from: 0, to: editor.state.doc.length, insert: formattedCode }]
				});

				await tick();

				if (codeEditor === editor) toast.success($i18n.t('Code formatted successfully'));
				return true;
			}
			return false;
		}
		return false;
	};

	let extensions: Extension[] = [
		basicSetup,
		keymap.of([{ key: 'Tab', run: acceptCompletion }, indentWithTab]),
		indentUnit.of('    '),
		placeholder($i18n.t('Enter your code here...')),
		EditorView.updateListener.of((e) => {
			if (e.docChanged) {
				_value = e.state.doc.toString();
				onChange(_value);
			}
		}),
		editorTheme.of([]),
		editorLanguage.of([])
	];

	$: if (lang) {
		setLanguage();
	}

	const setLanguage = async (): Promise<void> => {
		const language = await getLang();
		if (language && codeEditor) {
			codeEditor.dispatch({
				effects: editorLanguage.reconfigure(language)
			});
		}
	};

	onMount(() => {
		if (value === '') {
			value = boilerplate;
		}

		_value = value;

		// Check if html class has dark mode
		isDarkMode = document.documentElement.classList.contains('dark');

		// python code editor, highlight python code
		const editor = new EditorView({
			state: EditorState.create({
				doc: _value,
				extensions: extensions
			}),
			parent: container
		});
		codeEditor = editor;

		if (isDarkMode) {
			editor.dispatch({
				effects: editorTheme.reconfigure(oneDark)
			});
		}

		// listen to html class changes this should fire only when dark mode is toggled
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
					const _isDarkMode = document.documentElement.classList.contains('dark');

					if (_isDarkMode !== isDarkMode) {
						isDarkMode = _isDarkMode;
						if (_isDarkMode) {
							editor.dispatch({
								effects: editorTheme.reconfigure(oneDark)
							});
						} else {
							editor.dispatch({
								effects: editorTheme.reconfigure([])
							});
						}
					}
				}
			});
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});

		const keydownHandler = async (e: KeyboardEvent): Promise<void> => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();

				onSave();
			}

			// Format code when Ctrl + Shift + F is pressed
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
				e.preventDefault();
				await formatPythonCodeHandler();
			}
		};

		document.addEventListener('keydown', keydownHandler);

		return () => {
			observer.disconnect();
			document.removeEventListener('keydown', keydownHandler);
			// Must destroy EditorView so CodeMirror releases internal DOMObserver and DOM refs
			if (codeEditor) {
				codeEditor.destroy();
				codeEditor = null;
			}
		};
	});

	onDestroy(() => {
		activeFormat = null;
		cancelFormatting?.();
		if (pyodideWorkerInstance) {
			pyodideWorkerInstance.terminate();
		}
	});
</script>

<div
	bind:this={container}
	id="code-textarea-{id}"
	class="{className} h-full w-full min-w-0 overflow-hidden"
></div>
