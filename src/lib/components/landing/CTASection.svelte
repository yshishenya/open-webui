<script lang="ts">
	export let title: string = 'Готовы начать работу с AI?';
	export let description: string = 'Присоединяйтесь к тысячам пользователей, которые уже используют Open WebUI';
	export let buttonText: string = 'Начать бесплатно';
	export let buttonHref: string = '/api/v1/oauth/vk/login';
	export let onClick: (() => void) | null = null;
</script>

<div class="bg-white rounded-2xl border border-gray-200/70 p-8 md:p-12 shadow-sm">
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
		<div>
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">
				{title}
			</h2>
			<p class="text-base md:text-lg text-gray-600 max-w-2xl">
				{description}
			</p>
		</div>
		<div>
			{#if onClick}
				<button
					on:click={onClick}
					class="bg-black text-white px-8 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
				>
					{buttonText}
				</button>
			{:else}
				<a
					href={buttonHref}
					class="bg-black text-white px-8 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors inline-block"
				>
					{buttonText}
				</a>
			{/if}
		</div>
	</div>
</div>
