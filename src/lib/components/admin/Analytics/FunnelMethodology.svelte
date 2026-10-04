<script lang="ts">
	import { page } from '$app/stores';
	import type { FunnelReport } from '$lib/utils/airis/analyticsReport';

	export let report: FunnelReport;
	export let days: number;
	export let methodology: HTMLDetailsElement;
	const number = (value: number): string => value.toLocaleString('ru-RU');
</script>

<details
	bind:this={methodology}
	id="funnel-methodology"
	open={$page.url.hash === '#data-quality' || $page.url.hash === '#funnel-methodology'}
	class="border-t border-gray-200 pt-4 text-sm dark:border-gray-800"
>
	<summary class="cursor-pointer py-2 font-medium">Качество данных и ограничения</summary>
	<div class="mt-3 space-y-3 text-gray-600 dark:text-gray-300">
		<p>
			Первый зафиксированный визит может быть не первым реальным. Отказавшиеся от аналитики и
			заблокированные посещения отсутствуют. До входа устройства могут учитываться отдельно.
		</p>
		<p>
			Регистрация подтверждается сервером; первый ответ — наблюдаемое завершение ответа в
			интерфейсе. Отсутствие события не доказывает отсутствие действия. Первый ответ не означает
			полезность продукта.
		</p>
		<p>
			Достижения учитываются в течение {days} дней после визита, даже после конца периода отбора. Итоговая
			доля — только по завершённым наблюдениям. Поздние события и изменение согласия могут изменить отчёт.
		</p>
		<p>
			Первое пополнение — первое успешное пополнение аккаунта, подтверждённое платёжной системой и
			зачислением. Повторное может быть автоматическим.
		</p>
		<h3 class="font-medium">Исключения в выбранном отчёте</h3>
		<p>
			Существующих аккаунтов исключено: {report.coverage.excluded_existing_accounts === undefined
				? 'нет данных'
				: number(report.coverage.excluded_existing_accounts)}.
		</p>
		<details id="data-quality" open={$page.url.hash === '#data-quality'}>
			<summary class="cursor-pointer py-2 font-medium"
				>Покрытие и передача событий за всё время</summary
			>
			<div class="mt-2 space-y-2">
				<p>
					С действующим согласием сейчас: {number(report.coverage.consented_identities)} идентификаторов
					посетителей и устройств. Связано с аккаунтами: {number(report.coverage.linked_accounts)}.
					Это накопленные данные, не выбранный период; процент покрытия всех посетителей неизвестен.
				</p>
				<h4 class="font-medium">Передача событий аналитики</h4>
				{#each report.delivery as item}
					<p>{item.destination}: {item.state} — {number(item.count)}</p>
				{:else}<p>Записей о передаче событий нет.</p>{/each}
				<p>Это передача событий во внешнюю аналитику, не доставка писем.</p>
				<a
					class="underline"
					href="https://metrika.yandex.ru/overview?id=111392024"
					target="_blank"
					rel="noopener noreferrer">Яндекс Метрика</a
				>
				·
				<a
					class="underline"
					href="https://analytics.2brain.pro/project/2/dashboard/3"
					target="_blank"
					rel="noopener noreferrer">PostHog</a
				>
			</div>
		</details>
		<details>
			<summary class="cursor-pointer py-2 font-medium"
				>Попытки оплаты за выбранные календарные даты</summary
			>
			<p class="mt-2">
				Создано: {number(report.payment_funnel.created)}; подтверждено к текущему моменту: {number(
					report.payment_funnel.confirmed
				)}.
			</p>
			<p>Это попытки, а не люди. Незавершённые оплаты ещё могут быть подтверждены.</p>
		</details>
		<details>
			<summary class="cursor-pointer py-2 font-medium"
				>Промежуточные события выбранных посетителей</summary
			>
			<div class="mt-2 space-y-1">
				<p>Число событий, не уникальных посетителей.</p>
				{#each Object.entries(report.events) as [event, count]}
					<p>{event}: {number(count)}</p>
				{:else}<p>Событий нет.</p>{/each}
			</div>
		</details>
	</div>
</details>

<style>
	summary {
		min-height: 44px;
	}
	summary:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 3px;
	}
</style>
