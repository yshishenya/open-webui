<script lang="ts">
	import { onMount } from 'svelte';
	import comparison from '$lib/utils/airis/guide-comparison.json';
	import PublicPageLayout from '$lib/components/landing/PublicPageLayout.svelte';
	import { buildChatUrl, openPreset } from '$lib/components/landing/welcomeNavigation';
	import { getPublicLeadMagnetConfig, getPublicPricingConfig } from '$lib/apis/billing';
	import type { PublicLeadMagnetConfig, PublicPricingConfig } from '$lib/apis/billing';

	const model = 'gpt-5.6-luna';
	const examples = [
		{
			id: 'letter',
			title: 'Написать текст',
			purpose: 'Короткое деловое письмо о переносе встречи.',
			prompt:
				'Помоги написать короткое деловое письмо коллегам. Мы хотим перенести встречу по проекту с пятницы на понедельник в 11:00, потому что к пятнице не успеем подготовить расчёты. Попроси подтвердить, подходит ли новое время. Тон спокойный и дружелюбный, без канцелярита. Дай тему письма и текст не длиннее 120 слов. Не добавляй факты, которых нет в запросе.',
			check:
				'Есть тема, причина переноса, новое время и просьба подтвердить. Нет придуманных имён и обязательств.',
			followUp:
				'Сократи до пяти предложений. Убери оправдания, но сохрани причину и просьбу подтвердить время.'
		},
		{
			id: 'topic',
			title: 'Разобраться в теме',
			purpose: 'Понять разницу между выручкой и прибылью.',
			prompt:
				'Объясни человеку без финансового образования, чем выручка отличается от прибыли. Используй простой пример маленькой кофейни с вымышленными числами. Сначала дай объяснение в трёх предложениях, потом покажи расчёт и назови две частые ошибки. В конце задай один короткий вопрос, чтобы я проверил, понял ли разницу.',
			check:
				'Выручка и прибыль различаются, затраты учтены, числа сходятся. Ответьте на проверочный вопрос.',
			followUp:
				'Я всё ещё путаюсь. Объясни ещё проще и отдельно покажи, куда ушли деньги из выручки.'
		},
		{
			id: 'plan',
			title: 'Составить план',
			purpose: 'Распределить задачи на неделю и оставить запас времени.',
			prompt:
				'Помоги составить реалистичный план рабочей недели. У меня по два свободных часа в день с понедельника по пятницу. Нужно подготовить презентацию из 10 слайдов, разобрать 30 рабочих писем и изучить вводный материал по новой теме. Предложи порядок задач и план по дням. Оставь небольшой запас времени на непредвиденные дела. Если всё не помещается, явно скажи, что перенести. Не планируй работу на выходные.',
			check:
				'План занимает не больше 10 часов, включает резерв и понятные шаги. Лишние задачи перенесены, выходные свободны.',
			followUp:
				'Во вторник у меня нет свободного времени. Перестрой план на восемь часов, сохрани резерв и объясни, что придётся сократить.'
		}
	];

	let freeConfig: PublicLeadMagnetConfig | null = null;
	let pricingConfig: PublicPricingConfig | null = null;
	let loading = true;
	let pricingLoadedAt: string | null = null;
	const formatNumber = (value: number): string => new Intl.NumberFormat('ru-RU').format(value);

	onMount(() => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10000);
		void Promise.all([
			getPublicLeadMagnetConfig(controller.signal),
			getPublicPricingConfig(controller.signal)
		])
			.then(([free, pricing]) => {
				freeConfig = free;
				pricingConfig = pricing;
				if (
					Array.isArray(pricing?.topup_amounts_rub) &&
					pricing.topup_amounts_rub.length > 0 &&
					pricing.topup_amounts_rub.every((amount) => Number.isFinite(amount) && amount > 0)
				) {
					pricingLoadedAt = new Intl.DateTimeFormat('ru-RU', {
						day: 'numeric',
						month: 'long',
						year: 'numeric',
						timeZone: 'Europe/Moscow'
					}).format(new Date());
				} else {
					pricingConfig = null;
				}
			})
			.finally(() => {
				clearTimeout(timeout);
				loading = false;
			});
		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	});
</script>

