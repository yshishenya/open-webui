<script lang="ts">
	// The API supplies UTC calendar buckets, so format their literal date without local conversion.
	const dateLabel = (value: string, year = false): string => {
		const [date, time] = value.split(/[ T]/);
		const [yyyy, mm, dd] = date.split('-');
		return `${dd}.${mm}${year ? `.${yyyy}` : ''}${time ? ` ${time.slice(0, 5)}` : ''}`;
	};

	interface Props {
		data: { date: string; models: Record<string, number> }[];
		models: string[];
		colors: string[];
		height?: number;
		period?: 'hour' | 'week' | 'month' | 'year' | 'all';
		label?: string;
		formatValue?: (value: number) => string;
		showPercent?: boolean;
	}

	let {
		data,
		models,
		colors,
		height = 300,
		period = 'week',
		label = 'Сохранённые ответы по моделям; значения доступны в таблице графика',
		formatValue = (value: number) => value.toLocaleString(),
		showPercent = true
	}: Props = $props();

	let hoveredIdx: number | null = $state(null);
	let mouseX = $state(0);

	let colorMap = $derived(new Map(models.map((n, i) => [n, colors[i % colors.length]])));
	let maxCount = $derived(Math.max(...data.flatMap((d) => Object.values(d.models || {})), 1));

	const pad = { t: 8, r: 0, b: 20, l: 0 };
	const w = 1000;
	let cw = $derived(w - pad.l - pad.r);
	let ch = $derived(height - pad.t - pad.b);

	const getX = (i: number) =>
		data.length <= 1 ? pad.l + cw / 2 : pad.l + (i / (data.length - 1)) * cw;
	const getY = (v: number) => pad.t + ch - (v / maxCount) * ch;

	const path = (m: string) => {
		const pts = data.map((d, i) => `${getX(i)},${getY(d.models?.[m] || 0)}`);
		return pts.length > 1 ? `M${pts.join('L')}` : '';
	};

	const onMove = (e: MouseEvent) => {
		const svg = e.currentTarget as SVGSVGElement;
		const r = svg.getBoundingClientRect();
		mouseX = (e.clientX - r.left) * (w / r.width);
		hoveredIdx = Math.max(
			0,
			Math.min(data.length - 1, Math.round(((mouseX - pad.l) / cw) * (data.length - 1)))
		);
	};

	let hovered = $derived(hoveredIdx !== null ? data[hoveredIdx] : null);
</script>

<div class="relative w-full" style="height:{height}px">
	<svg
		role="img"
		aria-label={label}
		viewBox="0 0 {w} {height - 20}"
		class="absolute inset-x-0 top-0 h-[calc(100%-20px)] w-full"
		preserveAspectRatio="none"
		onmousemove={onMove}
		onmouseleave={() => (hoveredIdx = null)}
	>
		{#each models as m}
			<path
				d={path(m)}
				fill="none"
				stroke={colorMap.get(m)}
				stroke-width="1.5"
				class={hovered && !hovered.models?.[m] ? 'opacity-20' : ''}
			/>
		{/each}
		{#if hoveredIdx !== null}
			<line
				x1={getX(hoveredIdx)}
				y1={pad.t}
				x2={getX(hoveredIdx)}
				y2={ch + pad.t}
				stroke="#ddd"
				stroke-width="1"
			/>
			{#each models as m}
				{@const v = hovered?.models?.[m] || 0}
				{#if v > 0}
					<circle cx={getX(hoveredIdx)} cy={getY(v)} r="3" fill={colorMap.get(m)} />
				{/if}
			{/each}
		{/if}
	</svg>
	<!-- X-axis labels as HTML -->
	{#if data.length > 1}
		{@const labelCount = Math.min(7, data.length)}
		{@const step = labelCount > 1 ? Math.floor((data.length - 1) / (labelCount - 1)) || 1 : 1}
		<div class="absolute inset-x-0 bottom-0 flex justify-between px-0.5 text-[10px] text-gray-400">
			{#each [...Array(labelCount).keys()] as i}
				{@const idx = i === labelCount - 1 ? data.length - 1 : Math.min(i * step, data.length - 1)}
				{#if data[idx]}
					<span class={i === 0 ? 'text-left' : i === labelCount - 1 ? 'text-right' : 'text-center'}
						>{dateLabel(data[idx].date, period === 'year' || period === 'all')}</span
					>
				{/if}
			{/each}
		</div>
	{/if}
	{#if hovered}
		{@const total = Object.values(hovered.models || {}).reduce((a, b) => a + b, 0)}
		<div
			class="pointer-events-none absolute top-1 text-[11px]"
			style="left:{Math.min(Math.max((mouseX / w) * 100, 8), 92)}%"
		>
			<div
				class="min-w-[140px] -translate-x-1/2 rounded border border-gray-100 bg-white px-2.5 py-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
			>
				<div class="mb-1.5 text-[10px] text-gray-400">
					{dateLabel(hovered.date, true)} · UTC
				</div>
				{#each Object.entries(hovered.models || {})
					.sort(([, a], [, b]) => b - a)
					.slice(0, 5) as [n, c]}
					<div class="flex items-center justify-between gap-2 py-0.5">
						<span class="min-w-0 truncate text-gray-600 dark:text-gray-300">{n}</span>
						<span class="shrink-0 text-gray-900 tabular-nums dark:text-white"
							>{formatValue(c)}
							{#if showPercent}<span class="text-gray-400"
									>({total > 0 ? ((c / total) * 100).toFixed(0) : 0}%)</span
								>{/if}</span
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
