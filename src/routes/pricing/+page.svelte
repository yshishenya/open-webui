<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	let billingPeriod: 'monthly' | 'annual' = 'monthly';
	
	const plans = [
		{
			name: 'Бесплатный',
			nameEn: 'free',
			description: 'Для начала работы с AI',
			monthlyPrice: 0,
			annualPrice: 0,
			features: [
				{ text: '10 запросов в день', included: true },
				{ text: 'Базовые модели GPT-3.5', included: true },
				{ text: 'История чатов 7 дней', included: true },
				{ text: 'Стандартная скорость', included: true },
				{ text: 'Email поддержка', included: true },
				{ text: 'Продвинутые модели', included: false },
				{ text: 'Приоритетная поддержка', included: false },
				{ text: 'API доступ', included: false }
			],
			cta: 'Начать бесплатно',
			popular: false
		},
		{
			name: 'Профессиональный',
			nameEn: 'pro',
			description: 'Для активных пользователей',
			monthlyPrice: 990,
			annualPrice: 9900,
			features: [
				{ text: 'Безлимитные запросы', included: true },
				{ text: 'Все модели (GPT-4, Claude, Llama)', included: true },
				{ text: 'Полная история чатов', included: true },
				{ text: 'Приоритетная скорость', included: true },
				{ text: 'Приоритетная поддержка', included: true },
				{ text: 'Продвинутые функции', included: true },
				{ text: 'Экспорт данных', included: true },
				{ text: 'API доступ (100k токенов/мес)', included: true }
			],
			cta: 'Выбрать план',
			popular: true
		},
		{
			name: 'Команда',
			nameEn: 'team',
			description: 'Для команд и организаций',
			monthlyPrice: 4990,
			annualPrice: 49900,
			features: [
				{ text: 'Все из Профессионального', included: true },
				{ text: 'До 10 пользователей', included: true },
				{ text: 'Корпоративные модели', included: true },
				{ text: 'Управление командой', included: true },
				{ text: 'Аналитика и отчеты', included: true },
				{ text: 'Выделенная поддержка', included: true },
				{ text: 'SLA 99.9%', included: true },
				{ text: 'API доступ (1M токенов/мес)', included: true }
			],
			cta: 'Связаться с нами',
			popular: false
		}
	];
	
	const getPrice = (plan: typeof plans[0]) => {
		if (plan.monthlyPrice === 0) return 'Бесплатно';
		const price = billingPeriod === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice / 12);
		return `${price.toLocaleString('ru-RU')} ₽`;
	};
	
	const getSavings = (plan: typeof plans[0]) => {
		if (plan.monthlyPrice === 0) return null;
		const monthlyCost = plan.monthlyPrice * 12;
		const annualCost = plan.annualPrice;
		const savings = monthlyCost - annualCost;
		return savings;
	};
	
	const handleSelectPlan = (planName: string) => {
		if (planName === 'free') {
			window.location.href = '/';
		} else if (planName === 'team') {
			window.location.href = '/contact?plan=team';
		} else {
			window.location.href = '/auth?plan=' + planName;
		}
	};
</script>

<PublicPageLayout
	title="Тарифы"
	description="Выберите подходящий тариф AIris. От бесплатного доступа до корпоративных решений."
	showHero={true}
	heroTitle="Тарифы и цены"
	heroSubtitle="Выберите план, который подходит именно вам"
