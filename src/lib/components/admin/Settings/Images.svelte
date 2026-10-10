<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { createEventDispatcher, onMount, onDestroy, getContext } from 'svelte';
	import { config as backendConfig, user } from '$lib/stores';

	import { getBackendConfig } from '$lib/apis';
	import {
		getImageGenerationModels,
		getConfig,
		updateConfig,
		verifyConfigUrl,
		type ImageConfig,
		type ImageModel,
		type ImageWorkflowNode
	} from '$lib/apis/images';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Textarea from '$lib/components/common/Textarea.svelte';
	import CodeEditorModal from '$lib/components/common/CodeEditorModal.svelte';
	import SettingsSelect from '$lib/components/common/SettingsSelect.svelte';
	import AdminSettingField from './AdminSettingField.svelte';
	import AdminSettingRow from './AdminSettingRow.svelte';
	import AdminSettingSection from './AdminSettingSection.svelte';

	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import { getErrorMessage } from '$lib/utils/airis/error_message';

	const dispatch = createEventDispatcher();

	const i18n = getContext<Writable<i18nType>>('i18n');

	let loading = false;

	let models: ImageModel[] | null = null;
	type ImageSettingsForm = Omit<
		ImageConfig,
		| 'AUTOMATIC1111_PARAMS'
		| 'IMAGES_OPENAI_API_PARAMS'
		| 'AUTOMATIC1111_API_AUTH'
		| 'IMAGE_SIZE'
		| 'IMAGE_EDIT_SIZE'
		| 'IMAGE_STEPS'
	> & {
		AUTOMATIC1111_PARAMS: string;
		IMAGES_OPENAI_API_PARAMS: string;
		AUTOMATIC1111_API_AUTH: string;
		IMAGE_SIZE: string;
		IMAGE_EDIT_SIZE: string;
		IMAGE_STEPS: number | undefined;
	};
	let config: ImageSettingsForm | null = null;
	let destroyed = false;
	let modelRequest = 0;
	const workflowReads = { COMFYUI_WORKFLOW: 0, IMAGES_EDIT_COMFYUI_WORKFLOW: 0 };
	const lifetime = new AbortController();
	onDestroy(() => {
		destroyed = true;
		modelRequest++;
		lifetime.abort();
	});
	const inputClass =
		'w-full h-7 rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500';
	const textareaClass =
		'w-full rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 py-1.5 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500';

	let showComfyUIWorkflowEditor = false;
	let REQUIRED_WORKFLOW_NODES = [
		{
			type: 'prompt',
			key: 'text',
			node_ids: ''
		},
		{
			type: 'model',
			key: 'ckpt_name',
			node_ids: ''
		},
		{
			type: 'width',
			key: 'width',
			node_ids: ''
		},
		{
			type: 'height',
			key: 'height',
			node_ids: ''
		},
		{
			type: 'steps',
			key: 'steps',
			node_ids: ''
		},
		{
			type: 'seed',
			key: 'seed',
			node_ids: ''
		}
	];

	let showComfyUIEditWorkflowEditor = false;
	let REQUIRED_EDIT_WORKFLOW_NODES = [
		{
			type: 'image',
			key: 'image',
			node_ids: ''
		},
		{
			type: 'prompt',
			key: 'prompt',
			node_ids: ''
		},
		{
			type: 'model',
			key: 'unet_name',
			node_ids: ''
		},
		{
			type: 'width',
			key: 'width',
			node_ids: ''
		},
		{
			type: 'height',
			key: 'height',
			node_ids: ''
		}
	];

	const getModels = async (): Promise<void> => {
		const request = ++modelRequest;
		const engine = config?.IMAGE_GENERATION_ENGINE;
		try {
			const response = await getImageGenerationModels(localStorage.token, lifetime.signal);
			if (
				!destroyed &&
				request === modelRequest &&
				engine === config?.IMAGE_GENERATION_ENGINE &&
				config?.ENABLE_IMAGE_GENERATION
			)
				models = response;
		} catch (error) {
			if (!destroyed && request === modelRequest) toast.error(getErrorMessage(error));
		}
	};

	const parseObject = (value: unknown, allowEmpty = false): Record<string, unknown> => {
		const parsed: unknown =
			typeof value === 'string' ? JSON.parse(allowEmpty ? value.trim() || '{}' : value) : value;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
			throw new Error($i18n.t('Invalid JSON format'));
		return parsed as Record<string, unknown>;
	};

	const workflowNodes = (
		nodes: { type: string; key: string; node_ids: string }[]
	): ImageWorkflowNode[] =>
		nodes.map((node) => ({
			...node,
			node_ids: node.node_ids
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean)
		}));

	const updateConfigHandler = async (verify = false): Promise<ImageConfig | null> => {
		if (!config || loading || destroyed) return null;
		loading = true;
		try {
			if (config.ENABLE_IMAGE_GENERATION) {
				const credentials: Record<string, [string, string]> = {
					automatic1111: [config.AUTOMATIC1111_BASE_URL, 'AUTOMATIC1111 Base URL is required.'],
					comfyui: [config.COMFYUI_BASE_URL, 'ComfyUI Base URL is required.'],
					openai: [config.IMAGES_OPENAI_API_KEY, 'OpenAI API Key is required.'],
					gemini: [config.IMAGES_GEMINI_API_KEY, 'Gemini API Key is required.']
				};
				const required = credentials[config.IMAGE_GENERATION_ENGINE || 'automatic1111'];
				if (required && !required[0].trim()) throw new Error($i18n.t(required[1]));
			}
			if (config.COMFYUI_WORKFLOW) parseObject(config.COMFYUI_WORKFLOW);
			if (config.IMAGES_EDIT_COMFYUI_WORKFLOW) parseObject(config.IMAGES_EDIT_COMFYUI_WORKFLOW);
			if (
				!Number.isInteger(config.IMAGE_STEPS) ||
				config.IMAGE_STEPS === undefined ||
				config.IMAGE_STEPS < 0
			)
				throw new Error($i18n.t('Enter Number of Steps (e.g. 50)'));
			const payload: ImageConfig = {
				...config,
				IMAGE_STEPS: config.IMAGE_STEPS,
				AUTOMATIC1111_PARAMS: parseObject(config.AUTOMATIC1111_PARAMS, true),
				IMAGES_OPENAI_API_PARAMS: parseObject(config.IMAGES_OPENAI_API_PARAMS, true),
				COMFYUI_WORKFLOW_NODES: config.COMFYUI_WORKFLOW
					? workflowNodes(REQUIRED_WORKFLOW_NODES)
					: config.COMFYUI_WORKFLOW_NODES,
				IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: config.IMAGES_EDIT_COMFYUI_WORKFLOW
					? workflowNodes(REQUIRED_EDIT_WORKFLOW_NODES)
					: config.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES
			};
			// Invalidate the initial model list before the saved engine changes on the server.
			modelRequest++;
			const response = await updateConfig(localStorage.token, payload, lifetime.signal);
			if (destroyed) return null;
			if (verify && ['automatic1111', 'comfyui'].includes(payload.IMAGE_GENERATION_ENGINE)) {
				const verified = await verifyConfigUrl(localStorage.token, lifetime.signal);
				if (destroyed) return null;
				if (verified) toast.success($i18n.t('Server connection verified'));
			}
			// Saving succeeded; ancillary refreshes must not leave the Save button pending.
			void getBackendConfig()
				.then((value) => {
					if (!destroyed) backendConfig.set(value);
				})
				.catch((error) => {
					if (!destroyed) toast.error(getErrorMessage(error));
				});
			if (response.ENABLE_IMAGE_GENERATION) void getModels();
			else models = null;
			return response;
		} catch (error) {
			if (!destroyed) toast.error(getErrorMessage(error));
			return null;
		} finally {
			loading = false;
		}
	};

	const saveHandler = async (): Promise<void> => {
		const response = await updateConfigHandler();
		if (response && !destroyed) dispatch('save');
	};

	const uploadWorkflow = async (
		event: Event,
		field: 'COMFYUI_WORKFLOW' | 'IMAGES_EDIT_COMFYUI_WORKFLOW'
	): Promise<void> => {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const file = input.files?.[0];
		const draft = config;
		if (!file || !draft || destroyed) return;
		const previous = draft[field];
		const request = ++workflowReads[field];
		input.value = '';
		try {
			const text = await file.text();
			if (
				destroyed ||
				config !== draft ||
				request !== workflowReads[field] ||
				draft[field] !== previous
			)
				return;
			parseObject(text);
			config[field] = text;
		} catch (error) {
			if (!destroyed) toast.error(getErrorMessage(error));
		}
	};

	const formatJSON = (value: string | Record<string, unknown> | null): string => {
		if (typeof value !== 'string') return JSON.stringify(value ?? {}, null, 2);
		try {
			return JSON.stringify(JSON.parse(value), null, 2);
		} catch {
			return value;
		}
	};

	onMount(async () => {
		if ($user?.role !== 'admin') return;
		try {
			const response = await getConfig(localStorage.token, lifetime.signal);
			if (destroyed) return;
			config = {
				...response,
				AUTOMATIC1111_PARAMS: formatJSON(response.AUTOMATIC1111_PARAMS),
				IMAGES_OPENAI_API_PARAMS: formatJSON(response.IMAGES_OPENAI_API_PARAMS),
				AUTOMATIC1111_API_AUTH:
					typeof response.AUTOMATIC1111_API_AUTH === 'string'
						? response.AUTOMATIC1111_API_AUTH
						: response.AUTOMATIC1111_API_AUTH
							? JSON.stringify(response.AUTOMATIC1111_API_AUTH)
							: '',
				COMFYUI_WORKFLOW: response.COMFYUI_WORKFLOW ? formatJSON(response.COMFYUI_WORKFLOW) : '',
				IMAGES_EDIT_COMFYUI_WORKFLOW: response.IMAGES_EDIT_COMFYUI_WORKFLOW
					? formatJSON(response.IMAGES_EDIT_COMFYUI_WORKFLOW)
					: '',
				IMAGE_SIZE: response.IMAGE_SIZE ?? '',
				IMAGE_EDIT_SIZE: response.IMAGE_EDIT_SIZE ?? '',
				IMAGE_STEPS: response.IMAGE_STEPS ?? 50
			};
			const mapNodes = (
				defaults: typeof REQUIRED_WORKFLOW_NODES,
				nodes: ImageWorkflowNode[]
			): typeof REQUIRED_WORKFLOW_NODES =>
				defaults.map((node) => {
					const saved = nodes.find((item) => item.type === node.type);
					return saved ? { ...saved, node_ids: saved.node_ids.join(',') } : node;
				});
			REQUIRED_WORKFLOW_NODES = mapNodes(REQUIRED_WORKFLOW_NODES, response.COMFYUI_WORKFLOW_NODES);
			REQUIRED_EDIT_WORKFLOW_NODES = mapNodes(
				REQUIRED_EDIT_WORKFLOW_NODES,
				response.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES
			);
			if (config.ENABLE_IMAGE_GENERATION) void getModels();
		} catch (error) {
			if (!destroyed) toast.error(getErrorMessage(error));
		}
	});
