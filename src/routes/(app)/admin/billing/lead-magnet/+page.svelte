<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getLeadMagnetConfig, updateLeadMagnetConfig } from '$lib/apis/admin/billing';
	import type { LeadMagnetConfig } from '$lib/apis/admin/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let saving = false;
	let errorMessage: string | null = null;

	let enabled = false;
	let cycleDays = '30';
	let tokensInput = '0';
	let tokensOutput = '0';
	let images = '0';
	let ttsSeconds = '0';
	let sttSeconds = '0';
	let configVersion: number | null = null;

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await loadConfig();
	});

	const loadConfig = async (): Promise<void> => {
		loading = true;
		errorMessage = null;
		try {
			const config = await getLeadMagnetConfig(localStorage.token);
			if (!config) {
				errorMessage = $i18n.t('Failed to load lead magnet configuration');
				return;
			}
			applyConfig(config);
		} catch (error) {
			console.error('Failed to load lead magnet config:', error);
			errorMessage = $i18n.t('Failed to load lead magnet configuration');
		} finally {
			loading = false;
		}
	};

	const applyConfig = (config: LeadMagnetConfig) => {
		enabled = config.enabled;
		cycleDays = String(config.cycle_days ?? 30);
		tokensInput = String(config.quotas?.tokens_input ?? 0);
		tokensOutput = String(config.quotas?.tokens_output ?? 0);
		images = String(config.quotas?.images ?? 0);
		ttsSeconds = String(config.quotas?.tts_seconds ?? 0);
		sttSeconds = String(config.quotas?.stt_seconds ?? 0);
		configVersion = config.config_version ?? null;
	};

	const parsePositiveInt = (value: string, label: string): number | null => {
		const parsed = Number.parseInt(value, 10);
		if (!Number.isFinite(parsed) || parsed < 0) {
			toast.error($i18n.t('{label} must be a non-negative integer', { label }));
			return null;
		}
		return parsed;
	};

	const handleSave = async (): Promise<void> => {
		if (saving) return;
		saving = true;

		const parsedCycleDays = parsePositiveInt(cycleDays, $i18n.t('Cycle days'));
		const parsedTokensInput = parsePositiveInt(tokensInput, $i18n.t('Input tokens'));
		const parsedTokensOutput = parsePositiveInt(tokensOutput, $i18n.t('Output tokens'));
		const parsedImages = parsePositiveInt(images, $i18n.t('Images'));
		const parsedTtsSeconds = parsePositiveInt(ttsSeconds, $i18n.t('TTS seconds'));
		const parsedSttSeconds = parsePositiveInt(sttSeconds, $i18n.t('STT seconds'));

		if (
			parsedCycleDays === null ||
			parsedCycleDays < 1 ||
			parsedTokensInput === null ||
			parsedTokensOutput === null ||
			parsedImages === null ||
			parsedTtsSeconds === null ||
			parsedSttSeconds === null
		) {
			if (parsedCycleDays !== null && parsedCycleDays < 1) {
				toast.error($i18n.t('Cycle days must be at least 1'));
			}
			saving = false;
			return;
		}

		try {
			const updated = await updateLeadMagnetConfig(localStorage.token, {
				enabled,
				cycle_days: parsedCycleDays,
				quotas: {
					tokens_input: parsedTokensInput,
					tokens_output: parsedTokensOutput,
					images: parsedImages,
					tts_seconds: parsedTtsSeconds,
					stt_seconds: parsedSttSeconds
				}
			});
			if (!updated) {
				toast.error($i18n.t('Failed to update lead magnet configuration'));
				saving = false;
				return;
			}
			applyConfig(updated);
			toast.success($i18n.t('Lead magnet configuration saved'));
		} catch (error) {
			console.error('Failed to update lead magnet config:', error);
			toast.error($i18n.t('Failed to update lead magnet configuration'));
		} finally {
			saving = false;
		}
	};
</script>

<svelte:head>
	<title>
		{$i18n.t('Lead magnet')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loading}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else if errorMessage}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">{errorMessage}</div>
			<button
				type="button"
				on:click={loadConfig}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else}
	<div class="w-full">
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Lead magnet')}</div>
				</div>
			</div>
			<div class="text-sm text-gray-500">
				{$i18n.t('Configure free access quotas for models marked as lead magnet.')}
			</div>
		</div>

		<div
			class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
		>
			<div class="flex items-center justify-between mb-4">
				<div class="text-sm font-medium">{$i18n.t('Status')}</div>
				<Switch
					state={enabled}
					on:change={(e) => {
						enabled = e.detail;
					}}
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('Cycle days')}</span>
					<input
						type="number"
						min="1"
						bind:value={cycleDays}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('Input tokens')}</span>
					<input
						type="number"
						min="0"
						bind:value={tokensInput}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('Output tokens')}</span>
					<input
						type="number"
						min="0"
						bind:value={tokensOutput}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('Images')}</span>
					<input
						type="number"
						min="0"
						bind:value={images}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('TTS seconds')}</span>
					<input
						type="number"
						min="0"
						bind:value={ttsSeconds}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs text-gray-500">{$i18n.t('STT seconds')}</span>
					<input
						type="number"
						min="0"
						bind:value={sttSeconds}
						class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
					/>
				</label>
			</div>

			<div class="flex items-center justify-between mt-4">
				<div class="text-xs text-gray-500">
					{$i18n.t('Config version')}: {configVersion ?? 0}
				</div>
				<button
					type="button"
					on:click={handleSave}
					disabled={saving}
					class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60"
				>
					{#if saving}
						<div class="flex items-center gap-2">
							<Spinner className="size-4" />
							<span>{$i18n.t('Saving')}...</span>
						</div>
					{:else}
						{$i18n.t('Save changes')}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
