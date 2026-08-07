<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';
	import { trackEvent } from '$lib/utils/analytics';

	const handleSupportClick = (): void => {
		trackEvent('support_contact_click', { source: 'contact_page' });
	};
</script>

<PublicPageLayout
	title="Контакты"
	description="Свяжитесь с поддержкой Airis по вопросам продукта, оплаты и доступа."
	showHero={false}
>
	<section class="airis-public-simple-hero">
		<div class="container mx-auto px-4 py-16 lg:py-24">
			<div class="max-w-3xl">
				<p class="airis-public-eyebrow">Поддержка Airis</p>
				<h1 class="airis-public-display mt-5">Поможем разобраться</h1>
				<p class="airis-public-lead mt-6">
					Напишите нам, если не получается войти, пополнить баланс или разобраться с возможностями
					модели.
				</p>
				<a
					class="airis-public-btn-primary mt-8 inline-flex min-h-11 items-center justify-center rounded-xl px-6"
					href="mailto:support@airis.you?subject=Вопрос%20в%20Airis"
					on:click={handleSupportClick}>Написать в поддержку</a
				>
				<p class="mt-4 text-sm text-[var(--airis-muted)]">
					support@airis.you · срок ответа зависит от нагрузки
				</p>
			</div>
		</div>
	</section>

	<section class="airis-public-section">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<p class="airis-public-eyebrow">Перед письмом</p>
				<h2 class="airis-public-section-title">Что поможет ответить быстрее</h2>
			</div>
			<div class="mt-10 grid gap-4 md:grid-cols-3">
				<div class="airis-public-card p-6">
					<h3>Оплата</h3>
					<p class="mt-2">Укажите дату платежа и сумму. Не отправляйте данные карты.</p>
				</div>
				<div class="airis-public-card p-6">
					<h3>Доступ</h3>
					<p class="mt-2">Напишите email аккаунта и шаг, на котором возникла проблема.</p>
				</div>
				<div class="airis-public-card p-6">
					<h3>Ошибка</h3>
					<p class="mt-2">Приложите текст ошибки или скриншот без личных данных.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="airis-public-section airis-public-section-muted">
		<div class="container mx-auto px-4">
			<div class="grid gap-4 md:grid-cols-2">
				<a class="airis-public-card p-6 transition hover:-translate-y-0.5" href="/pricing"
					><h3>Вопрос о стоимости?</h3>
					<p class="mt-2">Посмотрите ставки, способы пополнения и расчёт использования.</p>
					<span class="airis-public-text-button mt-5 inline-flex">Открыть тарифы →</span></a
				>
				<a class="airis-public-card p-6 transition hover:-translate-y-0.5" href="/features"
					><h3>Хотите понять возможности?</h3>
					<p class="mt-2">Откройте готовые задачи и запустите пример в настоящем Airis.</p>
					<span class="airis-public-text-button mt-5 inline-flex">Посмотреть возможности →</span></a
				>
			</div>
		</div>
	</section>
</PublicPageLayout>
