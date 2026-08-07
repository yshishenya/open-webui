<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';
</script>

<PublicPageLayout
	title="О нас"
	description="Airis объединяет доступные AI-модели в одном понятном чате."
	showHero={false}
>
	<section class="airis-public-simple-hero">
		<div
			class="container mx-auto grid items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_0.85fr] lg:py-24"
		>
			<div class="max-w-2xl">
				<p class="airis-public-eyebrow">О Airis</p>
				<h1 class="airis-public-display mt-5">AI-модели в одном понятном чате</h1>
				<p class="airis-public-lead mt-6">
					Мы делаем доступ к современным моделям проще для повседневных задач: без VPN, лишних
					вкладок и отдельных сервисов.
				</p>
				<div class="mt-8 flex flex-col gap-3 sm:flex-row">
					<a
						class="airis-public-btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-6"
						href="/signup?src=about_hero"
					>
						Начать бесплатно
					</a>
					<a
						class="airis-public-btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-6"
						href="/contact"
					>
						Задать вопрос
					</a>
				</div>
			</div>
			<figure class="airis-public-product-shot">
				<img
					src="/landing/airis-chat.png"
					alt="Интерфейс чата Airis"
					width="2640"
					height="1534"
					loading="eager"
				/>
				<figcaption>Настоящий интерфейс Airis</figcaption>
			</figure>
		</div>
	</section>

	<section class="airis-public-section">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<p class="airis-public-eyebrow">Наш подход</p>
				<h2 class="airis-public-section-title">Сначала задача, потом настройки</h2>
				<p class="airis-public-section-lead">
					Вы выбираете модель и пишете запрос. Остальное можно уточнить прямо в диалоге.
				</p>
			</div>
			<div class="mt-10 grid gap-4 md:grid-cols-3">
				<div class="airis-public-card p-6">
					<span class="airis-public-card-tag">01</span>
					<h3 class="mt-5">Один чат</h3>
					<p class="mt-2">Переключайтесь между доступными моделями, не меняя сервис.</p>
				</div>
				<div class="airis-public-card p-6">
					<span class="airis-public-card-tag">02</span>
					<h3 class="mt-5">Без VPN</h3>
					<p class="mt-2">Открывайте Airis напрямую из России.</p>
				</div>
				<div class="airis-public-card p-6">
					<span class="airis-public-card-tag">03</span>
					<h3 class="mt-5">Понятные расходы</h3>
					<p class="mt-2">Пополняйте баланс в рублях и смотрите историю списаний.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="airis-public-section airis-public-section-muted">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<h2 class="airis-public-section-title">Начните с реальной задачи</h2>
				<p class="airis-public-section-lead">
					Регистрация не требует карты. Доступность функций и бесплатных лимитов зависит от текущего
					каталога моделей.
				</p>
				<a class="airis-public-text-button mt-6 inline-flex min-h-11 items-center" href="/features"
					>Посмотреть возможности <span aria-hidden="true">→</span></a
				>
			</div>
		</div>
	</section>
</PublicPageLayout>
