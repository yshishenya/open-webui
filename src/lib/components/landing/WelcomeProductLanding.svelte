<script lang="ts">
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';
	import { presetsById } from '$lib/data/features';
	import ArrowRight from '$lib/components/icons/ArrowRight.svelte';
	import ArrowUpCircle from '$lib/components/icons/ArrowUpCircle.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import ChevronRight from '$lib/components/icons/ChevronRight.svelte';
	import CreditCard from '$lib/components/icons/CreditCard.svelte';
	import Folder from '$lib/components/icons/Folder.svelte';
	import GlobeAlt from '$lib/components/icons/GlobeAlt.svelte';
	import Sparkles from '$lib/components/icons/Sparkles.svelte';
	import { trackEvent } from '$lib/utils/analytics';
	import FooterLinks from './FooterLinks.svelte';
	import { buildSignupUrl, openCta, openPreset } from './welcomeNavigation';

	export let leadMagnetConfig: PublicLeadMagnetConfig | null = null;

	type DemoMode = {
		id: 'text' | 'document' | 'image';
		label: string;
		prompt: string;
		result: string;
		resultNote: string;
		preset: string;
	};

	type ScenarioTask = {
		id: string;
		label: string;
		description: string;
		prompt: string;
		result: string;
		preset: string;
	};

	type ScenarioGroup = {
		id: 'study' | 'work' | 'creative';
		label: string;
		tasks: ScenarioTask[];
	};

	type QuotaItem = {
		label: string;
		value: number;
	};

	const demoModes: DemoMode[] = [
		{
			id: 'text',
			label: 'Текст',
			prompt: 'Сделай письмо короче и дружелюбнее',
			result: 'Готово. Текст стал короче, сохранил смысл и звучит естественно.',
			resultNote: 'Письмо готово к отправке',
			preset: 'email_reply'
		},
		{
			id: 'document',
			label: 'Документ',
			prompt: 'Сделай краткую сводку документа и выдели решения',
			result: 'Короткая сводка: 4 ключевых тезиса, 2 решения и список следующих шагов.',
			resultNote: 'Структура и выводы в одном ответе',
			preset: 'summarize_notes'
		},
		{
			id: 'image',
			label: 'Изображение',
			prompt: 'Создай спокойную обложку для статьи об AI',
			result: 'Подготовил промпт и четыре варианта композиции для обложки.',
			resultNote: 'Можно уточнить стиль прямо в чате',
			preset: 'image_generate'
		}
	];

	const scenarioGroups: ScenarioGroup[] = [
		{
			id: 'study',
			label: 'Учёба',
			tasks: [
				{
					id: 'study-explain',
					label: 'Объяснить сложную тему',
					description: 'Простыми словами и с примерами',
					prompt: 'Объясни квантовые вычисления простыми словами для студента первого курса.',
					result:
						'Квантовые вычисления используют кубиты — они могут хранить несколько состояний одновременно. Поэтому некоторые задачи можно решать иначе и быстрее, чем на обычном компьютере.',
					preset: 'study_explain'
				},
				{
					id: 'study-report',
					label: 'Подготовить реферат',
					description: 'План, структура и ключевые идеи',
					prompt: 'Составь план реферата о развитии городской среды: введение, три главы и вывод.',
					result:
						'Готова структура из введения, трёх логичных глав и вывода. Для каждого раздела добавлены тезисы и вопросы для исследования.',
					preset: 'report_plan'
				},
				{
					id: 'study-rewrite',
					label: 'Проверить и улучшить текст',
					description: 'Грамматика, стиль и ясность',
					prompt: 'Проверь мой текст, исправь ошибки и сделай формулировки яснее, не меняя смысл.',
					result:
						'Исправил грамматику, убрал повторы и упростил тяжёлые формулировки. Смысл и авторский тон сохранены.',
					preset: 'rewrite_clear'
				}
			]
		},
		{
			id: 'work',
			label: 'Работа',
			tasks: [
				{
					id: 'work-email',
					label: 'Ответить на письмо',
					description: 'Вежливо, кратко и по делу',
					prompt: 'Составь короткий деловой ответ клиенту: подтвердить сроки и предложить созвон.',
					result:
						'Подготовил ясный ответ: подтверждение сроков, следующий шаг и два варианта времени для созвона.',
					preset: 'email_reply'
				},
				{
					id: 'work-summary',
					label: 'Сделать сводку встречи',
					description: 'Решения, ответственные и сроки',
					prompt:
						'Преврати заметки со встречи в короткий протокол: решения, ответственные и сроки.',
					result:
						'Собрал решения в четыре пункта, назначил ответственных из заметок и вынес сроки в отдельный список.',
					preset: 'summarize_notes'
				},
				{
					id: 'work-resume',
					label: 'Улучшить резюме',
					description: 'Структура и сильные формулировки',
					prompt: 'Перепиши опыт в резюме через результаты и измеримые достижения.',
					result:
						'Заменил общие обязанности на конкретные результаты, добавил сильные глаголы и выстроил единый формат.',
					preset: 'resume'
				}
			]
		},
		{
			id: 'creative',
			label: 'Творчество',
			tasks: [
				{
					id: 'creative-post',
					label: 'Написать пост',
					description: 'Идея, текст и варианты подачи',
					prompt:
						'Напиши дружелюбный пост о запуске нового продукта: три варианта заголовка и основной текст.',
					result:
						'Готовы три заголовка и лаконичный текст поста с ясным преимуществом и призывом к действию.',
					preset: 'social_post'
				},
				{
					id: 'creative-image',
					label: 'Создать изображение',
					description: 'Концепция, стиль и варианты',
					prompt:
						'Создай обложку для подкаста о технологиях: минимализм, тёмный фон, фиолетовый акцент.',
					result:
						'Подготовил визуальное направление и несколько вариантов композиции, которые можно уточнить в чате.',
					preset: 'image_generate'
				},
				{
					id: 'creative-plan',
					label: 'Развить идею',
					description: 'От черновика до понятного плана',
					prompt: 'Помоги превратить идею короткого видео в сценарий на 60 секунд.',
					result:
						'Разложил идею на хук, основную сцену, кульминацию и финальный кадр. Добавил пример реплик и темп.',
					preset: 'presentation_plan'
				}
			]
		}
	];

	const faqItems = [
		{
			id: 'free',
			question: 'Что доступно бесплатно?',
			answer:
				'После регистрации вы получаете бесплатные лимиты на доступные возможности. Точный объём берётся из текущих настроек Airis и показывается на странице, когда он включён.'
		},
		{
			id: 'subscription',
			question: 'Нужна ли подписка?',
			answer:
				'Нет. Вы можете пополнить баланс и платить только за фактическое использование без обязательного ежемесячного платежа.'
		},
		{
			id: 'cost',
			question: 'Как считается стоимость?',
			answer:
				'Стоимость зависит от выбранной модели и объёма задачи. Для текста учитывается объём запроса и ответа, для изображений и других функций действуют свои ставки. Актуальные цены всегда доступны на странице тарифов.'
		},
		{
			id: 'payment',
			question: 'Можно ли оплатить российской картой?',
			answer: 'Да. Баланс можно пополнить российской банковской картой привычным способом.'
		},
		{
			id: 'vpn',
			question: 'Нужен ли VPN?',
			answer: 'Нет. Airis доступен напрямую из России без VPN.'
		}
	];

	const breadthLinks = [
		{ label: 'Тексты', preset: 'social_post', prompt: 'Помоги написать текст.' },
		{ label: 'Документы', preset: 'summarize_notes', prompt: 'Сделай сводку документа.' },
		{ label: 'Изображения', preset: 'image_generate', prompt: 'Создай изображение.' },
		{ label: 'Код', preset: 'code_help', prompt: 'Помоги разобраться с задачей по коду.' },
		{
			label: 'Анализ данных',
			preset: 'data_analysis',
			prompt: 'Проанализируй данные, найди закономерности и сформулируй выводы.'
		},
		{ label: 'Сводки', preset: 'summarize_notes', prompt: 'Сделай короткую сводку.' }
	];

	let activeDemo = demoModes[0];
	let activeScenarioGroup = scenarioGroups[0];
	let activeScenario = activeScenarioGroup.tasks[0];

	const heroHref = buildSignupUrl('welcome_hero_primary');
	const finalHref = buildSignupUrl('welcome_final_cta');

	const resolvePrompt = (preset: string, fallback: string): string =>
		presetsById[preset]?.prompt ?? fallback;

	const selectDemo = (mode: DemoMode): void => {
		activeDemo = mode;
		trackEvent('welcome_demo_tab_select', { mode: mode.id });
	};

	const selectScenarioGroup = (group: ScenarioGroup): void => {
		activeScenarioGroup = group;
		activeScenario = group.tasks[0];
		trackEvent('welcome_scenario_group_select', { group: group.id });
	};

	const selectScenario = (scenario: ScenarioTask): void => {
		activeScenario = scenario;
		trackEvent('welcome_scenario_select', { scenario: scenario.id });
	};

	const handleTabKeydown = (event: KeyboardEvent): void => {
		const keyDirection = {
			ArrowRight: 1,
			ArrowDown: 1,
			ArrowLeft: -1,
			ArrowUp: -1
		} as const;
		const direction = keyDirection[event.key as keyof typeof keyDirection];
		if (!direction && event.key !== 'Home' && event.key !== 'End') return;

		const current = event.currentTarget;
		if (!(current instanceof HTMLButtonElement)) return;
		const tablist = current.closest('[role="tablist"]');
		const tabs = Array.from(tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
		if (!tabs.length) return;

		event.preventDefault();
		const currentIndex = tabs.indexOf(current);
		const nextIndex =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? tabs.length - 1
					: (currentIndex + direction + tabs.length) % tabs.length;
		tabs[nextIndex]?.focus();
		tabs[nextIndex]?.click();
	};

	const startCta = (event: MouseEvent, source: string): void => {
		event.preventDefault();
		trackEvent(`${source}_click`);
		openCta(source);
	};

	const startPreset = (source: string, preset: string, fallbackPrompt: string): void => {
		trackEvent(`${source}_click`, { preset });
		openPreset(source, preset, resolvePrompt(preset, fallbackPrompt));
	};

	const formatNumber = (value: number): string => new Intl.NumberFormat('ru-RU').format(value);

	const buildQuotaItems = (config: PublicLeadMagnetConfig | null): QuotaItem[] => {
		if (!config?.enabled) return [];

		return [
			{ label: 'токенов на запросы', value: config.quotas.tokens_input },
			{ label: 'токенов на ответы', value: config.quotas.tokens_output },
			{ label: 'изображений', value: config.quotas.images },
			{ label: 'секунд озвучки', value: config.quotas.tts_seconds },
			{ label: 'секунд распознавания', value: config.quotas.stt_seconds }
		].filter((item) => item.value > 0);
	};

	$: quotaItems = buildQuotaItems(leadMagnetConfig);
</script>

<main class="welcome-product">
	<section class="hero" aria-labelledby="welcome-title">
		<div class="shell hero__inner">
			<div class="hero__copy">
				<h1 id="welcome-title">Все задачи с AI —<br class="desktop-break" /> в одном чате</h1>
				<p>
					Пишите и улучшайте тексты, анализируйте документы, создавайте изображения и работайте с
					кодом в одном месте.
				</p>
				<a
					href={heroHref}
					class="button button--primary"
					on:click={(event) => startCta(event, 'welcome_hero_primary')}
				>
					Начать бесплатно
				</a>
				<div class="hero__facts" aria-label="Условия использования">
					<span>Без VPN</span><span>Карты РФ</span><span>Без обязательной подписки</span>
				</div>
			</div>

			<div class="demo" aria-label="Пример работы Airis">
				<div class="demo__topline">
					<span>Попробуйте пример</span>
					<div class="demo__brand"><span class="demo__mark">AI</span> Airis</div>
				</div>
				<div class="tablist tablist--dark" role="tablist" aria-label="Тип задачи">
					{#each demoModes as mode}
						<button
							type="button"
							role="tab"
							id={`demo-tab-${mode.id}`}
							aria-controls="demo-panel"
							aria-selected={activeDemo.id === mode.id}
							tabindex={activeDemo.id === mode.id ? 0 : -1}
							class:active={activeDemo.id === mode.id}
							on:click={() => selectDemo(mode)}
							on:keydown={handleTabKeydown}
						>
							{mode.label}
						</button>
					{/each}
				</div>
				<div
					class="demo__conversation"
					role="tabpanel"
					id="demo-panel"
					aria-labelledby={`demo-tab-${activeDemo.id}`}
				>
					<div class="demo__prompt">{activeDemo.prompt}</div>
					<div class="demo__answer">
						<div class="demo__answer-label">Ответ Airis</div>
						<p>{activeDemo.result}</p>
						<span>{activeDemo.resultNote}</span>
					</div>
					<button
						type="button"
						class="demo__composer"
						on:click={() =>
							startPreset('welcome_demo_preset', activeDemo.preset, activeDemo.prompt)}
					>
						<span>Попробовать этот запрос</span>
						<ArrowUpCircle className="h-8 w-8" strokeWidth="1.7" />
					</button>
				</div>
			</div>
		</div>
	</section>

	<section class="breadth" aria-labelledby="breadth-title">
		<div class="shell breadth__inner">
			<h2 id="breadth-title">Что можно сделать</h2>
			<div class="breadth__links">
				{#each breadthLinks as item}
					<button
						type="button"
						on:click={() => startPreset('welcome_breadth_preset', item.preset, item.prompt)}
					>
						{item.label}<ChevronRight className="h-4 w-4" />
					</button>
				{/each}
			</div>
		</div>
	</section>

	<section id="usecases" class="section scenarios" aria-labelledby="scenarios-title">
		<div class="shell">
			<div class="section-heading">
				<p>Знакомый старт</p>
				<h2 id="scenarios-title">Сценарии для жизни и работы</h2>
				<span>Выберите задачу — Airis уже знает, с чего начать.</span>
			</div>

			<div class="tablist tablist--light" role="tablist" aria-label="Сценарии по сфере">
				{#each scenarioGroups as group}
					<button
						type="button"
						role="tab"
						id={`scenario-group-tab-${group.id}`}
						aria-controls="scenario-group-panel"
						aria-selected={activeScenarioGroup.id === group.id}
						tabindex={activeScenarioGroup.id === group.id ? 0 : -1}
						class:active={activeScenarioGroup.id === group.id}
						on:click={() => selectScenarioGroup(group)}
						on:keydown={handleTabKeydown}
					>
						{group.label}
					</button>
				{/each}
			</div>

			<div
				class="scenario-explorer"
				role="tabpanel"
				id="scenario-group-panel"
				aria-labelledby={`scenario-group-tab-${activeScenarioGroup.id}`}
			>
				<div
					class="scenario-list"
					role="tablist"
					aria-label={`Задачи: ${activeScenarioGroup.label}`}
				>
					{#each activeScenarioGroup.tasks as scenario}
						<button
							type="button"
							role="tab"
							id={`scenario-tab-${scenario.id}`}
							aria-controls="scenario-panel"
							aria-selected={activeScenario.id === scenario.id}
							tabindex={activeScenario.id === scenario.id ? 0 : -1}
							class:active={activeScenario.id === scenario.id}
							on:click={() => selectScenario(scenario)}
							on:keydown={handleTabKeydown}
						>
							<span><strong>{scenario.label}</strong><small>{scenario.description}</small></span>
							<ChevronRight className="h-5 w-5" />
						</button>
					{/each}
				</div>

				<div
					class="scenario-preview"
					role="tabpanel"
					id="scenario-panel"
					aria-labelledby={`scenario-tab-${activeScenario.id}`}
				>
					<div class="scenario-preview__label">Ваш запрос</div>
					<p class="scenario-preview__prompt">{activeScenario.prompt}</p>
					<div class="scenario-preview__label">Ответ Airis</div>
					<p>{activeScenario.result}</p>
					<button
						type="button"
						class="text-link"
						on:click={() =>
							startPreset('welcome_scenario_preset', activeScenario.preset, activeScenario.prompt)}
					>
						Попробовать задачу <ArrowRight className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	</section>

	<section class="section steps" aria-labelledby="steps-title">
		<div class="shell">
			<div class="section-heading section-heading--compact">
				<h2 id="steps-title">Три шага до результата</h2>
			</div>
			<ol class="steps__list">
				<li>
					<span>1</span>
					<div>
						<strong>Выберите задачу</strong>
						<p>Из списка сценариев или начните с нуля.</p>
					</div>
				</li>
				<li>
					<span>2</span>
					<div>
						<strong>Добавьте контекст</strong>
						<p>Опишите цель, вставьте текст или загрузите файл.</p>
					</div>
				</li>
				<li>
					<span>3</span>
					<div>
						<strong>Получите готовый результат</strong>
						<p>Проверьте, доработайте и используйте.</p>
					</div>
				</li>
			</ol>
		</div>
	</section>

	<section class="trust" aria-label="Почему Airis удобно использовать">
		<div class="shell trust__grid">
			<div>
				<Sparkles className="h-7 w-7" /><strong>Лучшие модели<br />в одном чате</strong>
				<p>Выбирайте подходящую модель без смены сервиса.</p>
			</div>
			<div>
				<GlobeAlt className="h-7 w-7" /><strong>Работает<br />без VPN</strong>
				<p>Доступен напрямую из России.</p>
			</div>
			<div>
				<CreditCard className="h-7 w-7" /><strong>Оплата<br />российской картой</strong>
				<p>Пополняйте баланс привычным способом.</p>
			</div>
			<div>
				<Folder className="h-7 w-7" /><strong>История и файлы<br />в одном месте</strong>
				<p>Возвращайтесь к задачам без лишних переключений.</p>
			</div>
		</div>
	</section>

	<section id="pricing" class="section pricing" aria-labelledby="pricing-title">
		<div class="shell">
			<div class="section-heading">
				<p>Без лишних обязательств</p>
				<h2 id="pricing-title">Понятная оплата без подписки</h2>
			</div>

			<div class="pricing__grid">
				<div class="pricing__primary">
					<div class="pricing__icon"><CreditCard className="h-6 w-6" /></div>
					<div>
						<h3>Пополняйте баланс и платите только за то, чем пользуетесь</h3>
						<p>
							Нет автопродления и регулярных списаний с карты. Расходы видны в личном кабинете, а
							ставки зависят от модели и типа задачи.
						</p>
						<a href="/pricing" class="button button--outline">Посмотреть цены</a>
					</div>
				</div>

				<div class="pricing__free">
					<div class="pricing__eyebrow">Бесплатно на старте</div>
					<h3>{quotaItems.length ? 'Лимиты уже включены' : 'Попробуйте ключевые возможности'}</h3>
					<ul>
						<li><Check className="h-4 w-4" /> Без привязки карты</li>
						<li><Check className="h-4 w-4" /> Без обязательной подписки</li>
						<li><Check className="h-4 w-4" /> Доступ после регистрации</li>
					</ul>
					{#if quotaItems.length}
						<details class="quota-details">
							<summary>Что входит бесплатно</summary>
							<ul>
								{#each quotaItems as item}
									<li><span>{item.label}</span><strong>{formatNumber(item.value)}</strong></li>
								{/each}
							</ul>
							<p>Лимиты обновляются каждые {leadMagnetConfig?.cycle_days ?? 30} дней.</p>
						</details>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<section id="faq" class="section faq" aria-labelledby="faq-title">
		<div class="shell faq__shell">
			<div class="section-heading section-heading--compact">
				<h2 id="faq-title">Частые вопросы</h2>
			</div>
			<div class="faq__list">
				{#each faqItems as item, index}
					<details id={item.id === 'cost' ? 'faq-cost' : undefined} open={index === 0}>
						<summary>{item.question}</summary>
						<p>{item.answer}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<section class="final-cta" aria-labelledby="final-cta-title">
		<div class="shell">
			<div class="final-cta__panel">
				<h2 id="final-cta-title">Начните с реальной задачи</h2>
				<p>Откройте Airis бесплатно и получите первый результат за несколько минут.</p>
				<a
					href={finalHref}
					class="button button--primary"
					on:click={(event) => startCta(event, 'welcome_final_cta')}
				>
					Открыть Airis бесплатно
				</a>
				<span>Без карты · Без обязательств · Можно прекратить в любой момент</span>
			</div>
		</div>
	</section>

	<footer class="footer">
		<div class="shell"><FooterLinks tone="dark" copyright="2026 Airis. Все права защищены." /></div>
	</footer>
</main>

<style>
	.welcome-product {
		--airis-ink: #171330;
		--airis-violet: #1e1647;
		--airis-raised: #2c2359;
		--airis-accent: #7132f2;
		--airis-lavender: #ad93fc;
		--airis-soft: #f7f5ff;
		--airis-border: #e7e2f5;
		background: #ffffff;
		color: var(--airis-ink);
		font-family: 'Noto Sans', sans-serif;
		overflow: clip;
	}

	.shell {
		width: min(1180px, calc(100% - 40px));
		margin-inline: auto;
	}

	.hero {
		background: var(--airis-violet);
		color: #ffffff;
		padding: 66px 0 28px;
	}

	.hero__inner {
		display: grid;
		gap: 48px;
	}

	.hero__copy {
		max-width: 800px;
		margin-inline: auto;
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: clamp(40px, 5vw, 68px);
		font-weight: 760;
		letter-spacing: -0.045em;
		line-height: 1.04;
	}

	.hero__copy > p {
		max-width: 650px;
		margin: 22px auto 28px;
		color: #ded8f6;
		font-size: 17px;
		line-height: 1.65;
	}

	.button {
		display: inline-flex;
		min-height: 48px;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		padding: 0 24px;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		transition:
			background-color 160ms ease,
			border-color 160ms ease,
			transform 160ms ease;
	}

	.button--primary {
		background: var(--airis-accent);
		color: #ffffff;
		box-shadow: 0 12px 28px rgba(113, 50, 242, 0.26);
	}

	.button--outline {
		border: 1px solid #d6cff0;
		color: var(--airis-accent);
		background: #ffffff;
	}

	@media (hover: hover) {
		.button:hover {
			transform: translateY(-1px);
		}
		.button--primary:hover {
			background: #6427e8;
		}
		.button--outline:hover {
			border-color: var(--airis-accent);
			background: var(--airis-soft);
		}
	}

	.button:focus-visible,
	button:focus-visible,
	summary:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--airis-lavender);
		outline-offset: 3px;
	}

	.hero__facts {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 18px;
		margin-top: 18px;
		color: #cfc7ef;
		font-size: 13px;
	}

	.hero__facts span + span::before {
		content: '·';
		margin-right: 18px;
		color: #766da0;
	}

	.demo {
		max-width: 1080px;
		margin-inline: auto;
		border: 1px solid rgba(173, 147, 252, 0.3);
		border-radius: 24px;
		background: #151226;
		box-shadow: 0 30px 70px rgba(8, 5, 24, 0.35);
		overflow: hidden;
	}

	.demo__topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 24px 8px;
		color: #d8d1f1;
		font-size: 13px;
		font-weight: 650;
	}

	.demo__brand {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #ffffff;
	}
	.demo__mark {
		display: inline-grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border-radius: 50%;
		background: #ffffff;
		color: var(--airis-violet);
		font-size: 10px;
		font-weight: 800;
	}

	.tablist {
		display: flex;
		gap: 8px;
	}

	.tablist button {
		min-height: 44px;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 14px;
		font-weight: 650;
		cursor: pointer;
	}

	.tablist--dark {
		padding: 0 24px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.tablist--dark button {
		padding: 0 18px;
		color: #aaa3c8;
		border-bottom: 2px solid transparent;
	}
	.tablist--dark button.active {
		color: #ffffff;
		border-color: var(--airis-accent);
	}

	.demo__conversation {
		max-width: 720px;
		margin-inline: auto;
		padding: 34px 24px 28px;
	}

	.demo__prompt {
		width: fit-content;
		max-width: 82%;
		margin-left: auto;
		border-radius: 16px 16px 4px 16px;
		background: var(--airis-raised);
		padding: 14px 16px;
		font-size: 14px;
		line-height: 1.5;
	}

	.demo__answer {
		margin-top: 18px;
		border-radius: 18px;
		background: #211d34;
		padding: 18px;
		color: #f6f3ff;
	}

	.demo__answer-label,
	.scenario-preview__label {
		margin-bottom: 7px;
		color: var(--airis-lavender);
		font-size: 11px;
		font-weight: 750;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.demo__answer p {
		margin: 0;
		font-size: 15px;
		line-height: 1.6;
	}
	.demo__answer span {
		display: block;
		margin-top: 12px;
		color: #aaa3c8;
		font-size: 12px;
	}

	.demo__composer {
		display: flex;
		width: 100%;
		min-height: 54px;
		align-items: center;
		justify-content: space-between;
		margin-top: 22px;
		border: 1px solid rgba(173, 147, 252, 0.28);
		border-radius: 15px;
		background: #181427;
		padding: 7px 9px 7px 17px;
		color: #bcb5d7;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.demo__composer :global(svg) {
		color: var(--airis-lavender);
	}

	.breadth {
		border-bottom: 1px solid var(--airis-border);
		background: #ffffff;
	}
	.breadth__inner {
		padding-block: 28px;
	}
	.breadth__inner > h2 {
		display: block;
		margin-bottom: 18px;
		margin-top: 0;
		font-size: 17px;
	}

	.scenarios,
	.pricing {
		scroll-margin-top: 80px;
	}
	.breadth__links {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 10px 18px;
	}
	.breadth__links button {
		display: flex;
		min-height: 40px;
		align-items: center;
		justify-content: space-between;
		border: 0;
		background: transparent;
		padding: 0;
		color: var(--airis-accent);
		font: inherit;
		font-size: 14px;
		font-weight: 650;
		cursor: pointer;
	}

	.section {
		padding-block: 88px;
	}
	.section-heading {
		max-width: 680px;
		margin-bottom: 34px;
	}
	.section-heading--compact {
		margin-bottom: 30px;
	}
	.section-heading > p {
		margin: 0 0 8px;
		color: var(--airis-accent);
		font-size: 12px;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.section-heading h2 {
		margin: 0;
		font-size: clamp(30px, 3vw, 44px);
		font-weight: 750;
		letter-spacing: -0.035em;
		line-height: 1.12;
	}
	.section-heading > span {
		display: block;
		margin-top: 12px;
		color: #69647b;
		font-size: 16px;
		line-height: 1.6;
	}

	.scenarios {
		background: #ffffff;
	}
	.tablist--light {
		gap: 2px;
		margin-bottom: 22px;
		border-bottom: 1px solid var(--airis-border);
	}
	.tablist--light button {
		padding: 0 18px;
		color: #6a6578;
		border-bottom: 2px solid transparent;
	}
	.tablist--light button.active {
		color: var(--airis-accent);
		border-color: var(--airis-accent);
	}

	.scenario-explorer {
		display: grid;
		grid-template-columns: 0.82fr 1.18fr;
		border: 1px solid var(--airis-border);
		border-radius: 20px;
		overflow: hidden;
	}
	.scenario-list {
		display: grid;
		align-content: start;
		border-right: 1px solid var(--airis-border);
		background: #ffffff;
	}
	.scenario-list button {
		display: flex;
		min-height: 86px;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border: 0;
		border-bottom: 1px solid var(--airis-border);
		background: #ffffff;
		padding: 17px 20px;
		color: var(--airis-ink);
		text-align: left;
		font: inherit;
		cursor: pointer;
	}
	.scenario-list button:last-child {
		border-bottom: 0;
	}
	.scenario-list button.active {
		background: var(--airis-soft);
		color: var(--airis-accent);
	}
	.scenario-list button span {
		min-width: 0;
	}
	.scenario-list strong {
		display: block;
		font-size: 15px;
	}
	.scenario-list small {
		display: block;
		margin-top: 5px;
		color: #777184;
		font-size: 12px;
		line-height: 1.4;
	}
	.scenario-preview {
		display: flex;
		min-height: 258px;
		flex-direction: column;
		justify-content: center;
		background: #faf9fe;
		padding: 34px 40px;
	}
	.scenario-preview__prompt {
		margin: 0 0 28px;
		border-radius: 12px;
		background: #eeeaff;
		padding: 13px 15px;
		font-weight: 650;
	}
	.scenario-preview > p {
		color: #4f4a60;
		font-size: 14px;
		line-height: 1.65;
	}
	.text-link {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		gap: 7px;
		align-self: flex-start;
		margin-top: 10px;
		border: 0;
		background: transparent;
		padding: 0;
		color: var(--airis-accent);
		font: inherit;
		font-size: 14px;
		font-weight: 750;
		cursor: pointer;
	}

	.steps {
		padding-top: 18px;
	}
	.steps__list {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.steps__list li {
		position: relative;
		display: grid;
		grid-template-columns: 46px 1fr;
		gap: 14px;
		padding-right: 32px;
	}
	.steps__list li:not(:last-child)::after {
		content: '';
		position: absolute;
		top: 22px;
		left: 46px;
		right: 12px;
		height: 1px;
		background: #cfc4f3;
	}
	.steps__list li > span {
		position: relative;
		z-index: 1;
		display: grid;
		width: 44px;
		height: 44px;
		place-items: center;
		border-radius: 50%;
		background: var(--airis-accent);
		color: #ffffff;
		font-size: 15px;
		font-weight: 750;
	}
	.steps__list li > div {
		padding-top: 54px;
		margin-left: -60px;
	}
	.steps__list strong {
		font-size: 15px;
	}
	.steps__list p {
		max-width: 260px;
		margin: 8px 0 0;
		color: #716c7f;
		font-size: 13px;
		line-height: 1.55;
	}

	.trust {
		border-block: 1px solid var(--airis-border);
		background: var(--airis-soft);
		padding-block: 44px;
	}
	.trust__grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 28px;
	}
	.trust__grid > div {
		display: grid;
		grid-template-columns: 34px 1fr;
		column-gap: 12px;
		align-items: start;
	}
	.trust__grid :global(svg) {
		color: var(--airis-accent);
	}
	.trust__grid strong {
		font-size: 14px;
		line-height: 1.35;
	}
	.trust__grid p {
		grid-column: 2;
		margin: 7px 0 0;
		color: #716b80;
		font-size: 12px;
		line-height: 1.5;
	}

	.pricing {
		background: #ffffff;
	}
	.pricing__grid {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 56px;
	}
	.pricing__primary {
		display: grid;
		grid-template-columns: 48px 1fr;
		gap: 18px;
	}
	.pricing__icon {
		display: grid;
		width: 46px;
		height: 46px;
		place-items: center;
		border-radius: 12px;
		background: #eee9ff;
		color: var(--airis-accent);
	}
	.pricing h3 {
		margin: 0;
		font-size: 22px;
		line-height: 1.35;
		letter-spacing: -0.02em;
	}
	.pricing__primary p {
		margin: 14px 0 22px;
		color: #6c6679;
		font-size: 14px;
		line-height: 1.7;
	}
	.pricing__free {
		border-left: 1px solid var(--airis-border);
		padding-left: 56px;
	}
	.pricing__eyebrow {
		margin-bottom: 8px;
		color: var(--airis-accent);
		font-size: 12px;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.pricing__free ul {
		display: grid;
		gap: 9px;
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
	}
	.pricing__free > ul li {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #5f596d;
		font-size: 13px;
	}
	.pricing__free > ul :global(svg) {
		color: var(--airis-accent);
	}
	.quota-details {
		margin-top: 22px;
		border-top: 1px solid var(--airis-border);
		padding-top: 16px;
	}
	.quota-details summary {
		min-height: 44px;
		color: var(--airis-accent);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.quota-details ul {
		margin: 8px 0;
	}
	.quota-details li {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		color: #656071;
		font-size: 12px;
	}
	.quota-details p {
		margin: 10px 0 0;
		color: #817b8c;
		font-size: 11px;
	}

	.faq {
		padding-top: 30px;
		background: #ffffff;
	}
	.faq__shell {
		max-width: 920px;
	}
	.faq__list {
		border-top: 1px solid var(--airis-border);
	}
	.faq details {
		border-bottom: 1px solid var(--airis-border);
	}
	.faq summary {
		position: relative;
		display: flex;
		min-height: 62px;
		align-items: center;
		justify-content: space-between;
		padding-right: 36px;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		list-style: none;
	}
	.faq summary::-webkit-details-marker {
		display: none;
	}
	.faq summary::after {
		content: '+';
		position: absolute;
		right: 6px;
		color: var(--airis-accent);
		font-size: 22px;
		font-weight: 400;
	}
	.faq details[open] summary::after {
		content: '−';
	}
	.faq details p {
		max-width: 760px;
		margin: -3px 0 20px;
		color: #686273;
		font-size: 14px;
		line-height: 1.65;
	}

	.final-cta {
		background: #ffffff;
		padding: 40px 0 0;
	}
	.final-cta__panel {
		border-radius: 22px 22px 0 0;
		background: var(--airis-violet);
		padding: 58px 24px 50px;
		color: #ffffff;
		text-align: center;
	}
	.final-cta h2 {
		margin: 0;
		font-size: clamp(30px, 3vw, 42px);
		font-weight: 750;
		letter-spacing: -0.035em;
	}
	.final-cta p {
		margin: 13px auto 24px;
		color: #d8d1ef;
		font-size: 15px;
	}
	.final-cta__panel > span {
		display: block;
		margin-top: 16px;
		color: #9e96be;
		font-size: 11px;
	}
	.footer {
		background: var(--airis-violet);
		color: #ffffff;
		padding-bottom: 34px;
	}

	@media (max-width: 900px) {
		.breadth__links {
			grid-template-columns: repeat(3, 1fr);
		}
		.trust__grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.pricing__grid {
			gap: 36px;
		}
		.pricing__free {
			padding-left: 36px;
		}
	}

	@media (max-width: 700px) {
		.shell {
			width: min(100% - 32px, 1180px);
		}
		.hero {
			padding: 42px 0 18px;
		}
		h1 {
			font-size: clamp(36px, 11vw, 46px);
		}
		.desktop-break {
			display: none;
		}
		.hero__copy > p {
			margin-top: 18px;
			font-size: 15px;
			line-height: 1.55;
		}
		.hero__copy .button {
			width: 100%;
		}
		.hero__facts {
			gap: 6px 10px;
			font-size: 11px;
		}
		.hero__facts span + span::before {
			margin-right: 10px;
		}
		.hero__inner {
			gap: 32px;
		}
		.demo {
			border-radius: 18px;
		}
		.demo__topline {
			padding: 14px 16px 6px;
		}
		.tablist--dark {
			padding: 0 8px;
			overflow-x: auto;
			scrollbar-width: none;
		}
		.tablist--dark::-webkit-scrollbar {
			display: none;
		}
		.tablist--dark button {
			flex: 1 0 auto;
			padding-inline: 14px;
		}
		.demo__conversation {
			padding: 24px 16px 18px;
		}
		.demo__prompt {
			max-width: 94%;
		}
		.demo__answer {
			padding: 16px;
		}
		.demo__composer {
			min-height: 52px;
		}
		.breadth__inner {
			padding-block: 24px;
		}
		.breadth__links {
			grid-template-columns: repeat(2, 1fr);
			column-gap: 24px;
		}
		.section {
			padding-block: 64px;
		}
		.section-heading {
			margin-bottom: 26px;
		}
		.section-heading h2 {
			font-size: 32px;
		}
		.section-heading > span {
			font-size: 14px;
		}
		.tablist--light {
			overflow-x: auto;
			scrollbar-width: none;
		}
		.tablist--light button {
			flex: 1 0 auto;
		}
		.scenario-explorer {
			display: block;
			border-radius: 16px;
		}
		.scenario-list {
			border-right: 0;
		}
		.scenario-list button {
			min-height: 76px;
			padding: 14px 16px;
		}
		.scenario-preview {
			min-height: 0;
			border-top: 1px solid var(--airis-border);
			padding: 24px 18px;
		}
		.scenario-preview__prompt {
			margin-bottom: 22px;
		}
		.steps {
			padding-top: 4px;
		}
		.steps__list {
			display: grid;
			grid-template-columns: 1fr;
			gap: 22px;
		}
		.steps__list li {
			min-height: 70px;
			grid-template-columns: 40px 1fr;
			gap: 14px;
			padding: 0;
		}
		.steps__list li:not(:last-child)::after {
			top: 40px;
			bottom: -24px;
			left: 19px;
			width: 1px;
			height: auto;
		}
		.steps__list li > span {
			width: 40px;
			height: 40px;
		}
		.steps__list li > div {
			margin: 0;
			padding: 1px 0 0;
		}
		.steps__list p {
			margin-top: 5px;
		}
		.trust {
			padding-block: 34px;
		}
		.trust__grid {
			gap: 28px 20px;
		}
		.trust__grid > div {
			grid-template-columns: 30px 1fr;
			column-gap: 10px;
		}
		.pricing__grid {
			grid-template-columns: 1fr;
			gap: 32px;
		}
		.pricing__primary {
			grid-template-columns: 42px 1fr;
			gap: 14px;
		}
		.pricing__icon {
			width: 42px;
			height: 42px;
		}
		.pricing h3 {
			font-size: 19px;
		}
		.pricing__free {
			border-top: 1px solid var(--airis-border);
			border-left: 0;
			padding: 28px 0 0;
		}
		.faq {
			padding-top: 14px;
		}
		.faq summary {
			min-height: 60px;
			font-size: 14px;
		}
		.final-cta {
			padding-top: 24px;
		}
		.final-cta__panel {
			border-radius: 18px 18px 0 0;
			padding: 44px 20px 38px;
		}
		.final-cta__panel .button {
			width: 100%;
			max-width: 320px;
		}
	}

	@media (max-width: 420px) {
		.shell {
			width: min(100% - 24px, 1180px);
		}
		h1 {
			font-size: 36px;
		}
		.hero__facts {
			gap: 6px;
		}
		.hero__facts span + span::before {
			margin-right: 6px;
		}
		.demo__topline > span {
			font-size: 12px;
		}
		.breadth__links {
			grid-template-columns: 1fr 1fr;
		}
		.trust__grid {
			grid-template-columns: 1fr;
		}
		.trust__grid strong br {
			display: none;
		}
		.pricing__primary {
			grid-template-columns: 1fr;
		}
		.final-cta h2 {
			font-size: 30px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.button {
			transition: none;
		}
		:global(html:focus-within) {
			scroll-behavior: auto;
		}
	}
</style>
