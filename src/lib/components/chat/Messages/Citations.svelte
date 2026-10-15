<script lang="ts">
	import { getContext } from 'svelte';
	import { groupCitations, type Citation } from '$lib/utils/airis/citations';
	import { embed, showControls, showEmbeds } from '$lib/stores';

	import CitationModal from './Citations/CitationModal.svelte';

	const i18n = getContext('i18n');

	export let id = '';
	export let chatId = '';

	export let sources: unknown[] | null | undefined = [];
	export let readOnly = false;

	let citations: Citation[] = [];
	let showPercentage = false;
	let showRelevance = true;

	let showCitations = false;
	let showCitationModal = false;

	let selectedCitation: Citation | null = null;

	export const showSourceModal = (sourceId: string | number): void => {
		const index = (typeof sourceId === 'string' ? Number(sourceId.split('#')[0]) : sourceId) - 1;
		const citation = Number.isInteger(index) ? citations[index] : undefined;
		if (!citation) return;

		const embedUrl = citation.source.embed_url;
		if (embedUrl) {
			if (readOnly) {
				window.open(embedUrl, '_blank', 'noopener,noreferrer');
			} else {
				showControls.set(true);
				showEmbeds.set(true);
				embed.set({
					url: embedUrl,
					title: citation.source.name || 'Embedded Content',
					source: citation,
					chatId,
					messageId: id,
					sourceId: String(sourceId)
				});
			}
		} else {
			selectedCitation = citation;
			showCitationModal = true;
		}
	};

	function calculateShowRelevance(sources: Citation[]): boolean {
		const distances = sources
			.flatMap((citation) => citation.distances)
			.filter((d): d is number => d !== undefined);
		const inRange = distances.filter((d) => d !== undefined && d >= -1 && d <= 1).length;
		const outOfRange = distances.filter((d) => d !== undefined && (d < -1 || d > 1)).length;

		if (distances.length === 0) {
			return false;
		}

		if (
			(inRange === distances.length - 1 && outOfRange === 1) ||
			(outOfRange === distances.length - 1 && inRange === 1)
		) {
			return false;
		}

		return true;
	}

	function shouldShowPercentage(sources: Citation[]): boolean {
		const distances = sources
			.flatMap((citation) => citation.distances)
			.filter((d): d is number => d !== undefined);
		return distances.every((d) => d !== undefined && d >= -1 && d <= 1);
	}

	$: {
		citations = groupCitations(sources);

		showRelevance = calculateShowRelevance(citations);
		showPercentage = shouldShowPercentage(citations);
	}

	const decodeString = (str: string): string => {
		try {
			return decodeURIComponent(str);
		} catch {
			return str;
		}
	};
</script>

<CitationModal
	bind:show={showCitationModal}
	citation={selectedCitation}
	{showPercentage}
	{showRelevance}
/>

{#if citations.length > 0}
	{@const urlCitations = citations.filter((c) => c?.source?.name?.startsWith('http'))}
	<div class=" py-1 -mx-0.5 w-full flex gap-1 items-center flex-wrap">
		<button
			class="text-xs font-normal text-gray-600 dark:text-gray-300 px-3.5 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center gap-1 border border-gray-50 dark:border-gray-850/30"
			aria-label={citations.length === 1
				? $i18n.t('Toggle 1 source')
				: $i18n.t('Toggle {{COUNT}} sources', { COUNT: citations.length })}
			aria-expanded={showCitations}
			on:click={() => {
				showCitations = !showCitations;
			}}
		>
			{#if urlCitations.length > 0}
				<div class="flex -space-x-1 items-center">
					{#each urlCitations.slice(0, 3) as citation}
						<img
							src="https://www.google.com/s2/favicons?sz=32&domain={citation.source.name}"
							alt="favicon"
							class="size-4 rounded-full shrink-0 border border-white dark:border-gray-850 bg-white dark:bg-gray-900"
							on:error={(e) => {
								if (e.currentTarget instanceof HTMLImageElement)
									e.currentTarget.src = '/favicon.png';
							}}
						/>
					{/each}
					{#if citations.length > 3}
						<div
							class="size-4 rounded-full shrink-0 border border-white dark:border-gray-850 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[8px] font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap tracking-tighter"
							aria-hidden="true"
						>
							+{citations.length - Math.min(urlCitations.length, 3)}
						</div>
					{/if}
				</div>
			{/if}
			<div>
				{#if citations.length === 1}
					{$i18n.t('1 Source')}
				{:else}
					{$i18n.t('{{COUNT}} Sources', {
						COUNT: citations.length
					})}
				{/if}
			</div>
		</button>
	</div>
{/if}

{#if showCitations}
	<div class="py-1.5">
		<div class="text-xs gap-2 flex flex-col">
			{#each citations as citation, idx}
				<button
					id={`source-${id}-${idx + 1}`}
					aria-label={$i18n.t('View source: {{name}}', {
						name: decodeString(citation.source.name)
					})}
					class="no-toggle outline-hidden flex dark:text-gray-300 bg-transparent text-gray-600 rounded-xl gap-1.5 items-center"
					on:click={() => {
						showCitationModal = true;
						selectedCitation = citation;
					}}
				>
					<div class=" font-normal bg-gray-50 dark:bg-gray-850 rounded-md px-1">
						{idx + 1}
					</div>
					<div
						class="flex-1 truncate hover:text-black dark:text-white/60 dark:hover:text-white transition text-left"
					>
						{decodeString(citation.source.name)}
					</div>
				</button>
			{/each}
		</div>
	</div>
{/if}
