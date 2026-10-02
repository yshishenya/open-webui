<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';
	import { ANALYTICS_SETTINGS_EVENT } from '$lib/utils/airis/analyticsConsent';

	const lastUpdated = '2 октября 2026';
	const docVersion = '2026-10-02';

	const openAnalyticsSettings = (): void => {
		window.dispatchEvent(new CustomEvent(ANALYTICS_SETTINGS_EVENT));
	};
</script>

<PublicPageLayout
	title="Cookie‑политика"
	description="Cookie и локальные хранилища AIRIS, аналитика и управление её настройками."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="space-y-6">
			<span
				class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
			>
				Документы
			</span>
			<h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
				Cookie‑политика
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Какие cookies и локальные хранилища использует AIRIS и как изменить выбор аналитики.
			</p>
			<p class="text-sm text-gray-500">
				Версия: {docVersion} · Последнее обновление: {lastUpdated}
			</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div
			class="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-7"
		>
			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">1. Что регулирует документ</h2>
				<p class="text-gray-600 leading-relaxed">
					Cookie — небольшой файл, который сайт сохраняет в браузере. AIRIS также использует
					localStorage и sessionStorage. В этой политике все такие технологии вместе называются
					«локальными хранилищами».
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">2. Необходимые хранилища</h2>
				<ul class="list-disc pl-6 space-y-2 text-gray-600 leading-relaxed">
					<li>
						<strong>Авторизация и безопасность:</strong> поддерживают вход, сессию, защиту запросов и
						предотвращение злоупотреблений. Без них вход и часть функций не работают.
					</li>
					<li>
						<strong>Настройки:</strong> запоминают язык, тему, состояние интерфейса и иные выбранные пользователем
						параметры.
					</li>
					<li>
						<strong>Выбор аналитики:</strong> ключ <code>airis.analytics.consent.v1</code>
						сохраняет значение «разрешено» или «запрещено» до следующего изменения пользователем либо
						очистки данных сайта.
					</li>
				</ul>
				<p class="text-gray-600 leading-relaxed">
					Правовое основание необходимых хранилищ — предоставление запрошенного сервиса, исполнение
					договора и обеспечение безопасности. Они не используются для рекламной персонализации.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">3. Аналитика и возможность её запретить</h2>
				<p class="text-gray-600 leading-relaxed">
					Аналитика включена по умолчанию, пока пользователь её не запретил. При первом посещении
					AIRIS показывает уведомление с кнопками «Запретить» и «Понятно». Отсутствие ответа или
					закрытие уведомления не останавливает сбор. Ранее сохранённый запрет продолжает
					действовать.
				</p>
				<p class="text-gray-600 leading-relaxed">
					AIRIS использует Яндекс Метрику и PostHog для учёта посещений, источников переходов,
					регистраций, первого использования, подтверждённых оплат и возвратов. Могут обрабатываться
					IP‑адрес, характеристики браузера и устройства, путь страницы, рекламные метки и события.
					Тексты чатов и введённые в поле сообщения данные, email, имя, токены и приватные параметры
					адресов в собственные события не включаются. Запись сеансов, Вебвизор и карта кликов
					выключены.
				</p>
				<p class="text-gray-600 leading-relaxed">
					Пока аналитика разрешена, локальные хранилища сохраняют псевдонимный идентификатор
					посетителя и источники перехода. Рекламные метки UTM, gclid, yclid или ymclid могут
					храниться до 90 дней. После входа наблюдаемые события связываются с аккаунтом через
					псевдонимный аналитический идентификатор.
				</p>
			</section>

			<section id="analytics-settings" class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">4. Как изменить выбор</h2>
				<p class="text-gray-600 leading-relaxed">
					Отказ не ограничивает основные функции AIRIS. Новый выбор применяется к дальнейшей
					аналитике. При запрете AIRIS останавливает сбор, удаляет собственные источники перехода и
					идентификатор посетителя и перезагружает страницу, чтобы не запускать аналитические
					сценарии снова. Ранее установленные cookies аналитического сервиса могут сохраняться до их
					срока действия или удаления в браузере.
				</p>
				<button
					type="button"
					class="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
					on:click={openAnalyticsSettings}
				>
					Открыть настройки аналитики
				</button>
				<p class="text-gray-600 leading-relaxed">
					Кроме того, cookies и локальные данные можно удалить в настройках браузера. После очистки
					выбор будет сброшен и аналитика снова включится по умолчанию. Полная блокировка
					необходимых хранилищ может нарушить вход и работу сервиса.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">5. Получатели и сроки</h2>
				<p class="text-gray-600 leading-relaxed">
					Получателем аналитических данных является привлечённый сервис веб‑аналитики в объёме,
					необходимом для указанной функции. Сроки отдельных cookies и данных на стороне поставщика
					определяются его настройками и документами. Актуальная роль и условие использования
					указаны в
					<a href="/documents/subprocessors" class="text-gray-900 font-medium hover:underline"
						>перечне поставщиков</a
					>.
				</p>
			</section>

			<p class="text-gray-600 leading-relaxed">
				О целях, основаниях, сроках и правах субъекта см.
				<a href="/privacy" class="text-gray-900 font-medium hover:underline"
					>Политику конфиденциальности и обработки персональных данных</a
				>.
			</p>
		</div>
	</section>
</PublicPageLayout>