>
	<div class="container mx-auto px-4 py-16">

		<!-- Billing Toggle -->
		<div class="flex justify-center mb-12">
			<div class="bg-white rounded-full p-1 shadow-md inline-flex">
				<button
					on:click={() => billingPeriod = 'monthly'}
					class="px-6 py-2 rounded-full transition-all duration-200 {billingPeriod === 'monthly' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}"
				>
					Ежемесячно
				</button>
				<button
					on:click={() => billingPeriod = 'annual'}
					class="px-6 py-2 rounded-full transition-all duration-200 relative {billingPeriod === 'annual' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}"
				>
					Ежегодно
					<span class="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
						-17%
					</span>
				</button>
			</div>
		</div>

		<!-- Pricing Cards -->
		<div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
			{#each plans as plan}
				<div class="relative">
					{#if plan.popular}
						<div class="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
							<span class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
								Популярный
							</span>
						</div>
					{/if}
					
					<div class="bg-white rounded-2xl shadow-xl p-8 h-full flex flex-col {plan.popular ? 'border-2 border-purple-200 transform scale-105' : ''}">
						<!-- Plan Header -->
						<div class="text-center mb-6">
							<h3 class="text-2xl font-bold text-gray-900 mb-2">
								{plan.name}
							</h3>
							<p class="text-gray-600 text-sm mb-4">
								{plan.description}
							</p>
							<div class="mb-2">
								<span class="text-4xl font-bold text-gray-900">
									{getPrice(plan)}
								</span>
								{#if plan.monthlyPrice > 0}
									<span class="text-gray-600">/месяц</span>
								{/if}
							</div>
							{#if billingPeriod === 'annual' && getSavings(plan)}
								<p class="text-sm text-green-600 font-medium">
									Экономия {getSavings(plan).toLocaleString('ru-RU')} ₽/год
								</p>
							{/if}
						</div>

						<!-- Features List -->
						<ul class="space-y-3 mb-8 flex-grow">
							{#each plan.features as feature}
								<li class="flex items-start gap-3">
									{#if feature.included}
										<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
										</svg>
									{:else}
										<svg class="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
										</svg>
									{/if}
									<span class="{feature.included ? 'text-gray-700' : 'text-gray-400'}">
										{feature.text}
									</span>
								</li>
							{/each}
						</ul>

						<!-- CTA Button -->
						<button
							on:click={() => handleSelectPlan(plan.nameEn)}
							class="w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 {plan.popular ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}"
						>
							{plan.cta}
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- FAQ Section -->
		<div class="max-w-3xl mx-auto">
			<h2 class="text-3xl font-bold text-center text-gray-900 mb-8">
				Часто задаваемые вопросы
			</h2>
			
			<div class="space-y-4">
				<!-- FAQ Item 1 -->
				<details class="bg-white rounded-lg shadow-md p-6 group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Можно ли изменить план позже?
						<svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Да, вы можете в любой момент повысить или понизить свой план. При повышении разница будет пересчитана пропорционально. При понижении новый план вступит в силу со следующего расчетного периода.
					</p>
				</details>

				<!-- FAQ Item 2 -->
				<details class="bg-white rounded-lg shadow-md p-6 group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Какие способы оплаты доступны?
						<svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Мы принимаем банковские карты (Visa, MasterCard, Мир), ЮMoney, QIWI и другие популярные способы оплаты через сервис YooKassa.
					</p>
				</details>

				<!-- FAQ Item 3 -->
				<details class="bg-white rounded-lg shadow-md p-6 group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Есть ли пробный период?
						<svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Бесплатный план доступен без ограничений по времени. Вы можете пользоваться им столько, сколько нужно, и перейти на платный план в любой момент.
					</p>
				</details>

				<!-- FAQ Item 4 -->
				<details class="bg-white rounded-lg shadow-md p-6 group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Можно ли отменить подписку?
						<svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Да, вы можете отменить подписку в любой момент. После отмены вы сможете пользоваться платными функциями до конца оплаченного периода, после чего будете автоматически переведены на бесплатный план.
					</p>
				</details>

				<!-- FAQ Item 5 -->
				<details class="bg-white rounded-lg shadow-md p-6 group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Нужна ли кредитная карта для бесплатного плана?
						<svg class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Нет, для бесплатного плана не требуется указывать данные карты. Просто зарегистрируйтесь и начните пользоваться сервисом.
					</p>
				</details>
			</div>
		</div>

		<!-- Enterprise Section -->
		<div class="mt-16 max-w-4xl mx-auto">
			<div class="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white text-center">
				<h2 class="text-3xl font-bold mb-4">
					Корпоративные решения
				</h2>
				<p class="text-lg mb-6 opacity-90 max-w-2xl mx-auto">
					Нужно больше пользователей, особые требования к безопасности или индивидуальные настройки? 
					Мы предложим решение для вашей компании.
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a
						href="/contact?type=enterprise"
						class="bg-white text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg inline-block"
					>
						Связаться с отделом продаж
					</a>
					<a
						href="/features"
						class="border-2 border-white text-white px-8 py-3 rounded-xl font-semibold hover:bg-white hover:text-purple-600 transition-colors inline-block"
					>
						Узнать больше
					</a>
				</div>
			</div>
		</div>

		<!-- Comparison Table -->
		<div class="mt-16">
			<h2 class="text-3xl font-bold text-center text-gray-900 mb-8">
				Сравнение планов
			</h2>
			
			<div class="overflow-x-auto">
				<table class="w-full bg-white rounded-lg shadow-md overflow-hidden">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Функция</th>
							<th class="px-6 py-4 text-center text-sm font-semibold text-gray-900">Бесплатный</th>
							<th class="px-6 py-4 text-center text-sm font-semibold text-gray-900 bg-purple-50">Профессиональный</th>
							<th class="px-6 py-4 text-center text-sm font-semibold text-gray-900">Команда</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">Запросов в день</td>
							<td class="px-6 py-4 text-sm text-center text-gray-600">10</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 bg-purple-50 font-semibold">Безлимит</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 font-semibold">Безлимит</td>
						</tr>
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">AI модели</td>
							<td class="px-6 py-4 text-sm text-center text-gray-600">GPT-3.5</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 bg-purple-50 font-semibold">Все модели</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 font-semibold">Все + корпоративные</td>
						</tr>
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">История</td>
							<td class="px-6 py-4 text-sm text-center text-gray-600">7 дней</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 bg-purple-50 font-semibold">Полная</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 font-semibold">Полная</td>
						</tr>
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">API доступ</td>
							<td class="px-6 py-4 text-sm text-center text-gray-400">—</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 bg-purple-50">100k токенов</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 font-semibold">1M токенов</td>
						</tr>
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">Пользователей</td>
							<td class="px-6 py-4 text-sm text-center text-gray-600">1</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 bg-purple-50">1</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 font-semibold">До 10</td>
						</tr>
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">Поддержка</td>
							<td class="px-6 py-4 text-sm text-center text-gray-600">Email</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 bg-purple-50">Приоритетная</td>
							<td class="px-6 py-4 text-sm text-center text-gray-900 font-semibold">Выделенная</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</PublicPageLayout>
