<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { models } from '$lib/stores';
	import {
		getSummary,
		getModelAnalytics,
		getUserAnalytics,
		getDailyStats,
		getTokenUsage
	} from '$lib/apis/analytics';
	import { getGroups } from '$lib/apis/groups';
	import { defaultReportDates, reportDateRange } from '$lib/utils/airis/analyticsReport';
	import ChartLine from './ChartLine.svelte';
	import AnalyticsModelModal from './AnalyticsModelModal.svelte';

	type ModelStat = {
		model_id: string;
		count: number;
		unique_users: number;
		unique_chats: number;
		name: string;
	};
	type UserStat = {
		user_id: string;
		name?: string;
		email?: string;
		count: number;
		total_tokens: number;
	};
	type ModelSort = 'name' | 'count' | 'unique_users' | 'unique_chats' | 'tokens';
	type UserSort = 'name' | 'count' | 'total_tokens';
	const initial = defaultReportDates();
	let fromDate = $page.url.searchParams.get('from') || initial.from;
	let toDate = $page.url.searchParams.get('to') || initial.to;
	let selectedGroupId = $page.url.searchParams.get('group_id') || '';
	let granularity: 'hourly' | 'daily' =
		$page.url.searchParams.get('granularity') === 'hourly' ? 'hourly' : 'daily';
	let groups: Array<{ id: string; name: string }> = [];
	let groupsError = '';
	let summary = { total_messages: 0, total_chats: 0, total_models: 0, total_users: 0 };
	let modelStats: ModelStat[] = [];
	let userStats: UserStat[] = [];
	let dailyStats: Array<{ date: string; models: Record<string, number> }> = [];
	let tokenStats: Record<string, { total_tokens: number }> = {};
	let totalTokens = 0;
	let loading = false;
	let error = '';
	let generation = 0;
	let applied: {
		from: string;
		to: string;
		start: number | null;
		end: number | null;
		group: string;
		granularity: 'hourly' | 'daily';
	} = { from: fromDate, to: toDate, start: null, end: null, group: '', granularity };
	let selectedModel: { id: string; name: string } | null = null;
	let showModelModal = false;
	let modelOrderBy: ModelSort = 'count';
	let modelDirection = -1;
	let userOrderBy: UserSort = 'count';
	let userDirection = -1;
	const number = (value: number): string => value.toLocaleString('ru-RU');
	const modelName = (id: string): string =>
		modelStats.find((model) => model.model_id === id)?.name || id;
	const modelColumns: Array<{ key: ModelSort; label: string }> = [
		{ key: 'name', label: 'Модель' },
		{ key: 'count', label: 'Ответы' },
		{ key: 'unique_users', label: 'Люди' },
		{ key: 'unique_chats', label: 'Чаты' },
		{ key: 'tokens', label: 'Токены' }
	];
	const userColumns: Array<{ key: UserSort; label: string }> = [
		{ key: 'name', label: 'Пользователь' },
		{ key: 'count', label: 'Ответы' },
		{ key: 'total_tokens', label: 'Токены' }
	];
	const colors = [
		'#3b82f6',
		'#10b981',
		'#f59e0b',
		'#ef4444',
		'#8b5cf6',
		'#ec4899',
		'#06b6d4',
		'#84cc16'
	];
	const sortModels = (key: ModelSort): void => {
		modelDirection = modelOrderBy === key ? -modelDirection : key === 'name' ? 1 : -1;
		modelOrderBy = key;
	};
	const sortUsers = (key: UserSort): void => {
		userDirection = userOrderBy === key ? -userDirection : key === 'name' ? 1 : -1;
		userOrderBy = key;
	};
	const modelValue = (model: ModelStat, key: ModelSort): number =>
		key === 'tokens'
			? (tokenStats[model.model_id]?.total_tokens ?? 0)
			: key === 'name'
				? 0
				: model[key];
	const openModel = (model: ModelStat): void => {
		selectedModel = { id: model.model_id, name: model.name };
		showModelModal = true;
	};
	const load = async (persist = true): Promise<void> => {
		const current = ++generation;
		error = '';
		let range: { start: number; end: number };
		try {
			range = reportDateRange(fromDate, toDate);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Проверьте даты';
			loading = false;
			return;
		}
		const selected = { from: fromDate, to: toDate, ...range, group: selectedGroupId, granularity };
		loading = true;
		try {
			const [overview, modelData, userData, daily, tokens] = await Promise.all([
				getSummary(localStorage.token, range.start, range.end, selected.group || null),
				getModelAnalytics(localStorage.token, range.start, range.end, selected.group || null),
				getUserAnalytics(localStorage.token, range.start, range.end, 50, selected.group || null),
				getDailyStats(
					localStorage.token,
					range.start,
					range.end,
					selected.granularity,
					selected.group || null
				),
				getTokenUsage(localStorage.token, range.start, range.end, selected.group || null)
			]);
			if (current !== generation) return;
			if (!overview || !modelData || !userData || !daily || !tokens)
				throw new Error('Не все данные загрузились. Повторите попытку.');
			summary = overview;
			const names = new Map($models.map((model) => [model.id, model.name || model.id]));
			modelStats = modelData.models.map((entry: Omit<ModelStat, 'name'>) => ({
				...entry,
				name: names.get(entry.model_id) || entry.model_id
			}));
			userStats = userData.users;
			dailyStats = daily.data;
			tokenStats = Object.fromEntries(
				tokens.models.map((entry: { model_id: string; total_tokens: number }) => [
					entry.model_id,
					entry
				])
			);
			totalTokens = tokens.total_tokens;
			applied = selected;
			if (persist) {
				const params = new URLSearchParams($page.url.searchParams);
				params.set('from', selected.from);
				params.set('to', selected.to);
				params.set('granularity', selected.granularity);
				if (selected.group) params.set('group_id', selected.group);
				else params.delete('group_id');
				await goto(`${$page.url.pathname}?${params}`, {
					replaceState: true,
					noScroll: true,
					keepFocus: true
				});
			}
		} catch {
			if (current === generation) error = 'Не удалось загрузить отчёт. Повторите попытку.';
		} finally {
			if (current === generation) loading = false;
		}
	};
	onDestroy(() => {
		++generation;
	});
	onMount(() => {
		void load(false);
		void getGroups(localStorage.token)
			.then((result) => {
				groups = result || [];
			})
			.catch(() => {
				groupsError = 'Список групп не загрузился. Отчёт сохраняет выбранную группу.';
			});
	});
	$: sortedModels = [...modelStats].sort(
		(a, b) =>
			modelDirection *
			(modelOrderBy === 'name'
				? a.name.localeCompare(b.name)
				: modelValue(a, modelOrderBy) - modelValue(b, modelOrderBy))
	);
	$: sortedUsers = [...userStats].sort(
		(a, b) =>
			userDirection *
			(userOrderBy === 'name'
				? (a.name || a.user_id).localeCompare(b.name || b.user_id)
				: a[userOrderBy] - b[userOrderBy])
	);
	$: topModels = [...modelStats]
		.sort((a, b) => b.count - a.count)
		.slice(0, 8)
		.map((model) => model.model_id);
