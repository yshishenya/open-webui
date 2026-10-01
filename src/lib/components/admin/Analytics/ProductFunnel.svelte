<script lang="ts">
	import { onMount, getContext } from 'svelte';
	const i18n = getContext<import('svelte/store').Writable<{ t: (key: string) => string }>>('i18n');
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	type Cohort = {
		cohort: string;
		visitors: number;
		registered: number;
		activated: number;
		paid: number;
		repeated: number;
		mature_visitors: number;
		mature_paid: number;
		conversion_percent: number | null;
		median_hours_to_pay: number | null;
	};
	type Report = {
		payment_funnel: { created: number; confirmed: number; conversion_percent: number | null };
		stages: Record<string, number>;
		financial: Record<
			string,
			{
				confirmed_payments: number;
				gross_kopeks: number;
				refund_kopeks: number;
				net_kopeks: number;
			}
		>;
		delivery: Array<{ destination: string; state: string; count: number }>;
		rows: Cohort[];
		coverage: {
			consented_identities: number;
			linked_accounts: number;
			excluded_existing_accounts?: number;
		};
		events: Record<string, number>;
	};
	let report: Report | null = null;
	let windowDays = 30;
	let breakdown = 'week';
	let startDate = '';
	let endDate = '';
	const dateQuery = (): string => {
		const params = new URLSearchParams();
		if (startDate)
			params.set('start', String(Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)));
		if (endDate)
			params.set(
				'end',
				String(Math.floor(new Date(`${endDate}T00:00:00Z`).getTime() / 1000) + 86400)
			);
		return params.toString();
	};
	let loading = false;
	let error = '';
	let generation = 0;
	const load = async (): Promise<void> => {
		const current = ++generation;
		loading = true;
		report = null;
		error = '';
		try {
			const response = await fetch(
				`${WEBUI_API_BASE_URL}/analytics/funnel-report?window_days=${windowDays}&breakdown=${breakdown}&${dateQuery()}`,
				{
					headers: { Authorization: `Bearer ${localStorage.token}` },
					signal: AbortSignal.timeout(15000)
				}
			);
			if (!response.ok) throw new Error('Не удалось загрузить отчёт');
			const result: Report = await response.json();
			if (current === generation) report = result;
		} catch {
			if (current === generation) error = 'Не удалось загрузить отчёт. Повторите попытку.';
		} finally {
			if (current === generation) loading = false;
		}
	};
	onMount(() => {
		void load();
	});
</script>

