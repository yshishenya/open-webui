<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { user } from '$lib/stores';
	import { getPublicLeadMagnetConfig } from '$lib/apis/billing';
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';
	import { trackEvent } from '$lib/utils/analytics';
	import { buildSignupUrl, openCta, openPreset } from '$lib/components/landing/welcomeNavigation';
	import { presetsById } from '$lib/data/features';
	import { sanitizeRedirectPath } from '$lib/utils/airis/return_to';

	interface NavLink {
		href: string;
		label: string;
	}

	type HeroPillIcon = 'globe' | 'chat' | 'card';

	interface HeroPill {
		label: string;
		icon: HeroPillIcon;
	}

	interface HeroStat {
		value: string;
		label: string;
	}

	interface ExampleCard {
		title: string;
		description: string;
		presetId: string;
		source: string;
		fallbackPrompt: string;
		tone: 'base' | 'accent' | 'gradient';
		layout: 'default' | 'tall';
		preview: 'text' | 'transcribe' | 'image' | 'docs' | 'code';
		prompts?: string[];
	}

	interface StepItem {
		title: string;
		text: string;
	}

	interface ModelCard {
		title: string;
		subtitle: string;
		note?: string;
		tone: 'base' | 'accent' | 'solid';
	}

	interface WhyCard {
		title: string;
		text: string;
	}

	interface PricingPoint {
		text: string;
	}

	interface FaqItem {
		id: string;
		question: string;
		answer: string;
	}

	interface FreeStartItem {
		label: string;
		value: number;
		unit: string;
	}

	let loaded = false;
	let mobileMenuOpen = false;
	let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	let freeStartItems: FreeStartItem[] = [];

	const navLinks: NavLink[] = [
		{ href: '/features', label: 'Возможности' },
		{ href: '/pricing', label: 'Тарифы' },
		{ href: '/about', label: 'О нас' },
		{ href: '/contact', label: 'Контакты' }
	];

	const heroPills: HeroPill[] = [
		{ label: 'Без подписок и VPN', icon: 'globe' },
		{ label: 'Единый чат', icon: 'chat' },
		{ label: 'Оплата в рублях', icon: 'card' }
	];

	const heroStats: HeroStat[] = [
		{ value: '100+', label: 'нейросетей' },
		{ value: '1 000+', label: 'готовых промптов' },
		{ value: '1 000 000', label: 'токенов' }
	];

	const exampleCategories: string[] = [
		'Генерация видео',
		'Генерация изображений',
		'Улучшение текста',
		'Транскрибация',
		'Синтез речи',
		'Генерация писем'
	];

	const exampleCards: ExampleCard[] = [
		{
			title: 'Генерация текста',
			description: 'Посты, письма, статьи, сценарии и тексты под ваш тон и цель.',
			presetId: 'social_post',
			source: 'welcome_examples',
			fallbackPrompt: 'Напиши пост для соцсетей о запуске нового продукта.',
			tone: 'base',
			layout: 'default',
			preview: 'text',
			prompts: [
				'Напиши статью по теме [тема] для [аудитория]',
				'Напиши письмо для рассылки'
			]
		},
		{
			title: 'Транскрибация',
			description: 'Расшифровывайте встречи, интервью и подкасты за минуты, а не часы.',
			presetId: 'stt_transcribe',
			source: 'welcome_examples',
			fallbackPrompt: 'Сделай транскрибацию аудио и убери слова-паразиты.',
			tone: 'gradient',
			layout: 'default',
			preview: 'transcribe'
		},
		{
			title: 'Генерация изображений',
			description: 'Баннеры, обложки и визуалы под бренд и нужный формат.',
			presetId: 'image_generate',
			source: 'welcome_examples',
			fallbackPrompt: 'Сгенерируй изображение для рекламного поста о кофейне.',
			tone: 'base',
			layout: 'tall',
			preview: 'image'
		},
		{
			title: 'Анализ документов',
			description: 'Короткие выводы из отчётов, договоров и длинных материалов.',
			presetId: 'summarize_report',
			source: 'welcome_examples',
			fallbackPrompt: 'Сделай краткое резюме отчёта и выдели ключевые риски.',
			tone: 'accent',
			layout: 'default',
			preview: 'docs'
		},
		{
			title: 'Генерация кода',
			description: 'Помощь с фрагментами, рефакторингом и объяснением ошибок.',
			presetId: 'debug_code',
			source: 'welcome_examples',
			fallbackPrompt: 'Помоги найти и исправить ошибку в коде.',
			tone: 'gradient',
			layout: 'default',
			preview: 'code'
		}
	];

	const steps: StepItem[] = [
		{ title: '1', text: 'Вы выбираете задачу и описываете её своими словами' },
		{ title: '2', text: 'AIris автоматически создаёт промпт и подбирает ИИ-модель' },
		{ title: '3', text: 'Вы получаете результат и при необходимости уточняете его' }
	];

	const modelCards: ModelCard[] = [
		{
			title: 'Тексты и анализ',
			subtitle: 'ChatGPT · Claude · Grok · DeepSeek',
			tone: 'base'
		},
		{
			title: 'Изображения и видео',
			subtitle: 'Midjourney · Flux · Veo · Kling · Sora',
			tone: 'base'
		},
		{
			title: 'Аудио и озвучка',
			subtitle: 'Suno · ElevenLabs',
			tone: 'accent'
		},
		{
			title: 'Ассистенты GPTs и AI-инструменты',
			subtitle: 'Дополнительные AI-инструменты под рабочие задачи',
			note: 'Замена фона, генерация вариаций, оживление фото и другое.',
			tone: 'solid'
		}
	];

	const whyCards: WhyCard[] = [
		{
			title: 'Без подписок',
			text: 'Работает без VPN. Оплата только за использование, в рублях.'
		},
		{
			title: 'Все нейросети в одном месте',
			text: 'Тексты, изображения, видео и аудио в одном сервисе.'
		},
		{
			title: 'Для команд и бизнеса',
			text: 'Совместная работа, корпоративный доступ и API для интеграций.'
		},
		{
			title: 'Быстрый старт',
			text: 'Готовые примеры и понятные сценарии доступны сразу.'
		},
		{
			title: 'Живая поддержка',
			text: 'Помогаем разобраться и отвечаем на вопросы пользователей.'
		}
	];

	const pricingPoints: PricingPoint[] = [
		{ text: 'Оплата только за реальные запросы' },
		{ text: 'Без подписок и ежемесячных платежей' },
		{ text: 'Полный контроль расходов: баланс пополняется заранее' },
		{ text: 'Цена видна до выполнения запроса' },
		{ text: 'История запросов и списаний в личном кабинете' }
	];

	const faqItems: FaqItem[] = [
		{
			id: 'faq-payg',
			question: 'Как работает оплата по использованию?',
			answer: 'Вы пополняете баланс, а списания происходят только за реально выполненные запросы.'
		},
		{
			id: 'faq-free',
			question: 'Есть ли бесплатный доступ?',
			answer: 'Да. Доступен бесплатный старт с лимитами, которые обновляются по циклу.'
		},
		{
			id: 'faq-why-paid',
			question: 'Почему не все возможности бесплатные?',
			answer: 'Платные модели и генерация медиа требуют внешних вычислительных ресурсов.'
		},
		{
			id: 'faq-vpn',
			question: 'Нужен ли VPN?',
			answer: 'Нет, AIris работает без VPN.'
		},
		{
			id: 'faq-history',
			question: 'Где посмотреть баланс и историю списаний?',
			answer: 'В кабинете есть баланс, журнал операций и история использования.'
		},
		{
			id: 'faq-business',
			question: 'Можно ли использовать для работы и бизнеса?',
			answer: 'Да. Сервис подходит для индивидуальной работы и командных сценариев.'
		}
	];

	const buildLoginTarget = (source: string): string => {
		const redirectTarget = `/?src=${source}`;
		const params = new URLSearchParams({ redirect: redirectTarget, src: source });
		return `/auth?${params.toString()}`;
	};

	const resolvePrompt = (presetId: string, fallbackPrompt: string): string => {
		return presetsById[presetId]?.prompt ?? fallbackPrompt;
	};

	const formatNumber = (value: number): string => new Intl.NumberFormat('ru-RU').format(value);

	const mapFreeStartItems = (config: PublicLeadMagnetConfig | null): FreeStartItem[] => {
		if (!config?.enabled) {
			return [];
		}

		const { tokens_input, tokens_output, images, tts_seconds, stt_seconds } = config.quotas;

		return [
			{ label: 'Текст (ввод)', value: tokens_input, unit: 'токенов' },
			{ label: 'Текст (ответ)', value: tokens_output, unit: 'токенов' },
			{ label: 'Изображения', value: images, unit: 'шт.' },
			{ label: 'Озвучка', value: tts_seconds, unit: 'сек.' },
			{ label: 'Транскрибация', value: stt_seconds, unit: 'сек.' }
		].filter((item) => item.value > 0);
	};

	const loadLeadMagnetConfig = async (): Promise<void> => {
		try {
			leadMagnetConfig = await getPublicLeadMagnetConfig();
		} catch (error) {
			console.error('Failed to load lead magnet config:', error);
		}
	};

	$: redirectParam = sanitizeRedirectPath($page.url.searchParams.get('redirect'));
	$: redirectUrl = redirectParam || '/';
	$: shouldAutoRedirect = Boolean(redirectParam);
	$: freeStartItems = mapFreeStartItems(leadMagnetConfig);
	$: freeCycleDays = leadMagnetConfig?.cycle_days ?? 30;

	onMount(() => {
		if ($user && shouldAutoRedirect) {
			goto(redirectUrl);
			return;
		}

		loaded = true;
		void loadLeadMagnetConfig();
	});

	$: if (
		typeof window !== 'undefined' &&
		localStorage.getItem('token') &&
		!loaded &&
		shouldAutoRedirect
	) {
		goto(redirectUrl);
	}

	const headerCtaHref = buildSignupUrl('welcome_header_cta');
	const heroPrimaryHref = buildSignupUrl('welcome_hero_primary');
	const finalCtaHref = buildSignupUrl('welcome_final_cta');

	const handleHeaderCtaClick = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('welcome_header_cta_click');
		openCta('welcome_header_cta');
	};

	const handleHeaderLoginClick = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('welcome_login_click');

		if ($user) {
			goto('/?src=welcome_login');
			return;
		}

		goto(buildLoginTarget('welcome_login'));
	};

	const handleHeroPrimaryClick = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('welcome_hero_primary_click');
		openCta('welcome_hero_primary');
	};

	const handleExampleCardClick = (card: ExampleCard): void => {
		trackEvent('welcome_examples_card_click', { preset: card.presetId });
		openPreset(card.source, card.presetId, resolvePrompt(card.presetId, card.fallbackPrompt));
	};

	const handleTryAiClick = (source: string): void => {
		trackEvent('welcome_try_ai_click', { source });
		openCta(source);
	};

	const handleLearnPricingClick = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('welcome_pricing_more_click');
		goto('/pricing');
	};

	const handleFinalCtaClick = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('welcome_final_cta_click');
		openCta('welcome_final_cta');
	};

	const handleMobileNavItemClick = (): void => {
		mobileMenuOpen = false;
	};
