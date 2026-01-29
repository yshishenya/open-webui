<script lang="ts">
	interface Feature {
		title: string;
		description: string;
		icon: 'layers' | 'shield' | 'wallet';
	}

	export let features: Feature[] = [
		{
			title: 'Выбор модели под задачу',
			description: 'В одном интерфейсе доступны разные AI-модели без переключения сервисов.',
			icon: 'layers'
		},
		{
			title: 'Данные под контролем',
			description: 'Истории чатов, настройки и доступы защищены и прозрачно управляются.',
			icon: 'shield'
		},
		{
			title: 'Прозрачная оплата',
			description: 'Платите за использование и легко контролируйте лимиты.',
			icon: 'wallet'
		}
	];
</script>

<div class="grid md:grid-cols-3 gap-6">
	{#each features as feature}
		<div
			class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div
				class="w-11 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center mb-4"
			>
				{#if feature.icon === 'layers'}
					<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4"
						></path>
					</svg>
				{:else if feature.icon === 'shield'}
					<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 3l8 4v5c0 5-3.5 9-8 9s-8-4-8-9V7l8-4z"
						></path>
					</svg>
				{:else if feature.icon === 'wallet'}
					<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 7h15a3 3 0 013 3v7a3 3 0 01-3 3H3V7zm0 0V5a2 2 0 012-2h13M16 12h4"
						></path>
					</svg>
				{/if}
			</div>
			<h3 class="text-lg font-semibold text-gray-900 mb-2">
				{feature.title}
			</h3>
			<p class="text-gray-600 text-sm leading-relaxed">
				{feature.description}
			</p>
		</div>
	{/each}
</div>
