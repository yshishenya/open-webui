<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';
</script>

<PublicPageLayout
	title="Согласие на обработку персональных данных"
	description="Текст согласия на обработку персональных данных для пользователей AIRIS."
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
				Согласие на обработку персональных данных
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Текст для подтверждения согласия при регистрации и использовании сервиса.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-6">
			<p class="text-gray-600 leading-relaxed">
				Настоящим я, как субъект персональных данных, действуя свободно, своей волей и в своём интересе,
				даю согласие Индивидуальному предпринимателю Шишеня Ян Александрович (ИНН 667803118920, ОГРНИП
				320665800036109) (далее — «Оператор») на обработку моих персональных данных в целях предоставления
				доступа к платформе AIRIS, оказания поддержки, выполнения требований законодательства, а также
				иных целей, указанных в
				<a href="/privacy" class="text-gray-900 font-medium hover:underline">Политике конфиденциальности</a>.
			</p>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">1. Состав данных</h2>
				<p class="text-gray-600 leading-relaxed">
					Согласие распространяется на данные, которые я предоставляю при регистрации/использовании сервиса
					(например: имя, email, данные профиля), а также на данные, собираемые автоматически (например: IP‑адрес,
					идентификаторы устройства/браузера, cookies), в объёме, указанном в Политике.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">2. Действия с данными</h2>
				<p class="text-gray-600 leading-relaxed">
					Обработка включает сбор, запись, систематизацию, накопление, хранение, уточнение, использование,
					передачу (предоставление, доступ), обезличивание, блокирование, удаление, уничтожение — с использованием
					средств автоматизации и/или без таковых.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">3. Срок действия и отзыв</h2>
				<p class="text-gray-600 leading-relaxed">
					Согласие действует до достижения целей обработки или до момента отзыва согласия. Отзыв согласия
					направляется по адресу
					<a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">support@airis.you</a>.
					Отзыв не влияет на законность обработки, осуществленной до его получения, и может ограничить доступ к сервису.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">4. Дополнительные условия</h2>
				<p class="text-gray-600 leading-relaxed">
					Подробные сведения о целях, правовых основаниях, получателях и мерах защиты приведены в
					<a href="/privacy" class="text-gray-900 font-medium hover:underline">Политике конфиденциальности</a>.
				</p>
			</section>
		</div>
	</section>
</PublicPageLayout>

