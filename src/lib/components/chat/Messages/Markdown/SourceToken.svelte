<script lang="ts">
	import { LinkPreview } from 'bits-ui';
	import { decodeString } from '$lib/utils';
	import Source from './Source.svelte';

	export let token;
	export let sourceIds: string[] = [];
	export let onClick: (id: string) => unknown = () => {};

	let openPreview = false;

	// Helper function to return only the domain from a URL
	function getDomain(url: string): string {
		const domain = url.replace('http://', '').replace('https://', '').split(/[/?#]/)[0];

		if (domain.startsWith('www.')) {
			return domain.slice(4);
		}
		return domain;
	}

	// Helper function to check if text is a URL and return the domain
	function formattedTitle(title: string): string {
		if (title.startsWith('http')) {
			return getDomain(title);
		}

		return title;
	}

	const getDisplayTitle = (title: string): string => {
		if (!title) return 'N/A';
		if (title.length > 30) {
			return title.slice(0, 15) + '...' + title.slice(-10);
		}
		return title;
	};
</script>

{#if sourceIds}
	{#if (token?.ids ?? []).length == 1}
		{@const id = token.ids[0]}
		{@const identifier = token.citationIdentifiers?.[0] ?? id}
		<Source id={identifier} title={sourceIds[id - 1] ?? 'N/A'} {onClick} />
	{:else}
		<LinkPreview.Root openDelay={0} bind:open={openPreview}>
			<LinkPreview.Trigger>
				<button
					aria-label={`${getDisplayTitle(formattedTitle(decodeString(sourceIds[token.ids[0] - 1] ?? 'N/A')))} +${(token?.ids ?? []).length - 1} more sources`}
					class="text-[10px] w-fit translate-y-[2px] px-2 py-0.5 dark:bg-white/5 dark:text-white/80 dark:hover:text-white bg-gray-50 text-black/80 hover:text-black transition rounded-xl"
					on:click={() => {
						openPreview = !openPreview;
					}}
				>
					<span class="line-clamp-1">
						{getDisplayTitle(formattedTitle(decodeString(sourceIds[token.ids[0] - 1] ?? 'N/A')))}
						<span class="dark:text-white/50 text-black/50">+{(token?.ids ?? []).length - 1}</span>
					</span>
				</button>
			</LinkPreview.Trigger>
			<LinkPreview.Portal>
				<LinkPreview.Content class="z-[999]" align="start" sideOffset={6}>
					<div class="bg-gray-50 dark:bg-gray-850 rounded-xl p-1 cursor-pointer">
						{#each token.citationIdentifiers ?? token.ids as identifier}
							{@const id =
								typeof identifier === 'string' ? parseInt(identifier.split('#')[0]) : identifier}
							<div class="">
								<Source id={identifier} title={sourceIds[id - 1] ?? 'N/A'} {onClick} />
							</div>
						{/each}
					</div>
				</LinkPreview.Content>
			</LinkPreview.Portal>
		</LinkPreview.Root>
	{/if}
{:else}
	<span>{token.raw}</span>
{/if}
