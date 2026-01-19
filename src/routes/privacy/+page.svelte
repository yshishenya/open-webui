<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '19 января 2026';
</script>

<PublicPageLayout
	title="Политика конфиденциальности"
	description="Политика конфиденциальности AIris. Узнайте, как мы собираем, используем и защищаем ваши данные."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="relative">
			<div class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"></div>
			<div class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"></div>
			<div class="space-y-6">
				<span class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600">
					Документы
				</span>
				<h1 class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
					Политика конфиденциальности
				</h1>
				<p class="text-lg md:text-xl text-gray-600 max-w-3xl">
					Рассказываем, какие данные мы собираем, зачем это нужно и как их защищаем.
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
					Собираем только данные, необходимые для работы сервиса.
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
					Передаем данные только партнёрам, которые обеспечивают работу сервиса.
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
					Вы можете запросить доступ, исправление или удаление данных.
				</li>
			</ul>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto">
			<div class="bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-8">
				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">1. Введение</h2>
					<p class="text-gray-600 leading-relaxed">
						ИП Шишеня Ян Александрович (далее - "Компания", "мы") уважает вашу конфиденциальность и обязуется
						защищать ваши персональные данные. Настоящая Политика конфиденциальности описывает,
						как мы собираем, используем и защищаем информацию, которую вы предоставляете при
						использовании сервиса AIris.
					</p>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">2. Какие данные мы собираем</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>2.1. Данные, которые вы предоставляете напрямую:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Имя и email при регистрации</li>
							<li>Данные профиля (аватар, настройки)</li>
							<li>Содержание ваших чатов с AI-моделями</li>
							<li>Платежная информация при пополнении баланса</li>
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

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">3. Как мы используем ваши данные</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>Мы используем собранные данные для:</p>
						<ul class="list-disc pl-6 space-y-2">
							<li>Предоставления и улучшения сервиса</li>
							<li>Персонализации вашего опыта</li>
							<li>Обработки платежей и управления балансом</li>
							<li>Отправки важных уведомлений о сервисе</li>
							<li>Технической поддержки и ответов на обращения</li>
							<li>Анализа использования и улучшения функций</li>
							<li>Обеспечения безопасности и предотвращения мошенничества</li>
							<li>Соблюдения законодательных требований</li>
						</ul>
					</div>
				</section>

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

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">6. Хранение данных</h2>
					<div class="space-y-4 text-gray-600 leading-relaxed">
						<p>
							6.1. Мы храним ваши персональные данные до тех пор, пока это необходимо для
							предоставления услуг или выполнения законодательных требований.
						</p>
						<p>
							6.2. История чатов хранится в соответствии с настройками вашего аккаунта.
						</p>
						<p>
							6.3. После удаления аккаунта ваши данные удаляются в течение 30 дней,
							за исключением данных, которые мы обязаны хранить по закону.
						</p>
					</div>
				</section>

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
							<a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">support@airis.you</a>.
						</p>
					</div>
				</section>

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

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">9. Защита детей</h2>
					<p class="text-gray-600 leading-relaxed">
						Наш сервис не предназначен для лиц младше 18 лет. Мы не собираем сознательно
						персональные данные несовершеннолетних. Если вам стало известно о регистрации
						несовершеннолетнего, пожалуйста, сообщите нам.
					</p>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">10. Изменения политики</h2>
					<p class="text-gray-600 leading-relaxed">
						Мы можем обновлять настоящую Политику. Об изменениях мы уведомим вас по email
						или через уведомление в сервисе не менее чем за 30 дней до вступления изменений в силу.
					</p>
				</section>

				<section>
					<h2 class="text-2xl font-bold text-gray-900 mb-4">11. Контактная информация</h2>
					<p class="text-gray-600 leading-relaxed">
						По вопросам, связанным с защитой персональных данных:
					</p>
					<ul class="mt-4 text-gray-600 space-y-2">
						<li>Email: <a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">support@airis.you</a></li>
						<li>Форма обратной связи: <a href="/contact" class="text-gray-900 font-medium hover:underline">страница контактов</a></li>
					</ul>
				</section>

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
	</section>
</PublicPageLayout>
