<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '1 января 2025';
</script>

<PublicPageLayout
	title="Условия использования"
	description="Условия использования сервиса AIris. Ознакомьтесь с правилами и ограничениями."
>
	<div class="container mx-auto px-4 pt-12 pb-16">
		<div class="max-w-4xl mx-auto">
			<!-- Header -->
			<div class="text-center mb-12">
				<h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
					Условия использования
				</h1>
				<p class="text-gray-600">
					Последнее обновление: {lastUpdated}
				</p>
			</div>

			<!-- Content -->
			<div class="bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-8">
				<!-- Introduction -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">1. Общие положения</h2>
					<p class="text-gray-600 leading-relaxed">
						Настоящие Условия использования (далее - "Условия") регулируют использование сервиса Open WebUI
						(далее - "Сервис"), предоставляемого ООО "Open WebUI" (далее - "Компания").
						Используя Сервис, вы соглашаетесь с настоящими Условиями.
					</p>
				</section>

				<!-- Registration -->
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
							2.4. Компания оставляет за собой право заблокировать или удалить учетную запись
							при нарушении настоящих Условий.
						</p>
					</div>
				</section>

				<!-- Usage Rules -->
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

				<!-- AI Usage -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">4. Использование AI-функций</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							4.1. AI-модели, используемые в Сервисе, генерируют ответы на основе вероятностных
							алгоритмов и могут содержать неточности.
						</p>
						<p>
							4.2. Вы несете ответственность за проверку и использование информации,
							полученной от AI-моделей.
						</p>
						<p>
							4.3. Запрещается использовать AI-функции для создания контента, нарушающего
							законодательство или права третьих лиц.
						</p>
					</div>
				</section>

				<!-- Payment -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">5. Оплата и подписка</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							5.1. Платные функции Сервиса предоставляются на условиях подписки.
							Актуальные тарифы указаны на странице <a href="/pricing" class="text-gray-900 font-medium hover:underline">тарифов</a>.
						</p>
						<p>
							5.2. Оплата производится автоматически в начале каждого расчетного периода.
						</p>
						<p>
							5.3. Вы можете отменить подписку в любой момент. Доступ к платным функциям
							сохраняется до конца оплаченного периода.
						</p>
						<p>
							5.4. Возврат средств осуществляется в соответствии с законодательством РФ
							о защите прав потребителей.
						</p>
					</div>
				</section>

				<!-- Intellectual Property -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">6. Интеллектуальная собственность</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							6.1. Все права на Сервис, включая программное обеспечение, дизайн и контент,
							принадлежат Компании или её лицензиарам.
						</p>
						<p>
							6.2. Вы сохраняете права на контент, который вы создаете с помощью Сервиса.
						</p>
						<p>
							6.3. Вы предоставляете Компании ограниченную лицензию на использование вашего
							контента для обеспечения работы Сервиса.
						</p>
					</div>
				</section>

				<!-- Limitation of Liability -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">7. Ограничение ответственности</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							7.1. Сервис предоставляется "как есть". Компания не гарантирует бесперебойную
							работу Сервиса.
						</p>
						<p>
							7.2. Компания не несет ответственности за любые косвенные убытки, связанные
							с использованием Сервиса.
						</p>
						<p>
							7.3. Максимальная ответственность Компании ограничена суммой, уплаченной вами
							за использование Сервиса за последние 12 месяцев.
						</p>
					</div>
				</section>

				<!-- Changes -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">8. Изменение условий</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							8.1. Компания оставляет за собой право изменять настоящие Условия с уведомлением
							пользователей не менее чем за 30 дней до вступления изменений в силу.
						</p>
						<p>
							8.2. Продолжение использования Сервиса после вступления изменений в силу означает
							ваше согласие с новыми Условиями.
						</p>
					</div>
				</section>

				<!-- Contact -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">9. Контактная информация</h2>
					<p class="text-gray-600 leading-relaxed">
						По вопросам, связанным с настоящими Условиями, вы можете связаться с нами:
					</p>
					<ul class="mt-4 text-gray-600 space-y-2">
						<li>Email: <a href="mailto:legal@openwebui.ru" class="text-gray-900 font-medium hover:underline">legal@openwebui.ru</a></li>
						<li>Форма обратной связи: <a href="/contact" class="text-gray-900 font-medium hover:underline">страница контактов</a></li>
					</ul>
				</section>

				<!-- Navigation -->
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
	</div>
</PublicPageLayout>
