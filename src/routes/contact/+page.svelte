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
			await new Promise((resolve) => setTimeout(resolve, 1500));
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
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="relative">
			<div class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"></div>
			<div class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"></div>
			<div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
				<div class="space-y-6">
					<span class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600">
						Контакты
					</span>
					<h1 class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
						Свяжитесь с нами
					</h1>
					<p class="text-lg md:text-xl text-gray-600 max-w-xl">
						Ответим на вопросы, поможем с настройкой и подскажем лучший путь.
					</p>
					<div class="flex flex-wrap gap-3">
						<a
							href="mailto:support@airis.you"
							class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
						>
							support@airis.you
						</a>
						<a
							href="/welcome"
							class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
						>
							Начать бесплатно
						</a>
					</div>
				</div>

				<div class="rounded-[32px] border border-gray-200/70 bg-white/90 p-6 shadow-sm">
					<h3 class="text-xl font-semibold text-gray-900 mb-4">Как быстро отвечаем</h3>
					<ul class="space-y-3 text-sm text-gray-700">
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Обычно отвечаем в течение 24 часов
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Поддержка помогает с оплатой и настройкой
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Пишем коротко и по делу
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
				<div class="space-y-6">
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<div class="w-11 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center mb-4">
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
							</svg>
						</div>
						<h3 class="font-semibold text-gray-900 mb-2">Email</h3>
						<a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">
							support@airis.you
						</a>
					</div>

					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<div class="w-11 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center mb-4">
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
						</div>
						<h3 class="font-semibold text-gray-900 mb-2">Время ответа</h3>
						<p class="text-gray-600 text-sm">
							Обычно отвечаем<br />
							в течение 24 часов
						</p>
					</div>
				</div>

				<div class="md:col-span-2">
					<div class="bg-white rounded-2xl border border-gray-200/70 p-8 shadow-sm">
						{#if submitStatus === 'success'}
							<div class="text-center py-12">
								<div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
									<svg class="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
									</svg>
								</div>
								<h3 class="text-2xl font-semibold text-gray-900 mb-2">Сообщение отправлено</h3>
								<p class="text-gray-600 mb-6">
									Спасибо за обращение. Мы ответим вам в ближайшее время.
								</p>
								<button
									on:click={() => (submitStatus = 'idle')}
									class="text-gray-900 font-semibold hover:underline"
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
											class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-shadow"
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
											class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-shadow"
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
											class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-shadow"
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
											class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-shadow"
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
										class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-shadow resize-none"
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
									class="w-full bg-black text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
									Нажимая кнопку, вы соглашаетесь с
									<a href="/privacy" class="text-gray-900 font-medium hover:underline">
										политикой конфиденциальности
									</a>
								</p>
							</form>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
</PublicPageLayout>