<PublicPageLayout
	title="Как начать пользоваться AIRIS"
	description="Три готовые задачи: написать текст, разобраться в теме и составить план. Узнайте, как уточнять ответы, проверить бесплатные лимиты и расходы."
>
	<section class="airis-public-simple-hero">
		<div class="container mx-auto px-4 py-12 md:py-20">
			<div class="max-w-3xl">
				<p class="airis-public-eyebrow">Короткое руководство</p>
				<h1 class="airis-public-display mt-5">Начните с одной задачи</h1>
				<p class="airis-public-lead mt-6">
					Выберите пример, измените его под себя и отправьте в чат. После ответа можно продолжить
					разговор и уточнить результат.
				</p>
				<a
					href="#examples"
					class="airis-public-btn-primary mt-8 inline-flex min-h-11 items-center justify-center rounded-xl px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
					>Выбрать задачу</a
				>
			</div>
		</div>
	</section>

	<section class="airis-public-section" id="free">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Что можно попробовать бесплатно</h2>
			<p class="mt-5 text-[var(--airis-muted)]">
				Примеры открываются с моделью <strong class="text-[var(--airis-ink)]">{model}</strong>.
				Перед отправкой проверьте выбранную модель и оставшийся бесплатный лимит в кошельке.
			</p>
			<div class="airis-public-card mt-6 p-6" aria-live="polite">
				{#if loading}
					<p>Загружаем действующие условия. Примеры ниже уже можно читать.</p>
				{:else if freeConfig?.enabled}
					<p>
						Лимиты обновляются каждые {freeConfig.cycle_days} дней. Для текста: {formatNumber(
							freeConfig.quotas.tokens_input
						)} входных токенов и {formatNumber(freeConfig.quotas.tokens_output)} токенов ответа за период.
					</p>
				{:else if freeConfig}
					<p>
						Бесплатный доступ сейчас выключен. Перед отправкой примера проверьте ставки модели и
						баланс кошелька.
					</p>
				{:else}
					<p>
						Не удалось загрузить условия бесплатного доступа. Проверьте их в кошельке перед
						отправкой запроса.
					</p>
				{/if}
				<p class="mt-3">
					Токены — небольшие части текста. Их количество зависит от языка и длины переписки: лимит
					не означает фиксированное число задач.
				</p>
				<p class="mt-3">
					Когда бесплатный лимит исчерпан или не применяется к модели, запрос может оплачиваться из
					кошелька. Если модель из примера недоступна, чат попросит выбрать другую — сначала
					проверьте её стоимость.
				</p>
				<a
					href="/billing/balance"
					class="airis-public-text-button mt-4 inline-flex min-h-11 items-center"
					>Проверить мои лимиты и баланс →</a
				>
			</div>
		</div>
	</section>

	<section class="airis-public-section" id="video">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Посмотрите один пример за минуту</h2>
			<p class="mt-5 text-[var(--airis-muted)]">
				Письмо, ответ, уточнение и проверка расходов. Запись от 2 октября 2026 года; вход выполнен
				заранее. Действующие условия смотрите в кошельке.
			</p>
			<video
				controls
				playsinline
				preload="none"
				class="mt-6 w-full rounded-xl bg-black"
				aria-label="Первая задача в AIRIS: письмо, уточнение и расходы"
			>
				<source src="/airis/guide/first-task-20261002.mp4" type="video/mp4" />
				<track
					kind="captions"
					src="/airis/guide/first-task-20261002.vtt"
					srclang="ru"
					label="Русские пояснения"
					default
				/>
				Браузер не поддерживает видео. Все действия доступны текстом ниже.
			</video>
			<a
				href="/airis/guide/first-task-20261002.md"
				class="airis-public-text-button mt-4 inline-flex min-h-11 items-center"
				>Все действия текстом →</a
			>
			<p class="mt-3 text-[var(--airis-muted)]">
				Можно начать с примеров ниже без просмотра видео.
			</p>
		</div>
	</section>

	<section class="airis-public-section airis-public-section-muted" id="examples">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Три задачи для первого разговора</h2>
			<ol class="mt-6 space-y-3 list-decimal pl-5 text-[var(--airis-muted)]">
				<li>
					Нажмите «Открыть задачу». Если нужно, войдите или зарегистрируйтесь: текст сохранится.
				</li>
				<li>В чате проверьте модель и замените условия примера на свои.</li>
				<li>Нажмите кнопку отправки. Открытие примера само по себе ничего не отправляет.</li>
			</ol>
			<div class="mt-8 space-y-6">
				{#each examples as example, index (example.id)}
					<article class="airis-public-card p-6 md:p-8" aria-labelledby={`example-${example.id}`}>
						<p class="airis-public-eyebrow">Задача {index + 1}</p>
						<h3 class="mt-3 text-2xl font-semibold" id={`example-${example.id}`}>
							{example.title}
						</h3>
						<p class="mt-3">{example.purpose}</p>
						<blockquote class="mt-5 border-l-2 border-[var(--airis-lavender)] pl-4 leading-relaxed">
							{example.prompt}
						</blockquote>
						<a
							href={buildChatUrl('guide_examples', {
								preset: example.id,
								q: example.prompt,
								model,
								submit: 'false'
							})}
							class="airis-public-btn-primary mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
							aria-label={`Открыть задачу: ${example.title.toLowerCase()}`}
							on:click={(event) => {
								if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
								event.preventDefault();
								openPreset('guide_examples', example.id, example.prompt, model);
							}}>Открыть задачу</a
						>
						<p class="mt-6"><strong>Проверьте результат:</strong> {example.check}</p>
						<p class="mt-4"><strong>Уточнение в том же чате:</strong> «{example.followUp}»</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="airis-public-section" id="follow-up">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Как получить более полезный ответ</h2>
			<p class="mt-5 text-[var(--airis-muted)]">
				Напишите, что изменить: длину, тон, формат или условия. Продолжайте в том же чате — модель
				видит предыдущую переписку. Для другой темы начните новый чат.
			</p>
			<p class="mt-4 text-[var(--airis-muted)]">
				Проверяйте факты и расчёты. Если ответ не подходит, сначала добавьте контекст и уточните
				запрос. Другую модель имеет смысл попробовать, если нужны её возможности или вы хотите
				сравнить результат; доступность и ставки моделей различаются.
			</p>
		</div>
	</section>

	<section class="airis-public-section airis-public-section-muted" id="costs">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Где посмотреть расходы и пополнить баланс</h2>
			<p class="mt-5 text-[var(--airis-muted)]">
				Для платного использования пополните кошелёк в рублях. Оплата идёт за использование
				выбранной модели, без обязательной подписки. Расход зависит от модели, объёма вашего
				сообщения, ответа и истории чата.
			</p>
			{#if pricingConfig?.topup_amounts_rub?.length}
				<p class="mt-4 text-[var(--airis-muted)]">
					Действующие суммы пополнения: {pricingConfig.topup_amounts_rub
						.map((amount) => `${formatNumber(amount)} ₽`)
						.join(', ')}. Условия пополнения загружены {pricingLoadedAt} из настроек AIRIS.
				</p>
			{:else}
				<p class="mt-4 text-[var(--airis-muted)]">
					Доступные суммы пополнения можно проверить в кошельке.
				</p>
			{/if}
			<p class="mt-4 text-[var(--airis-muted)]">
				На странице тарифов есть ставки моделей и приблизительный расчёт. Он помогает оценить
				расход, но не фиксирует цену будущего ответа. Фактическое использование и списания смотрите
				в истории.
			</p>
			<div class="mt-6 flex flex-wrap gap-4">
				<a
					href="/pricing#calculation"
					class="airis-public-text-button inline-flex min-h-11 items-center"
					>Ставки и примерный расчёт →</a
				>
				<a
					href="/billing/balance"
					class="airis-public-text-button inline-flex min-h-11 items-center">Кошелёк →</a
				>
				<a
					href="/billing/history"
					class="airis-public-text-button inline-flex min-h-11 items-center">История расходов →</a
				>
			</div>
		</div>
	</section>

	<section class="airis-public-section" id="model-comparison">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Когда стоит сравнить модели</h2>
			<p class="mt-5 text-[var(--airis-muted)]">
				Сначала попробуйте бесплатную Luna и уточните запрос. Если задача требует сложного плана,
				можно сравнить ответ с другой моделью, предварительно проверив её ставки и лимит расхода.
				Более высокая цена сама по себе не гарантирует более полезный ответ.
			</p>
			<div class="airis-public-card mt-6 p-6">
				<h3 class="text-xl font-semibold">Одна задача, два настоящих ответа</h3>
				<p class="mt-4">
					3 октября 2026 года мы проверили план подготовки презентации. В задаче доступно четыре дня
					по 120 минут, все работы занимают 480 минут, нужен резерв 30 минут. При этом четверговая
					цепочка «замечания → исправления → репетиция» занимает 135 минут.
				</p>
				<p class="mt-4">
					Обе модели нашли оба противоречия и предложили согласовать увеличение четвергового окна до
					150 минут. Luna уже решила основную задачу. В этом ответе Sol подробнее разделила работу и
					резерв: 120, 120, 105 и 135 минут работы, по 15 минут резерва в среду и четверг. В
					итоговом списке Luna время работы и доступные окна разделены менее явно; его стоит
					уточнить следующим сообщением.
				</p>
				<div class="mt-6 overflow-x-auto">
					<table class="w-full text-left text-sm">
						<caption class="pb-3 text-left font-semibold"
							>Использование и расчёт по ставкам AIRIS на 3 октября 2026 года</caption
						>
						<thead
							><tr>
								<th scope="col" class="p-2">Модель</th>
								<th scope="col" class="p-2">Токены запроса</th>
								<th scope="col" class="p-2">Токены ответа</th>
								<th scope="col" class="p-2">По ставкам AIRIS</th>
							</tr></thead
						>
						<tbody>
							{#each comparison.models as result}
								<tr
									><th scope="row" class="p-2 font-medium">{result.model}</th>
									<td class="p-2">{formatNumber(result.input_tokens)}</td>
									<td class="p-2">{formatNumber(result.output_tokens)}</td>
									<td class="p-2 whitespace-nowrap"
										>{(result.cost_kopeks / 100).toLocaleString('ru-RU', {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2
										})} ₽</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-4 text-sm text-[var(--airis-muted)]">
					Ответы получены по одному одинаковому запросу в новых чатах, с одинаковыми общими
					инструкциями и пределом длины. Расход проверен в тестовом кошельке. Для Luna 0,42 ₽ —
					ориентир платного использования: в пределах бесплатной квоты деньги с кошелька не
					списываются. Это один пример; результат следующего запроса может отличаться.
				</p>
				<p class="mt-4 text-sm text-[var(--airis-muted)]">
					Ставки за 1000 токенов запроса / ответа: Luna — 0,06 / 0,36 ₽, Sol — 1,50 / 9,00 ₽.
					Стоимость запроса и ответа округляется вверх до копейки отдельно. В токены ответа входит
					также внутреннее рассуждение модели. Новая длина ответа и история чата меняют расход;
					действующие ставки смотрите на странице тарифов, предел одного ответа и дневной расход — в
					кошельке.
				</p>
				<details class="mt-6">
					<summary class="cursor-pointer py-3 font-medium">Полный запрос и оба ответа</summary>
					<h4 class="mt-4 font-semibold">Запрос</h4>
					<p class="mt-3">{comparison.prompt}</p>
					{#each comparison.models as result}
						<h4 class="mt-6 font-semibold">{result.model}</h4>
						<pre
							class="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{result.answer}</pre>
					{/each}
				</details>
			</div>
		</div>
	</section>

	<section class="airis-public-section" id="help">
		<div class="container mx-auto px-4 max-w-4xl">
			<h2 class="airis-public-section-title">Если нужна помощь</h2>
			<p class="mt-5 text-[var(--airis-muted)]">
				Напишите, какую задачу решаете и на каком шаге возникла проблема. Можно ответить на письмо
				AIRIS или написать в поддержку. Пароли и данные карты отправлять не нужно.
			</p>
			<a
				href="mailto:support@airis.you?subject=Помощь%20с%20первой%20задачей%20AIRIS"
				class="airis-public-text-button mt-4 inline-flex min-h-11 items-center"
				>support@airis.you →</a
			>
		</div>
	</section>
</PublicPageLayout>
