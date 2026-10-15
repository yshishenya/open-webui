<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import {
		getPromptById,
		updatePromptById,
		type PromptForm,
		type PromptRecord
	} from '$lib/apis/prompts';
	import { page } from '$app/stores';
	import PromptEditor from '$lib/components/workspace/Prompts/PromptEditor.svelte';
	const i18n = getContext<Writable<i18nType>>('i18n');
	let prompt: PromptRecord | null = null;
	let disabled = true;
	let alive = true;
	let saving = false;
	const controller = new AbortController();
	onDestroy(() => {
		alive = false;
		controller.abort();
	});
	$: promptId = $page.params.id;
	const onSubmit = async (draft: PromptForm): Promise<boolean> => {
		if (!alive || disabled || saving) return false;
		saving = true;
		try {
			const updated = await updatePromptById(localStorage.token, draft, controller.signal);
			if (!updated) throw new Error('Failed to update prompt.');
			if (!alive) return false;
			prompt = updated;
			toast.success($i18n.t('Prompt updated successfully'));
			return true;
		} catch (error) {
			if (alive) toast.error(`${error}`);
			return false;
		} finally {
			if (alive) saving = false;
		}
	};
	onMount(async () => {
		if (!promptId) {
			await goto('/workspace/prompts');
			return;
		}
		try {
			const result = await getPromptById(localStorage.token, promptId, controller.signal);
			if (!alive) return;
			if (!result) {
				await goto('/workspace/prompts');
				return;
			}
			disabled = !(result.write_access ?? false);
			prompt = result;
		} catch (error) {
			if (alive) toast.error(`${error}`);
		}
	});
</script>

{#if prompt}
	<PromptEditor {prompt} {onSubmit} {disabled} edit />
{/if}
