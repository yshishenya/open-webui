<script lang="ts">
	export let id: string | null = null;
	export let eyebrow: string | null = null;
	export let title: string;
	export let subtitle: string | null = null;
	export let align: 'left' | 'center' = 'left';

	const alignClass = (): string =>
		align === 'center' ? 'items-center text-center' : 'items-start text-left';
</script>

<div
	id={id ?? undefined}
	class={`flex flex-col gap-3 max-w-2xl ${alignClass()} ${id ? 'scroll-mt-24' : ''}`}
>
	{#if eyebrow}
		<span class="text-xs uppercase tracking-[0.2em] text-gray-500">{eyebrow}</span>
	{/if}
	<h2 class="text-2xl md:text-3xl font-semibold text-gray-900">
		{title}
	</h2>
	{#if subtitle}
		<p class="text-gray-600">
			{subtitle}
		</p>
	{/if}
	{#if $$slots.actions}
		<div class={`w-full flex ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
			<slot name="actions" />
		</div>
	{/if}
</div>
