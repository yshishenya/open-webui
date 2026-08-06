<script lang="ts">
	import type { PublicLeadMagnetConfig, PublicRateCardResponse } from '$lib/apis/billing';
	import { presetsById } from '$lib/data/features';
	import ArrowRight from '$lib/components/icons/ArrowRight.svelte';
	import ArrowUpCircle from '$lib/components/icons/ArrowUpCircle.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import CreditCard from '$lib/components/icons/CreditCard.svelte';
	import GlobeAlt from '$lib/components/icons/GlobeAlt.svelte';
	import Sparkles from '$lib/components/icons/Sparkles.svelte';
	import { trackEvent } from '$lib/utils/analytics';
	import FooterLinks from './FooterLinks.svelte';
	import { buildSignupUrl, openCta, openPreset } from './welcomeNavigation';

	export let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	export let rateCard: PublicRateCardResponse | null = null;

	type DemoMode = {
		id: 'text' | 'document' | 'compare';
		label: string;
		prompt: string;
		result: string;
		resultNote: string;
		preset: string;
	};

	type Scenario = {
		id: 'study' | 'work' | 'creative';
		label: string;
		title: string;
		description: string;
		prompt: string;
		result: string;
		preset: string;
	};

	const demoModes: DemoMode[] = [
		{
			id: 'text',
			label: 'Письмо',
			prompt: 'Сделай письмо короче и дружелюбнее',
			result: 'Вот более короткий и дружелюбный вариант. Смысл сохранён, формулировки стали проще.',
			resultNote: 'Пример ответа — его можно уточнить в диалоге',
			preset: 'email_reply'
		},
		{
			id: 'document',
			label: 'Документ',
			prompt: 'Сделай краткую сводку документа и выдели решения',
			result: 'Короткая сводка: ключевые тезисы, решения и следующие шаги из документа.',
			resultNote: 'Работа с файлами зависит от выбранной модели',
			preset: 'summarize_notes'
		},
		{
			id: 'compare',
			label: 'Сравнение',
			prompt: 'Предложи три названия для нового образовательного проекта',
			result: 'Выберите несколько доступных моделей в одном чате и сравните их варианты.',
			resultNote: 'Состав доступных моделей может меняться',
			preset: 'creative_ideas'
		}
	];

	const scenarios: Scenario[] = [
		{
			id: 'study',
			label: 'Учёба',
			title: 'Разобраться в сложной теме',
			description: 'Попросите объяснить материал простыми словами и привести пример.',
			prompt: 'Объясни квантовые вычисления простыми словами для студента первого курса.',
			result:
				'Квантовые вычисления используют кубиты. В отличие от обычных битов, они позволяют иначе представить задачу и для некоторых вычислений быстрее найти решение.',
			preset: 'study_explain'
		},
		{
			id: 'work',
			label: 'Работа',
			title: 'Подготовить деловой текст',
			description: 'Составьте письмо, сводку или план и уточните тон прямо в диалоге.',
			prompt: 'Составь короткий ответ клиенту: подтвердить сроки и предложить созвон.',
			result:
				'Здравствуйте! Подтверждаем согласованные сроки. Предлагаю коротко созвониться и сверить следующий шаг — подскажите, когда вам удобно.',
			preset: 'email_reply'
		},
		{
			id: 'creative',
			label: 'Творчество',
			title: 'Развить идею',
			description: 'Получите несколько направлений и доработайте понравившееся.',
			prompt: 'Предложи три идеи короткого видео о привычках, которые помогают сосредоточиться.',
			result:
				'Три направления: эксперимент на один день, разбор рабочей рутины и короткая история «до и после». Для каждого можно уточнить сценарий и тон.',
			preset: 'creative_ideas'
		}
	];

	const faqItems = [
		{
			id: 'vpn',
			question: 'Нужен ли VPN?',
			answer: 'Нет. Airis доступен напрямую из России без VPN.'
		},
		{
			id: 'models',
			question: 'Какие модели доступны?',
			answer:
				'Актуальный список показывается в Airis и обновляется вместе с продуктом. Можно выбрать одну модель или несколько для сравнения.'
		},
		{
			id: 'free',
			question: 'Что доступно бесплатно?',
			answer:
				'После регистрации доступны бесплатные лимиты на выбранных моделях. Карта для старта не нужна. Точный объём зависит от текущих настроек Airis.'
		},
		{
			id: 'subscription',
			question: 'Нужна ли подписка?',
			answer:
				'Обязательной подписки и фиксированного ежемесячного платежа нет. Пополняйте баланс по мере необходимости.'
		},
		{
			id: 'cost',
			question: 'Как считается стоимость?',
			answer:
				'Списание зависит от выбранной модели и объёма использования. Актуальные ставки доступны на странице тарифов, расходы — в личном кабинете.'
		},
		{
			id: 'data',
			question: 'Как Airis работает с моими данными?',
			answer:
				'Запросы передаются выбранному AI-провайдеру для подготовки ответа. Подробные условия обработки и хранения данных описаны в политике конфиденциальности.'
		}
	];

	let activeDemo = demoModes[0];
	let activeScenario = scenarios[0];

	const heroHref = buildSignupUrl('welcome_hero_primary');
	const finalHref = buildSignupUrl('welcome_final_cta');

	const resolvePrompt = (preset: string, fallback: string): string =>
		presetsById[preset]?.prompt ?? fallback;

	const selectDemo = (mode: DemoMode): void => {
		activeDemo = mode;
		trackEvent('welcome_demo_tab_select', { mode: mode.id });
	};

	const selectScenario = (scenario: Scenario): void => {
		activeScenario = scenario;
		trackEvent('welcome_scenario_group_select', { group: scenario.id });
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

	const reveal = (node: HTMLElement): { destroy: () => void } => {
		if (
			!('IntersectionObserver' in window) ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return { destroy: () => undefined };
		}

		node.dataset.reveal = 'pending';
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return;
				node.dataset.reveal = 'visible';
				observer.disconnect();
			},
			{ rootMargin: '0px 0px -8%', threshold: 0.12 }
		);
		observer.observe(node);

		return { destroy: () => observer.disconnect() };
	};

	const formatNumber = (value: number): string => new Intl.NumberFormat('ru-RU').format(value);
	const formatModelCount = (value: number): string => {
		const remainder100 = value % 100;
		const remainder10 = value % 10;
		const noun =
			remainder100 >= 11 && remainder100 <= 14
				? 'моделей'
				: remainder10 === 1
					? 'модель'
					: remainder10 >= 2 && remainder10 <= 4
						? 'модели'
						: 'моделей';
		return `Сейчас ${noun === 'модель' ? 'доступна' : 'доступно'} ${formatNumber(value)} ${noun}. Состав может меняться.`;
	};

	$: freeStartEnabled = leadMagnetConfig?.enabled !== false;
	$: primaryCtaLabel = freeStartEnabled ? 'Начать бесплатно' : 'Открыть Airis';
	$: availableModelNames = Array.from(
		new Set(rateCard?.models.map((model) => model.display_name).filter(Boolean) ?? [])
	);
	$: availableModelCount = availableModelNames.length;