<section class="space-y-4 p-4">
	<h2 class="text-xl font-semibold">{$i18n.t('From first visit to payment')}</h2>
	<p class="text-sm text-gray-500">
		Только наблюдаемые посетители с согласием на аналитику. Конверсия рассчитана по людям, впервые
		пришедшим в одну неделю, с окном 7 или 30 дней. Для новых групп итог ещё не известен.
	</p>
	<div class="flex flex-wrap gap-3 items-center">
		<label
			>Первый визит с <input
				class="rounded border p-2 bg-transparent"
				type="date"
				bind:value={startDate}
				on:change={load}
			/></label
		>
		<label
			>по <input
				class="rounded border p-2 bg-transparent"
				type="date"
				bind:value={endDate}
				on:change={load}
			/></label
		>
		<label
			>Окно конверсии <select
				class="rounded border p-2 bg-transparent"
				bind:value={windowDays}
				on:change={load}
				><option value={7}>{$i18n.t('7 days')}</option><option value={30}
					>{$i18n.t('30 days')}</option
				></select
			></label
		>
		<label
			>Группировка <select
				class="rounded border p-2 bg-transparent"
				bind:value={breakdown}
				on:change={load}
				><option value="week">{$i18n.t('Week of first visit')}</option><option value="utm_source"
					>{$i18n.t('First source')}</option
				><option value="utm_campaign">{$i18n.t('First campaign')}</option><option value="device"
					>{$i18n.t('Device')}</option
				><option value="signup_method">{$i18n.t('Signup method')}</option></select
			></label
		>
		<button class="rounded border px-3 py-2" on:click={load} disabled={loading}
			>{loading ? 'Загрузка…' : 'Обновить'}</button
		>
	</div>
	{#if error}<p role="alert" class="text-red-600">{error}</p>{/if}
	{#if report}
		<p class="text-sm">
			Посетителей с действующим согласием: {report.coverage.consented_identities}. Связано с
			аккаунтами: {report.coverage.linked_accounts}.
		</p>
		{#if (report.coverage.excluded_existing_accounts ?? 0) > 0}
			<p class="text-sm text-gray-500">
				Из воронки новых посетителей исключено существующих аккаунтов: {report.coverage
					.excluded_existing_accounts}.
			</p>
		{/if}
		<div class="overflow-x-auto">
			<table class="w-full text-sm text-left">
				<thead
					><tr
						>{#each [$i18n.t('Cohort'), $i18n.t('Unique visitors'), $i18n.t('Registrations'), $i18n.t('First response'), $i18n.t('First payment'), $i18n.t('Repeat payment'), $i18n.t('Completed observation window'), $i18n.t('Final conversion'), $i18n.t('Median hours to payment')] as heading}<th
								class="p-2 border-b whitespace-nowrap">{heading}</th
							>{/each}</tr
					></thead
				>
				<tbody
					>{#each report.rows as row}<tr
							><td class="p-2 border-b">{row.cohort}</td><td class="p-2 border-b">{row.visitors}</td
							><td class="p-2 border-b">{row.registered}</td><td class="p-2 border-b"
								>{row.activated}</td
							><td class="p-2 border-b">{row.paid}</td><td class="p-2 border-b">{row.repeated}</td
							><td class="p-2 border-b">{row.mature_visitors}</td><td class="p-2 border-b"
								>{row.conversion_percent === null
									? 'Окно ещё не завершено'
									: `${row.conversion_percent}% (${row.mature_paid}/${row.mature_visitors})`}</td
							><td class="p-2 border-b">{row.median_hours_to_pay ?? '—'}</td></tr
						>{/each}</tbody
				>
			</table>
		</div>
		{#if report.rows.length === 0}<p>
				Данных ещё нет. Отчёт начнёт наполняться после включения новой аналитики.
			</p>{/if}
		<h3 class="font-semibold">{$i18n.t('Payment funnel')}</h3>
		<p>
			Создано платежей: {report.payment_funnel.created}. Подтверждено: {report.payment_funnel
				.confirmed}. Конверсия: {report.payment_funnel.conversion_percent === null
				? '—'
				: `${report.payment_funnel.conversion_percent}%`}.
		</p>
		<p class="text-sm text-gray-500">
			Платежи, созданные в выбранном периоде, и их подтверждение к текущему моменту. Свежие платежи
			могут ещё ожидать оплаты.
		</p>
		<h3 class="font-semibold">{$i18n.t('Confirmed payments and refunds in period')}</h3>
		{#each Object.entries(report.financial) as [currency, totals]}
			<p>
				{currency}: {totals.confirmed_payments} оплат; поступило {(
					totals.gross_kopeks / 100
				).toFixed(2)}; возвращено {(totals.refund_kopeks / 100).toFixed(2)}; чистые поступления {(
					totals.net_kopeks / 100
				).toFixed(2)}.
			</p>
		{/each}
		<p class="text-sm text-gray-500">
			Финансовые суммы охватывают все подтверждённые пополнения, независимо от согласия. Возвраты
			учитываются по дате возврата; они могут относиться к более ранним покупкам.
		</p>
		<details>
			<summary class="cursor-pointer">{$i18n.t('External delivery')}</summary
			>{#each report.delivery as item}<p>{item.destination}: {item.state} — {item.count}</p>{/each}
		</details>
		<details>
			<summary class="cursor-pointer">{$i18n.t('Intermediate events')}</summary>
			<dl class="grid grid-cols-2 gap-2 text-sm mt-2">
				{#each Object.entries(report.events) as [event, count]}<dt>{event}</dt>
					<dd>{count}</dd>{/each}
			</dl>
		</details>
		<p class="text-sm text-gray-500">
			Отказавшиеся от аналитики и заблокированные посещения отсутствуют. До входа устройства нельзя
			надёжно связать. Регистрация определяется сервером; первый ответ — наблюдаемым успешным
			завершением в интерфейсе. Эти числа не заменяют финансовый учёт.
		</p>
	{/if}
</section>
