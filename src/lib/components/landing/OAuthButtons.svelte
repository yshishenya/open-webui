<script lang="ts">
	export let telegramBotName: string = '';

	const handleVKLogin = () => {
		window.location.href = '/api/v1/oauth/vk/login';
	};

	const handleYandexLogin = () => {
		window.location.href = '/api/v1/oauth/yandex/login';
	};
</script>

<div class="bg-white/90 rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-10">
	<h2 class="text-xl md:text-2xl font-semibold text-gray-900 mb-6">
		Войти или создать аккаунт
	</h2>

	<div class="space-y-4 max-w-md">
		<!-- VK Button -->
		<button
			on:click={handleVKLogin}
			class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#0077FF] hover:bg-[#0066DD] text-white rounded-xl font-semibold transition-colors"
		>
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12.785 16.241s.288-.032.436-.194c.136-.149.132-.428.132-.428s-.02-1.304.587-1.496c.6-.19 1.37 1.26 2.184 1.817.616.42 1.083.328 1.083.328l2.178-.03s1.139-.071.599-967c-.04-.083-.286-.602-1.471-1.703-1.24-1.151-1.074-.965.42-2.957.91-1.214 1.274-1.955 1.161-2.272-.108-.302-.777-.222-.777-.222l-2.452.015s-.182-.025-.316.056c-.131.079-.215.263-.215.263s-.386 1.027-.9 1.902c-1.082 1.843-1.515 1.941-1.692 1.826-.411-.267-.308-1.074-.308-1.647 0-1.791.272-2.537-.53-2.73-.267-.064-.463-.106-1.145-.113-.875-.009-1.616.003-2.034.208-.278.137-.493.442-.362.46.161.021.527.099.721.363.251.341.242 1.106.242 1.106s.145 2.109-.337 2.372c-.331.18-.785-.188-1.76-1.873-.499-.851-.876-1.792-.876-1.792s-.073-.178-.203-.273c-.157-.115-.376-.151-.376-.151l-2.329.015s-.35.01-.478.162c-.114.135-.009.413-.009.413s1.816 4.242 3.871 6.383c1.884 1.963 4.022 1.833 4.022 1.833h.971z"/>
			</svg>
			Войти через ВКонтакте
		</button>

		<!-- Yandex Button -->
		<button
			on:click={handleYandexLogin}
			class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#FC3F1D] hover:bg-[#E63600] text-white rounded-xl font-semibold transition-colors"
		>
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.5 18.75h-2.437v-6.891h-1.126c-1.863 0-2.924-1.021-2.924-2.799 0-1.828 1.061-2.81 2.924-2.81h3.563v2.156h-3.188c-.626 0-.938.313-.938.938 0 .625.312.937.938.937h1.751v8.469h1.437z"/>
			</svg>
			Войти через Яндекс
		</button>

		<!-- Telegram Button -->
		{#if telegramBotName}
			<div class="flex justify-center pt-2">
				<div
					id="telegram-login-button"
					data-telegram-login={telegramBotName}
					data-size="large"
					data-onauth="onTelegramAuth(user)"
					data-request-access="write"
				></div>
			</div>
		{/if}

		<!-- Email/Password Link -->
		<div class="pt-4 border-t border-gray-200/70 text-sm text-gray-600">
			<a
				href="/auth"
				class="font-medium text-gray-700 hover:text-gray-900 transition-colors"
			>
				Или войти с помощью email
			</a>
		</div>
	</div>
</div>
