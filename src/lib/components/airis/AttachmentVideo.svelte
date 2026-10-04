<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { toast } from 'svelte-sonner';

	export let src: string;
	const i18n = getContext<Writable<I18n>>('i18n');
	let captions = '';
	let revision = 0;

	const addCaptions = async (event: Event): Promise<void> => {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		const current = ++revision;
		if (!file) return;
		try {
			if (file.size > 5 * 1024 * 1024 || !/^\uFEFF?WEBVTT(?:[ \t\r\n]|$)/.test(await file.text())) {
				throw new Error('Invalid WebVTT');
			}
			if (current !== revision) return;
			const next = URL.createObjectURL(file);
			if (captions) URL.revokeObjectURL(captions);
			captions = next;
		} catch (error) {
			console.warn('Unable to read local subtitles', error);
			if (current === revision) toast.error($i18n.t('Invalid subtitles file'));
		}
	};

	onDestroy(() => {
		revision++;
		if (captions) URL.revokeObjectURL(captions);
	});
</script>

<video {src} controls class="max-h-96 rounded-lg">
	<track kind="captions" src={captions || undefined} default />
</video>
<label class="block mt-1 text-xs text-gray-600 dark:text-gray-400">
	{$i18n.t('Add subtitles (.vtt)')}
	<input type="file" accept=".vtt,text/vtt" on:change={addCaptions} />
</label>
