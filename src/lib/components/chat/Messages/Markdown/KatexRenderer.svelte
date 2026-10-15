<script lang="ts" context="module">
	import type { renderToString as katexRenderToString } from 'katex';

	// Module-level singleton: load katex once, share across all KatexRenderer instances
	let katexRenderer: Promise<typeof katexRenderToString> | null = null;
	function getKatexRenderer(): Promise<typeof katexRenderToString> {
		if (!katexRenderer) {
			katexRenderer = Promise.all([
				import('katex'),
				import('katex/contrib/mhchem'),
				import('katex/dist/katex.min.css')
			])
				.then(([katex]) => katex.renderToString)
				.catch((cause: unknown) => {
					katexRenderer = null;
					throw cause;
				});
		}
		return katexRenderer;
	}
</script>

<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { sanitizedHtml } from '$lib/utils/airis/sanitized_html';
	import { copyToClipboard } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	const i18n = getContext<import('svelte/store').Writable<import('i18next').i18n>>('i18n');

	export let content: string;
	export let displayMode: boolean = false;

	let renderToString: typeof katexRenderToString | null = null;

	onMount(() => {
		let active = true;
		getKatexRenderer()
			.then((render) => {
				if (active) renderToString = render;
			})
			.catch((cause: unknown) => {
				if (active) console.error('Formula renderer unavailable:', cause);
			});
		return () => {
			active = false;
		};
	});

	const copyFormula = (): void => {
		copyToClipboard(content);
		toast.success($i18n.t('Copied to clipboard'));
	};

	// Cache rendered HTML — only re-compute when content, displayMode, or renderToString changes,
	// not on every parent re-render during streaming
	let renderedHTML: string = '';
	$: if (renderToString) {
		try {
			renderedHTML = renderToString(content, { displayMode, throwOnError: false });
		} catch {
			// throwOnError only suppresses ParseError; RangeError on deep nesting escapes, so escape the fallback (never {@html} raw source)
			renderedHTML = content
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;');
		}
	}
</script>

{#if renderToString && renderedHTML}
	<svelte:element
		this={displayMode ? 'div' : 'span'}
		class="cursor-pointer"
		role="button"
		tabindex="0"
		aria-label={$i18n.t('Copy to clipboard')}
		on:click={copyFormula}
		on:keydown={(event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				copyFormula();
			}
		}}
		use:sanitizedHtml={renderedHTML}
	/>
{/if}
