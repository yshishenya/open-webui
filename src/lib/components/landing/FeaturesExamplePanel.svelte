<script lang="ts">
	export let title: string | null = null;
	export let prompt: string = '';
	export let resultPreview: string = '';
	export let tryPresetId: string = '';
	export let onTry: (presetId: string) => void = () => {};
	export let variant: 'text' | 'image' | 'audio' | 'data' = 'text';
</script>

<div class="features-card features-card--soft p-6 space-y-4">
	{#if title}
		<h4 class="text-sm font-semibold text-gray-900">{title}</h4>
	{/if}

	<div class="space-y-2">
		<div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
			Пример запроса
		</div>
		<p class="text-sm text-gray-700 whitespace-pre-line">{prompt}</p>
	</div>

	{#if variant === 'image'}
		<div class="grid grid-cols-2 gap-3">
			{#each Array.from({ length: 4 }) as _, index}
				<div
					class="h-20 rounded-xl border border-gray-200 bg-[linear-gradient(135deg,#f3f4f6,#e5e7eb)]"
					aria-hidden="true"
				></div>
			{/each}
		</div>
	{/if}

	<div class="space-y-2">
		<div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
			Пример результата
		</div>
		<p class="text-sm text-gray-700 whitespace-pre-line">{resultPreview}</p>
	</div>

	<button
		type="button"
		class="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
		on:click={() => onTry(tryPresetId)}
	>
		Попробовать
	</button>
</div>
