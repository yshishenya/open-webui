<script lang="ts">
	export let title: string = 'Готовы начать работу с AI?';
	export let description: string = 'Присоединяйтесь к пользователям, которые уже используют AIris';
	export let buttonText: string = 'Начать бесплатно';
	export let buttonHref: string = '/api/v1/oauth/vk/login';
	export let onClick: (() => void) | null = null;
	export let tone: 'light' | 'dark' = 'light';

	$: containerClass =
		tone === 'dark'
			? 'bg-[#0b0d12] border border-white/10 text-white'
			: 'bg-white border border-gray-200/70 text-gray-900';

	$: titleClass = tone === 'dark' ? 'text-white' : 'text-gray-900';
	$: descriptionClass = tone === 'dark' ? 'text-white/70' : 'text-gray-600';
	$: buttonClass =
		tone === 'dark'
			? 'bg-white text-gray-900 hover:bg-gray-100'
			: 'bg-black text-white hover:bg-gray-900';
</script>

<div class={`rounded-2xl p-8 md:p-12 shadow-sm ${containerClass}`}>
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
		<div>
			<h2 class={`text-2xl md:text-3xl font-semibold mb-3 ${titleClass}`}>
				{title}
			</h2>
			<p class={`text-base md:text-lg max-w-2xl ${descriptionClass}`}>
				{description}
			</p>
		</div>
		<div>
			{#if onClick}
				<button
					on:click={onClick}
					class={`px-8 py-3 rounded-full font-semibold transition-colors ${buttonClass}`}
				>
					{buttonText}
				</button>
			{:else}
				<a
					href={buttonHref}
					class={`px-8 py-3 rounded-full font-semibold transition-colors inline-block ${buttonClass}`}
				>
					{buttonText}
				</a>
			{/if}
		</div>
	</div>
</div>
