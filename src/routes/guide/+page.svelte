<script lang="ts">
	import { onMount } from 'svelte';
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
						.join(', ')}. Они загружаются из текущих настроек AIRIS.
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
