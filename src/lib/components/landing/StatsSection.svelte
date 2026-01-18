<script lang="ts">
	interface Stat {
		value: string;
		label: string;
	}

	export let stats: Stat[] = [
		{ value: '10K+', label: 'Активных пользователей' },
		{ value: '1M+', label: 'Запросов обработано' },
		{ value: '99.9%', label: 'Время доступности' }
	];
</script>

<div class="grid md:grid-cols-3 gap-6">
	{#each stats as stat}
		<div class="bg-white rounded-2xl border border-gray-200/70 p-6 text-center shadow-sm">
			<div class="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
				{stat.value}
			</div>
			<div class="text-sm md:text-base text-gray-600">{stat.label}</div>
		</div>
	{/each}
</div>