</script>

<section class="space-y-5" data-testid="model-usage">
	<div>
		<h1 class="text-2xl font-semibold">Использование моделей</h1>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
			Сохранённые ответы и токены за календарные даты. Расходы в рублях — в разделе «Деньги».
		</p>
	</div>
	<form class="flex flex-wrap items-end gap-3" on:submit|preventDefault={() => load()}>
		<label class="flex flex-col gap-1 text-sm"
			>Ответы с<input
				type="date"
				bind:value={fromDate}
				required
				class="min-h-11 rounded-lg border bg-transparent px-3 dark:border-gray-700"
			/></label
		>
		<label class="flex flex-col gap-1 text-sm"
			>по<input
				type="date"
				bind:value={toDate}
				required
				class="min-h-11 rounded-lg border bg-transparent px-3 dark:border-gray-700"
			/></label
		>
		<label class="flex flex-col gap-1 text-sm"
			>Группа<select
				bind:value={selectedGroupId}
				class="min-h-11 rounded-lg border bg-transparent px-3 dark:border-gray-700"
				><option value="">Все пользователи</option
				>{#if selectedGroupId && !groups.some((group) => group.id === selectedGroupId)}<option
						value={selectedGroupId}>Выбранная группа</option
					>{/if}{#each groups as group}<option value={group.id}>{group.name}</option>{/each}</select
			></label
		>
		<label class="flex flex-col gap-1 text-sm"
			>График<select
				bind:value={granularity}
				class="min-h-11 rounded-lg border bg-transparent px-3 dark:border-gray-700"
				><option value="daily">По дням</option><option value="hourly">По часам</option></select
			></label
		>
		<button
			disabled={loading}
			class="min-h-11 rounded-lg bg-gray-900 px-4 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
			>Применить</button
		>
	</form>
	{#if groupsError}<p role="status" class="text-sm">{groupsError}</p>{/if}
	{#if loading}<p role="status">Загружаем отчёт…</p>
	{:else if error}<div role="alert" class="space-y-2 rounded-lg border border-red-300 p-3 text-sm">
			<p>{error}</p>
			<button class="underline" on:click={() => load()}>Повторить загрузку</button>
		</div>
	{:else}
		<p class="text-sm text-gray-600 dark:text-gray-300">
			{applied.from} — {applied.to} · UTC · {applied.group
				? groups.find((group) => group.id === applied.group)?.name || 'Выбранная группа'
				: 'Все пользователи'}
		</p>
		<div class="grid gap-3 sm:grid-cols-3">
			{#each [{ label: 'Сохранённых ответов', value: summary.total_messages }, { label: 'Людей с ответами', value: summary.total_users }, { label: 'Чатов с ответами', value: summary.total_chats }] as item}<article
					class="min-w-0 rounded-xl border p-3 dark:border-gray-800"
				>
					<h2 class="text-sm text-gray-600 dark:text-gray-300">{item.label}</h2>
					<p class="mt-2 break-words text-2xl font-semibold tabular-nums">{number(item.value)}</p>
				</article>{/each}
		</div>
		{#if dailyStats.length}
			<section class="space-y-3">
				<h2 class="font-medium">
					Сохранённые ответы {applied.granularity === 'hourly' ? 'по часам' : 'по дням'} · UTC
				</h2>
				<ChartLine
					data={dailyStats}
					models={topModels}
					{colors}
					height={200}
					period={applied.granularity === 'hourly' ? 'hour' : 'month'}
				/>
				<div class="flex flex-wrap gap-3 text-xs">
					{#each topModels as id, index}<span
							><span aria-hidden="true" style="color: {colors[index]}">●</span>
							{modelStats.find((model) => model.model_id === id)?.name || id}</span
						>{/each}
				</div>
				<p class="text-xs text-gray-600 dark:text-gray-300">
					На графике до 8 наиболее используемых моделей. Полные значения — ниже.
				</p>
				<details>
					<summary class="cursor-pointer text-sm">Значения графика</summary>
					<div class="mt-3 max-h-72 overflow-auto">
						<table class="w-full text-left text-sm">
							<caption class="sr-only">Сохранённые ответы по датам и моделям</caption>
							<thead
								><tr
									><th scope="col" class="p-2">Дата UTC</th><th scope="col" class="p-2">Модель</th
									><th scope="col" class="p-2">Сохранённые ответы</th></tr
								></thead
							><tbody
								>{#each dailyStats as row}
									{#each Object.entries(row.models).sort( ([a], [b]) => modelName(a).localeCompare(modelName(b)) ) as [model, count]}<tr
										>
											<td class="p-2">{row.date}</td><td class="p-2 break-words"
												>{modelName(model)}</td
											><td class="p-2 tabular-nums">{number(count)}</td>
										</tr>{/each}<tr
										><td class="p-2">{row.date}</td><td class="p-2 tabular-nums">Все модели</td><td
											class="p-2 tabular-nums"
											>{number(
												Object.values(row.models).reduce((sum, count) => sum + count, 0)
											)}</td
										></tr
									>{/each}</tbody
							>
						</table>
					</div>
				</details>
			</section>
		{/if}
		<div class="grid gap-6 xl:grid-cols-2">
			<section>
				<h2 class="mb-3 text-lg font-medium">Модели</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead
							><tr
								>{#each modelColumns as column}<th
										class="p-2"
										aria-sort={modelOrderBy === column.key
											? modelDirection === 1
												? 'ascending'
												: 'descending'
											: 'none'}
										><button
											class="min-h-11 whitespace-nowrap"
											on:click={() => sortModels(column.key)}
											>{column.label}{modelOrderBy === column.key
												? modelDirection === 1
													? ' ↑'
													: ' ↓'
												: ''}</button
										></th
									>{/each}</tr
							></thead
						><tbody
							>{#each sortedModels as model}<tr class="border-t dark:border-gray-800"
									><td class="p-2"
										><button
											class="min-h-11 max-w-52 break-words text-left underline"
											on:click={() => openModel(model)}>{model.name}</button
										></td
									><td class="p-2 tabular-nums">{number(model.count)}</td><td
										class="p-2 tabular-nums">{number(model.unique_users)}</td
									><td class="p-2 tabular-nums">{number(model.unique_chats)}</td><td
										class="p-2 tabular-nums"
										>{number(tokenStats[model.model_id]?.total_tokens ?? 0)}</td
									></tr
								>{:else}<tr><td colspan="5" class="p-3">За выбранные даты ответов нет.</td></tr
								>{/each}</tbody
						>
					</table>
				</div>
			</section>
			<section>
				<h2 class="mb-1 text-lg font-medium">Активные пользователи</h2>
				<p class="mb-3 text-xs text-gray-600 dark:text-gray-300">
					До 50 пользователей с наибольшим числом сохранённых ответов. Сортировка действует внутри
					этого списка.
				</p>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead
							><tr
								>{#each userColumns as column}<th
										class="p-2"
										aria-sort={userOrderBy === column.key
											? userDirection === 1
												? 'ascending'
												: 'descending'
											: 'none'}
										><button class="min-h-11" on:click={() => sortUsers(column.key)}
											>{column.label}{userOrderBy === column.key
												? userDirection === 1
													? ' ↑'
													: ' ↓'
												: ''}</button
										></th
									>{/each}</tr
							></thead
						><tbody
							>{#each sortedUsers as user}<tr class="border-t dark:border-gray-800"
									><td class="p-2"
										><a
											class="inline-flex min-h-11 items-center break-all underline"
											href={`/admin/billing/customers/${encodeURIComponent(user.user_id)}?${new URLSearchParams({ from: applied.from, to: applied.to })}`}
											>{user.name || user.email || user.user_id}</a
										></td
									><td class="p-2 tabular-nums">{number(user.count)}</td><td
										class="p-2 tabular-nums">{number(user.total_tokens)}</td
									></tr
								>{:else}<tr
									><td colspan="3" class="p-3">Нет пользователей с ответами за эти даты.</td></tr
								>{/each}</tbody
						>
					</table>
				</div>
			</section>
		</div>
		<details class="border-t pt-4 text-sm dark:border-gray-800">
			<summary class="cursor-pointer">Токены и методика расчёта</summary>
			<p class="mt-3">Токенов по сохранённым данным: {number(totalTokens)}</p>
			<p class="mt-3 text-gray-600 dark:text-gray-300">
				Считаем сохранённые ответы ассистента с известной моделью, исключая внутренние служебные
				чаты. Эти записи не доказывают успешный запрос или полезность ответа. Токены берём из
				сохранённых данных; они могут отличаться от учёта поставщика. Стоимость поставщиков и
				прибыль здесь не рассчитываются.
			</p>
		</details>
	{/if}
</section>
<AnalyticsModelModal
	bind:show={showModelModal}
	model={selectedModel}
	startDate={applied.start}
	endDate={applied.end}
	groupId={applied.group || null}
/>
