<script lang="ts">
	export let title: string = 'AIris';
	export let subtitle: string = 'Интеллектуальный AI-ассистент для работы и творчества';
	export let description: string =
		'Работайте с лучшими AI-моделями в удобном интерфейсе. Полная поддержка русского языка, безопасность данных и гибкие тарифы.';
	export let eyebrow: string = 'AI-сервис для повседневных задач';
</script>

<div class="space-y-6">
	<span
		class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
	>
		{eyebrow}
	</span>
	<h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
		{title}
	</h1>
	<p class="text-lg md:text-xl text-gray-600 max-w-2xl">
		{subtitle}
	</p>
	<p class="text-base text-gray-600 max-w-2xl">
		{description}
	</p>
</div>
