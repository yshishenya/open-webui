<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';
	import { page } from '$app/stores';

	let formData = {
		name: '',
		email: '',
		subject: '',
		message: '',
		type: 'general'
	};

	let isSubmitting = false;
	let submitStatus: 'idle' | 'success' | 'error' = 'idle';

	// Get query params for pre-selecting subject
	$: {
		const planParam = $page.url.searchParams.get('plan');
		const typeParam = $page.url.searchParams.get('type');

		if (planParam === 'team') {
			formData.subject = 'Интерес к командному тарифу';
			formData.type = 'sales';
		} else if (typeParam === 'enterprise') {
			formData.subject = 'Корпоративное решение';
			formData.type = 'sales';
		}
	}

	const contactTypes = [
		{ value: 'general', label: 'Общий вопрос' },
		{ value: 'support', label: 'Техническая поддержка' },
		{ value: 'sales', label: 'Отдел продаж' },
		{ value: 'partnership', label: 'Партнерство' },
		{ value: 'feedback', label: 'Отзыв о продукте' }
	];

	const handleSubmit = async () => {
		isSubmitting = true;
		submitStatus = 'idle';

		try {
			// Simulate form submission
			await new Promise(resolve => setTimeout(resolve, 1500));
			submitStatus = 'success';
			formData = { name: '', email: '', subject: '', message: '', type: 'general' };
		} catch (error) {
			submitStatus = 'error';
		} finally {
			isSubmitting = false;
		}
	};
</script>

<PublicPageLayout
	title="Контакты"
	description="Свяжитесь с командой AIris. Мы готовы ответить на ваши вопросы и помочь с любыми проблемами."
	showHero={true}
	heroTitle="Свяжитесь с нами"
	heroSubtitle="У вас есть вопросы? Мы готовы помочь"
