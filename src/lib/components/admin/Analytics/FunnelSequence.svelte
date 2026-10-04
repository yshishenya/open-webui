<script lang="ts">
	import { transitionPercent, type FunnelSequence } from '$lib/utils/airis/analyticsReport';
	export let sequence: FunnelSequence | undefined;
	const number = (value: number): string => value.toLocaleString('ru-RU');
	const percent = (value: number | null): string =>
		value === null ? '—' : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
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

<div class="mt-3 space-y-3 text-sm">
	{#if sequence}
		<p class="text-gray-600 dark:text-gray-300">
			Завершённые наблюдения: {number(sequence.mature_visitors)}. Проверенный порядок визит →
			регистрация → ответ → пополнение. Другие пути включены в общий результат.
		</p>
		{#each steps as step}
			<div>
				<p class="flex justify-between gap-3">
					<span>{step.label}</span><strong class="shrink-0 tabular-nums"
						>{number(step.count)}</strong
					>
				</p>
				{#if step.previous !== null}
					<p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
						{percent(transitionPercent(step.count, step.previous))} от предыдущего шага · Следующий шаг
						не наблюдается: {number(step.previous - step.count)}
					</p>
				{/if}
			</div>
		{/each}
		<p>
			Пополнили до первого ответа: <strong>{number(sequence.mature_paid_before_response)}</strong>
		</p>
		<p>
			Пополнили, но ответ не наблюдается: <strong
				>{number(sequence.mature_paid_without_observed_response)}</strong
			>
		</p>
		<p>
			Пополнили с неполным порядком событий: <strong
				>{number(sequence.mature_incomplete_paid)}</strong
			>
		</p>
		<p class="text-gray-600 dark:text-gray-300">
			Отсутствие события не доказывает отсутствие действия.
		</p>
	{:else}
		<p>Последовательность этой группы не загружена.</p>
	{/if}
</div>
