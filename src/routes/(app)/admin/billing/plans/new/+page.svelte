<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { createPlan } from '$lib/apis/admin/billing';
	import type { CreatePlanRequest } from '$lib/apis/admin/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import ChevronLeft from '$lib/components/icons/ChevronLeft.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';

	const i18n = getContext('i18n');

	let saving = false;

	// Form data
	let formData: CreatePlanRequest = {
		id: '',
		name: '',
		name_ru: '',
		description: '',
		description_ru: '',
		price: 0,
		currency: 'RUB',
		interval: 'month',
		quotas: {
			tokens_input: 1000000,
			tokens_output: 500000,
			requests: 5000
		},
		features: [],
		is_active: true,
		display_order: 0,
		plan_extra_metadata: {}
	};

	// Auto-generate ID from name
	$: if (formData.name) {
		formData.id = formData.name.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_-]/g, '');
	}

	// Features management
	let newFeature = '';

	const addFeature = () => {
		if (newFeature.trim()) {
			formData.features = [...formData.features, newFeature.trim()];
			newFeature = '';
		}
	};

	const removeFeature = (index: number) => {
		formData.features = formData.features.filter((_, i) => i !== index);
	};

	// Quota helpers
	let unlimitedTokensInput = false;
	let unlimitedTokensOutput = false;
	let unlimitedRequests = false;

	// Default values for when unlimited is toggled off
	const DEFAULT_TOKENS_INPUT = 1000000;
	const DEFAULT_TOKENS_OUTPUT = 500000;
	const DEFAULT_REQUESTS = 5000;

	// Bidirectional reactivity for unlimited toggles
	$: {
		if (unlimitedTokensInput) {
			formData.quotas.tokens_input = null;
		} else if (formData.quotas.tokens_input === null) {
			formData.quotas.tokens_input = DEFAULT_TOKENS_INPUT;
		}
	}
	$: {
		if (unlimitedTokensOutput) {
			formData.quotas.tokens_output = null;
		} else if (formData.quotas.tokens_output === null) {
			formData.quotas.tokens_output = DEFAULT_TOKENS_OUTPUT;
		}
	}
	$: {
		if (unlimitedRequests) {
			formData.quotas.requests = null;
		} else if (formData.quotas.requests === null) {
			formData.quotas.requests = DEFAULT_REQUESTS;
		}
	}

	onMount(async () => {
		if ($user?.role !== 'admin') {
			goto('/');
			return;
		}
	});

	const validateForm = (): boolean => {
		if (!formData.id.trim()) {
			toast.error($i18n.t('Plan ID is required'));
			return false;
		}
		if (!/^[a-z0-9_-]+$/.test(formData.id)) {
			toast.error($i18n.t('Plan ID must contain only lowercase letters, numbers, hyphens and underscores'));
			return false;
		}
		if (!formData.name.trim()) {
			toast.error($i18n.t('Plan name is required'));
			return false;
		}
		if (formData.price < 0) {
			toast.error($i18n.t('Price cannot be negative'));
			return false;
		}
		if (!unlimitedTokensInput && (!formData.quotas.tokens_input || formData.quotas.tokens_input <= 0)) {
			toast.error($i18n.t('Token input quota must be greater than 0'));
			return false;
		}
		if (!unlimitedTokensOutput && (!formData.quotas.tokens_output || formData.quotas.tokens_output <= 0)) {
			toast.error($i18n.t('Token output quota must be greater than 0'));
			return false;
		}
		if (!unlimitedRequests && (!formData.quotas.requests || formData.quotas.requests <= 0)) {
			toast.error($i18n.t('Requests quota must be greater than 0'));
			return false;
		}

		return true;
	};

	const handleSave = async () => {
		if (!validateForm() || saving) return;

		saving = true;
		try {
			const result = await createPlan(localStorage.token, formData);
			if (result) {
				toast.success($i18n.t('Plan created successfully'));
				goto('/admin/billing/plans');
			}
		} catch (error: any) {
			console.error('Failed to create plan:', error);
			toast.error(error?.detail || $i18n.t('Failed to create plan'));
		} finally {
			saving = false;
		}
	};

	const formatNumber = (value: number | null): string => {
		if (value === null) return '∞';
		return new Intl.NumberFormat($i18n.locale).format(value);
	};
</script>

<svelte:head>
	<title>
		{$i18n.t('Create Plan')} • {$WEBUI_NAME}
	</title>
</svelte:head>

