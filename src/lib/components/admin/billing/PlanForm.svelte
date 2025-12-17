<script lang="ts">
	import { getContext, createEventDispatcher } from 'svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	// Props
	export let formData: {
		id?: string;
		name: string;
		name_ru?: string;
		description?: string;
		description_ru?: string;
		price: number;
		currency: string;
		interval: string;
		quotas: {
			tokens_input: number | null;
			tokens_output: number | null;
			requests: number | null;
		};
		features: string[];
		is_active: boolean;
		display_order: number;
	};

	export let isEditMode = false;
	export let planId = '';
	export let hasActiveSubscribers = false;
	export let subscriberCount = 0;
	export let originalPlan: typeof formData | null = null;

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
	export let unlimitedTokensInput = false;
	export let unlimitedTokensOutput = false;
	export let unlimitedRequests = false;

	// Default values for when unlimited is toggled off
	const DEFAULT_TOKENS_INPUT = 1000000;
	const DEFAULT_TOKENS_OUTPUT = 500000;
	const DEFAULT_REQUESTS = 5000;

	// Bidirectional reactivity for unlimited toggles
	$: {
		if (formData.quotas) {
			if (unlimitedTokensInput) {
				formData.quotas.tokens_input = null;
			} else if (formData.quotas.tokens_input === null) {
				formData.quotas.tokens_input = DEFAULT_TOKENS_INPUT;
			}
		}
	}
	$: {
		if (formData.quotas) {
			if (unlimitedTokensOutput) {
				formData.quotas.tokens_output = null;
			} else if (formData.quotas.tokens_output === null) {
				formData.quotas.tokens_output = DEFAULT_TOKENS_OUTPUT;
			}
		}
	}
	$: {
		if (formData.quotas) {
			if (unlimitedRequests) {
				formData.quotas.requests = null;
			} else if (formData.quotas.requests === null) {
				formData.quotas.requests = DEFAULT_REQUESTS;
			}
		}
	}

	// Check if quotas are being decreased (for edit mode)
	$: quotasDecreased = isEditMode && originalPlan && formData.quotas && originalPlan.quotas && (
		(formData.quotas.tokens_input !== null && originalPlan.quotas.tokens_input !== null &&
		 formData.quotas.tokens_input < originalPlan.quotas.tokens_input) ||
		(formData.quotas.tokens_output !== null && originalPlan.quotas.tokens_output !== null &&
		 formData.quotas.tokens_output < originalPlan.quotas.tokens_output) ||
		(formData.quotas.requests !== null && originalPlan.quotas.requests !== null &&
		 formData.quotas.requests < originalPlan.quotas.requests)
	);

	// Check if price is being changed (for edit mode)
	$: priceChanged = isEditMode && originalPlan && formData.price !== undefined && formData.price !== originalPlan.price;

	const formatNumber = (value: number | null): string => {
		if (value === null) return '∞';
		return new Intl.NumberFormat($i18n.locale).format(value);
	};

	const formatPrice = (price: number): string => {
		if (price === 0) return $i18n.t('Free');
		return new Intl.NumberFormat($i18n.locale, {
			style: 'currency',
			currency: formData.currency || 'RUB'
		}).format(price);
	};

	const getIntervalLabel = (interval: string): string => {
		const labels: Record<string, string> = {
			day: $i18n.t('day'),
			week: $i18n.t('week'),
			month: $i18n.t('month'),
			year: $i18n.t('year')
		};
		return labels[interval] || interval;
	};
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
	<!-- Form - 2 columns -->
	<div class="lg:col-span-2 space-y-6">
		<!-- Warnings (edit mode only) -->
		{#if isEditMode && hasActiveSubscribers}
			<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
				<div class="flex items-start gap-3">
					<svg class="size-5 text-yellow-600 dark:text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
					</svg>
					<div class="flex-1">
						<div class="font-medium text-yellow-900 dark:text-yellow-200">
							{$i18n.t('Plan has active subscribers')}
						</div>
						<div class="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
							{$i18n.t('{count} users are currently subscribed to this plan. Be careful when making changes.', {
								count: subscriberCount
							})}
						</div>
						{#if quotasDecreased}
							<div class="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">
								{$i18n.t('⚠️ Cannot decrease quotas while plan has active subscriptions')}
							</div>
						{/if}
						{#if priceChanged}
							<div class="text-sm text-yellow-800 dark:text-yellow-300 mt-2">
								{$i18n.t('⚠️ Price changes will affect new subscriptions only')}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Basic Info -->
		<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
			<h3 class="text-lg font-semibold mb-4">{$i18n.t('Basic Information')}</h3>

			<div class="space-y-4">
				<!-- Plan ID -->
				<div>
					<label class="block text-sm font-medium mb-2">
						{$i18n.t('Plan ID')}
						{#if !isEditMode}<span class="text-red-500">*</span>{/if}
					</label>
					{#if isEditMode}
						<input
							type="text"
							value={planId}
							disabled
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{$i18n.t('Plan ID cannot be changed')}
						</p>
					{:else}
						<input
							type="text"
							bind:value={formData.id}
							placeholder="starter, pro, business..."
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{$i18n.t('Unique identifier (lowercase, numbers, hyphens, underscores only)')}
						</p>
					{/if}
				</div>

				<!-- Names -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Name (English)')}
							<span class="text-red-500">*</span>
						</label>
						<input
							type="text"
							bind:value={formData.name}
							placeholder="Starter"
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Name (Russian)')}
						</label>
						<input
							type="text"
							bind:value={formData.name_ru}
							placeholder="Старт"
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						/>
					</div>
				</div>

				<!-- Descriptions -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Description (English)')}
						</label>
						<textarea
							bind:value={formData.description}
							placeholder="Perfect for students and hobbyists"
							rows="3"
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Description (Russian)')}
						</label>
						<textarea
							bind:value={formData.description_ru}
							placeholder="Идеально для студентов и любителей"
							rows="3"
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Pricing -->
		<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
			<h3 class="text-lg font-semibold mb-4">{$i18n.t('Pricing')}</h3>

			<div class="space-y-4">
				<div class="grid grid-cols-3 gap-4">
					<!-- Price -->
					<div class="col-span-1">
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Price')}
						</label>
						<input
							type="number"
							bind:value={formData.price}
							min="0"
							step="0.01"
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						/>
					</div>

					<!-- Currency -->
					<div class="col-span-1">
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Currency')}
						</label>
						<select
							bind:value={formData.currency}
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						>
							<option value="RUB">RUB (₽)</option>
							<option value="USD">USD ($)</option>
							<option value="EUR">EUR (€)</option>
						</select>
					</div>

					<!-- Interval -->
					<div class="col-span-1">
						<label class="block text-sm font-medium mb-2">
							{$i18n.t('Interval')}
						</label>
						<select
							bind:value={formData.interval}
							class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
						>
							<option value="day">{$i18n.t('Daily')}</option>
							<option value="week">{$i18n.t('Weekly')}</option>
							<option value="month">{$i18n.t('Monthly')}</option>
							<option value="year">{$i18n.t('Annual')}</option>
						</select>
					</div>
				</div>
			</div>
		</div>

		<!-- Quotas -->
		<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
			<h3 class="text-lg font-semibold mb-4">{$i18n.t('Usage Quotas')}</h3>

			<div class="space-y-4">
				<!-- Input Tokens -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm font-medium">
							{$i18n.t('Input Tokens')}
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								bind:checked={unlimitedTokensInput}
								class="rounded"
							/>
							{$i18n.t('Unlimited')}
						</label>
					</div>
					<input
						type="number"
						bind:value={formData.quotas.tokens_input}
						disabled={unlimitedTokensInput}
						min="0"
						step="1000"
						class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent disabled:opacity-50"
					/>
					{#if isEditMode && hasActiveSubscribers && originalPlan?.quotas?.tokens_input !== null}
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{$i18n.t('Current: {value}', { value: formatNumber(originalPlan.quotas.tokens_input) })}
						</p>
					{/if}
				</div>

				<!-- Output Tokens -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm font-medium">
							{$i18n.t('Output Tokens')}
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								bind:checked={unlimitedTokensOutput}
								class="rounded"
							/>
							{$i18n.t('Unlimited')}
						</label>
					</div>
					<input
						type="number"
						bind:value={formData.quotas.tokens_output}
						disabled={unlimitedTokensOutput}
						min="0"
						step="1000"
						class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent disabled:opacity-50"
					/>
					{#if isEditMode && hasActiveSubscribers && originalPlan?.quotas?.tokens_output !== null}
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{$i18n.t('Current: {value}', { value: formatNumber(originalPlan.quotas.tokens_output) })}
						</p>
					{/if}
				</div>

				<!-- Requests -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm font-medium">
							{$i18n.t('Requests')}
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								bind:checked={unlimitedRequests}
								class="rounded"
							/>
							{$i18n.t('Unlimited')}
						</label>
					</div>
					<input
						type="number"
						bind:value={formData.quotas.requests}
						disabled={unlimitedRequests}
						min="0"
						step="100"
						class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent disabled:opacity-50"
					/>
					{#if isEditMode && hasActiveSubscribers && originalPlan?.quotas?.requests !== null}
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{$i18n.t('Current: {value}', { value: formatNumber(originalPlan.quotas.requests) })}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Features -->
		<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
			<h3 class="text-lg font-semibold mb-4">{$i18n.t('Features')}</h3>

			<div class="space-y-4">
				<!-- Add Feature -->
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={newFeature}
						on:keypress={(e) => e.key === 'Enter' && addFeature()}
						placeholder={$i18n.t('Add feature...')}
						class="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
					/>
					<button
						type="button"
						on:click={addFeature}
						class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
					>
						<Plus className="size-4" />
					</button>
				</div>

				<!-- Features List -->
				{#if formData.features && formData.features.length > 0}
					<div class="space-y-2">
						{#each formData.features as feature, index}
							<div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
								<div class="flex-1 text-sm">{feature}</div>
								<button
									type="button"
									on:click={() => removeFeature(index)}
									class="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded transition"
								>
									<GarbageBin className="size-4" />
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-500 dark:text-gray-400 italic">
						{$i18n.t('No features added yet')}
					</p>
				{/if}
			</div>
		</div>

		<!-- Settings -->
		<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
			<h3 class="text-lg font-semibold mb-4">{$i18n.t('Settings')}</h3>

			<div class="space-y-4">
				<!-- Active Status -->
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium">{$i18n.t('Active')}</div>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{$i18n.t('Make plan available to users')}
						</div>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={formData.is_active}
							class="sr-only peer"
						/>
						<div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
					</label>
				</div>

				<!-- Display Order -->
				<div>
					<label class="block text-sm font-medium mb-2">
						{$i18n.t('Display Order')}
					</label>
					<input
						type="number"
						bind:value={formData.display_order}
						min="0"
						class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-transparent"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						{$i18n.t('Lower numbers appear first')}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Preview - 1 column -->
	<div class="lg:col-span-1">
		<div class="sticky top-6 space-y-6">
			<!-- Plan Preview -->
			<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
				<h3 class="text-lg font-semibold mb-4">{$i18n.t('Preview')}</h3>

				<!-- Plan Card Preview -->
				<div class="border-2 dark:border-gray-600 rounded-xl p-6 space-y-4">
					<!-- Header -->
					<div>
						<div class="text-2xl font-bold">
							{formData.name_ru || formData.name || $i18n.t('Plan Name')}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
							{formData.description_ru || formData.description || $i18n.t('Plan description')}
						</div>
					</div>

					<!-- Price -->
					<div class="py-4 border-y dark:border-gray-700">
						<div class="text-3xl font-bold">
							{formatPrice(formData.price || 0)}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400">
							/{getIntervalLabel(formData.interval || 'month')}
						</div>
					</div>

					<!-- Quotas -->
					{#if formData.quotas}
						<div class="space-y-2">
							<div class="text-sm font-medium">{$i18n.t('Quotas')}:</div>
							<div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
								<div class="flex justify-between">
									<span>{$i18n.t('Input Tokens')}:</span>
									<span class="font-medium">{formatNumber(formData.quotas.tokens_input)}</span>
								</div>
								<div class="flex justify-between">
									<span>{$i18n.t('Output Tokens')}:</span>
									<span class="font-medium">{formatNumber(formData.quotas.tokens_output)}</span>
								</div>
								<div class="flex justify-between">
									<span>{$i18n.t('Requests')}:</span>
									<span class="font-medium">{formatNumber(formData.quotas.requests)}</span>
								</div>
							</div>
						</div>
					{/if}

					<!-- Features -->
					{#if formData.features && formData.features.length > 0}
						<div class="space-y-2">
							<div class="text-sm font-medium">{$i18n.t('Features')}:</div>
							<ul class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
								{#each formData.features as feature}
									<li class="flex items-start gap-2">
										<span class="text-green-500 mt-0.5">✓</span>
										<span>{feature}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Status Badge -->
					<div class="pt-4 border-t dark:border-gray-700">
						<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
							{formData.is_active
								? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
								: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}">
							{formData.is_active ? $i18n.t('Active') : $i18n.t('Inactive')}
						</span>
					</div>
				</div>
			</div>

			<!-- Subscribers Info (edit mode only) -->
			{#if isEditMode && hasActiveSubscribers}
				<div class="bg-white dark:bg-gray-850 rounded-xl border dark:border-gray-700 p-6">
					<h3 class="text-lg font-semibold mb-4">{$i18n.t('Active Subscribers')}</h3>
					<div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
						{subscriberCount}
					</div>
					<div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
						{$i18n.t('users subscribed')}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
