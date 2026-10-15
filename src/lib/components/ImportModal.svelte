<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getContext, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	const i18n = getContext<Readable<{ t: (key: string) => string }>>('i18n');

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Modal from '$lib/components/common/Modal.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import { extractFrontmatter, nameToId } from '$lib/utils';

	type ImportedSource = {
		id: string;
		name: string;
		content: string;
		meta: Record<string, unknown>;
	};
	export let show = false;
	export let onImport: (source: ImportedSource) => void | Promise<void> = () => {};
	export let onClose: () => void = () => {};
	export let loadUrlHandler: (url: string, signal?: AbortSignal) => Promise<unknown> = async () =>
		null;
	export let successMessage = '';

	let loading = false;
	let url = '';
	let controller: AbortController | null = null;
	let alive = true;
	let wasOpen = show;
	const cancelImport = (): void => {
		controller?.abort();
		controller = null;
		loading = false;
	};
	$: if (show !== wasOpen) {
		wasOpen = show;
		if (!show) {
			cancelImport();
			onClose();
		}
	}
	onDestroy(() => {
		alive = false;
		cancelImport();
	});

	const submitHandler = async (): Promise<void> => {
		if (loading || !show || !alive) return;
		if (!url.trim()) {
			toast.error($i18n.t('Please enter a valid URL'));
			return;
		}
		loading = true;
		const request = new AbortController();
		controller = request;
		const current = (): boolean =>
			alive && show && controller === request && !request.signal.aborted;
		try {
			const res = await loadUrlHandler(url.trim(), request.signal);
			if (!current()) return;
			if (!res || typeof res !== 'object' || Array.isArray(res))
				throw new Error($i18n.t('Invalid source response'));
			const source = res as Record<string, unknown>;
			if (
				typeof source.name !== 'string' ||
				!source.name.trim() ||
				typeof source.content !== 'string' ||
				(source.id !== undefined && typeof source.id !== 'string') ||
				(source.meta != null && (typeof source.meta !== 'object' || Array.isArray(source.meta)))
			) {
				throw new Error($i18n.t('Invalid source response'));
			}
			const frontmatter = extractFrontmatter(source.content);
			const name = frontmatter.title || source.name;
			await onImport({
				...source,
				id: (source.id as string | undefined) || nameToId(source.name),
				name,
				content: source.content,
				meta: {
					...(source.meta as Record<string, unknown> | null | undefined),
					description: frontmatter.description ?? name
				}
			});
			if (!current()) return;
			toast.success(successMessage || $i18n.t('Source loaded for review in the editor'));
			show = false;
		} catch (error) {
			if (current()) toast.error(getErrorMessage(error));
		} finally {
			if (controller === request) {
				controller = null;
				loading = false;
			}
		}
	};
</script>

<Modal size="sm" bind:show>
	<div>
		<div class=" flex justify-between dark:text-gray-300 px-4 pt-3 pb-1">
			<div class=" text-sm font-medium self-center">{$i18n.t('Import')}</div>
			<button
				class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				aria-label={$i18n.t('Close')}
				on:click={() => {
					show = false;
				}}
			>
				<XMark className={'size-4'} />
			</button>
		</div>

		<div class="flex flex-col md:flex-row w-full px-4 pb-3 md:space-x-4 dark:text-gray-200">
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				<form
					class="flex flex-col w-full"
					on:submit|preventDefault={() => {
						submitHandler();
					}}
				>
					<div class="px-1">
						<div class="flex flex-col w-full">
							<div class=" mb-1 text-xs text-gray-500">{$i18n.t('URL')}</div>

							<div class="flex-1">
								<input
									class="w-full text-sm bg-transparent disabled:text-gray-500 dark:disabled:text-gray-500 outline-hidden"
									type="url"
									aria-label={$i18n.t('URL')}
									disabled={loading}
									bind:value={url}
									placeholder={$i18n.t('Enter the URL to import')}
									required
								/>

								<!-- $i18n.t('Enter the URL of the function to import') -->
							</div>
						</div>
					</div>

					<div class="flex justify-end pt-3 text-sm font-normal">
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex items-center gap-2 whitespace-nowrap {loading
								? ' cursor-not-allowed'
								: ''}"
							type="submit"
							disabled={loading}
						>
							{$i18n.t('Import')}

							{#if loading}
								<span class="shrink-0">
									<Spinner />
								</span>
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>