<div class="flex flex-col justify-between w-full overflow-y-auto h-full">
	<div class="mx-auto w-full md:px-0 h-full">
		<form
			class="flex flex-col max-h-[100dvh] h-full"
			on:submit|preventDefault={handleSave}
		>
			<div class="flex flex-col flex-1 overflow-auto h-0 rounded-lg">
				<!-- Header -->
				<div class="w-full mb-2 flex flex-col gap-0.5">
					<div class="flex w-full items-center">
						<div class="shrink-0 mr-2">
							<Tooltip content={$i18n.t('Back')}>
								<button
									class="w-full text-left text-sm py-1.5 px-1 rounded-lg dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-gray-850"
									on:click={() => goto('/admin/billing/plans')}
									type="button"
								>
									<ChevronLeft strokeWidth="2.5" />
								</button>
							</Tooltip>
						</div>

						<div class="flex-1">
							<Tooltip content={$i18n.t('e.g. Professional')} placement="top-start">
								<input
									class="w-full text-2xl font-medium bg-transparent outline-hidden font-primary"
									type="text"
									placeholder={$i18n.t('Plan Name')}
									bind:value={formData.name}
									required
								/>
							</Tooltip>
						</div>

						<div>
							<Badge type="muted" content={$i18n.t('Plan')} />
						</div>
					</div>

					<div class="flex gap-2 px-1 items-center">
						<Tooltip className="w-full" content={$i18n.t('e.g. professional')} placement="top-start">
							<input
								class="w-full text-sm text-gray-500 bg-transparent outline-hidden"
								type="text"
								placeholder={$i18n.t('Plan ID')}
								bind:value={formData.id}
								required
							/>
						</Tooltip>

						<Tooltip
							className="w-full self-center items-center flex"
							content={$i18n.t('e.g. For growing teams')}
							placement="top-start"
						>
							<input
								class="w-full text-sm bg-transparent outline-hidden"
								type="text"
								placeholder={$i18n.t('Description (English)')}
								bind:value={formData.description}
							/>
						</Tooltip>
					</div>
				</div>

				<!-- Main Content -->
				<div class="mb-2 flex-1 overflow-auto h-0 px-1">
					<div class="space-y-4">
						<!-- Localization -->
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Name (Russian)')}</label>
								<input
									type="text"
									bind:value={formData.name_ru}
									placeholder="Профессиональный"
									class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
								/>
							</div>
							<div>
								<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Description (Russian)')}</label>
								<input
									type="text"
									bind:value={formData.description_ru}
									placeholder="Для растущих команд"
									class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
								/>
							</div>
						</div>

						<!-- Pricing -->
						<div>
							<div class="text-xs text-gray-500 mb-2 font-medium">{$i18n.t('Pricing')}</div>
							<div class="grid grid-cols-3 gap-3">
								<div>
									<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Price')}</label>
									<input
										type="number"
										bind:value={formData.price}
										min="0"
										step="0.01"
										class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
									/>
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Currency')}</label>
									<select
										bind:value={formData.currency}
										class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
									>
										<option value="RUB">RUB (₽)</option>
										<option value="USD">USD ($)</option>
										<option value="EUR">EUR (€)</option>
									</select>
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Interval')}</label>
									<select
										bind:value={formData.interval}
										class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
									>
										<option value="day">{$i18n.t('Daily')}</option>
										<option value="week">{$i18n.t('Weekly')}</option>
										<option value="month">{$i18n.t('Monthly')}</option>
										<option value="year">{$i18n.t('Annual')}</option>
									</select>
								</div>
							</div>
						</div>

						<!-- Quotas -->
						<div>
							<div class="text-xs text-gray-500 mb-2 font-medium">{$i18n.t('Usage Quotas')}</div>
							<div class="space-y-3">
								<div class="flex items-center gap-3">
									<div class="flex-1">
										<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Input Tokens')}</label>
										<input
											type="number"
											bind:value={formData.quotas.tokens_input}
											disabled={unlimitedTokensInput}
											min="0"
											step="1000"
											class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden disabled:opacity-50"
										/>
									</div>
									<label class="flex items-center gap-1.5 text-xs text-gray-500 pt-4">
										<input
											type="checkbox"
											bind:checked={unlimitedTokensInput}
											class="rounded"
										/>
										{$i18n.t('Unlimited')}
									</label>
								</div>

								<div class="flex items-center gap-3">
									<div class="flex-1">
										<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Output Tokens')}</label>
										<input
											type="number"
											bind:value={formData.quotas.tokens_output}
											disabled={unlimitedTokensOutput}
											min="0"
											step="1000"
											class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden disabled:opacity-50"
										/>
									</div>
									<label class="flex items-center gap-1.5 text-xs text-gray-500 pt-4">
										<input
											type="checkbox"
											bind:checked={unlimitedTokensOutput}
											class="rounded"
										/>
										{$i18n.t('Unlimited')}
									</label>
								</div>

								<div class="flex items-center gap-3">
									<div class="flex-1">
										<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Requests')}</label>
										<input
											type="number"
											bind:value={formData.quotas.requests}
											disabled={unlimitedRequests}
											min="0"
											step="100"
											class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden disabled:opacity-50"
										/>
									</div>
									<label class="flex items-center gap-1.5 text-xs text-gray-500 pt-4">
										<input
											type="checkbox"
											bind:checked={unlimitedRequests}
											class="rounded"
										/>
										{$i18n.t('Unlimited')}
									</label>
								</div>
							</div>
						</div>

						<!-- Features -->
						<div>
							<div class="text-xs text-gray-500 mb-2 font-medium">{$i18n.t('Features')}</div>
							<div class="flex gap-2 mb-2">
								<input
									type="text"
									bind:value={newFeature}
									on:keypress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
									placeholder={$i18n.t('Add feature...')}
									class="flex-1 text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
								/>
								<button
									type="button"
									on:click={addFeature}
									class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
								>
									<Plus className="size-4" />
								</button>
							</div>

							{#if formData.features.length > 0}
								<div class="space-y-1">
									{#each formData.features as feature, index}
										<div class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-850 rounded-lg text-sm">
											<span class="flex-1">{feature}</span>
											<button
												type="button"
												on:click={() => removeFeature(index)}
												class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition text-gray-400 hover:text-red-500"
											>
												<GarbageBin className="size-3.5" />
											</button>
										</div>
									{/each}
								</div>
							{:else}
								<div class="text-xs text-gray-400 italic">{$i18n.t('No features added yet')}</div>
							{/if}
						</div>

						<!-- Settings -->
						<div>
							<div class="text-xs text-gray-500 mb-2 font-medium">{$i18n.t('Settings')}</div>
							<div class="grid grid-cols-2 gap-4">
								<div class="flex items-center gap-3">
									<label class="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											bind:checked={formData.is_active}
											class="rounded"
										/>
										{$i18n.t('Active')}
									</label>
									<span class="text-xs text-gray-400">{$i18n.t('Make plan available to users')}</span>
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{$i18n.t('Display Order')}</label>
									<input
										type="number"
										bind:value={formData.display_order}
										min="0"
										class="w-full text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 outline-hidden"
									/>
								</div>
							</div>
						</div>

						<!-- Preview Card -->
						<div>
							<div class="text-xs text-gray-500 mb-2 font-medium">{$i18n.t('Preview')}</div>
							<div class="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
								<div class="flex justify-between items-start mb-2">
									<div>
										<div class="font-medium">{formData.name_ru || formData.name || $i18n.t('Plan Name')}</div>
										<div class="text-xs text-gray-500">{formData.description_ru || formData.description || ''}</div>
									</div>
									<div class="text-right">
										<div class="text-lg font-semibold">
											{#if formData.price === 0}
												{$i18n.t('Free')}
											{:else}
												{new Intl.NumberFormat($i18n.locale, { style: 'currency', currency: formData.currency, minimumFractionDigits: 0 }).format(formData.price)}
											{/if}
										</div>
										<div class="text-xs text-gray-500">/{$i18n.t(formData.interval)}</div>
									</div>
								</div>
								<div class="flex gap-4 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
									<div>{$i18n.t('Input')}: <span class="font-medium">{formatNumber(formData.quotas.tokens_input)}</span></div>
									<div>{$i18n.t('Output')}: <span class="font-medium">{formatNumber(formData.quotas.tokens_output)}</span></div>
									<div>{$i18n.t('Requests')}: <span class="font-medium">{formatNumber(formData.quotas.requests)}</span></div>
								</div>
								{#if formData.features.length > 0}
									<div class="flex flex-wrap gap-1 mt-2">
										{#each formData.features as feature}
											<span class="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full">{feature}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Footer -->
				<div class="pb-3 flex justify-between">
					<div class="flex-1 pr-3">
						<div class="text-xs text-gray-500 line-clamp-2">
							{$i18n.t('Plans define subscription tiers with quotas and pricing.')}
						</div>
					</div>

					<button
						class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full disabled:opacity-50"
						type="submit"
						disabled={saving}
					>
						{#if saving}
							<Spinner className="size-4" />
						{:else}
							{$i18n.t('Save')}
						{/if}
					</button>
				</div>
			</div>
		</form>
	</div>
</div>