</script>

<svelte:head>
	<title>AIris - Один сервис для работы с топовыми нейросетями</title>
	<meta
		name="description"
		content="AIris объединяет топовые нейросети для текста, изображений, видео и аудио в одном сервисе. Без VPN, без подписки, оплата в рублях."
	/>
</svelte:head>

{#if loaded}
	<div class="welcome-landing">
		<header class="landing-header">
			<div class="landing-container header-inner">
				<a href="/" class="brand" aria-label="AIris">
					<span class="brand-mark" aria-hidden="true">
						<img src="{WEBUI_BASE_URL}/static/favicon.svg" alt="" />
					</span>
					<span class="brand-text">AIris</span>
				</a>

				<nav class="desktop-nav" aria-label="Навигация по публичным страницам">
					{#each navLinks as link}
						<a href={link.href}>{link.label}</a>
					{/each}
				</nav>

				<div class="desktop-actions">
					<a href="/auth" class="link-login" on:click={handleHeaderLoginClick}>Войти</a>
					<a href={headerCtaHref} class="btn btn-primary" on:click={handleHeaderCtaClick}>
						Попробовать
					</a>
				</div>

				<div class="mobile-actions">
					<a href={headerCtaHref} class="btn btn-primary mobile-cta" on:click={handleHeaderCtaClick}>
						Попробовать
					</a>
					<button
						type="button"
						class="menu-toggle"
						on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
						aria-label="Открыть меню"
						aria-expanded={mobileMenuOpen}
						aria-controls="mobile-nav"
					>
						{#if mobileMenuOpen}
							✕
						{:else}
							☰
						{/if}
					</button>
				</div>
			</div>

			{#if mobileMenuOpen}
				<div class="mobile-menu" id="mobile-nav">
					<div class="landing-container mobile-menu-inner">
						{#each navLinks as link}
							<a href={link.href} on:click={handleMobileNavItemClick}>{link.label}</a>
						{/each}
						<a href="/auth" on:click={handleHeaderLoginClick}>Войти</a>
					</div>
				</div>
			{/if}
		</header>

		<main>
				<section class="hero-section">
					<div class="hero-backdrop" aria-hidden="true"></div>
					<div class="landing-container hero-inner">
						<h1>Один сервис для работы с топовыми нейросетями под ваши задачи</h1>

						<div class="hero-pills">
							{#each heroPills as pill}
								<div class="hero-pill">
									<span class="hero-pill-icon" aria-hidden="true">
										{#if pill.icon === 'globe'}
											<svg viewBox="0 0 24 24" role="presentation">
												<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
												<path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
											</svg>
										{:else if pill.icon === 'chat'}
											<svg viewBox="0 0 24 24" role="presentation">
												<path
													d="M21 11.5a8.4 8.4 0 0 1-8.75 8.25c-1.19 0-2.33-.22-3.36-.63l-4.89 1.5 1.56-4.59a8.25 8.25 0 1 1 15.44-4.53Z"
												/>
												<path d="M8 10h8M8 14h5" />
											</svg>
										{:else}
											<svg viewBox="0 0 24 24" role="presentation">
												<rect x="2.5" y="5" width="19" height="14" rx="3" />
												<path d="M2.5 10.5h19M7.5 14h3" />
											</svg>
										{/if}
									</span>
									<span>{pill.label}</span>
								</div>
							{/each}
						</div>

						<div class="hero-actions">
							<a href={heroPrimaryHref} class="btn btn-primary" on:click={handleHeroPrimaryClick}>
								Начать бесплатно
							</a>
						</div>

						<div class="hero-stats" aria-label="Ключевые показатели AIris">
							{#each heroStats as stat}
							<div class="hero-stat-card">
								<div class="hero-stat-value">{stat.value}</div>
								<div class="hero-stat-label">{stat.label}</div>
							</div>
						{/each}
					</div>
				</div>
			</section>

			<section class="intro-section">
				<div class="landing-container">
					<div class="intro-card">
						<h2>AIris — сервис, который сам формирует промпты и подбирает ИИ-модели</h2>
						<p>
							Вы выбираете задачу — AIris автоматически формирует запрос и отправляет его в чат
							с подходящей моделью.
						</p>
					</div>
				</div>
			</section>

				<section class="examples-section" id="examples">
					<div class="landing-container">
						<h2>Полный набор AI-инструментов для бизнеса и творчества</h2>

					<div class="example-categories" role="list" aria-label="Категории примеров">
						{#each exampleCategories as category}
							<div role="listitem" class="example-category-chip">
								<span class="chip-dot" aria-hidden="true"></span>
								{category}
							</div>
						{/each}
					</div>

						<div class="examples-grid">
							{#each exampleCards as card}
								<article
									class={`example-card example-card--${card.tone}`}
									data-layout={card.layout}
									data-preview={card.preview}
								>
									<div class="example-card-text">
										<h3>{card.title}</h3>
										<p>{card.description}</p>
									</div>
									{#if card.preview === 'text'}
										<div class="example-preview example-preview--prompts" aria-hidden="true">
											{#if card.prompts}
												{#each card.prompts as prompt}
													<span>{prompt}</span>
												{/each}
											{/if}
										</div>
									{:else if card.preview === 'transcribe'}
										<div class="example-preview example-preview--wave" aria-hidden="true">
											<div class="wave-line"></div>
											<div class="transcript-sheet"></div>
										</div>
									{:else if card.preview === 'image'}
										<div class="example-preview example-preview--image" aria-hidden="true"></div>
									{:else if card.preview === 'docs'}
										<div class="example-preview example-preview--docs" aria-hidden="true">
											<span>W</span>
											<span>X</span>
										</div>
										{:else if card.preview === 'code'}
											<div class="example-preview example-preview--code" aria-hidden="true">
												<pre><code>def solve(task):
    return ai_model(task)</code></pre>
											</div>
										{/if}
									<button type="button" on:click={() => handleExampleCardClick(card)}>
										Попробовать
									</button>
								</article>
						{/each}
					</div>

					<div class="section-cta">
						<button type="button" class="btn btn-primary" on:click={() => handleTryAiClick('welcome_examples_cta')}>
							Попробовать ИИ
						</button>
					</div>
				</div>
			</section>

				<section class="steps-section">
					<div class="landing-container steps-shell">
						<h2>Три шага до результата</h2>
						<div class="steps-list">
							{#each steps as step}
								<div class="step-item">
									<span class="step-index">{step.title}</span>
									<p>{step.text}</p>
								</div>
							{/each}
						</div>
						<div class="video-placeholder" aria-label="Видео о работе AIris">
							<button type="button" aria-label="Запустить видео" class="play-button">▶</button>
						</div>
					</div>
			</section>

			<section class="models-section" id="features">
				<div class="landing-container">
					<div class="section-head">
						<h2>AIris объединяет лучшие ИИ-модели для любых задач</h2>
						<p>
							От текстов и анализа до изображений, видео и аудио. Модель подбирается автоматически.
						</p>
					</div>

					<div class="models-grid">
						{#each modelCards as card}
							<article class={`model-card model-card--${card.tone}`}>
								<h3>{card.title}</h3>
								<p>{card.subtitle}</p>
								{#if card.note}
									<small>{card.note}</small>
								{/if}
							</article>
						{/each}
					</div>
				</div>
			</section>

			<section class="why-section">
				<div class="landing-container">
					<h2>Почему AIris?</h2>
					<div class="why-grid">
						{#each whyCards as card}
							<article class="why-card">
								<h3>{card.title}</h3>
								<p>{card.text}</p>
							</article>
						{/each}
					</div>
				</div>
			</section>

			<section class="pricing-section" id="pricing">
				<div class="landing-container pricing-grid">
					<div class="pricing-shot">
						<div class="pricing-shot-frame">
							<img src="/landing/airis-chat.png" alt="Интерфейс сервиса AIris" loading="lazy" />
						</div>
					</div>
					<div class="pricing-content">
						<h2>Прозрачная оплата за использование</h2>
						<ul>
							{#each pricingPoints as item}
								<li>{item.text}</li>
							{/each}
						</ul>
						<a href="/pricing" class="btn btn-secondary" on:click={handleLearnPricingClick}>
							Подробнее
						</a>
					</div>
				</div>
			</section>

			<section class="free-start-section">
				<div class="landing-container">
					<div class="free-start-card">
						<div>
							<h2>Бесплатный старт с AIris</h2>
							<p>
								Часть возможностей доступна бесплатно, чтобы вы могли проверить сервис в боевом
								сценарии.
							</p>
							<p>Без карты. Без лишних шагов. Лимиты обновляются каждые {freeCycleDays} дней.</p>
							<a href={finalCtaHref} class="btn btn-secondary" on:click={handleFinalCtaClick}>
								Начать бесплатно
							</a>
						</div>

						{#if freeStartItems.length > 0}
							<div class="free-start-limits" aria-label="Лимиты бесплатного старта">
								{#each freeStartItems as item}
									<div>
										<strong>{formatNumber(item.value)}</strong>
										<span>{item.unit}</span>
										<p>{item.label}</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</section>

			<section class="faq-section" id="faq">
				<div class="landing-container">
					<div class="faq-grid">
						{#each faqItems as item}
							<details id={item.id} class="faq-item">
								<summary>
									<span>{item.question}</span>
									<span aria-hidden="true">+</span>
								</summary>
								<p>{item.answer}</p>
							</details>
						{/each}
					</div>
				</div>
			</section>
		</main>

		<footer class="landing-footer">
			<div class="landing-container footer-content">
				<div class="footer-links">
					{#each navLinks as link}
						<a href={link.href}>{link.label}</a>
					{/each}
					<a href="/terms">Оферта</a>
					<a href="/privacy">Политика конфиденциальности</a>
				</div>

				<div class="footer-meta">
					<div>© 2026 AIris. Все права защищены.</div>
					<div>ИП Шишеня Ян Александрович · ИНН 667803118920 · ОГРНИП 320665800036109</div>
				</div>
			</div>
			<div class="footer-wordmark" aria-hidden="true">Airis</div>
		</footer>
	</div>
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
		background: #1e1647;
	}

	:global(section[id]) {
		scroll-margin-top: 96px;
	}

	.welcome-landing {
		background: #1e1647;
		color: #ffffff;
		font-family: var(--font-primary, 'Inter', sans-serif);
		min-height: 100vh;
	}

	.landing-container {
		margin: 0 auto;
		width: min(1180px, calc(100% - 32px));
	}

	.landing-header {
		position: sticky;
		top: 0;
		z-index: 50;
		backdrop-filter: blur(8px);
		background: rgba(30, 22, 71, 0.88);
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.header-inner {
		min-height: 88px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: #ffffff;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.brand-mark img {
		width: 24px;
		height: 24px;
	}

	.brand-text {
		font-size: 20px;
		line-height: 1;
	}

	.desktop-nav {
		display: inline-flex;
		align-items: center;
		gap: 20px;
	}

	.desktop-nav a {
		color: rgba(255, 255, 255, 0.82);
		font-size: 15px;
		font-weight: 500;
		padding: 8px;
		border-radius: 8px;
		transition: color 0.2s ease;
	}

	.desktop-nav a:hover {
		color: #ffffff;
	}

	.desktop-actions {
		display: inline-flex;
		align-items: center;
		gap: 14px;
	}

	.link-login {
		color: rgba(255, 255, 255, 0.88);
		font-weight: 600;
		font-size: 14px;
		padding: 8px;
	}

	.link-login:hover {
		color: #ffffff;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 52px;
		padding: 0 26px;
		border-radius: 10px;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
		transition:
			transform 0.2s ease,
			opacity 0.2s ease,
			background-color 0.2s ease,
			border-color 0.2s ease;
	}

	.btn:hover {
		transform: translateY(-1px);
	}

	.btn-primary {
		background: #7132f2;
		color: #ffffff;
		border: 1px solid transparent;
	}

	.btn-primary:hover {
		background: #7f49f4;
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.35);
		color: #ffffff;
	}

	.btn-secondary:hover {
		border-color: rgba(255, 255, 255, 0.58);
		background: rgba(255, 255, 255, 0.08);
	}

	.mobile-actions,
	.mobile-menu {
		display: none;
	}

	.mobile-actions {
		align-items: center;
		gap: 10px;
	}

	.mobile-cta {
		height: 44px;
		padding-inline: 16px;
		font-size: 13px;
	}

	.menu-toggle {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.04);
		color: #ffffff;
		font-size: 18px;
		line-height: 1;
	}

	.mobile-menu {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(16, 11, 43, 0.94);
	}

	.mobile-menu-inner {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 0 14px;
	}

	.mobile-menu-inner a {
		padding: 10px 6px;
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.9);
	}

	.hero-section {
		position: relative;
		padding: 52px 0 92px;
		overflow: hidden;
	}

	.hero-backdrop {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(980px 560px at 100% 20%, rgba(113, 50, 242, 0.7), rgba(113, 50, 242, 0) 70%),
			radial-gradient(800px 420px at 0% 4%, rgba(80, 35, 170, 0.5), rgba(80, 35, 170, 0) 68%);
	}

	.hero-inner {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 26px;
		text-align: center;
	}

	.hero-inner h1 {
		max-width: 920px;
		font-size: clamp(34px, 5vw, 56px);
		line-height: 1.08;
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.hero-pills {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
		width: 100%;
		max-width: 980px;
	}

	.hero-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 20px 22px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(255, 255, 255, 0.06);
		font-size: 20px;
		line-height: 1.2;
	}

	.hero-pill-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		color: rgba(198, 172, 255, 0.96);
	}

	.hero-pill-icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.hero-actions {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.hero-actions .btn {
		min-width: min(320px, 100%);
	}

	.hero-stats {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		width: 100%;
		max-width: 1180px;
		padding: 118px 0 8px;
		isolation: isolate;
	}

	.hero-stats::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		transform: translateX(-50%);
		width: min(1320px, calc(100% + 220px));
		height: 346px;
		pointer-events: none;
		background:
			radial-gradient(
				ellipse at 50% 96%,
				rgba(198, 148, 255, 0.76) 0%,
				rgba(198, 148, 255, 0.38) 28%,
				rgba(198, 148, 255, 0.14) 50%,
				rgba(198, 148, 255, 0) 72%
			),
			repeating-conic-gradient(
				from -90deg at 50% 100%,
				rgba(243, 229, 255, 0.62) 0deg 7deg,
				rgba(243, 229, 255, 0.08) 7deg 13deg
			);
		clip-path: ellipse(53% 64% at 50% 100%);
		filter: saturate(118%) blur(0.3px);
		z-index: 0;
	}

	.hero-stats::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 138px;
		transform: translateX(-50%);
		width: min(920px, calc(100% - 34px));
		height: 176px;
		pointer-events: none;
		background: radial-gradient(
			circle at center,
			rgba(182, 122, 255, 0.48) 0%,
			rgba(182, 122, 255, 0.14) 48%,
			rgba(182, 122, 255, 0) 78%
		);
		z-index: 0;
	}

	.hero-stat-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		justify-content: flex-end;
		height: 240px;
		padding: 40px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.35);
		background: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(14px);
	}

	.hero-stat-value {
		font-size: clamp(36px, 3vw, 56px);
		line-height: 1;
		font-weight: 600;
		letter-spacing: -0.04em;
	}

	.hero-stat-label {
		font-size: 24px;
		line-height: 1.2;
	}

	.intro-section {
		padding: 0 0 86px;
	}

	.intro-card {
		background: linear-gradient(162deg, #7132f2 45%, #f6b3e6 170%);
		border-radius: 10px;
		padding: 56px 44px;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.intro-card h2 {
		font-size: clamp(28px, 3.8vw, 36px);
		line-height: 1.12;
		font-weight: 600;
		letter-spacing: -0.02em;
		max-width: 800px;
		margin: 0 auto;
	}

	.intro-card p {
		font-size: 20px;
		line-height: 1.5;
		max-width: 1100px;
		margin: 0 auto;
		color: rgba(255, 255, 255, 0.96);
	}

	.examples-section,
	.steps-section,
	.models-section,
	.why-section,
	.pricing-section,
	.free-start-section,
	.faq-section {
		padding: 0 0 92px;
	}

	.examples-section h2,
	.steps-shell h2,
	.section-head h2,
	.why-section h2,
	.pricing-content h2,
	.free-start-card h2 {
		font-size: clamp(30px, 3.4vw, 42px);
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-weight: 600;
		margin: 0;
	}

	.examples-section h2,
	.why-section h2 {
		text-align: center;
	}

	.example-categories {
		margin-top: 44px;
		display: flex;
		align-items: center;
		gap: 10px;
		overflow-x: auto;
		padding-bottom: 6px;
		scrollbar-width: thin;
	}

	.example-category-chip {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		white-space: nowrap;
		padding: 18px 26px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.18);
		font-size: 18px;
		line-height: 1;
	}

	.chip-dot {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.65);
	}

	.examples-grid {
		margin-top: 28px;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
	}

	.example-card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 32px;
		min-height: 300px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.08);
	}

	.example-card[data-layout='tall'] {
		grid-row: span 2;
		min-height: 700px;
	}

	.example-card-text {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.example-card h3 {
		font-size: 28px;
		line-height: 1.2;
		font-weight: 500;
		margin: 0;
	}

	.example-card p {
		font-size: 16px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.82);
		max-width: 360px;
	}

	.example-preview {
		position: relative;
		margin-top: auto;
		min-height: 120px;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		overflow: hidden;
		background: rgba(10, 8, 24, 0.4);
	}

	.example-preview--prompts {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
		padding: 16px;
		background: linear-gradient(150deg, rgba(182, 126, 255, 0.4), rgba(113, 50, 242, 0.42));
	}

	.example-preview--prompts span {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		padding: 8px 14px;
		border-radius: 999px;
		font-size: 12px;
		line-height: 1;
		color: rgba(255, 255, 255, 0.92);
		background: rgba(209, 175, 255, 0.3);
	}

	.example-preview--wave {
		display: grid;
		gap: 10px;
		padding: 16px;
		background:
			linear-gradient(160deg, rgba(113, 50, 242, 0.6), rgba(194, 124, 255, 0.56)),
			radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 48%);
	}

	.wave-line {
		position: relative;
		height: 52px;
		border-radius: 999px;
		background: rgba(226, 205, 255, 0.18);
	}

	.wave-line::before {
		content: '';
		position: absolute;
		left: 16px;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		height: 24px;
		background: repeating-linear-gradient(
			90deg,
			rgba(248, 238, 255, 0.92) 0 4px,
			rgba(248, 238, 255, 0.2) 4px 8px
		);
		mask: radial-gradient(circle at center, #000 58%, transparent 100%);
	}

	.transcript-sheet {
		height: 56px;
		border-radius: 10px;
		background: rgba(233, 214, 255, 0.14);
	}

	.transcript-sheet::before,
	.transcript-sheet::after {
		content: '';
		position: absolute;
		left: 30px;
		right: 30px;
		height: 4px;
		border-radius: 999px;
		background: rgba(230, 212, 255, 0.58);
	}

	.transcript-sheet::before {
		top: 88px;
	}

	.transcript-sheet::after {
		top: 104px;
	}

	.example-preview--image {
		min-height: 320px;
		background:
			linear-gradient(180deg, rgba(15, 11, 37, 0) 0%, rgba(15, 11, 37, 0.68) 100%),
			url('/landing/airis-hero.webp') center / cover no-repeat;
	}

	.example-preview--image::after {
		content: '';
		position: absolute;
		inset: auto 0 0 0;
		height: 64px;
		background: linear-gradient(180deg, rgba(15, 11, 37, 0) 0%, rgba(15, 11, 37, 0.86) 100%);
	}

	.example-preview--docs {
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		gap: 8px;
		padding: 18px;
		background:
			linear-gradient(145deg, rgba(123, 61, 238, 0.88), rgba(193, 124, 255, 0.84)),
			radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 48%);
	}

	.example-preview--docs span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 54px;
		height: 54px;
		border-radius: 12px;
		font-size: 38px;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: rgba(247, 241, 255, 0.98);
		background: rgba(35, 20, 82, 0.42);
		box-shadow: 0 18px 30px rgba(20, 10, 49, 0.3);
	}

	.example-preview--docs span:first-child {
		transform: rotate(-14deg);
	}

	.example-preview--docs span:last-child {
		transform: rotate(11deg);
	}

	.example-preview--code {
		padding: 12px;
		background:
			linear-gradient(180deg, rgba(10, 21, 54, 0.94), rgba(8, 15, 41, 0.98)),
			radial-gradient(circle at 12% 6%, rgba(84, 123, 255, 0.34), rgba(84, 123, 255, 0) 48%);
	}

	.example-preview--code pre {
		margin: 0;
		height: 100%;
		min-height: 118px;
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 12px;
		line-height: 1.5;
		color: rgba(182, 215, 255, 0.94);
	}

	.example-card[data-preview='image'] {
		gap: 18px;
	}

	.example-card button {
		margin-top: 4px;
		height: 38px;
		padding: 0 14px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		width: fit-content;
		font-size: 13px;
		font-weight: 600;
	}

	.example-card--accent {
		background: #7132f2;
	}

	.example-card--gradient {
		background: linear-gradient(142deg, #c876ff 10%, #7132f2 72%);
	}

	.section-cta {
		margin-top: 36px;
		display: flex;
		justify-content: center;
	}

	.steps-shell {
		display: flex;
		flex-direction: column;
		gap: 26px;
	}

	.steps-shell h2 {
		text-align: center;
	}

	.steps-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}

	.step-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
		padding: 26px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.step-index {
		font-size: 40px;
		line-height: 1;
		font-weight: 600;
		color: rgba(190, 155, 255, 0.9);
		min-width: 1em;
	}

	.step-item p {
		font-size: 17px;
		line-height: 1.45;
	}

	.video-placeholder {
		position: relative;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background:
			linear-gradient(160deg, rgba(113, 50, 242, 0.46), rgba(16, 11, 43, 0.82)),
			radial-gradient(circle at 16% 22%, rgba(255, 255, 255, 0.18), transparent 58%);
		min-height: 520px;
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.play-button {
		width: 76px;
		height: 76px;
		border-radius: 50%;
		background: rgba(12, 8, 32, 0.78);
		border: 2px solid rgba(255, 255, 255, 0.58);
		color: #f6f2ff;
		font-size: 26px;
		line-height: 1;
		padding-left: 4px;
	}

	.models-section .section-head {
		max-width: 980px;
		margin: 0 auto;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.section-head p {
		font-size: 20px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.84);
	}

	.models-grid {
		margin-top: 32px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}

	.model-card {
		padding: 36px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.08);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.model-card--accent,
	.model-card--solid {
		background: linear-gradient(135deg, rgba(113, 50, 242, 0.95), rgba(160, 95, 255, 0.78));
	}

	.model-card h3 {
		font-size: 30px;
		line-height: 1.2;
		font-weight: 500;
		margin: 0;
	}

	.model-card p {
		font-size: 16px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.88);
	}

	.model-card small {
		font-size: 14px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.78);
	}

	.why-grid {
		margin-top: 30px;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
	}

	.why-card {
		min-height: 220px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 10px;
		padding: 30px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.16);
	}

	.why-card h3 {
		font-size: 28px;
		line-height: 1.2;
		font-weight: 500;
	}

	.why-card p {
		font-size: 16px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.82);
	}

	.pricing-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 20px;
		align-items: stretch;
	}

	.pricing-shot,
	.pricing-content {
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.08);
		padding: 28px;
	}

	.pricing-shot {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pricing-shot-frame {
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.16);
		background: rgba(10, 8, 24, 0.7);
	}

	.pricing-shot-frame img {
		width: 100%;
		display: block;
		aspect-ratio: 16 / 10;
		object-fit: cover;
	}

	.pricing-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.pricing-content ul {
		display: grid;
		gap: 10px;
		padding-left: 20px;
	}

	.pricing-content li {
		font-size: 17px;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.88);
	}

	.free-start-card {
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: linear-gradient(150deg, #7132f2 45%, #f6b3e6 170%);
		padding: 42px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
		gap: 22px;
		align-items: start;
	}

	.free-start-card p {
		margin-top: 14px;
		font-size: 19px;
		line-height: 1.45;
		max-width: 720px;
		color: rgba(255, 255, 255, 0.96);
	}

	.free-start-card .btn {
		margin-top: 20px;
		width: fit-content;
	}

	.free-start-limits {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.free-start-limits div {
		border-radius: 10px;
		padding: 12px 14px;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.2);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.free-start-limits strong {
		font-size: 20px;
		line-height: 1;
	}

	.free-start-limits span {
		font-size: 12px;
		line-height: 1;
		text-transform: uppercase;
		opacity: 0.78;
	}

	.free-start-limits p {
		margin: 6px 0 0;
		font-size: 13px;
		line-height: 1.3;
	}

	.faq-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.faq-item {
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(0, 0, 0, 0.22);
		overflow: hidden;
	}

	.faq-item summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		cursor: pointer;
		list-style: none;
		padding: 22px 24px;
		font-size: 18px;
		line-height: 1.4;
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item summary span:last-child {
		font-size: 24px;
		line-height: 1;
		color: rgba(255, 255, 255, 0.7);
		transition: transform 0.2s ease;
	}

	.faq-item[open] summary span:last-child {
		transform: rotate(45deg);
	}

	.faq-item p {
		padding: 0 24px 20px;
		font-size: 15px;
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.78);
	}

	.landing-footer {
		position: relative;
		padding: 64px 0 110px;
		overflow: hidden;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
	}

	.footer-content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.footer-links a {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.82);
	}

	.footer-links a:hover {
		color: #ffffff;
	}

	.footer-meta {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 13px;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.72);
	}

	.footer-wordmark {
		position: absolute;
		left: 50%;
		bottom: -72px;
		transform: translateX(-50%);
		font-size: clamp(148px, 23vw, 360px);
		line-height: 0.82;
		font-weight: 700;
		letter-spacing: -0.045em;
		color: rgba(255, 255, 255, 0.13);
		pointer-events: none;
		user-select: none;
		white-space: nowrap;
	}

	@media (max-width: 1199px) {
		.hero-pill {
			font-size: 18px;
		}

		.hero-stat-card {
			height: 210px;
			padding: 28px;
		}

		.hero-stat-label {
			font-size: 20px;
		}

		.example-card {
			padding: 26px;
		}
	}

	@media (max-width: 1023px) {
		:global(section[id]) {
			scroll-margin-top: 88px;
		}

		.desktop-nav,
		.desktop-actions {
			display: none;
		}

		.mobile-actions,
		.mobile-menu {
			display: flex;
		}

		.hero-section {
			padding-top: 38px;
		}

		.hero-pills {
			grid-template-columns: 1fr;
			max-width: 620px;
		}

		.hero-actions {
			justify-content: center;
		}

		.hero-stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.hero-stats::before {
			top: 22px;
			width: min(1080px, calc(100% + 140px));
			height: 290px;
		}

		.hero-stats::after {
			top: 128px;
			width: min(700px, calc(100% - 14px));
		}

		.examples-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.example-card[data-layout='tall'] {
			grid-row: span 1;
			min-height: 340px;
		}

		.steps-list,
		.pricing-grid,
		.free-start-card {
			grid-template-columns: 1fr;
		}

		.video-placeholder {
			min-height: 360px;
		}

		.models-grid,
		.why-grid,
		.faq-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 767px) {
		:global(section[id]) {
			scroll-margin-top: 78px;
		}

		.landing-container {
			width: min(1180px, calc(100% - 24px));
		}

		.header-inner {
			min-height: 76px;
		}

		.brand-mark {
			width: 34px;
			height: 34px;
		}

		.brand-text {
			font-size: 18px;
		}

		.mobile-cta {
			height: 40px;
			padding-inline: 13px;
			font-size: 12px;
		}

		.menu-toggle {
			width: 36px;
			height: 36px;
		}

		.hero-section,
		.intro-section,
		.examples-section,
		.steps-section,
		.models-section,
		.why-section,
		.pricing-section,
		.free-start-section,
		.faq-section {
			padding-bottom: 68px;
		}

		.hero-inner {
			align-items: stretch;
			text-align: left;
		}

		.hero-inner h1 {
			font-size: clamp(30px, 9vw, 42px);
			max-width: 100%;
		}

		.hero-pills {
			max-width: 100%;
		}

		.hero-pill {
			justify-content: flex-start;
			font-size: 16px;
			padding: 16px;
		}

		.hero-actions {
			display: flex;
			flex-direction: column;
			align-items: stretch;
		}

		.hero-actions .btn {
			width: 100%;
		}

		.hero-stats {
			grid-template-columns: 1fr;
			gap: 12px;
			padding-top: 28px;
		}

		.hero-stats::before {
			top: 12px;
			height: 208px;
			width: calc(100% + 44px);
		}

		.hero-stats::after {
			top: 94px;
			height: 132px;
			width: calc(100% - 22px);
		}

		.hero-stat-card {
			height: auto;
			min-height: 146px;
			padding: 22px;
		}

		.hero-stat-value {
			font-size: 40px;
		}

		.hero-stat-label {
			font-size: 20px;
		}

		.intro-card {
			padding: 32px 20px;
			gap: 16px;
		}

		.intro-card p {
			font-size: 17px;
		}

		.example-category-chip {
			padding: 14px 18px;
			font-size: 15px;
		}

		.examples-grid,
		.models-grid,
		.why-grid,
		.faq-grid,
		.free-start-limits {
			grid-template-columns: 1fr;
		}

		.example-card {
			padding: 20px;
			min-height: 240px;
		}

		.example-card h3,
		.model-card h3,
		.why-card h3 {
			font-size: 24px;
		}

		.step-item {
			padding: 18px;
			gap: 14px;
		}

		.step-item p {
			font-size: 15px;
		}

		.step-index {
			font-size: 27px;
		}

		.video-placeholder {
			min-height: 220px;
		}

		.play-button {
			width: 64px;
			height: 64px;
			font-size: 22px;
		}

		.section-head p,
		.pricing-content li,
		.free-start-card p {
			font-size: 16px;
		}

		.pricing-shot,
		.pricing-content,
		.model-card,
		.why-card,
		.free-start-card {
			padding: 20px;
		}

		.faq-item summary {
			padding: 16px 18px;
			font-size: 16px;
		}

		.faq-item p {
			padding: 0 18px 16px;
		}

		.landing-footer {
			padding: 42px 0 72px;
		}

		.footer-meta {
			font-size: 12px;
		}

		.footer-wordmark {
			bottom: -34px;
			font-size: clamp(92px, 28vw, 190px);
		}
	}
</style>
