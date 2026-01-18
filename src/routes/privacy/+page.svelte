<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '1 января 2025';
</script>

<PublicPageLayout
	title="Политика конфиденциальности"
	description="Политика конфиденциальности AIris. Узнайте, как мы собираем, используем и защищаем ваши данные."
>
	<div class="container mx-auto px-4 pt-12 pb-16">
		<div class="max-w-4xl mx-auto">
			<!-- Header -->
			<div class="text-center mb-12">
				<h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
					Политика конфиденциальности
				</h1>
				<p class="text-gray-600">
					Последнее обновление: {lastUpdated}
				</p>
			</div>

			<!-- Content -->
			<div class="bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-8">
				<!-- Introduction -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">1. Введение</h2>
					<p class="text-gray-600 leading-relaxed">
						ООО "Open WebUI" (далее - "Компания", "мы") уважает вашу конфиденциальность и обязуется
						защищать ваши персональные данные. Настоящая Политика конфиденциальности описывает,
						как мы собираем, используем и защищаем информацию, которую вы предоставляете при
						использовании сервиса Open WebUI.
					</p>
				</section>

				<!-- Data Collection -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">2. Какие данные мы собираем</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>2.1. Данные, которые вы предоставляете напрямую:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Имя и email при регистрации</li>
							<li>Данные профиля (аватар, настройки)</li>
							<li>Содержание ваших чатов с AI-моделями</li>
							<li>Платежная информация при оформлении подписки</li>
							<li>Сообщения в службу поддержки</li>
						</ul>

						<p class="pt-4">2.2. Данные, собираемые автоматически:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>IP-адрес и информация об устройстве</li>
							<li>Тип браузера и операционной системы</li>
							<li>Данные о использовании сервиса (частота, продолжительность)</li>
							<li>Cookies и аналогичные технологии</li>
						</ul>
					</div>
				</section>

				<!-- Data Usage -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">3. Как мы используем ваши данные</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>Мы используем собранные данные для:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Предоставления и улучшения сервиса</li>
							<li>Персонализации вашего опыта</li>
							<li>Обработки платежей и управления подпиской</li>
							<li>Отправки важных уведомлений о сервисе</li>
							<li>Технической поддержки и ответов на обращения</li>
							<li>Анализа использования и улучшения функций</li>
							<li>Обеспечения безопасности и предотвращения мошенничества</li>
							<li>Соблюдения законодательных требований</li>
						</ul>
					</div>
				</section>

				<!-- Data Sharing -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">4. Передача данных третьим лицам</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>4.1. Мы не продаем ваши персональные данные третьим лицам.</p>
						<p>4.2. Мы можем передавать данные:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Провайдерам AI-моделей для обработки ваших запросов</li>
							<li>Платежным системам для обработки транзакций</li>
							<li>Хостинг-провайдерам для хранения данных</li>
							<li>Аналитическим сервисам для улучшения продукта</li>
							<li>По требованию государственных органов в соответствии с законом</li>
						</ul>
						<p class="pt-4">
							4.3. Все наши партнеры обязаны соблюдать строгие стандарты защиты данных.
						</p>
					</div>
				</section>

				<!-- Data Protection -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">5. Защита данных</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>Мы применяем следующие меры защиты:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Шифрование данных при передаче (TLS/SSL)</li>
							<li>Шифрование данных при хранении</li>
							<li>Регулярное резервное копирование</li>
							<li>Контроль доступа и аутентификация сотрудников</li>
							<li>Мониторинг безопасности 24/7</li>
							<li>Регулярные аудиты безопасности</li>
						</ul>
					</div>
				</section>

				<!-- Data Retention -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">6. Хранение данных</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							6.1. Мы храним ваши персональные данные до тех пор, пока это необходимо для
							предоставления услуг или выполнения законодательных требований.
						</p>
						<p>
							6.2. История чатов хранится в соответствии с вашим тарифным планом.
						</p>
						<p>
							6.3. После удаления аккаунта ваши данные удаляются в течение 30 дней,
							за исключением данных, которые мы обязаны хранить по закону.
						</p>
					</div>
				</section>

				<!-- User Rights -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">7. Ваши права</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>Вы имеете право:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Получить доступ к своим персональным данным</li>
							<li>Исправить неточные данные</li>
							<li>Удалить свои данные ("право на забвение")</li>
							<li>Ограничить обработку данных</li>
							<li>Экспортировать свои данные</li>
							<li>Отозвать согласие на обработку данных</li>
							<li>Подать жалобу в надзорный орган</li>
						</ul>
						<p class="pt-4">
							Для реализации своих прав обратитесь к нам по адресу
							<a href="mailto:privacy@openwebui.ru" class="text-gray-900 font-medium hover:underline">privacy@openwebui.ru</a>.
						</p>
					</div>
				</section>

				<!-- Cookies -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">8. Файлы cookie</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>8.1. Мы используем следующие типы cookies:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li><strong>Необходимые</strong> - для работы сервиса (авторизация, настройки)</li>
							<li><strong>Аналитические</strong> - для улучшения сервиса (можно отключить)</li>
							<li><strong>Маркетинговые</strong> - для персонализации рекламы (можно отключить)</li>
						</ul>
						<p class="pt-4">
							8.2. Вы можете управлять настройками cookies в своем браузере или в настройках аккаунта.
						</p>
					</div>
				</section>

				<!-- Children -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">9. Защита детей</h2>
					<p class="text-gray-600 leading-relaxed">
						Наш сервис не предназначен для лиц младше 18 лет. Мы не собираем сознательно
						персональные данные несовершеннолетних. Если вам стало известно о регистрации
						несовершеннолетнего, пожалуйста, сообщите нам.
					</p>
				</section>

				<!-- Changes -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">10. Изменения политики</h2>
					<p class="text-gray-600 leading-relaxed">
						Мы можем обновлять настоящую Политику. Об изменениях мы уведомим вас по email
						или через уведомление в сервисе не менее чем за 30 дней до вступления изменений в силу.
					</p>
				</section>

				<!-- Contact -->
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">11. Контактная информация</h2>
					<p class="text-gray-600 leading-relaxed">
						По вопросам, связанным с защитой персональных данных:
					</p>
					<ul class="mt-4 text-gray-600 space-y-2">
						<li>Email: <a href="mailto:privacy@openwebui.ru" class="text-gray-900 font-medium hover:underline">privacy@openwebui.ru</a></li>
						<li>Форма обратной связи: <a href="/contact" class="text-gray-900 font-medium hover:underline">страница контактов</a></li>
					</ul>
				</section>

				<!-- Navigation -->
				<div class="pt-8 border-t border-gray-200 flex flex-wrap gap-4">
					<a href="/terms" class="text-gray-900 font-medium hover:underline">
						Условия использования
					</a>
					<a href="/contact" class="text-gray-900 font-medium hover:underline">
						Связаться с нами
					</a>
				</div>
			</div>
		</div>
	</div>
</PublicPageLayout>