</script>

<main class="welcome-product">
	<section class="hero section-screen" aria-labelledby="welcome-title">
		<div class="shell hero__inner">
			<div class="hero__copy">
				<p class="eyebrow">Работает в России без VPN</p>
				<h1 id="welcome-title">AI-модели <span>без VPN — в одном чате</span></h1>
				<p class="hero__lead">
					GPT, Claude, Gemini и другие доступные модели — без отдельных сервисов и сложных настроек.
					Выбирайте модель и решайте задачи с текстом и файлами в одном месте.
				</p>
				<div class="hero__actions">
					<a
						href={heroHref}
						class="button button--primary"
						on:click={(event) => startCta(event, 'welcome_hero_primary')}
					>
						{primaryCtaLabel}
					</a>
					<a href="#models" class="button button--quiet">Посмотреть, как работает</a>
				</div>
				<div class="hero__facts" aria-label="Условия старта">
					{#if freeStartEnabled}<span>Без карты на старте</span>{/if}
					<span>Оплата в ₽</span>
					<span>Без обязательной подписки</span>
				</div>
			</div>

			<div class="demo" aria-label="Интерактивный пример Airis">
				<div class="demo__topline">
					<span>Попробуйте пример</span>
					<div class="demo__brand">
						<img src="/static/favicon.svg" alt="" />
						Airis
					</div>
				</div>
				<div class="tablist tablist--demo" role="tablist" aria-label="Пример задачи">
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
				{#key activeDemo.id}
					<div
						class="demo__conversation demo__conversation--enter"
						role="tabpanel"
						id="demo-panel"
						aria-labelledby={`demo-tab-${activeDemo.id}`}
						aria-live="polite"
					>
						<div class="demo__prompt">{activeDemo.prompt}</div>
						<div class="demo__answer">
							<div class="demo__answer-label">Пример ответа Airis</div>
							<p>{activeDemo.result}</p>
							<span>{activeDemo.resultNote}</span>
						</div>
						<button
							type="button"
							class="demo__composer"
							on:click={() =>
								startPreset('welcome_demo_preset', activeDemo.preset, activeDemo.prompt)}
						>
							<span>Открыть этот пример в Airis</span>
							<ArrowUpCircle className="h-8 w-8" strokeWidth="1.7" />
						</button>
					</div>
				{/key}
			</div>
		</div>
	</section>

	<section
		id="models"
		class="section section-screen model-story"
		aria-labelledby="models-title"
		use:reveal
	>
		<div class="shell split-layout">
			<div class="section-copy">
				<p class="eyebrow">Один интерфейс</p>
				<h2 id="models-title">Меняйте модель, не меняя сервис</h2>
				<p class="section-lead">
					Все доступные в Airis модели собраны в одном чате. Выбирайте одну или несколько —
					отдельные аккаунты и вкладки не нужны.
				</p>
				<ul class="check-list">
					<li><Check className="h-5 w-5" /> Сравнивайте ответы нескольких моделей</li>
					<li><Check className="h-5 w-5" /> Сохраняйте чаты и файлы в одном месте</li>
					<li><Check className="h-5 w-5" /> Видите актуальный каталог прямо в продукте</li>
				</ul>
				{#if availableModelCount}
					<p class="model-count">{formatModelCount(availableModelCount)}</p>
				{/if}
				<a href="/features#models" class="text-link">
					Все возможности <ArrowRight className="h-4 w-4" />
				</a>
			</div>

			<figure class="product-shot">
				<div class="product-shot__frame">
					<img
						src="/landing/airis-product-models.jpg"
						alt="Интерфейс Airis с открытым каталогом доступных моделей"
						width="820"
						height="460"
						loading="lazy"
					/>
				</div>
				<figcaption>Реальный интерфейс Airis · состав моделей может меняться</figcaption>
			</figure>
		</div>
	</section>

	<section
		id="usecases"
		class="section section-screen scenarios"
		aria-labelledby="scenarios-title"
		use:reveal
	>
		<div class="shell">
			<div class="section-heading">
				<p class="eyebrow">Знакомые задачи</p>
				<h2 id="scenarios-title">Начните не с модели, а со своей задачи</h2>
				<p>Выберите знакомый сценарий — пример уже готов, его можно изменить под себя.</p>
			</div>

			<div class="tablist tablist--scenario" role="tablist" aria-label="Сценарии Airis">
				{#each scenarios as scenario}
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
						{scenario.label}
					</button>
				{/each}
			</div>

			{#key activeScenario.id}
				<div
					class="scenario-panel scenario-panel--enter"
					role="tabpanel"
					id="scenario-panel"
					aria-labelledby={`scenario-tab-${activeScenario.id}`}
					aria-live="polite"
				>
					<div class="scenario-panel__intro">
						<p>{activeScenario.label}</p>
						<h3>{activeScenario.title}</h3>
						<span>{activeScenario.description}</span>
						<button
							type="button"
							class="text-link"
							on:click={() =>
								startPreset(
									'welcome_scenario_preset',
									activeScenario.preset,
									activeScenario.prompt
								)}
						>
							Открыть пример в Airis <ArrowRight className="h-4 w-4" />
						</button>
					</div>
					<div class="scenario-panel__conversation">
						<div class="scenario-panel__label">Ваш запрос</div>
						<p class="scenario-panel__prompt">{activeScenario.prompt}</p>
						<div class="scenario-panel__label">Пример ответа</div>
						<p>{activeScenario.result}</p>
						<span>Фактический ответ зависит от модели и вашего запроса.</span>
					</div>
				</div>
			{/key}
		</div>
	</section>

	<section class="section section-screen local" aria-labelledby="local-title" use:reveal>
		<div class="shell local__inner">
			<p class="eyebrow">Главное преимущество</p>
			<h2 id="local-title">Работает напрямую из России</h2>
			<p class="local__lead">
				Открывайте Airis без VPN. Пополняйте баланс в рублях и пользуйтесь без обязательной
				подписки.
			</p>
			<div class="local__facts">
				<div>
					<GlobeAlt className="h-8 w-8" />
					<strong>Без VPN</strong>
					<span>Доступен напрямую из России</span>
				</div>
				<div>
					<CreditCard className="h-8 w-8" />
					<strong>Оплата в ₽</strong>
					<span>Пополняйте баланс по мере необходимости</span>
				</div>
				<div>
					<Sparkles className="h-8 w-8" />
					<strong>Без обязательной подписки</strong>
					<span>Нет фиксированного ежемесячного платежа</span>
				</div>
			</div>
		</div>
	</section>

	<section class="section steps" aria-labelledby="steps-title" use:reveal>
		<div class="shell">
			<div class="section-heading section-heading--left">
				<p class="eyebrow">Как начать</p>
				<h2 id="steps-title">Три шага — как в обычном чате</h2>
			</div>
			<ol class="steps__list">
				<li>
					<span>01</span>
					<div>
						<strong>Выберите модель</strong>
						<p>Или оставьте ту, которая уже выбрана в чате.</p>
					</div>
				</li>
				<li>
					<span>02</span>
					<div>
						<strong>Опишите задачу</strong>
						<p>Напишите своими словами, вставьте текст или добавьте файл.</p>
					</div>
				</li>
				<li>
					<span>03</span>
					<div>
						<strong>Уточните ответ</strong>
						<p>Получите ответ или черновик и попросите доработать его.</p>
					</div>
				</li>
			</ol>
		</div>
	</section>

	<section
		id="pricing"
		class="section section-screen pricing"
		aria-labelledby="pricing-title"
		use:reveal
	>
		<div class="shell pricing__inner">
			<div class="pricing__copy">
				<p class="eyebrow">Понятная оплата</p>
				<h2 id="pricing-title">
					{freeStartEnabled
						? 'Начните бесплатно. Дальше — по использованию'
						: 'Платите только за использование'}
				</h2>
				<p>
					{freeStartEnabled
						? 'После регистрации доступны бесплатные лимиты на выбранных моделях. Карта для старта не нужна.'
						: 'Пополняйте баланс по мере необходимости. Списание зависит от модели и объёма использования.'}
				</p>
				<div class="pricing__actions">
					<a
						href={heroHref}
						class="button button--dark"
						on:click={(event) => startCta(event, 'welcome_pricing_primary')}
					>
						{primaryCtaLabel}
					</a>
					<a href="/pricing" class="button button--light-outline">Посмотреть тарифы</a>
				</div>
			</div>

			<div class="pricing__details">
				<ul>
					<li><Check className="h-5 w-5" /> Нет обязательной подписки</li>
					<li><Check className="h-5 w-5" /> Расходы видны в личном кабинете</li>
					<li><Check className="h-5 w-5" /> Ставки зависят от модели и объёма использования</li>
				</ul>
			</div>
		</div>
	</section>

	<section id="faq" class="section faq" aria-labelledby="faq-title" use:reveal>
		<div class="shell faq__layout">
			<div class="faq__intro">
				<p class="eyebrow">Без мелкого шрифта</p>
				<h2 id="faq-title">Коротко о важном</h2>
				<p>Если ответа нет здесь, напишите в поддержку — ссылка есть внизу страницы.</p>
			</div>
			<div class="faq__list">
				{#each faqItems as item, index}
					<details id={item.id === 'cost' ? 'faq-cost' : undefined} open={index === 0}>
						<summary>{item.question}</summary>
						<p>
							{item.id === 'free' && !freeStartEnabled
								? 'Бесплатный старт сейчас недоступен. Актуальные условия показаны на странице тарифов.'
								: item.answer}
						</p>
						{#if item.id === 'data'}
							<a href="/privacy">Открыть политику конфиденциальности</a>
						{/if}
					</details>
				{/each}
			</div>
		</div>
	</section>

	<section class="final-cta" aria-labelledby="final-cta-title" use:reveal>
		<div class="shell">
			<div class="final-cta__panel">
				<div>
					<p class="eyebrow">Начните со своей задачи</p>
					<h2 id="final-cta-title">Все доступные модели уже в Airis</h2>
					<span>Без VPN · Оплата в ₽ · Без обязательной подписки</span>
				</div>
				<a
					href={finalHref}
					class="button button--primary"
					on:click={(event) => startCta(event, 'welcome_final_cta')}
				>
					{primaryCtaLabel}
				</a>
			</div>
		</div>
	</section>

	<footer class="footer">
		<div class="shell"><FooterLinks tone="dark" copyright="2026 Airis. Все права защищены." /></div>
	</footer>
</main>

<style>
	.welcome-product {
		--airis-ink: #17112f;
		--airis-deep: #1e1647;
		--airis-raised: #292055;
		--airis-panel: #121021;
		--airis-accent: #7132f2;
		--airis-accent-strong: #803cff;
		--airis-lavender: #ad93fc;
		--airis-text: #fbfaff;
		--airis-muted: #c7bfdc;
		--airis-line: rgb(255 255 255 / 0.13);
		background:
			radial-gradient(900px 620px at 7% 8%, rgb(113 50 242 / 0.14), transparent 66%),
			linear-gradient(180deg, #17112f 0%, #21184a 46%, #17112f 100%);
		color: var(--airis-text);
		color-scheme: dark;
		font-family: 'Noto Sans', Arial, sans-serif;
	}

	.welcome-product :global(a),
	.welcome-product button,
	.welcome-product summary {
		touch-action: manipulation;
	}

	.shell {
		width: min(1180px, calc(100% - 48px));
		margin-inline: auto;
	}

	.section {
		position: relative;
		padding: clamp(96px, 10vw, 150px) 0;
		scroll-margin-top: 64px;
	}

	.section-screen {
		min-height: min(900px, calc(100svh - 64px));
		display: grid;
		align-items: center;
	}

	:global([data-reveal='pending']) {
		opacity: 0;
		transform: translateY(26px);
	}

	:global([data-reveal='visible']) {
		opacity: 1;
		transform: translateY(0);
		transition:
			opacity 620ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.eyebrow {
		margin: 0 0 18px;
		color: var(--airis-lavender);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1,
	h2,
	h3 {
		text-wrap: balance;
	}

	h1 {
		max-width: 700px;
		margin-bottom: 26px;
		font-size: clamp(3rem, 5.4vw, 4.8rem);
		font-weight: 650;
		letter-spacing: -0.055em;
		line-height: 1.02;
	}

	h1 span {
		display: block;
		color: var(--airis-lavender);
	}

	h2 {
		margin-bottom: 22px;
		font-size: clamp(2.35rem, 4vw, 3.7rem);
		font-weight: 620;
		letter-spacing: -0.045em;
		line-height: 1.08;
	}

	.button {
		display: inline-flex;
		min-height: 50px;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
		border-radius: 14px;
		padding: 0 24px;
		font-size: 0.92rem;
		font-weight: 700;
		text-decoration: none;
		transition:
			background-color 160ms ease,
			border-color 160ms ease,
			box-shadow 180ms ease,
			color 160ms ease,
			transform 180ms ease;
	}

	.button:focus-visible,
	.text-link:focus-visible,
	button:focus-visible,
	summary:focus-visible,
	.faq__list a:focus-visible {
		outline: 3px solid var(--airis-lavender);
		outline-offset: 4px;
	}

	.button--primary {
		background: var(--airis-accent);
		box-shadow: 0 18px 50px rgb(113 50 242 / 0.3);
		color: #fff;
	}

	.button--primary:hover {
		background: var(--airis-accent-strong);
	}

	.button--quiet {
		border-color: var(--airis-line);
		color: #e6e0f4;
	}

	.button--quiet:hover {
		border-color: rgb(173 147 252 / 0.55);
		background: rgb(173 147 252 / 0.08);
	}

	.button--dark {
		background: var(--airis-ink);
		color: #fff;
	}

	.button--dark:hover {
		background: #241a52;
	}

	.button--light-outline {
		border-color: rgb(23 17 47 / 0.26);
		color: var(--airis-ink);
	}

	.button--light-outline:hover {
		background: rgb(23 17 47 / 0.07);
	}

	.text-link {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		gap: 8px;
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--airis-lavender);
		font: inherit;
		font-size: 0.93rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}

	.hero {
		position: relative;
		overflow: hidden;
		padding: clamp(72px, 8vw, 112px) 0 clamp(96px, 10vw, 144px);
		background:
			radial-gradient(820px 540px at 86% 76%, rgb(113 50 242 / 0.34), transparent 68%),
			radial-gradient(620px 520px at 88% 20%, rgb(173 147 252 / 0.16), transparent 68%),
			radial-gradient(680px 520px at 5% 100%, rgb(91 38 219 / 0.18), transparent 72%);
	}

	.hero::after {
		position: absolute;
		inset: auto -10% -280px 35%;
		height: 520px;
		border-radius: 50%;
		background: rgb(113 50 242 / 0.12);
		filter: blur(100px);
		content: '';
		pointer-events: none;
		animation: ambient-drift 12s ease-in-out infinite alternate;
	}

	.hero__inner {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(500px, 1.08fr);
		gap: clamp(52px, 6vw, 88px);
		align-items: center;
	}

	.hero__copy {
		animation: intro-rise 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.hero__lead {
		max-width: 620px;
		margin-bottom: 34px;
		color: var(--airis-muted);
		font-size: clamp(1.05rem, 1.55vw, 1.22rem);
		line-height: 1.65;
	}

	.hero__actions,
	.pricing__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.hero__facts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 24px;
		margin-top: 28px;
		color: #aaa1c2;
		font-size: 0.82rem;
	}

	.hero__facts span {
		position: relative;
	}

	.hero__facts span:not(:first-child)::before {
		position: absolute;
		top: 50%;
		left: -14px;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: #766d92;
		content: '';
	}

	.demo {
		border: 1px solid rgb(173 147 252 / 0.34);
		border-radius: 28px;
		background: rgb(13 11 27 / 0.94);
		box-shadow: 0 40px 100px rgb(4 2 18 / 0.5);
		overflow: hidden;
		animation: intro-rise 720ms 90ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.demo__topline {
		display: flex;
		min-height: 66px;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--airis-line);
		padding: 0 24px;
		color: #d8d2e9;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.demo__brand {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		color: #fff;
	}

	.demo__brand img {
		width: 26px;
		height: 26px;
		border-radius: 8px;
		background: #fff;
	}

	.tablist {
		display: flex;
	}

	.tablist button {
		min-height: 46px;
		border: 0;
		background: transparent;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.tablist--demo {
		gap: 6px;
		border-bottom: 1px solid var(--airis-line);
		padding: 8px 18px 0;
	}

	.tablist--demo button {
		position: relative;
		padding: 0 14px;
		color: #958cae;
		font-size: 0.82rem;
	}

	.tablist--demo button::after {
		position: absolute;
		right: 10px;
		bottom: -1px;
		left: 10px;
		height: 2px;
		border-radius: 2px;
		background: transparent;
		content: '';
	}

	.tablist--demo button.active {
		color: #fff;
	}

	.tablist--demo button.active::after {
		background: var(--airis-accent-strong);
	}

	.demo__conversation {
		display: grid;
		min-height: 360px;
		align-content: start;
		gap: 24px;
		padding: 30px;
	}

	.demo__conversation--enter,
	.scenario-panel--enter {
		animation: content-enter 240ms ease-out both;
	}

	.demo__prompt {
		max-width: 76%;
		margin-left: auto;
		border: 1px solid rgb(173 147 252 / 0.15);
		border-radius: 18px 18px 4px 18px;
		padding: 15px 18px;
		background: #302465;
		color: #fff;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.demo__answer {
		border: 1px solid var(--airis-line);
		border-radius: 20px;
		padding: 22px;
		background: #1d1930;
	}

	.demo__answer-label,
	.scenario-panel__label {
		margin-bottom: 10px;
		color: var(--airis-lavender);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.demo__answer p {
		margin-bottom: 12px;
		color: #f5f1ff;
		font-size: 0.94rem;
		line-height: 1.6;
	}

	.demo__answer span,
	.scenario-panel__conversation > span {
		color: #9389ab;
		font-size: 0.75rem;
	}

	.demo__composer {
		display: flex;
		min-height: 56px;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border: 1px solid rgb(173 147 252 / 0.35);
		border-radius: 16px;
		padding: 8px 10px 8px 18px;
		background: transparent;
		color: #ded8ed;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
	}

	.split-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.78fr) minmax(560px, 1.22fr);
		gap: clamp(64px, 8vw, 112px);
		align-items: center;
	}

	.model-story {
		overflow: hidden;
		background: radial-gradient(720px 520px at 82% 50%, rgb(113 50 242 / 0.13), transparent 72%);
	}

	.model-story::before {
		position: absolute;
		inset: 24% -10% 14% 48%;
		border-radius: 50%;
		background: rgb(128 60 255 / 0.13);
		filter: blur(110px);
		content: '';
		pointer-events: none;
	}

	.model-story .shell {
		position: relative;
		z-index: 1;
	}

	.section-lead,
	.section-heading > p:last-child,
	.local__lead,
	.faq__intro > p:last-child {
		color: var(--airis-muted);
		font-size: 1.08rem;
		line-height: 1.7;
	}

	.check-list {
		display: grid;
		gap: 16px;
		margin: 34px 0;
		padding: 0;
		list-style: none;
	}

	.check-list li {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		color: #e7e2f2;
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.check-list :global(svg) {
		flex: 0 0 auto;
		color: var(--airis-lavender);
	}

	.model-count {
		margin-bottom: 18px;
		color: #9e94b8;
		font-size: 0.8rem;
	}

	.product-shot {
		margin: 0;
	}

	.product-shot__frame {
		border: 1px solid rgb(173 147 252 / 0.28);
		border-radius: 30px;
		background: #0f0d1c;
		box-shadow: 0 42px 110px rgb(6 3 22 / 0.45);
		overflow: hidden;
		transition:
			border-color 220ms ease,
			box-shadow 220ms ease,
			transform 220ms ease;
	}

	.product-shot img {
		display: block;
		width: 100%;
		height: auto;
	}

	.product-shot figcaption {
		margin-top: 14px;
		color: #8f86a5;
		font-size: 0.75rem;
		text-align: right;
	}

	.scenarios {
		background:
			radial-gradient(680px 420px at 92% 20%, rgb(113 50 242 / 0.13), transparent 70%),
			rgb(23 18 53 / 0.54);
	}

	.section-heading {
		max-width: 760px;
		margin: 0 auto 48px;
		text-align: center;
	}

	.section-heading--left {
		max-width: 760px;
		margin: 0 0 56px;
		text-align: left;
	}

	.tablist--scenario {
		width: fit-content;
		margin: 0 auto 22px;
		border: 1px solid var(--airis-line);
		border-radius: 15px;
		padding: 4px;
		background: rgb(12 9 28 / 0.48);
	}

	.tablist--scenario button {
		min-width: 130px;
		border-radius: 11px;
		padding: 0 18px;
		color: #968dac;
		font-size: 0.86rem;
	}

	.tablist--scenario button.active {
		background: var(--airis-accent);
		color: #fff;
	}

	.scenario-panel {
		display: grid;
		grid-template-columns: minmax(0, 0.74fr) minmax(0, 1.26fr);
		gap: 0;
		border: 1px solid var(--airis-line);
		border-radius: 30px;
		background: rgb(13 10 30 / 0.72);
		overflow: hidden;
	}

	.scenario-panel__intro,
	.scenario-panel__conversation {
		padding: clamp(30px, 4vw, 52px);
	}

	.scenario-panel__intro {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		border-right: 1px solid var(--airis-line);
	}

	.scenario-panel__intro > p {
		margin-bottom: 16px;
		color: var(--airis-lavender);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.scenario-panel__intro h3 {
		margin-bottom: 16px;
		font-size: clamp(1.7rem, 2.6vw, 2.5rem);
		letter-spacing: -0.035em;
		line-height: 1.16;
	}

	.scenario-panel__intro > span {
		margin-bottom: 28px;
		color: var(--airis-muted);
		font-size: 0.95rem;
		line-height: 1.65;
	}

	.scenario-panel__conversation {
		background: rgb(43 32 88 / 0.24);
	}

	.scenario-panel__conversation > p {
		font-size: 0.93rem;
		line-height: 1.65;
	}

	.scenario-panel__prompt {
		margin-bottom: 28px;
		border: 1px solid rgb(173 147 252 / 0.14);
		border-radius: 15px;
		padding: 15px 17px;
		background: rgb(113 50 242 / 0.12);
		color: #f4f0fb;
	}

	.local {
		position: relative;
		overflow: hidden;
		background: #1d1545;
	}

	.local::before {
		position: absolute;
		inset: 12% 16%;
		border-radius: 50%;
		background: rgb(113 50 242 / 0.22);
		filter: blur(120px);
		content: '';
		pointer-events: none;
	}

	.local__inner {
		position: relative;
		z-index: 1;
		text-align: center;
	}

	.local h2 {
		max-width: 820px;
		margin-inline: auto;
		font-size: clamp(3rem, 6.2vw, 5.4rem);
	}

	.local__lead {
		max-width: 680px;
		margin: 0 auto 60px;
	}

	.local__facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		max-width: 980px;
		margin: 0 auto;
		border: 1px solid var(--airis-line);
		border-radius: 24px;
		background: var(--airis-line);
		overflow: hidden;
	}

	.local__facts > div {
		display: flex;
		min-height: 190px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 28px;
		background: rgb(26 20 60 / 0.94);
	}

	.local__facts :global(svg) {
		color: var(--airis-lavender);
	}

	.local__facts strong {
		font-size: 1.02rem;
	}

	.local__facts span {
		max-width: 230px;
		color: #aaa2bd;
		font-size: 0.8rem;
		line-height: 1.55;
	}

	.steps {
		background: rgb(13 10 29 / 0.28);
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
		gap: 34px;
		border-top: 1px solid var(--airis-line);
		padding: 30px 42px 0 0;
	}

	.steps__list li:not(:last-child) {
		margin-right: 42px;
	}

	.steps__list li > span {
		color: var(--airis-lavender);
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.12em;
	}

	.steps__list strong {
		display: block;
		margin-bottom: 10px;
		font-size: 1.05rem;
	}

	.steps__list p {
		margin-bottom: 0;
		color: #a9a1bb;
		font-size: 0.88rem;
		line-height: 1.6;
	}

	.pricing {
		background:
			radial-gradient(500px 300px at 80% 10%, rgb(255 255 255 / 0.38), transparent 70%),
			linear-gradient(135deg, #d9ceff 0%, #b9a3fb 100%);
		color: var(--airis-ink);
	}

	.pricing .eyebrow {
		color: #5c28cc;
	}

	.pricing__inner {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(430px, 1.05fr);
		gap: clamp(56px, 8vw, 108px);
		align-items: center;
	}

	.pricing__copy > p:not(.eyebrow) {
		max-width: 590px;
		margin-bottom: 32px;
		color: #443868;
		font-size: 1.08rem;
		line-height: 1.7;
	}

	.pricing__details {
		border: 1px solid rgb(23 17 47 / 0.13);
		border-radius: 26px;
		padding: clamp(28px, 4vw, 42px);
		background: rgb(255 255 255 / 0.32);
		box-shadow: 0 24px 70px rgb(72 40 145 / 0.13);
	}

	.pricing__details > ul {
		display: grid;
		gap: 18px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pricing__details > ul li {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		color: #30264e;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.pricing__details :global(svg) {
		flex: 0 0 auto;
		color: #642bd5;
	}

	.faq__layout {
		display: grid;
		grid-template-columns: minmax(0, 0.66fr) minmax(540px, 1.34fr);
		gap: clamp(64px, 9vw, 126px);
		align-items: start;
	}

	.faq__intro {
		position: sticky;
		top: 110px;
	}

	.faq__list {
		border-top: 1px solid var(--airis-line);
	}

	.faq__list details {
		border-bottom: 1px solid var(--airis-line);
	}

	.faq__list summary {
		min-height: 76px;
		align-content: center;
		color: #f8f5ff;
		font-size: 1rem;
		font-weight: 750;
		cursor: pointer;
	}

	.faq__list details p {
		max-width: 680px;
		margin: -4px 0 22px;
		color: #a9a1bb;
		font-size: 0.9rem;
		line-height: 1.7;
	}

	.faq__list details a {
		display: inline-flex;
		margin: -8px 0 24px;
		color: var(--airis-lavender);
		font-size: 0.82rem;
		font-weight: 700;
	}

	.final-cta {
		padding: 40px 0 96px;
	}

	.final-cta__panel {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 40px;
		border: 1px solid rgb(173 147 252 / 0.25);
		border-radius: 30px;
		padding: clamp(34px, 5vw, 62px);
		background:
			radial-gradient(440px 220px at 80% 0%, rgb(173 147 252 / 0.17), transparent 70%), #241953;
	}

	.final-cta h2 {
		max-width: 700px;
		margin-bottom: 14px;
		font-size: clamp(2rem, 3.4vw, 3.2rem);
	}

	.final-cta__panel > div > span {
		color: #a9a0bf;
		font-size: 0.82rem;
	}

	.footer {
		padding: 0 0 48px;
		background: #120e26;
	}

	.footer :global(.footer-links) {
		margin-top: 0;
	}

	@keyframes intro-rise {
		from {
			opacity: 0;
			transform: translateY(18px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes content-enter {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes ambient-drift {
		from {
			transform: translate3d(-2%, 0, 0) scale(0.96);
		}
		to {
			transform: translate3d(3%, -2%, 0) scale(1.04);
		}
	}

	@media (hover: hover) {
		.button:hover {
			transform: translateY(-2px);
		}

		.product-shot__frame:hover {
			border-color: rgb(173 147 252 / 0.44);
			box-shadow: 0 46px 120px rgb(11 5 40 / 0.55);
			transform: translateY(-4px);
		}
	}

	@media (max-width: 1020px) {
		.section-screen {
			min-height: auto;
		}

		.hero__inner,
		.split-layout,
		.pricing__inner,
		.faq__layout {
			grid-template-columns: 1fr;
		}

		.hero__copy,
		.section-copy,
		.pricing__copy {
			max-width: 760px;
		}

		.demo,
		.product-shot {
			width: min(100%, 780px);
		}

		.split-layout {
			gap: 58px;
		}

		.pricing__inner,
		.faq__layout {
			gap: 56px;
		}

		.faq__intro {
			position: static;
			max-width: 680px;
		}
	}

	@media (max-width: 760px) {
		.shell {
			width: min(100% - 32px, 1180px);
		}

		.section {
			padding: 82px 0;
		}

		h1 {
			font-size: clamp(2.7rem, 12vw, 4rem);
		}

		h2 {
			font-size: clamp(2.15rem, 10vw, 3.2rem);
		}

		.hero {
			padding: 64px 0 92px;
		}

		.hero__inner {
			gap: 50px;
		}

		.hero__lead,
		.section-lead,
		.section-heading > p:last-child,
		.local__lead,
		.faq__intro > p:last-child,
		.pricing__copy > p:not(.eyebrow) {
			font-size: 1rem;
		}

		.hero__facts {
			display: grid;
			gap: 8px;
		}

		.hero__facts span:not(:first-child)::before {
			display: none;
		}

		.demo__topline {
			padding: 0 18px;
		}

		.tablist--demo {
			overflow-x: auto;
			padding-inline: 10px;
			scrollbar-width: none;
		}

		.tablist--demo::-webkit-scrollbar {
			display: none;
		}

		.demo__conversation {
			padding: 20px;
		}

		.demo__prompt {
			max-width: 88%;
		}

		.scenario-panel,
		.local__facts,
		.steps__list {
			grid-template-columns: 1fr;
		}

		.section-heading {
			margin-bottom: 36px;
			text-align: left;
		}

		.tablist--scenario {
			width: 100%;
			overflow-x: auto;
			justify-content: flex-start;
			scrollbar-width: none;
		}

		.tablist--scenario button {
			min-width: 112px;
		}

		.scenario-panel__intro {
			border-right: 0;
			border-bottom: 1px solid var(--airis-line);
		}

		.local h2 {
			font-size: clamp(2.8rem, 13vw, 4.4rem);
		}

		.local__facts {
			gap: 0;
		}

		.local__facts > div {
			min-height: 160px;
			border-bottom: 1px solid var(--airis-line);
		}

		.local__facts > div:last-child {
			border-bottom: 0;
		}

		.steps__list {
			gap: 34px;
		}

		.steps__list li,
		.steps__list li:not(:last-child) {
			margin-right: 0;
			padding-right: 0;
		}

		.pricing__details {
			padding: 28px 22px;
		}

		.faq__list summary {
			min-height: 68px;
		}

		.final-cta {
			padding: 16px 0 76px;
		}

		.final-cta__panel {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (max-width: 520px) {
		.hero__actions,
		.pricing__actions {
			flex-direction: column;
		}

		.button {
			width: 100%;
		}

		.demo {
			border-radius: 22px;
		}

		.demo__conversation {
			min-height: 390px;
		}

		.demo__composer {
			font-size: 0.78rem;
		}

		.product-shot__frame,
		.scenario-panel,
		.final-cta__panel {
			border-radius: 22px;
		}

		.scenario-panel__intro,
		.scenario-panel__conversation {
			padding: 28px 22px;
		}

		.final-cta__panel {
			padding: 30px 24px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.button,
		:global([data-reveal='visible']) {
			transition: none;
		}

		.hero__copy,
		.demo,
		.demo__conversation--enter,
		.scenario-panel--enter,
		.hero::after {
			animation: none;
		}
	}
</style>
