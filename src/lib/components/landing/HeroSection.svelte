<script lang="ts">
	export let title: string = 'AIris';
	export let subtitle: string = 'Интеллектуальный AI-ассистент для работы и творчества';
	export let description: string = 'Работайте с лучшими AI-моделями в удобном интерфейсе. Полная поддержка русского языка, безопасность данных и гибкие тарифы.';
</script>

<div class="text-center max-w-4xl mx-auto">
	<!-- Logo & Title -->
	<div class="mb-8">
		<h1 class="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
			<span class="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
				{title}
			</span>
		</h1>
		<p class="text-xl md:text-2xl text-gray-600 font-medium">
			{subtitle}
		</p>
	</div>

	<!-- Value Proposition -->
	<p class="text-lg text-gray-700 mb-12 max-w-2xl mx-auto">
		{description}
	</p>
</div>