>
	<div class="container mx-auto px-4 py-16">

		<div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
			<!-- Contact Info -->
			<div class="space-y-6">
				<!-- Email -->
				<div class="bg-white rounded-xl shadow-md p-6">
					<div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
						<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
						</svg>
					</div>
					<h3 class="font-semibold text-gray-900 mb-2">Email</h3>
					<a href="mailto:support@openwebui.ru" class="text-purple-600 hover:text-purple-700">
						support@openwebui.ru
					</a>
				</div>

				<!-- Support Hours -->
				<div class="bg-white rounded-xl shadow-md p-6">
					<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
					</div>
					<h3 class="font-semibold text-gray-900 mb-2">Время работы</h3>
					<p class="text-gray-600 text-sm">
						Пн-Пт: 9:00 - 18:00 (МСК)<br>
						Техподдержка: 24/7
					</p>
				</div>

				<!-- Response Time -->
				<div class="bg-white rounded-xl shadow-md p-6">
					<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
						<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
					</div>
					<h3 class="font-semibold text-gray-900 mb-2">Время ответа</h3>
					<p class="text-gray-600 text-sm">
						Обычно отвечаем<br>
						в течение 24 часов
					</p>
				</div>

				<!-- Social Links -->
				<div class="bg-white rounded-xl shadow-md p-6">
					<h3 class="font-semibold text-gray-900 mb-4">Мы в соцсетях</h3>
					<div class="flex gap-4">
						<a href="#" class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-purple-100 transition-colors">
							<svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12.785 16.241s.288-.032.436-.194c.136-.149.132-.428.132-.428s-.02-1.304.587-1.496c.6-.19 1.37 1.26 2.184 1.817.616.42 1.083.328 1.083.328l2.178-.03s1.139-.071.599-967c-.04-.083-.286-.602-1.471-1.703-1.24-1.151-1.074-.965.42-2.957.91-1.214 1.274-1.955 1.161-2.272-.108-.302-.777-.222-.777-.222l-2.452.015s-.182-.025-.316.056c-.131.079-.215.263-.215.263s-.386 1.027-.9 1.902c-1.082 1.843-1.515 1.941-1.692 1.826-.411-.267-.308-1.074-.308-1.647 0-1.791.272-2.537-.53-2.73-.267-.064-.463-.106-1.145-.113-.875-.009-1.616.003-2.034.208-.278.137-.493.442-.362.46.161.021.527.099.721.363.251.341.242 1.106.242 1.106s.145 2.109-.337 2.372c-.331.18-.785-.188-1.76-1.873-.499-.851-.876-1.792-.876-1.792s-.073-.178-.203-.273c-.157-.115-.376-.151-.376-.151l-2.329.015s-.35.01-.478.162c-.114.135-.009.413-.009.413s1.816 4.242 3.871 6.383c1.884 1.963 4.022 1.833 4.022 1.833h.971z"/>
							</svg>
						</a>
						<a href="#" class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">
							<svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.308-.346-.11l-6.4 4.02-2.76-.918c-.6-.187-.612-.6.126-.89l10.782-4.156c.5-.18.94.12.78.89z"/>
							</svg>
						</a>
					</div>
				</div>
			</div>

			<!-- Contact Form -->
			<div class="md:col-span-2">
				<div class="bg-white rounded-2xl shadow-xl p-8">
					{#if submitStatus === 'success'}
						<div class="text-center py-12">
							<div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
								<svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
							</div>
							<h3 class="text-2xl font-bold text-gray-900 mb-2">Сообщение отправлено!</h3>
							<p class="text-gray-600 mb-6">
								Спасибо за обращение. Мы ответим вам в ближайшее время.
							</p>
							<button
								on:click={() => submitStatus = 'idle'}
								class="text-purple-600 font-semibold hover:text-purple-700"
							>
								Отправить еще одно сообщение
							</button>
						</div>
					{:else}
						<form on:submit|preventDefault={handleSubmit} class="space-y-6">
							<div class="grid md:grid-cols-2 gap-6">
								<div>
									<label for="name" class="block text-sm font-medium text-gray-700 mb-2">
										Ваше имя *
									</label>
									<input
										type="text"
										id="name"
										bind:value={formData.name}
										required
										class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
										placeholder="Иван Иванов"
									/>
								</div>
								<div>
									<label for="email" class="block text-sm font-medium text-gray-700 mb-2">
										Email *
									</label>
									<input
										type="email"
										id="email"
										bind:value={formData.email}
										required
										class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
										placeholder="ivan@example.com"
									/>
								</div>
							</div>

							<div class="grid md:grid-cols-2 gap-6">
								<div>
									<label for="type" class="block text-sm font-medium text-gray-700 mb-2">
										Тип обращения
									</label>
									<select
										id="type"
										bind:value={formData.type}
										class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
									>
										{#each contactTypes as contactType}
											<option value={contactType.value}>{contactType.label}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="subject" class="block text-sm font-medium text-gray-700 mb-2">
										Тема *
									</label>
									<input
										type="text"
										id="subject"
										bind:value={formData.subject}
										required
										class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
										placeholder="Тема вашего обращения"
									/>
								</div>
							</div>

							<div>
								<label for="message" class="block text-sm font-medium text-gray-700 mb-2">
									Сообщение *
								</label>
								<textarea
									id="message"
									bind:value={formData.message}
									required
									rows="6"
									class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow resize-none"
									placeholder="Опишите ваш вопрос или проблему..."
								></textarea>
							</div>

							{#if submitStatus === 'error'}
								<div class="bg-red-50 border border-red-200 rounded-lg p-4">
									<p class="text-red-600 text-sm">
										Произошла ошибка при отправке. Пожалуйста, попробуйте еще раз или напишите нам на email.
									</p>
								</div>
							{/if}

							<button
								type="submit"
								disabled={isSubmitting}
								class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								{#if isSubmitting}
									<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Отправка...
								{:else}
									Отправить сообщение
								{/if}
							</button>

							<p class="text-xs text-gray-500 text-center">
								Нажимая кнопку, вы соглашаетесь с <a href="/privacy" class="text-purple-600 hover:underline">политикой конфиденциальности</a>
							</p>
						</form>
					{/if}
				</div>
			</div>
		</div>
	</div>
</PublicPageLayout>
