<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import {
		defaultReportDates,
		reportDateRange,
		transitionPercent
	} from '$lib/utils/airis/analyticsReport';
	type Rate = { count: number; denominator: number; immature: number };
	type Cohort = {
		date: string;
		registrations: number;
		first_success_24h: Rate;
		first_success_7d: Rate;
		return_7d: Rate;
		paid_users_14d: Rate;
	};
	type Report = {
		cohorts: Cohort[];
		registrations: number;
		generated_at: number;
		exclusions: Record<string, number>;
	};
	const exclusionLabels: Record<string, string> = {
		non_user_role: 'Администраторы и служебные аккаунты',
		explicit_test_account: 'Явно отмеченные тестовые аккаунты',
		before_observation_start: 'Регистрации до начала достоверного наблюдения'
	};
	const metrics = [
		{ key: 'first_success_24h' as const, label: 'Первый успешный запрос за 24 часа' },
		{ key: 'first_success_7d' as const, label: 'Первый успешный запрос за 7 дней' },
		{ key: 'return_7d' as const, label: 'Вернулись в другой день за 7 дней' },
		{ key: 'paid_users_14d' as const, label: 'Пополнили за 14 дней' }
	];
	const initial = defaultReportDates();
	let fromDate = $page.url.searchParams.get('from') || initial.from;
	let toDate = $page.url.searchParams.get('to') || initial.to;
	// Recorded observation boundary from accepted Airis production rollout, not inferred from records.
	const observedFrom = 1790906400;
	let report: Report | null = null;
	let loading = false;
	let error = '';
	let generation = 0;
	let applied = { from: fromDate, to: toDate };
	const textRate = (value: Rate): string =>
		value.denominator
			? `${transitionPercent(value.count, value.denominator)?.toLocaleString('ru-RU')}% · ${value.count} из ${value.denominator}`
			: 'Наблюдение продолжается';
	const total = (key: (typeof metrics)[number]['key']): Rate =>
		(report?.cohorts ?? []).reduce(
			(sum, row) => ({
				count: sum.count + row[key].count,
				denominator: sum.denominator + row[key].denominator,
				immature: sum.immature + row[key].immature
			}),
			{ count: 0, denominator: 0, immature: 0 }
		);
	const load = async (persist = true): Promise<void> => {
		const current = ++generation;
		let range: { start: number; end: number };
		error = '';
		try {
			range = reportDateRange(fromDate, toDate);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Проверьте даты';
			loading = false;
			report = null;
			return;
		}
		const selected = { from: fromDate, to: toDate };
		loading = true;
		report = null;
		try {
			const params = new URLSearchParams({
				start_at: String(range.start),
				end_at: String(range.end),
				observed_from: String(observedFrom),
				timezone: 'UTC'
			});
			const response = await fetch(
				`${WEBUI_API_BASE_URL}/admin/email-deliveries/cohorts?${params}`,
				{
					headers: { Authorization: `Bearer ${localStorage.token}` },
					cache: 'no-store',
					signal: AbortSignal.timeout(25000)
				}
			);
			if (!response.ok)
				throw new Error(
					response.status === 422
						? 'Сократите период: отчёт поддерживает до 366 дней и 10 000 аккаунтов.'
						: 'Не удалось загрузить отчёт. Повторите попытку.'
				);
			const result: Report = await response.json();
			if (current !== generation) return;
			report = result;
			applied = selected;
			if (persist) {
				const params = new URLSearchParams($page.url.searchParams);
				params.set('from', selected.from);
				params.set('to', selected.to);
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
</script>

<section class="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
	<h1 class="text-2xl font-semibold">После регистрации</h1>
	<p class="text-sm text-gray-600 dark:text-gray-300">
		Начали пользоваться, вернулись и оплатили — отдельные результаты новых аккаунтов.
	</p>
	<form class="flex flex-wrap items-end gap-3" on:submit|preventDefault={() => load()}>
		<label class="flex flex-col gap-1 text-sm"
			>Регистрации с<input
				class="min-h-11 rounded-lg border bg-transparent px-3 py-2 dark:border-gray-700"
				type="date"
				bind:value={fromDate}
				required
			/></label
		>
		<label class="flex flex-col gap-1 text-sm"
			>по<input
				class="min-h-11 rounded-lg border bg-transparent px-3 py-2 dark:border-gray-700"
				type="date"
				bind:value={toDate}
				required
			/></label
		>
		<button
			disabled={loading}
			class="min-h-11 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
			>Применить</button
		>
	</form>
	{#if loading}<p role="status">Загружаем отчёт…</p>{/if}
	{#if error}<p role="alert" class="text-sm text-red-700 dark:text-red-300">{error}</p>{/if}
	{#if report}<p class="text-sm text-gray-600 dark:text-gray-300">
			Регистрации: {applied.from} — {applied.to} · Даты UTC · Обновлено {new Date(
				report.generated_at * 1000
			).toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC
		</p>
		<p>Новых аккаунтов в наблюдении: <strong>{report.registrations}</strong></p>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each metrics as metric}{@const value = total(metric.key)}
				<article class="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
					<h2 class="text-sm text-gray-600 dark:text-gray-300">{metric.label}</h2>
					<p class="mt-2 text-lg font-medium tabular-nums">
						{value.denominator
							? textRate(value)
							: report.registrations
								? 'Наблюдение продолжается'
								: 'Нет новых аккаунтов'}
					</p>
					{#if value.immature}<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							Ещё наблюдаем: {value.immature}
						</p>{/if}
				</article>{/each}
		</div>
		<details class="text-sm">
			<summary class="cursor-pointer">По датам регистрации</summary>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				{#each report.cohorts as row}<article
						class="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
					>
						<h3 class="font-medium">{row.date} · {row.registrations} аккаунтов</h3>
						{#each metrics as metric}<p class="mt-2">
								{metric.label}: {textRate(row[metric.key])}
							</p>{/each}
					</article>{/each}
			</div>
		</details>
		<details class="border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
			<summary class="cursor-pointer">Как считаем</summary>
			<div class="mt-3 space-y-2 text-gray-600 dark:text-gray-300">
				<p>
					Достоверное наблюдение принято с 2 октября 2026, 02:00 UTC. Более ранние регистрации
					исключены. Прошлые успешные ответы не восстанавливаются из сохранённых чатов.
				</p>
				<p>
					Отсчёт от регистрации отличается от первого визита в воронке. У каждого показателя свой
					срок; процент учитывает только завершённые наблюдения. Оплата может быть до первого
					успешного запроса.
				</p>
				<p>
					Возвращение — успешный запрос в другой календарный день. Успех не измеряет полезность
					ответа человеку.
				</p>
				{#each Object.entries(report.exclusions) as [reason, count]}<p>
						{exclusionLabels[reason] || reason}: {count}
					</p>{/each}
			</div>
		</details>
	{/if}
</section>
