<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		defaultReportDates,
		getFunnelReport,
		reportDateRange,
		transitionPercent,
		type FunnelReport
	} from '$lib/utils/airis/analyticsReport';
	export let overview = false;
	const initial = defaultReportDates();
	let fromDate = $page.url.searchParams.get('from') || initial.from;
	let toDate = $page.url.searchParams.get('to') || initial.to;
	let windowDays = $page.url.searchParams.get('window_days') === '7' ? 7 : 30;
	let breakdown = $page.url.searchParams.get('breakdown') || 'utm_source';
	const groups = [
		{ value: 'utm_source', label: 'Источник' },
		{ value: 'utm_campaign', label: 'Кампания' },
		{ value: 'week', label: 'Неделя первого визита' },
		{ value: 'device', label: 'Устройство' },
		{ value: 'signup_method', label: 'Способ регистрации' }
	];
	if (!groups.some((group) => group.value === breakdown)) breakdown = 'utm_source';
	let report: FunnelReport | null = null;
	let loading = false;
	let error = '';
	let generation = 0;
	let applied = { from: fromDate, to: toDate, days: windowDays, group: breakdown, updated: '' };
	const number = (value: number): string => value.toLocaleString('ru-RU');
	const percent = (value: number | null): string =>
		value === null ? '—' : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
	const money = (value: number, currency: string): string =>
		new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(value / 100);
	const date = (value: number): string =>
		new Date(value * 1000).toLocaleString('ru-RU', {
			timeZone: 'UTC',
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	const link = (path: string): string =>
		`${path}?${new URLSearchParams({ from: applied.from, to: applied.to, window_days: String(applied.days) })}`;
	const load = async (persist = true): Promise<void> => {
		const current = ++generation;
		error = '';
		let range: { start: number; end: number };
		try {
			range = reportDateRange(fromDate, toDate);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Проверьте даты';
			loading = false;
			report = null;
			return;
		}
		const selected = {
			from: fromDate,
			to: toDate,
			days: windowDays,
			group: breakdown,
			updated: ''
		};
		loading = true;
		report = null;
		try {
			const result = await getFunnelReport(localStorage.token, {
				...range,
				window_days: selected.days,
				breakdown: selected.group
			});
			if (current !== generation) return;
			report = result;
			applied = {
				...selected,
				updated: new Date().toLocaleTimeString('ru-RU', {
					timeZone: 'UTC',
					hour: '2-digit',
					minute: '2-digit'
				})
			};
			if (persist) {
				const params = new URLSearchParams($page.url.searchParams);
				params.set('from', selected.from);
				params.set('to', selected.to);
				params.set('window_days', String(selected.days));
				params.set('breakdown', selected.group);
				await goto(`${$page.url.pathname}?${params}`, {
					replaceState: true,
					noScroll: true,
					keepFocus: true
				});
			}
		} catch (cause) {
			if (current === generation)
				error = cause instanceof Error ? cause.message : 'Не удалось загрузить отчёт';
		} finally {
			if (current === generation) loading = false;
		}
	};
	onDestroy(() => {
		++generation;
	});
	onMount(() => {
		void load(false);
	});
	$: sequence = report?.sequence;
	$: steps = sequence
		? [
				{ label: 'Первый визит', count: sequence.mature_visitors, previous: null },
				{
					label: 'Регистрация после визита',
					count: sequence.mature_registered,
					previous: sequence.mature_visitors
				},
				{
					label: 'Первый ответ после регистрации',
					count: sequence.mature_responded,
					previous: sequence.mature_registered
				},
				{
					label: 'Первое пополнение после ответа',
					count: sequence.mature_paid_after_response,
					previous: sequence.mature_responded
				}
			]
		: [];
</script>

<section
	class="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"
	data-testid={overview ? 'product-overview' : 'product-funnel'}
>
	<div>
		<h1 class="text-2xl font-semibold">
			{overview ? 'Обзор продукта' : 'От первого визита до оплаты'}
		</h1>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
			{overview
				? 'Новые посетители, их путь к оплате и деньги за выбранные даты.'
				: 'Кто дошёл до первого пополнения и какими путями.'}
		</p>
	</div>
	<form class="flex flex-wrap items-end gap-3" on:submit|preventDefault={() => load()}>
		<label class="flex flex-col gap-1 text-sm"
			>Первые визиты с<input
				class="min-h-11 rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
				type="date"
				bind:value={fromDate}
				required
			/></label
		>
		<label class="flex flex-col gap-1 text-sm"
			>по<input
				class="min-h-11 rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
				type="date"
				bind:value={toDate}
				required
			/></label
		>
		<label class="flex flex-col gap-1 text-sm"
			>Время на первую оплату<select
				class="min-h-11 rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
				bind:value={windowDays}
				><option value={7}>7 дней</option><option value={30}>30 дней</option></select
			></label
		>
		{#if !overview}<label class="flex flex-col gap-1 text-sm"
				>Сравнить по<select
					class="min-h-11 rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
					bind:value={breakdown}
					>{#each groups as group}<option value={group.value}>{group.label}</option>{/each}</select
				></label
			>{/if}
		<button
			class="min-h-11 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
			disabled={loading}>Применить</button
		>
	</form>
	{#if error}<div
			role="alert"
			class="rounded-lg border border-red-300 p-3 text-sm text-red-700 dark:text-red-300"
		>
			{error}
		</div>{/if}
	{#if loading}<p role="status" class="text-sm text-gray-600 dark:text-gray-300">
			Загружаем отчёт…
		</p>{/if}
	{#if report}
		<p class="text-sm text-gray-600 dark:text-gray-300">
			Первые визиты: {applied.from} — {applied.to} · На оплату: {applied.days} дней · Даты UTC · Обновлено
			{applied.updated} UTC
		</p>
		<div
			class="grid grid-cols-2 gap-3 lg:grid-cols-4"
			aria-label="Достижения новых посетителей к текущему моменту"
		>
			{#each [{ label: 'Впервые пришли', value: report.summary.visitors }, { label: 'Зарегистрировались', value: report.summary.registered }, { label: 'Получили первый ответ', value: report.summary.activated }, { label: 'Впервые пополнили', value: report.summary.paid }] as item}
				<div class="min-w-0 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
					<p class="text-sm text-gray-600 dark:text-gray-300">{item.label}</p>
					<p class="mt-2 break-words text-2xl font-semibold tabular-nums">{number(item.value)}</p>
				</div>
			{/each}
		</div>
		<div
			class="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900"
			aria-live="polite"
		>
			<div>
				<h2 class="font-medium">Первая оплата за {applied.days} дней</h2>
				<p class="mt-1 text-xl font-semibold tabular-nums">
					{report.summary.conversion_percent === null
						? report.summary.visitors > 0
							? 'Наблюдение продолжается'
							: 'Нет новых наблюдаемых посетителей'
						: `${percent(report.summary.conversion_percent)} · ${number(report.summary.mature_paid)} из ${number(report.summary.mature_visitors)}`}
				</p>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
					Все пути к оплате. Итог только по завершённым наблюдениям.
				</p>
			</div>
			{#if report.summary.immature_visitors > 0}<div>
					<p class="font-medium">Ещё наблюдаем: {number(report.summary.immature_visitors)}</p>
					{#if report.summary.next_maturity_at}<p
							class="mt-1 text-sm text-gray-600 dark:text-gray-300"
						>
							Ближайший срок: {date(report.summary.next_maturity_at)} UTC
						</p>{/if}
				</div>{/if}
		</div>
		{#if report.summary.visitors === 0}<p class="text-sm">
				За эти даты новых наблюдаемых посетителей нет.
			</p>{/if}
		<div class="space-y-6">
			{#if !overview}<section class="space-y-4">
					<h2 class="text-lg font-medium">Путь через первый ответ</h2>
					<p class="text-sm text-gray-600 dark:text-gray-300">
						Завершённые наблюдения; порядок событий проверен.
					</p>
					{#each steps as step}
						<div>
							<div class="flex justify-between gap-3 text-sm">
								<span>{step.label}</span><strong class="shrink-0 tabular-nums"
									>{number(step.count)}</strong
								>
							</div>
							<progress
								class="mt-2 h-2 w-full"
								max={Math.max(sequence?.mature_visitors ?? 0, 1)}
								value={step.count}
								aria-label={step.label}
							></progress>{#if step.previous !== null}<p
									class="mt-1 text-xs text-gray-600 dark:text-gray-300"
								>
									{percent(transitionPercent(step.count, step.previous))} от предыдущего шага
								</p>{/if}
						</div>
					{/each}
					{#if sequence}<div
							class="space-y-1 border-t border-gray-200 pt-3 text-sm dark:border-gray-800"
						>
							<p>
								Пополнили до первого ответа: <strong
									>{number(sequence.mature_paid_before_response)}</strong
								>
							</p>
							<p>
								Пополнили, но ответ не наблюдается: <strong
									>{number(sequence.mature_paid_without_observed_response)}</strong
								>
							</p>
							{#if sequence.mature_incomplete_paid > 0}<p>
									Оплатили с неполным порядком событий: <strong
										>{number(sequence.mature_incomplete_paid)}</strong
									>
								</p>{/if}
							<p class="text-gray-600 dark:text-gray-300">Эти оплаты включены в общий результат.</p>
						</div>{/if}
				</section>{:else}<a
					class="min-h-11 inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
					href={link('/admin/analytics/funnel')}>Посмотреть источники и воронку</a
				>{/if}
			{#if overview}<section class="space-y-3">
					<h2 class="text-lg font-medium">Деньги за календарные даты</h2>
					<p class="text-sm text-gray-600 dark:text-gray-300">
						{applied.from} — {applied.to}. Все клиенты, включая прежних.
					</p>
					{#each Object.entries(report.financial) as [currency, totals]}<div
							class="space-y-3 text-sm"
						>
							<div class="flex justify-between gap-3">
								<span>Подтверждено пополнений</span><strong class="shrink-0 tabular-nums"
									>{money(totals.gross_kopeks, currency)}</strong
								>
							</div>
							<div class="flex justify-between gap-3">
								<span>Возвращено клиентам</span><strong class="shrink-0 tabular-nums"
									>{money(totals.refund_kopeks, currency)}</strong
								>
							</div>
							<div class="flex justify-between gap-3">
								<span>За вычетом возвратов</span><strong class="shrink-0 tabular-nums"
									>{money(totals.net_kopeks, currency)}</strong
								>
							</div>
						</div>{:else}<p class="text-sm">
							За эти даты подтверждённых пополнений и возвратов нет.
						</p>{/each}
					<p class="text-sm text-gray-600 dark:text-gray-300">
						Разность не учитывает комиссии и расходы компании.
					</p>
					<a
						class="inline-block rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
						href={link('/admin/billing')}>Посмотреть деньги и проверить оплаты</a
					>
				</section>{/if}
		</div>
		{#if !overview}<section>
				<h2 class="mb-3 text-lg font-medium">
					{groups.find((group) => group.value === applied.group)?.label || 'Группы посетителей'}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each report.rows as row}<article
							class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
						>
							<h3 class="break-words font-medium">
								{row.cohort === 'unknown' || !row.cohort ? 'Не определён' : row.cohort}
							</h3>
							<dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
								<dt>Пришли</dt>
								<dd class="text-right tabular-nums">{number(row.visitors)}</dd>
								<dt>Регистрация</dt>
								<dd class="text-right tabular-nums">{number(row.registered)}</dd>
								<dt>Первый ответ</dt>
								<dd class="text-right tabular-nums">{number(row.activated)}</dd>
								<dt>Первое пополнение</dt>
								<dd class="text-right tabular-nums">{number(row.paid)}</dd>
							</dl>
							<p class="mt-3 text-sm font-medium">
								{row.conversion_percent === null
									? 'Наблюдение продолжается'
									: `${percent(row.conversion_percent)} · ${number(row.mature_paid)} из ${number(row.mature_visitors)}`}
							</p>
							{#if row.immature_visitors > 0}<p
									class="mt-1 text-xs text-gray-600 dark:text-gray-300"
								>
									Ещё наблюдаем: {number(row.immature_visitors)}
								</p>{/if}{#if row.mature_visitors > 0 && row.mature_visitors < 20}<p
									class="mt-1 text-xs text-gray-600 dark:text-gray-300"
								>
									Мало наблюдений
								</p>{/if}
							<details class="mt-3 text-sm">
								<summary class="cursor-pointer">Повторная оплата и время</summary>
								<p class="mt-2">Повторно пополнили: {number(row.repeated)}</p>
								<p>
									Половина оплативших пополнила в течение: {row.median_hours_to_pay === null
										? '—'
										: `${row.median_hours_to_pay} ч`}
								</p>
							</details>
						</article>{/each}
				</div>
			</section>{/if}
		<details class="border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
			<summary class="cursor-pointer font-medium">Как считаем и что не видно</summary>
			<div class="mt-3 space-y-2 text-gray-600 dark:text-gray-300">
				<p>
					Показываем наблюдаемых новых посетителей с разрешённой аналитикой. Отказавшиеся и
					заблокированные посещения не видны; до входа устройства могут учитываться отдельно.
				</p>
				<p>
					Регистрация подтверждается сервером; первый ответ — наблюдаемое завершение ответа в
					интерфейсе. Существующие аккаунты исключены из новых посетителей. Счётчики достижений
					сверху могут включать ещё незавершённые наблюдения; итоговый процент и последовательный
					путь — только завершённые.
				</p>
				<p>
					Пополнения всех клиентов считаются по времени зачисления в Airis. Возвраты — по времени
					создания у YooKassa после подтверждения; их отражение в кошельке проверяется отдельно.
				</p>
				<p>
					Оплата может случиться после последней даты первого визита — в пределах выбранных {applied.days}
					дней. Источник «Не определён» не означает прямой переход.
				</p>
				<details>
					<summary class="cursor-pointer">Качество данных за всё время</summary>
					<p class="mt-2">
						Посетителей и устройств с разрешённой аналитикой сейчас: {number(
							report.coverage.consented_identities
						)}; связано с аккаунтами: {number(report.coverage.linked_accounts)}; исключено прежних
						аккаунтов: {number(report.coverage.excluded_existing_accounts ?? 0)}.
					</p>
					<h3 class="mt-3 font-medium">Отправка во внешнюю аналитику</h3>
					{#each report.delivery as item}<p>
							{item.destination}: {item.state} — {number(item.count)}
						</p>{/each}
					<h3 class="mt-3 font-medium">Промежуточные события</h3>
					{#each Object.entries(report.events) as [event, count]}<p>
							{event}: {number(count)}
						</p>{/each}<a
						href="https://metrika.yandex.ru/overview?id=111392024"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-block mt-3 underline">Яндекс Метрика</a
					>
					·
					<a
						href="https://analytics.2brain.pro/project/2/dashboard/3"
						target="_blank"
						rel="noopener noreferrer"
						class="underline">PostHog</a
					>
				</details>
				<details>
					<summary class="cursor-pointer">Попытки оплаты за выбранные даты</summary>
					<p class="mt-2">
						Создано: {number(report.payment_funnel.created)}; подтверждено к текущему моменту: {number(
							report.payment_funnel.confirmed
						)}; доля: {percent(report.payment_funnel.conversion_percent)}.
					</p>
					<p>Это попытки, а не люди. Незавершённые оплаты ещё могут быть подтверждены.</p>
				</details>
			</div>
		</details>
	{/if}
</section>
