<script lang="ts">
	interface Stat {
		value: string;
		label: string;
		color: 'purple' | 'blue' | 'green';
	}

	export let stats: Stat[] = [
		{ value: '10K+', label: 'Активных пользователей', color: 'purple' },
		{ value: '1M+', label: 'Запросов обработано', color: 'blue' },
		{ value: '99.9%', label: 'Время доступности', color: 'green' }
	];
</script>

<div class="grid grid-cols-3 gap-4 md:gap-8 mb-16">
	{#each stats as stat}
		<div class="text-center">
			<div class="text-3xl md:text-4xl font-bold mb-2"
				class:text-purple-600={stat.color === 'purple'}
				class:text-blue-600={stat.color === 'blue'}
				class:text-green-600={stat.color === 'green'}
			>
				{stat.value}
			</div>
			<div class="text-sm md:text-base text-gray-600">{stat.label}</div>
		</div>
	{/each}
</div>
