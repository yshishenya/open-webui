<script lang="ts">
	export let eyebrow: string | null = null;
	export let title: string;
	export let subtitle: string | null = null;
</script>

<div class="flex flex-col gap-3 max-w-2xl">
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
</div>
