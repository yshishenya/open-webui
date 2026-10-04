<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { afterNavigate, goto } from '$app/navigation';
	import FunnelSequence from './FunnelSequence.svelte';
	import FunnelMethodology from './FunnelMethodology.svelte';
	import {
		cohortLabel,
		cohortWeekDates,
		defaultReportDates,
		getFunnelReport,
		reportDateRange,
		reportPresetDates,
		type FunnelReport
	} from '$lib/utils/airis/analyticsReport';
	export let overview = false;
	const groups = [
		{ value: 'week', label: 'По неделям первого визита' },
		{ value: 'utm_source', label: 'По источникам' },
		{ value: 'utm_campaign', label: 'По кампаниям' },
		{ value: 'device', label: 'По устройствам' },
		{ value: 'signup_method', label: 'По способу регистрации' }
	];
	type Filters = { from: string; to: string; days: number; group: string };
	const readFilters = (url: URL): Filters => {
		const initial = defaultReportDates();
		const group = url.searchParams.get('breakdown') || 'week';
		return {
			from: url.searchParams.get('from') || initial.from,
			to: url.searchParams.get('to') || initial.to,
			days: url.searchParams.get('window_days') === '7' ? 7 : 30,
			group: groups.some((item) => item.value === group) ? group : 'week'
		};
	};
	let draft = readFilters($page.url);
	let applied = { ...draft };
	let attempted = { ...draft };
	let report: FunnelReport | null = null;
	let loading = false;
	let error = '';
	let dateError = '';
	let generation = 0;
	let loadedURL = '';
	let preset = 'custom';
	let methodology: HTMLDetailsElement;
	const number = (value: number): string => value.toLocaleString('ru-RU');
	const percent = (value: number | null): string =>
		value === null ? '—' : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
	const date = (value: number): string =>
		new Date(value * 1000).toLocaleString('ru-RU', {
			timeZone: 'UTC',
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	const money = (value: number, currency: string): string =>
		new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(value / 100);
	const setPreset = (): void => {
		if (preset === '7' || preset === '30' || preset === 'month')
			draft = { ...draft, ...reportPresetDates(preset) };
	};
	const load = async (selected: Filters, persist = true): Promise<void> => {
		const current = ++generation;
		loading = false;
		let range: { start: number; end: number };
		dateError = '';
		try {
			range = reportDateRange(selected.from, selected.to);
			if (selected.to > defaultReportDates().to)
				throw new Error('Конечная дата не может быть позже сегодняшней даты UTC');
		} catch (cause) {
			dateError = cause instanceof Error ? cause.message : 'Проверьте даты';
			return;
		}
		attempted = { ...selected };
		loading = true;
		error = '';
		try {
			const result = await getFunnelReport(localStorage.token, {
				...range,
				window_days: selected.days,
				breakdown: selected.group
			});
			if (current !== generation) return;
			report = result;
			applied = { ...selected };
			if (persist) {
				const params = new URLSearchParams($page.url.searchParams);
				params.set('from', selected.from);
				params.set('to', selected.to);
				params.set('window_days', String(selected.days));
				params.set('breakdown', selected.group);
				loadedURL = `${$page.url.pathname}?${params}`;
				await goto(loadedURL, { noScroll: true, keepFocus: true });
			}
		} catch (cause) {
			if (current === generation)
				error = cause instanceof Error ? cause.message : 'Не удалось загрузить отчёт';
		} finally {
			if (current === generation) loading = false;
		}
	};
	const synchronizeURL = (): void => {
		const key = `${$page.url.pathname}?${$page.url.searchParams}`;
		if (key === loadedURL) return;
		loadedURL = key;
		draft = readFilters($page.url);
		preset = 'custom';
		void load({ ...draft }, false);
	};
	// The administrator session can resolve after the initial navigation completed.
	onMount(synchronizeURL);
	afterNavigate(synchronizeURL);
	onDestroy(() => {
		++generation;
	});
	$: dirty =
		draft.from !== applied.from ||
		draft.to !== applied.to ||
		draft.days !== applied.days ||
		draft.group !== applied.group;
	$: failedDeliveries =
		report?.delivery.reduce(
			(count, item) => count + (item.state === 'failed' ? item.count : 0),
			0
		) ?? 0;
	const funnelLink = (): string =>
		`/admin/analytics/funnel?${new URLSearchParams({ from: applied.from, to: applied.to, window_days: String(applied.days), breakdown: applied.group })}`;
	const partialWeek = (cohort: string): boolean => {
		const week = applied.group === 'week' ? cohortWeekDates(cohort) : null;
		return week !== null && (applied.from > week.from || applied.to < week.to);
	};
</script>

<section
	class="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6"
	data-testid={overview ? 'product-overview' : 'product-funnel'}
>
	<header>
		<h1 class="text-2xl font-semibold">
			{overview ? 'Обзор продукта' : 'От первого визита до пополнения баланса'}
		</h1>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
			Только наблюдаемые посетители с согласием на аналитику. <a
				class="underline"
				href="#funnel-methodology"
				on:click={() => {
					if (methodology) methodology.open = true;
				}}>Как считаем</a
			>
		</p>
	</header>
	<form
		class="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
		on:submit|preventDefault={() => load({ ...draft })}
	>
		<h2 class="text-sm font-medium">Период первого зафиксированного визита</h2>
		<div class="flex flex-wrap items-end gap-3">
			<label class="flex min-w-0 flex-col gap-1 text-sm"
				>Период<select bind:value={preset} on:change={setPreset}
					><option value="custom">Выбранные даты</option><option value="7">Последние 7 дней</option
					><option value="30">Последние 30 дней</option><option value="month">Текущий месяц</option
					></select
				></label
			>
			<label class="flex min-w-0 flex-col gap-1 text-sm"
				>Первый визит с<input
					type="date"
					required
					bind:value={draft.from}
					on:input={() => {
						preset = 'custom';
					}}
					aria-invalid={dateError ? 'true' : undefined}
					aria-describedby="funnel-date-help"
				/></label
			>
			<label class="flex min-w-0 flex-col gap-1 text-sm"
				>Первый визит по<input
					type="date"
					required
					bind:value={draft.to}
					on:input={() => {
						preset = 'custom';
					}}
					aria-invalid={dateError ? 'true' : undefined}
					aria-describedby="funnel-date-help"
				/></label
			>
		</div>
		<div class="flex flex-wrap items-end gap-3">
			<label class="flex flex-col gap-1 text-sm"
				>Учитывать действия после визита в течение<select bind:value={draft.days}
					><option value={7}>7 дней</option><option value={30}>30 дней</option></select
				></label
			>
			<button class="primary" disabled={loading}>Применить</button>
			{#if dirty}<p class="py-2 text-sm text-gray-600 dark:text-gray-300">
					Изменения не применены
				</p>{/if}
		</div>
		<p id="funnel-date-help" class="text-sm text-gray-600 dark:text-gray-300">
			Даты UTC, последний день включён. Последующие действия могут произойти после конца выбранного
			периода.
		</p>
		{#if dateError}<p role="alert" class="text-sm text-red-700 dark:text-red-300">
				{dateError}
			</p>{/if}
	</form>
	{#if error}<div
			role="alert"
			class="rounded-lg border border-red-300 p-3 text-sm text-red-700 dark:text-red-300"
		>
			<p>{error}</p>
			{#if report}<p class="mt-1">
					Сохранён предыдущий отчёт. Его даты и время формирования указаны ниже.
				</p>{/if}<button
				class="mt-2 min-h-11 underline"
				disabled={loading}
				on:click={() => load({ ...attempted })}>Повторить</button
			>
		</div>{/if}
	{#if loading}<p role="status" class="text-sm text-gray-600 dark:text-gray-300">
			{report ? 'Обновляем данные. Ниже предыдущий отчёт.' : 'Загружаем отчёт…'}
		</p>{/if}
	{#if report}
		<div aria-busy={loading} class="space-y-6">
			<p class="text-sm text-gray-600 dark:text-gray-300">
				Первые визиты: {applied.from} — {applied.to} · Действия за {applied.days} дней после визита ·
				UTC{#if applied.to === defaultReportDates(new Date(report.generated_at * 1000)).to}
					· Последний день неполный{/if}
			</p>
			<section aria-label="Зафиксированные результаты" class="space-y-3">
				<h2 class="text-lg font-medium">Зафиксированные результаты</h2>
				<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{#each [{ label: 'Посетители', value: report.summary.visitors }, { label: 'Регистрации', value: report.summary.registered }, { label: 'Первый ответ', value: report.summary.activated }, { label: 'Первое пополнение', value: report.summary.paid }] as item}<div
							class="min-w-0 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
						>
							<p class="text-sm text-gray-600 dark:text-gray-300">{item.label}</p>
							<p class="mt-2 text-2xl font-semibold tabular-nums">{number(item.value)}</p>
						</div>{/each}
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Наблюдаемые достижения за {applied.days} дней после визита, включая тех, за кем ещё наблюдаем.
					Это не последовательные переходы.
				</p>
			</section>
			<section
				class="space-y-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-900"
				aria-label="Результат завершённых наблюдений"
			>
				<h2 class="font-medium">Доля впервые пополнивших баланс за {applied.days} дней</h2>
				<p class="text-xl font-semibold tabular-nums">
					{report.summary.conversion_percent === null
						? report.summary.visitors > 0
							? `Результат за ${applied.days} дней пока недоступен`
							: 'Нет новых наблюдаемых посетителей'
						: `${percent(report.summary.conversion_percent)} · ${number(report.summary.mature_paid)} из ${number(report.summary.mature_visitors)}`}
				</p>
				<p class="text-sm">
					Срок наблюдения завершился у {number(report.summary.mature_visitors)} из {number(
						report.summary.visitors
					)} посетителей.
				</p>
				{#if report.summary.immature_visitors > 0}<p class="text-sm">
						Ещё наблюдаем: {number(report.summary.immature_visitors)}
					</p>
					{#if report.summary.next_maturity_at}<p class="text-sm text-gray-600 dark:text-gray-300">
							Ближайшее завершение наблюдения: {date(report.summary.next_maturity_at)} UTC. Это не срок
							готовности всей группы.
						</p>{/if}{/if}
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Итог только по завершённым наблюдениям. Все пути к первому пополнению включены.
				</p>
			</section>
			{#if !overview && report.summary.visitors > 0}
				<section class="space-y-3">
					<div class="flex flex-wrap items-end justify-between gap-3">
						<h2 class="text-lg font-medium">Сравнение групп</h2>
						<label class="flex flex-col gap-1 text-sm"
							>Сравнить по<select bind:value={draft.group}
								>{#each groups as group}<option value={group.value}>{group.label}</option
									>{/each}</select
							></label
						>
					</div>
					{#if draft.group !== applied.group}<div class="flex flex-wrap items-center gap-3 text-sm">
							<p>Новая группировка ещё не применена.</p>
							<button class="secondary" disabled={loading} on:click={() => load({ ...draft })}
								>Применить изменения</button
							>
						</div>{/if}
					<p class="text-sm text-gray-600 dark:text-gray-300">
						Показано: {groups.find((group) => group.value === applied.group)?.label}. На узком
						экране таблицу можно прокрутить вправо.
					</p>
					<!-- Keyboard users must be able to scroll this region. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						class="max-w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800"
						role="region"
						aria-label="Таблица сравнения групп"
						tabindex="0"
					>
						<table class="w-full min-w-[680px] text-sm">
							<caption class="sr-only"
								>Достижения выбранных посетителей и доля пополнивших среди завершивших наблюдение</caption
							><thead class="bg-gray-50 dark:bg-gray-900"
								><tr
									>{#each ['Группа', 'Посетители', 'Регистрации', 'Первый ответ', 'Первое пополнение', `Итог за ${applied.days} дней`] as heading}<th
											scope="col"
											class="p-3 text-left font-medium">{heading}</th
										>{/each}</tr
								></thead
							><tbody>
								{#each report.rows as row}<tr class="border-t border-gray-200 dark:border-gray-800"
										><th scope="row" class="max-w-xs p-3 text-left align-top font-normal"
											><p class="break-words font-medium">
												{cohortLabel(row.cohort, applied.group)}
											</p>
											{#if applied.group === 'week'}<p
													class="mt-1 text-xs text-gray-600 dark:text-gray-300"
												>
													{row.cohort}{#if partialWeek(row.cohort)}
														· Часть недели{/if}
												</p>{/if}
											<details class="mt-2">
												<summary class="min-h-11 cursor-pointer py-2">Подробности</summary>
												<FunnelSequence sequence={row.sequence} />
												{#if row.mature_visitors > 0 && row.mature_visitors < 20}<p class="text-xs">
														Мало наблюдений
													</p>{/if}
												<div class="space-y-2 py-2 text-xs text-gray-600 dark:text-gray-300">
													<p>
														Повторно пополнили: {number(row.repeated)}. В пределах того же срока
														после визита; возможны автоматические пополнения.
													</p>
													<p>
														Медианное время до первого пополнения: {row.median_hours_to_pay === null
															? '—'
															: `${number(row.median_hours_to_pay)} ч`}. Пополнивших: {number(
															row.paid
														)}.
													</p>
													<p>
														Это наблюдаемые события, не доказательство полезности продукта или
														удержания.
													</p>
												</div>
											</details></th
										>{#each [row.visitors, row.registered, row.activated, row.paid] as count}<td
												class="p-3 text-right align-top tabular-nums">{number(count)}</td
											>{/each}<td class="p-3 align-top"
											><p class="font-medium tabular-nums">
												{row.conversion_percent === null
													? 'Пока недоступен'
													: `${percent(row.conversion_percent)} · ${number(row.mature_paid)} из ${number(row.mature_visitors)}`}
											</p>
											<p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
												Завершили наблюдение: {number(row.mature_visitors)} из {number(
													row.visitors
												)}. Ещё наблюдаем: {number(row.immature_visitors)}.
											</p></td
										></tr
									>{/each}
							</tbody>
						</table>
					</div>
				</section>
				<details class="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
					<summary class="min-h-11 cursor-pointer font-medium"
						>Последовательность событий для завершённых наблюдений</summary
					>
					<FunnelSequence sequence={report.sequence} />
				</details>
			{:else if !overview}<p>
					За выбранный период подходящих новых наблюдаемых посетителей не найдено.
				</p>{/if}
			{#if overview}<a class="secondary inline-flex" href={funnelLink()}
					>Посмотреть группы и воронку</a
				>{/if}
			{#if overview && (failedDeliveries > 0 || report.sequence.mature_incomplete_paid > 0)}
				<section class="space-y-2 rounded-xl border border-amber-300 p-4 dark:border-amber-800">
					<h2 class="font-medium">Требует внимания</h2>
					{#if report.sequence.mature_incomplete_paid > 0}<p class="text-sm">
							У пополнивших баланс неполный порядок наблюдаемых событий: {number(
								report.sequence.mature_incomplete_paid
							)}.
							<a class="underline" href={funnelLink()}>Посмотреть пути к пополнению</a>
						</p>{/if}
					{#if failedDeliveries > 0}<p class="text-sm">
							Не удалось отправить событий во внешнюю аналитику: {number(failedDeliveries)} за всё время.
							<a class="underline" href={`${funnelLink()}#data-quality`}>Проверить отправку</a>
						</p>{/if}
				</section>
			{/if}
			<section class="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
				<h2 class="text-lg font-medium">Платежи всех клиентов</h2>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Отдельный отчёт, включая прежних клиентов и посетителей без согласия на аналитику. Период
					выбирается по датам денежных операций, а не первого визита.
				</p>
				{#if overview}<p class="text-sm">
						Зачисления и возвраты за {applied.from} — {applied.to}, UTC:
					</p>
					{#each Object.entries(report.financial) as [currency, totals]}<p class="text-sm">
							Зачислено {money(totals.gross_kopeks, currency)} · Возвращено {money(
								totals.refund_kopeks,
								currency
							)} · После возвратов {money(totals.net_kopeks, currency)}
						</p>{:else}<p class="text-sm">
							За эти даты подтверждённых пополнений и возвратов нет.
						</p>{/each}
					<p class="text-sm text-gray-600 dark:text-gray-300">
						После возвратов — не прибыль: комиссии и расходы не учтены.
					</p>{/if}
				<a class="secondary inline-flex" href="/admin/billing">Открыть платежи и выбрать период</a>
			</section>
			<FunnelMethodology {report} days={applied.days} bind:methodology />
			<footer
				class="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300"
			>
				<p>Данные сформированы {date(report.generated_at)} UTC</p>
				<button class="secondary" disabled={loading} on:click={() => load({ ...applied }, false)}
					>Обновить</button
				>
			</footer>
		</div>
	{/if}
</section>

<style>
	input,
	select,
	.secondary {
		min-height: 44px;
		max-width: 100%;
		border: 1px solid var(--color-gray-300, #d1d5db);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: transparent;
	}
	.primary {
		min-height: 44px;
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		background: #111827;
		color: white;
	}
	button:disabled {
		opacity: 0.5;
	}
	:global(.dark) input,
	:global(.dark) select,
	:global(.dark) .secondary {
		border-color: #374151;
	}
	:global(.dark) .primary {
		background: #f3f4f6;
		color: #111827;
	}
	:global(.dark) select,
	:global(.dark) input {
		color-scheme: dark;
	}
	input:focus-visible,
	select:focus-visible,
	button:focus-visible,
	a:focus-visible,
	summary:focus-visible,
	[tabindex]:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 3px;
	}
</style>