</script>

<form
	class="flex h-full flex-col justify-between text-sm"
	on:submit|preventDefault={async () => {
		saveHandler();
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Images')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		{#if config}
			<div class="flex flex-col">
				<AdminSettingSection first>
					<AdminSettingRow
						label={$i18n.t('Image Generation')}
						description={$i18n.t('Allow users to generate images from prompts.')}
						let:labelId
					>
						<Switch bind:state={config.ENABLE_IMAGE_GENERATION} ariaLabelledbyId={labelId} />
					</AdminSettingRow>
				</AdminSettingSection>

				<AdminSettingSection title={$i18n.t('Create Image')}>
					<AdminSettingRow
						label={$i18n.t('Image Generation Engine')}
						description={$i18n.t('Choose the provider used for image generation.')}
					>
						<SettingsSelect
							bind:value={config.IMAGE_GENERATION_ENGINE}
							placeholder={$i18n.t('Select Engine')}
						>
							<option value="openai">{$i18n.t('Default (Open AI)')}</option>
							<option value="comfyui">{$i18n.t('ComfyUI')}</option>
							<option value="automatic1111">{$i18n.t('Automatic1111')}</option>
							<option value="gemini">{$i18n.t('Gemini')}</option>
						</SettingsSelect>
					</AdminSettingRow>

					{#if config.ENABLE_IMAGE_GENERATION}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<AdminSettingField label={$i18n.t('Model')}>
								<input
									list="model-list"
									class={inputClass}
									bind:value={config.IMAGE_GENERATION_MODEL}
									placeholder={$i18n.t('Select a model')}
									required
								/>

								<datalist id="model-list">
									{#each models ?? [] as model}
										<option value={model.id}>{model.name}</option>
									{/each}
								</datalist>
							</AdminSettingField>

							<AdminSettingField label={$i18n.t('Image Size')}>
								<input
									class={inputClass}
									placeholder={$i18n.t('Enter Image Size (e.g. 512x512)')}
									bind:value={config.IMAGE_SIZE}
								/>
							</AdminSettingField>

							{#if ['comfyui', 'automatic1111', ''].includes(config?.IMAGE_GENERATION_ENGINE)}
								<AdminSettingField label={$i18n.t('Steps')}>
									<input
										class={inputClass}
										placeholder={$i18n.t('Enter Number of Steps (e.g. 50)')}
										type="number"
										min="0"
										step="1"
										bind:value={config.IMAGE_STEPS}
										required
									/>
								</AdminSettingField>
							{/if}
						</div>

						<AdminSettingRow
							label={$i18n.t('Image Prompt Generation')}
							description={$i18n.t('Generate an image prompt before sending the request.')}
							let:labelId
						>
							<Switch
								bind:state={config.ENABLE_IMAGE_PROMPT_GENERATION}
								ariaLabelledbyId={labelId}
							/>
						</AdminSettingRow>
					{/if}

					{#if config?.IMAGE_GENERATION_ENGINE === 'openai'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<AdminSettingField label={$i18n.t('API Base URL')}>
								<input
									class={inputClass}
									placeholder={$i18n.t('API Base URL')}
									bind:value={config.IMAGES_OPENAI_API_BASE_URL}
								/>
							</AdminSettingField>

							<AdminSettingField label={$i18n.t('API Key')}>
								<SensitiveInput
									variant="settings"
									placeholder={$i18n.t('API Key')}
									bind:value={config.IMAGES_OPENAI_API_KEY}
									required={false}
								/>
							</AdminSettingField>
						</div>

						<AdminSettingField label={$i18n.t('API Version')}>
							<input
								class={inputClass}
								placeholder={$i18n.t('API Version')}
								bind:value={config.IMAGES_OPENAI_API_VERSION}
							/>
						</AdminSettingField>

						<AdminSettingField
							label={$i18n.t('Additional Parameters')}
							description={$i18n.t(
								'Send extra JSON parameters with each image generation request.'
							)}
						>
							<Textarea
								className={textareaClass}
								bind:value={config.IMAGES_OPENAI_API_PARAMS}
								placeholder={$i18n.t('Enter additional parameters in JSON format')}
								minSize={100}
							/>
						</AdminSettingField>
					{:else if (config?.IMAGE_GENERATION_ENGINE ?? 'automatic1111') === 'automatic1111'}
						<AdminSettingField
							label={$i18n.t('Base URL')}
							description={$i18n.t(
								'Connect to a stable-diffusion-webui server running with the `--api` flag.'
							)}
						>
							<div class="flex w-full gap-2">
								<input
									class={inputClass}
									placeholder={$i18n.t('Enter URL (e.g. http://127.0.0.1:7860/)')}
									bind:value={config.AUTOMATIC1111_BASE_URL}
								/>
								<button
									class="shrink-0 text-gray-400 transition-colors hover:text-gray-900 dark:text-gray-600 dark:hover:text-white"
									type="button"
									aria-label="verify connection"
									disabled={loading}
									on:click={() => updateConfigHandler(true)}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 20 20"
										fill="currentColor"
										class="w-4 h-4"
									>
										<path
											fill-rule="evenodd"
											d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						</AdminSettingField>

						<AdminSettingField
							label={$i18n.t('API Auth String')}
							description={$i18n.t('Provide the --api-auth username and password when required.')}
						>
							<SensitiveInput
								variant="settings"
								placeholder={$i18n.t('Enter api auth string (e.g. username:password)')}
								bind:value={config.AUTOMATIC1111_API_AUTH}
								required={false}
							/>
						</AdminSettingField>

						<AdminSettingField
							label={$i18n.t('Additional Parameters')}
							description={$i18n.t('Send extra JSON parameters with each AUTOMATIC1111 request.')}
						>
							<Textarea
								className={textareaClass}
								bind:value={config.AUTOMATIC1111_PARAMS}
								placeholder={$i18n.t('Enter additional parameters in JSON format')}
								minSize={100}
							/>
						</AdminSettingField>
					{:else if config?.IMAGE_GENERATION_ENGINE === 'comfyui'}
						<AdminSettingField
							label={$i18n.t('Base URL')}
							description={$i18n.t('Connect to the ComfyUI server used for generation.')}
						>
							<div class="flex w-full gap-2">
								<input
									class={inputClass}
									placeholder={$i18n.t('Enter URL (e.g. http://127.0.0.1:7860/)')}
									bind:value={config.COMFYUI_BASE_URL}
								/>
								<button
									class="shrink-0 text-gray-400 transition-colors hover:text-gray-900 dark:text-gray-600 dark:hover:text-white"
									type="button"
									aria-label="verify connection"
									disabled={loading}
									on:click={() => updateConfigHandler(true)}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 20 20"
										fill="currentColor"
										class="w-4 h-4"
									>
										<path
											fill-rule="evenodd"
											d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						</AdminSettingField>

						<AdminSettingField
							label={$i18n.t('API Key')}
							description={$i18n.t('Use an API key when your ComfyUI server requires one.')}
						>
							<SensitiveInput
								variant="settings"
								placeholder={$i18n.t('sk-1234')}
								bind:value={config.COMFYUI_API_KEY}
								required={false}
							/>
						</AdminSettingField>

						<div>
							<input
								id="upload-comfyui-workflow-input"
								hidden
								type="file"
								accept=".json"
								on:change={(event) => uploadWorkflow(event, 'COMFYUI_WORKFLOW')}
							/>
							<AdminSettingRow
								label={$i18n.t('ComfyUI Workflow')}
								description={$i18n.t(
									'Upload a workflow.json file exported as API format from ComfyUI.'
								)}
							>
								<div class="flex items-center justify-end gap-2">
									{#if config.COMFYUI_WORKFLOW}
										<button
											class="text-xs text-gray-500 transition-colors hover:text-gray-900 hover:underline dark:text-gray-500 dark:hover:text-white"
											type="button"
											aria-label={$i18n.t('Edit workflow.json content')}
											on:click={() => {
												// open code editor modal
												showComfyUIWorkflowEditor = true;
											}}
										>
											{$i18n.t('Edit')}
										</button>
									{/if}

									<Tooltip content={$i18n.t('Click here to upload a workflow.json file.')}>
										<button
											class="text-xs text-gray-500 transition-colors hover:text-gray-900 hover:underline dark:text-gray-500 dark:hover:text-white"
											type="button"
											aria-label={$i18n.t('Click here to upload a workflow.json file.')}
											on:click={() => {
												document.getElementById('upload-comfyui-workflow-input')?.click();
											}}
										>
											{$i18n.t('Upload')}
										</button>
									</Tooltip>
								</div>
							</AdminSettingRow>

							<div>
								<CodeEditorModal
									bind:show={showComfyUIWorkflowEditor}
									value={config.COMFYUI_WORKFLOW}
									lang="json"
									onChange={(e) => {
										if (config && !destroyed) config.COMFYUI_WORKFLOW = e;
									}}
									onSave={() => {
										console.log('Saved');
									}}
								/>
								<!-- {#if config.COMFYUI_WORKFLOW}
								<Textarea
									className="my-1 w-full resize-none rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 py-1.5 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 disabled:text-gray-600 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500"
									rows="10"
										bind:value={config.COMFYUI_WORKFLOW}
									required
								/>
							{/if} -->
							</div>
						</div>

						{#if config.COMFYUI_WORKFLOW}
							<AdminSettingField
								label={$i18n.t('ComfyUI Workflow Nodes')}
								description={$i18n.t('Map workflow node inputs used for image generation.')}
							>
								<div class="flex flex-col gap-1.5 text-xs">
									{#each REQUIRED_WORKFLOW_NODES as node}
										<div class="flex w-full flex-col">
											<div class="shrink-0">
												<div class=" capitalize line-clamp-1 w-20 text-gray-400 dark:text-gray-500">
													{node.type}{node.type === 'prompt' ? '*' : ''}
												</div>
											</div>

											<div class="flex mt-0.5 items-center">
												<div class="">
													<Tooltip content={$i18n.t('Input Key (e.g. text, unet_name, steps)')}>
														<input
															class="{inputClass} w-24"
															placeholder={$i18n.t('Key')}
															bind:value={node.key}
															required
														/>
													</Tooltip>
												</div>

												<div class="px-2 text-gray-400 dark:text-gray-500">:</div>

												<div class="w-full">
													<Tooltip
														content={$i18n.t('Comma separated Node Ids (e.g. 1 or 1,2)')}
														placement="top-start"
													>
														<input
															class={inputClass}
															placeholder={$i18n.t('Node Ids')}
															bind:value={node.node_ids}
														/>
													</Tooltip>
												</div>
											</div>
										</div>
									{/each}
								</div>

								<div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
									{$i18n.t('*Prompt node ID(s) are required for image generation')}
								</div>
							</AdminSettingField>
						{/if}
					{:else if config?.IMAGE_GENERATION_ENGINE === 'gemini'}
						<AdminSettingField
							label={$i18n.t('Base URL')}
							description={$i18n.t('Override the Gemini image generation endpoint.')}
						>
							<input
								class={inputClass}
								placeholder={$i18n.t('API Base URL')}
								bind:value={config.IMAGES_GEMINI_API_BASE_URL}
							/>
						</AdminSettingField>

						<AdminSettingField
							label={$i18n.t('API Key')}
							description={$i18n.t('Use a Gemini API key for image generation.')}
						>
							<SensitiveInput
								variant="settings"
								placeholder={$i18n.t('API Key')}
								bind:value={config.IMAGES_GEMINI_API_KEY}
								required={true}
							/>
						</AdminSettingField>

						<AdminSettingRow
							label={$i18n.t('Gemini Endpoint Method')}
							description={$i18n.t('Select the Gemini endpoint method to call.')}
						>
							<SettingsSelect
								bind:value={config.IMAGES_GEMINI_ENDPOINT_METHOD}
								placeholder={$i18n.t('Select Method')}
							>
								<option value="predict">predict</option>
								<option value="generateContent">generateContent</option>
							</SettingsSelect>
						</AdminSettingRow>
					{/if}
				</AdminSettingSection>

				<AdminSettingSection title={$i18n.t('Edit Image')}>
					<AdminSettingRow
						label={$i18n.t('Image Edit')}
						description={$i18n.t('Allow users to edit existing images.')}
						let:labelId
					>
						<Switch bind:state={config.ENABLE_IMAGE_EDIT} ariaLabelledbyId={labelId} />
					</AdminSettingRow>

					<AdminSettingRow
						label={$i18n.t('Image Edit Engine')}
						description={$i18n.t('Choose the provider used for image edits.')}
					>
						<SettingsSelect
							bind:value={config.IMAGE_EDIT_ENGINE}
							placeholder={$i18n.t('Select Engine')}
						>
							<option value="openai">{$i18n.t('Default (Open AI)')}</option>
							<option value="comfyui">{$i18n.t('ComfyUI')}</option>
							<option value="gemini">{$i18n.t('Gemini')}</option>
						</SettingsSelect>
					</AdminSettingRow>

					{#if config?.ENABLE_IMAGE_GENERATION && config?.ENABLE_IMAGE_EDIT}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<AdminSettingField label={$i18n.t('Model')}>
								<input
									list="model-list"
									class={inputClass}
									bind:value={config.IMAGE_EDIT_MODEL}
									placeholder={$i18n.t('Select a model')}
								/>

								<datalist id="model-list">
									{#each models ?? [] as model}
										<option value={model.id}>{model.name}</option>
									{/each}
								</datalist>
							</AdminSettingField>

							<AdminSettingField label={$i18n.t('Image Size')}>
								<input
									class={inputClass}
									placeholder={$i18n.t('Enter Image Size (e.g. 512x512)')}
									bind:value={config.IMAGE_EDIT_SIZE}
								/>
							</AdminSettingField>
						</div>
					{/if}

					{#if config?.IMAGE_EDIT_ENGINE === 'openai'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<AdminSettingField label={$i18n.t('API Base URL')}>
								<input
									class={inputClass}
									placeholder={$i18n.t('API Base URL')}
									bind:value={config.IMAGES_EDIT_OPENAI_API_BASE_URL}
								/>
							</AdminSettingField>

							<AdminSettingField label={$i18n.t('API Key')}>
								<SensitiveInput
									variant="settings"
									placeholder={$i18n.t('API Key')}
									bind:value={config.IMAGES_EDIT_OPENAI_API_KEY}
									required={false}
								/>
							</AdminSettingField>
						</div>

						<AdminSettingField label={$i18n.t('API Version')}>
							<input
								class={inputClass}
								placeholder={$i18n.t('API Version')}
								bind:value={config.IMAGES_EDIT_OPENAI_API_VERSION}
							/>
						</AdminSettingField>
					{:else if config?.IMAGE_EDIT_ENGINE === 'comfyui'}
						<AdminSettingField
							label={$i18n.t('Base URL')}
							description={$i18n.t('Connect to the ComfyUI server used for image edits.')}
						>
							<div class="flex w-full gap-2">
								<input
									class={inputClass}
									placeholder={$i18n.t('Enter URL (e.g. http://127.0.0.1:7860/)')}
									bind:value={config.IMAGES_EDIT_COMFYUI_BASE_URL}
								/>
							</div>
						</AdminSettingField>

						<AdminSettingField
							label={$i18n.t('API Key')}
							description={$i18n.t('Use an API key when your ComfyUI server requires one.')}
						>
							<SensitiveInput
								variant="settings"
								placeholder={$i18n.t('sk-1234')}
								bind:value={config.IMAGES_EDIT_COMFYUI_API_KEY}
								required={false}
							/>
						</AdminSettingField>

						<div>
							<input
								id="upload-comfyui-edit-workflow-input"
								hidden
								type="file"
								accept=".json"
								on:change={(event) => uploadWorkflow(event, 'IMAGES_EDIT_COMFYUI_WORKFLOW')}
							/>
							<AdminSettingRow
								label={$i18n.t('ComfyUI Workflow')}
								description={$i18n.t(
									'Upload a workflow.json file exported as API format from ComfyUI.'
								)}
							>
								<div class="flex items-center justify-end gap-2">
									{#if config.IMAGES_EDIT_COMFYUI_WORKFLOW}
										<button
											class="text-xs text-gray-500 transition-colors hover:text-gray-900 hover:underline dark:text-gray-500 dark:hover:text-white"
											type="button"
											aria-label={$i18n.t('Edit workflow.json content')}
											on:click={() => {
												// open code editor modal
												showComfyUIEditWorkflowEditor = true;
											}}
										>
											{$i18n.t('Edit')}
										</button>
									{/if}

									<Tooltip content={$i18n.t('Click here to upload a workflow.json file.')}>
										<button
											class="text-xs text-gray-500 transition-colors hover:text-gray-900 hover:underline dark:text-gray-500 dark:hover:text-white"
											type="button"
											aria-label={$i18n.t('Click here to upload a workflow.json file.')}
											on:click={() => {
												document.getElementById('upload-comfyui-edit-workflow-input')?.click();
											}}
										>
											{$i18n.t('Upload')}
										</button>
									</Tooltip>
								</div>
							</AdminSettingRow>

							<CodeEditorModal
								bind:show={showComfyUIEditWorkflowEditor}
								value={config.IMAGES_EDIT_COMFYUI_WORKFLOW}
								lang="json"
								onChange={(e) => {
									if (config && !destroyed) config.IMAGES_EDIT_COMFYUI_WORKFLOW = e;
								}}
								onSave={() => {
									console.log('Saved');
								}}
							/>
						</div>

						{#if config.IMAGES_EDIT_COMFYUI_WORKFLOW}
							<AdminSettingField
								label={$i18n.t('ComfyUI Workflow Nodes')}
								description={$i18n.t('Map workflow node inputs used for image edits.')}
							>
								<div class="flex flex-col gap-1.5 text-xs">
									{#each REQUIRED_EDIT_WORKFLOW_NODES as node}
										<div class="flex w-full flex-col">
											<div class="shrink-0">
												<div class=" capitalize line-clamp-1 w-20 text-gray-400 dark:text-gray-500">
													{node.type}{['prompt', 'image'].includes(node.type) ? '*' : ''}
												</div>
											</div>

											<div class="flex mt-0.5 items-center">
												<div class="">
													<Tooltip content={$i18n.t('Input Key (e.g. text, unet_name, steps)')}>
														<input
															class="{inputClass} w-24"
															placeholder={$i18n.t('Key')}
															bind:value={node.key}
															required
														/>
													</Tooltip>
												</div>

												<div class="px-2 text-gray-400 dark:text-gray-500">:</div>

												<div class="w-full">
													<Tooltip
														content={$i18n.t('Comma separated Node Ids (e.g. 1 or 1,2)')}
														placement="top-start"
													>
														<input
															class={inputClass}
															placeholder={$i18n.t('Node Ids')}
															bind:value={node.node_ids}
														/>
													</Tooltip>
												</div>
											</div>
										</div>
									{/each}
								</div>

								<div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
									{$i18n.t('*Prompt node ID(s) are required for image generation')}
								</div>
							</AdminSettingField>
						{/if}
					{:else if config?.IMAGE_EDIT_ENGINE === 'gemini'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<AdminSettingField label={$i18n.t('Base URL')}>
								<input
									class={inputClass}
									placeholder={$i18n.t('API Base URL')}
									bind:value={config.IMAGES_EDIT_GEMINI_API_BASE_URL}
								/>
							</AdminSettingField>

							<AdminSettingField label={$i18n.t('API Key')}>
								<SensitiveInput
									variant="settings"
									placeholder={$i18n.t('API Key')}
									bind:value={config.IMAGES_EDIT_GEMINI_API_KEY}
									required={true}
								/>
							</AdminSettingField>
						</div>
					{/if}
				</AdminSettingSection>
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-6 text-sm font-normal">
		<button
			class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex items-center gap-2 whitespace-nowrap {loading
				? ' cursor-not-allowed'
				: ''}"
			type="submit"
			disabled={loading || !config}
		>
			{$i18n.t('Save')}

			{#if loading}
				<span class="shrink-0">
					<Spinner />
				</span>
			{/if}
		</button>
	</div>
</form>
