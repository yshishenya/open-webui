<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { onMount, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';

	import { WEBUI_BASE_URL } from '$lib/constants';
	import { config, user, models, settings } from '$lib/stores';
	import { chatCompletion } from '$lib/apis/openai';

	import { splitStream } from '$lib/utils';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');

	let text = '';

	let selectedModelId = '';

	let loading = false;
	let stopResponseFlag = false;
	let responseController: AbortController | null = null;

	let textCompletionAreaElement: HTMLTextAreaElement;

	const scrollToBottom = (): void => {
		const element = textCompletionAreaElement;

		if (element) {
			element.scrollTop = element?.scrollHeight;
		}
	};

	const stopResponse = (): void => {
		stopResponseFlag = true;
		responseController?.abort('User: Stop Response');
	};

	const textCompletionHandler = async (): Promise<void> => {
		const model = $models.find((model) => model.id === selectedModelId);
		if (!model) {
			selectedModelId = '';
			return;
		}

		const [res, controller] = await chatCompletion(
			localStorage.token,
			{
				model: model.id,
				stream: true,
				messages: [
					{
						role: 'assistant',
						content: text
					}
				]
			},
			`${WEBUI_BASE_URL}/api`,
			responseController ?? undefined
		);
		if (!res?.ok || !res.body) throw new Error('Playground response unavailable.');

		const reader = res.body
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(splitStream('\n'))
			.getReader();

		try {
			for (;;) {
				const { value, done } = await reader.read();
				if (done || stopResponseFlag) {
					if (stopResponseFlag) {
						controller.abort('User: Stop Response');
					}
					break;
				}

				try {
					const lines = value.split('\n');

					for (const line of lines) {
						if (line !== '') {
							if (line.trim() === 'data: [DONE]') return;
							const data: { choices?: { delta?: { content?: unknown } }[] } = JSON.parse(
								line.replace(/^data: /, '')
							);
							const content = data.choices?.[0]?.delta?.content;
							if (typeof content === 'string') text += content;
						}
					}
				} catch {
					console.error('Invalid playground stream event.');
				}

				scrollToBottom();
			}
		} finally {
			controller.abort();
			reader.releaseLock();
		}
	};

	const submitHandler = async (): Promise<void> => {
		if (!selectedModelId || loading) return;
		loading = true;
		responseController = new AbortController();
		try {
			await textCompletionHandler();
		} catch {
			if (!stopResponseFlag) {
				console.error('Playground completion failed.');
				toast.error($i18n.t('Something went wrong :/'));
			}
		} finally {
			loading = false;
			stopResponseFlag = false;
			responseController = null;
		}
	};

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
		}

		if ($settings?.models) {
			selectedModelId = $settings?.models[0];
		} else if ($config?.default_models) {
			selectedModelId = $config?.default_models.split(',')[0];
		} else {
			selectedModelId = '';
		}
	});
</script>

<div class=" flex flex-col justify-between w-full overflow-y-auto h-full">
	<div class="mx-auto w-full md:px-0 h-full">
		<div class=" flex flex-col h-full px-2.5">
			<div
				class=" pt-0.5 pb-2.5 flex flex-col justify-between w-full flex-auto overflow-auto h-0"
				id="messages-container"
			>
				<div class=" h-full w-full flex flex-col">
					<div class="flex-1">
						<textarea
							id="text-completion-textarea"
							bind:this={textCompletionAreaElement}
							class="w-full h-full p-3 bg-transparent border border-gray-100/30 dark:border-gray-850/30 outline-hidden resize-none rounded-lg text-sm"
							bind:value={text}
							placeholder={$i18n.t("You're a helpful assistant.")}
						></textarea>
					</div>
				</div>
			</div>

			<div class="pb-3 flex justify-between items-center">
				<div class="flex-1">
					<select
						class="bg-transparent border border-gray-100/30 dark:border-gray-850/30 rounded-lg py-1 px-2 -mx-0.5 text-sm outline-hidden w-full"
						bind:value={selectedModelId}
					>
						{#each $models as model}
							<option value={model.id} class="bg-gray-50 dark:bg-gray-700">{model.name}</option>
						{/each}
					</select>
				</div>

				<div class="flex gap-2 shrink-0 ml-2">
					{#if !loading}
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-lg"
							on:click={() => {
								submitHandler();
							}}
						>
							{$i18n.t('Run')}
						</button>
					{:else}
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-gray-300 text-black transition rounded-lg flex items-center gap-2"
							on:click={() => {
								stopResponse();
							}}
						>
							<Spinner className="size-4" />
							{$i18n.t('Cancel')}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
