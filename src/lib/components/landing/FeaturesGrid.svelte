<script lang="ts">
	interface Feature {
		title: string;
		description: string;
		iconColor: 'purple' | 'blue' | 'green';
		icon: string;
	}

	export let features: Feature[] = [
		{
			title: 'Множество AI-моделей',
			description: 'Работайте с ChatGPT, Claude, Llama и другими моделями в одном интерфейсе',
			iconColor: 'purple',
			icon: 'lightbulb'
		},
		{
			title: 'Безопасность данных',
			description: 'Ваши разговоры защищены. Полное шифрование и конфиденциальность',
			iconColor: 'blue',
			icon: 'lock'
		},
		{
			title: 'Гибкие тарифы',
			description: 'От бесплатного доступа до профессиональных планов. Выберите свой вариант',
			iconColor: 'green',
			icon: 'scale'
		}
	];
</script>

<div class="grid md:grid-cols-3 gap-8 mb-16">
	{#each features as feature}
		<div class="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
			<div class="w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto"
				class:bg-purple-100={feature.iconColor === 'purple'}
				class:bg-blue-100={feature.iconColor === 'blue'}
				class:bg-green-100={feature.iconColor === 'green'}
			>
				{#if feature.icon === 'lightbulb'}
					<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				{:else if feature.icon === 'lock'}
					<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
					</svg>
				{:else if feature.icon === 'scale'}
					<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
					</svg>
				{/if}
			</div>
			<h3 class="text-lg font-semibold text-gray-800 mb-2">
				{feature.title}
			</h3>
			<p class="text-gray-600 text-sm">
				{feature.description}
			</p>
		</div>
	{/each}
</div>
