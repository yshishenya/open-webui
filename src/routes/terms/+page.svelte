<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '19 января 2026';
</script>

<PublicPageLayout
	title="Условия использования"
	description="Условия использования сервиса AIris. Ознакомьтесь с правилами и ограничениями."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="relative">
			<div
				class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"
			></div>
			<div
				class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"
			></div>
			<div class="space-y-6">
				<span
					class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
				>
					Документы
				</span>
				<h1
					class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]"
				>
					Условия использования
				</h1>
				<p class="text-lg md:text-xl text-gray-600 max-w-3xl">
					Правила работы с сервисом AIris, оплата и ответственность сторон.
				</p>
				<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Коротко</h2>
			<ul class="space-y-3 text-sm text-gray-700">
				<li class="flex items-start gap-2">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
					Сервис предоставляется на условиях PAYG — оплата по фактическому использованию.
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
					Вы отвечаете за корректность применения результатов работы AI‑моделей.
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
					Мы можем обновлять условия с предварительным уведомлением.
				</li>
			</ul>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto">
			<div class="bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-8">
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">1. Общие положения</h2>
					<p class="text-gray-600 leading-relaxed">
						Настоящие Условия использования (далее - "Условия") регулируют использование сервиса
						AIris (далее - "Сервис"), предоставляемого ИП Шишеня Ян Александрович (далее -
						"Компания"). Используя Сервис, вы соглашаетесь с настоящими Условиями.
					</p>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">2. Регистрация и аккаунт</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							2.1. Для использования Сервиса вам необходимо создать учетную запись, предоставив
							достоверную информацию.
						</p>
						<p>
							2.2. Вы несете ответственность за сохранность своих учетных данных и за все действия,
							совершенные под вашей учетной записью.
						</p>
						<p>
							2.3. Запрещается передавать учетные данные третьим лицам или создавать несколько
							учетных записей для одного пользователя.
						</p>
						<p>
							2.4. Компания оставляет за собой право заблокировать или удалить учетную запись при
							нарушении настоящих Условий.
						</p>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">3. Правила использования</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>3.1. При использовании Сервиса запрещается:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Нарушать законодательство Российской Федерации и международные нормы права</li>
							<li>Распространять незаконный, вредоносный или оскорбительный контент</li>
							<li>Предпринимать попытки несанкционированного доступа к системам Сервиса</li>
							<li>Использовать Сервис для рассылки спама или вредоносного ПО</li>
							<li>Нарушать права интеллектуальной собственности третьих лиц</li>
							<li>Создавать помехи в работе Сервиса или его пользователей</li>
						</ul>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">4. Использование AI-функций</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							4.1. AI-модели, используемые в Сервисе, генерируют ответы на основе вероятностных
							алгоритмов и могут содержать неточности.
						</p>
						<p>
							4.2. Вы несете ответственность за проверку и использование информации, полученной от
							AI-моделей.
						</p>
						<p>
							4.3. Запрещается использовать AI-функции для создания контента, нарушающего
							законодательство или права третьих лиц.
						</p>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">5. Оплата (PAYG)</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							5.1. Платные функции Сервиса предоставляются на условиях PAYG — оплата по фактическому
							использованию. Актуальные тарифы указаны на странице
							<a href="/pricing" class="text-gray-900 font-medium hover:underline">тарифов</a>.
						</p>
						<p>5.2. Списание происходит автоматически при использовании функций Сервиса.</p>
						<p>5.3. Вы можете пополнять баланс в любое время и контролировать лимиты расходов.</p>
						<p>
							5.4. Возврат средств осуществляется в соответствии с законодательством РФ о защите
							прав потребителей.
						</p>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">6. Интеллектуальная собственность</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							6.1. Все права на Сервис, включая программное обеспечение, дизайн и контент,
							принадлежат Компании или её лицензиарам.
						</p>
						<p>6.2. Вы сохраняете права на контент, который вы создаете с помощью Сервиса.</p>
						<p>
							6.3. Вы предоставляете Компании ограниченную лицензию на использование вашего контента
							для обеспечения работы Сервиса.
						</p>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">7. Ограничение ответственности</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							7.1. Сервис предоставляется "как есть". Компания не гарантирует бесперебойную работу
							Сервиса.
						</p>
						<p>
							7.2. Компания не несет ответственности за любые косвенные убытки, связанные с
							использованием Сервиса.
						</p>
						<p>
							7.3. Максимальная ответственность Компании ограничена суммой, уплаченной вами за
							использование Сервиса за последние 12 месяцев.
						</p>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">8. Изменение условий</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							8.1. Компания оставляет за собой право изменять настоящие Условия с уведомлением
							пользователей не менее чем за 30 дней до вступления изменений в силу.
						</p>
						<p>
							8.2. Продолжение использования Сервиса после вступления изменений в силу означает ваше
							согласие с новыми Условиями.
						</p>
					</div>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">9. Контактная информация</h2>
					<p class="text-gray-600 leading-relaxed">
						По вопросам, связанным с настоящими Условиями, вы можете связаться с нами:
					</p>
					<ul class="mt-4 text-gray-600 space-y-2">
						<li>
							Email: <a
								href="mailto:support@airis.you"
								class="text-gray-900 font-medium hover:underline">support@airis.you</a
							>
						</li>
						<li>
							Форма обратной связи: <a
								href="/contact"
								class="text-gray-900 font-medium hover:underline">страница контактов</a
							>
						</li>
					</ul>
				</section>

				<div class="pt-8 border-t border-gray-200 flex flex-wrap gap-4">
					<a href="/privacy" class="text-gray-900 font-medium hover:underline">
						Политика конфиденциальности
					</a>
					<a href="/contact" class="text-gray-900 font-medium hover:underline">
						Связаться с нами
					</a>
				</div>
			</div>
		</div>
	</section>
</PublicPageLayout>
