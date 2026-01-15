<script lang="ts">
	export let title: string = 'Готовы начать работу с AI?';
	export let description: string = 'Присоединяйтесь к тысячам пользователей, которые уже используют Open WebUI';
	export let buttonText: string = 'Начать бесплатно';
	export let buttonHref: string = '/api/v1/oauth/vk/login';
	export let onClick: (() => void) | null = null;
</script>

<div class="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white">
	<h2 class="text-2xl md:text-3xl font-bold mb-4">
		{title}
	</h2>
	<p class="text-lg mb-6 opacity-90">
		{description}
	</p>
	{#if onClick}
		<button
			on:click={onClick}
			class="bg-white text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg"
		>
			{buttonText}
		</button>
	{:else}
		<a
			href={buttonHref}
			class="bg-white text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg inline-block"
		>
			{buttonText}
		</a>
	{/if}
</div>
