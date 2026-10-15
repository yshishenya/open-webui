<script lang="ts">
	import VirtualList from '@sveltejs/svelte-virtual-list';

	import { getContext, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/airis/error_message';

	import { WEBUI_BASE_URL } from '$lib/constants';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	import emojiGroups from '$lib/emoji-groups.json';
	import emojiShortCodes from '$lib/emoji-shortcodes.json';

	import { settings } from '$lib/stores';
	import { updateUserSettings } from '$lib/apis/users';

	const i18n = getContext('i18n');

	export let onClose = () => {};
	export let onSubmit: (name: string | null) => unknown = () => {};
	export let side = 'top';
	export let align = 'start';
	export let selected: string | null = null;

	const MAX_RECENT = 30;

	let show = false;
	const shortCodes: Record<string, string | string[]> = emojiShortCodes;
	const groups: Record<string, string[]> = emojiGroups;
	type EmojiEntry = { type: 'emoji'; name: string; shortCodes: string[] };
	type EmojiRowItem = EmojiEntry | { type: 'group'; label: string };
	let emojis: Record<string, string | string[]> = shortCodes;
	let search = '';
	let flattenedEmojis: EmojiRowItem[] = [];
	let emojiRows: EmojiRowItem[][] = [];

	let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	let recentEmojiNames: string[] = [];
	let savePending = false;
	let saving = false;
	let destroyed = false;
	let saveToken = '';
	$: recentEmojiNames = ($settings?.recentEmojis ?? [])
		.filter((name) => shortCodes[name])
		.slice(0, MAX_RECENT);

	async function persistRecentEmojis(): Promise<void> {
		if (!savePending || saving) return;
		savePending = false;
		if (saveToken !== localStorage.token) return;
		saving = true;
		try {
			await updateUserSettings(saveToken, { ui: { ...$settings } });
		} catch (error) {
			if (!destroyed) toast.error(getErrorMessage(error));
			else console.warn('Recent emoji preferences could not be saved.');
		} finally {
			saving = false;
			if (savePending) void persistRecentEmojis();
		}
	}

	function saveRecentEmoji(emojiName: string): void {
		if (!shortCodes[emojiName]) return;
		settings.update((current) => ({
			...current,
			recentEmojis: [
				emojiName,
				...new Set(
					(current.recentEmojis ?? []).filter((name) => name !== emojiName && shortCodes[name])
				)
			].slice(0, MAX_RECENT)
		}));
		saveToken = localStorage.token;
		savePending = true;
		if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		saveDebounceTimer = setTimeout(() => {
			saveDebounceTimer = null;
			return persistRecentEmojis();
		}, 1000);
	}

	onDestroy(() => {
		destroyed = true;
		if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		saveDebounceTimer = null;
		// Flush the authorized choice instead of losing it when its caller leaves the screen.
		void persistRecentEmojis();
	});

	function emojiEntry(name: string): EmojiEntry {
		const codes = shortCodes[name];
		return { type: 'emoji', name, shortCodes: typeof codes === 'string' ? [codes] : codes };
	}

	// Reactive statement to filter the emojis based on search query
	$: {
		if (search) {
			const query = search.toLowerCase();
			emojis = Object.fromEntries(
				Object.entries(shortCodes).filter(
					([key, value]) =>
						key.toLowerCase().includes(query) ||
						(Array.isArray(value) ? value : [value]).some((code) => code.includes(query))
				)
			);
		} else {
			emojis = shortCodes;
		}
	}
	// Flatten emoji groups and group them into rows of 8 for virtual scrolling
	$: {
		flattenedEmojis = [];

		// Add "Recently Used" group first (only when not searching)
		if (!search && recentEmojiNames.length > 0) {
			flattenedEmojis.push({ type: 'group', label: $i18n.t('Recently Used') });
			flattenedEmojis.push(...recentEmojiNames.map(emojiEntry));
		}

		Object.keys(groups).forEach((group) => {
			const groupEmojis = groups[group].filter((emoji) => emojis[emoji]);
			if (groupEmojis.length > 0) {
				flattenedEmojis.push({ type: 'group', label: group });
				flattenedEmojis.push(...groupEmojis.map(emojiEntry));
			}
		});
		// Group emojis into rows of 8
		emojiRows = [];
		let currentRow: EmojiEntry[] = [];
		flattenedEmojis.forEach((item) => {
			if (item.type === 'emoji') {
				currentRow.push(item);
				if (currentRow.length === 8) {
					emojiRows.push(currentRow);
					currentRow = [];
				}
			} else if (item.type === 'group') {
				if (currentRow.length > 0) {
					emojiRows.push(currentRow); // Push the remaining row
					currentRow = [];
				}
				emojiRows.push([item]); // Add the group label as a separate row
			}
		});
		if (currentRow.length > 0) {
			emojiRows.push(currentRow); // Push the final row
		}
	}
	// Handle emoji selection
	function selectEmoji(emoji: EmojiEntry): void {
		const selectedCode = emoji.shortCodes[0];
		saveRecentEmoji(emoji.name);
		if (selected === selectedCode) {
			onSubmit(null);
		} else {
			onSubmit(selectedCode);
		}
		search = '';
		show = false;
	}
</script>

<Dropdown
	bind:show
	{align}
	{side}
	onOpenChange={(state) => {
		if (state === false) {
			search = '';
			onClose();
		}
	}}
>
	<slot />

	<div slot="content">
		<div
			class="max-w-full w-72 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-850 rounded-xl z-9999 shadow-lg dark:text-white"
		>
			<div class="mb-0.5 px-3 pt-2 pb-1.5">
				<input
					type="text"
					class="w-full text-[13px] bg-transparent outline-hidden"
					placeholder={$i18n.t('Search all emojis')}
					bind:value={search}
				/>
			</div>

			<!-- Virtualized Emoji List -->
			<div class="w-full flex justify-start h-96 overflow-y-auto px-2.5 pb-2.5 text-[13px]">
				{#if emojiRows.length === 0}
					<div class="text-center text-xs text-gray-500 dark:text-gray-400">
						{$i18n.t('No results')}
					</div>
				{:else}
					<div class="w-full flex ml-0.5">
						<VirtualList items={emojiRows} height="384px" let:item>
							<div class="w-full mb-2.5">
								{#if item.length === 1 && item[0].type === 'group'}
									<!-- Render group header -->
									<div class="text-xs font-normal -mb-1 text-gray-500 dark:text-gray-400">
										{item[0].label}
									</div>
								{:else}
									<!-- Render emojis in a row -->
									<div class="flex items-center gap-1.5 w-full">
										{#each item as emojiItem}
											{#if emojiItem.type === 'emoji'}
												<Tooltip
													content={emojiItem.shortCodes.map((code) => `:${code}:`).join(', ')}
													placement="top"
												>
													<button
														class="p-1 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition {selected ===
														emojiItem.shortCodes[0]
															? 'bg-gray-200 dark:bg-gray-700'
															: ''}"
														on:click={() => selectEmoji(emojiItem)}
													>
														<img
															src="{WEBUI_BASE_URL}/assets/emojis/{emojiItem.name.toLowerCase()}.svg"
															alt={emojiItem.name}
															class="size-5"
															loading="lazy"
														/>
													</button>
												</Tooltip>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						</VirtualList>
					</div>
				{/if}
			</div>
		</div>
	</div>
</Dropdown>
