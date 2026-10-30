<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import type { ContextUsage } from '$lib/utils/airis/frontend-contracts';
	import SlashCommands from './Commands/SlashCommands.svelte';
	import AtCommands from './Commands/AtCommands.svelte';
	import Knowledge from './Commands/Knowledge.svelte';
	import Skills from './Commands/Skills.svelte';
	import Emojis from './Commands/Emojis.svelte';
	import DropdownMenu from '$lib/components/common/DropdownMenu.svelte';

	export let char = '';
	export let query = '';
	export let command: (payload: {
		id: string;
		label: string;
		content?: string;
		type?: string;
	}) => void;

	export let onSelect: (e: unknown) => void = () => {};
	export let onUpload: (e: unknown) => void = () => {};
	export let onCompact: () => void = () => {};
	export let onStatus: () => void = () => {};
	export let onFork: () => void = () => {};
	export let onModel: () => void = () => {};
	export let onCompare: (() => void) | null = null;
	export let onSettings: () => void = () => {};
	export let onTemporary: () => void = () => {};
	export let onCreateSkill: () => void = () => {};
	export let insertTextHandler: (text: string) => void = () => {};
	export let canCompact: boolean | (() => boolean) = false;
	export let compactDisabled: boolean | (() => boolean) = false;
	export let canStatus: boolean | (() => boolean) = false;
	export let canFork: boolean | (() => boolean) = false;
	export let forkDisabled: boolean | (() => boolean) = false;
	export let canTemporary: boolean | (() => boolean) = false;
	export let temporaryEnabled: boolean | (() => boolean) = false;
	export let hasChatContent = false;
	export let canCreateSkill: boolean | (() => boolean) = false;
	export let contextUsage: ContextUsage | null | (() => ContextUsage | null) = null;
	export let fileUploadEnabled: boolean | (() => boolean) = true;

	$: compactAvailable = typeof canCompact === 'function' ? canCompact() : canCompact;
	$: isCompactDisabled =
		typeof compactDisabled === 'function' ? compactDisabled() : compactDisabled;
	$: statusAvailable = typeof canStatus === 'function' ? canStatus() : canStatus;
	$: forkAvailable = typeof canFork === 'function' ? canFork() : canFork;
	$: isForkDisabled = typeof forkDisabled === 'function' ? forkDisabled() : forkDisabled;
	$: temporaryAvailable = typeof canTemporary === 'function' ? canTemporary() : canTemporary;
	$: isTemporaryEnabled =
		typeof temporaryEnabled === 'function' ? temporaryEnabled() : temporaryEnabled;
	$: createSkillAvailable =
		typeof canCreateSkill === 'function' ? canCreateSkill() : canCreateSkill;
	let resolvedContextUsage: ContextUsage | null = null;
	// The editor updates query while keeping the same getter instance.
	$: if (query !== undefined) {
		resolvedContextUsage = typeof contextUsage === 'function' ? contextUsage() : contextUsage;
	}
	$: contextHasThreshold = Number(resolvedContextUsage?.threshold) > 0;
	$: contextPercent = contextHasThreshold
		? Math.max(0, Math.round(resolvedContextUsage?.percent ?? 0))
		: null;
	$: isFileUploadEnabled =
		typeof fileUploadEnabled === 'function' ? fileUploadEnabled() : fileUploadEnabled;

	let suggestionElement: {
		selectUp: () => void;
		selectDown: () => void;
		select: () => void | Promise<void>;
	} | null = null;
	let slashItems: ComponentProps<typeof SlashCommands>['filteredItems'] = [];
    let knowledgeItems: ComponentProps<typeof Knowledge>['filteredItems'] = [];
    let atItems: ComponentProps<typeof AtCommands>['filteredItems'] = [];
    let skillItems: ComponentProps<typeof Skills>['filteredItems'] = [];
    let emojiItems: ComponentProps<typeof Emojis>['filteredItems'] = [];
    $: filteredItems = char === '/' ? slashItems : char === '#' ? knowledgeItems : char === '@' ? atItems : char === '$' ? skillItems : emojiItems;

	const onKeyDown = (event: KeyboardEvent): boolean => {
		if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(event.key)) return false;
		if ((filteredItems ?? []).length === 0) return false;

		if (event.key === 'ArrowUp') {
			suggestionElement?.selectUp();
			const item = document.querySelector(`[data-selected="true"]`);
			item?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
			return true;
		}
		if (event.key === 'ArrowDown') {
			suggestionElement?.selectDown();
			const item = document.querySelector(`[data-selected="true"]`);
			item?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
			return true;
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			suggestionElement?.select();

			if (event.key === 'Enter') {
				event.preventDefault();
			}
			return true;
		}
		if (event.key === 'Escape') {
			return true;
		}
		return false;
	};

	// This method will be called from the suggestion renderer
	export function _onKeyDown(event: KeyboardEvent): boolean {
		return onKeyDown(event);
	}
</script>

<div
	class={(filteredItems ?? []).length > 0 ? '' : 'hidden'}
	id={(filteredItems ?? []).length > 0 ? 'suggestions-container' : undefined}
>
	<DropdownMenu className="w-72 max-w-[calc(100vw-1rem)] overflow-x-hidden font-sans text-xs">
		<div class="max-h-60 overflow-y-auto overflow-x-hidden scrollbar-thin">
			{#if char === '/'}
				<SlashCommands
					bind:this={suggestionElement}
					{query}
					canCompare={onCompare !== null}
					bind:filteredItems={slashItems}
					canCompact={compactAvailable}
					compactDisabled={isCompactDisabled}
					canStatus={statusAvailable}
					canFork={forkAvailable}
					forkDisabled={isForkDisabled}
					canTemporary={temporaryAvailable}
					temporaryEnabled={isTemporaryEnabled}
					contextPercent={contextPercent ?? 0}
					{contextHasThreshold}
					{hasChatContent}
					canCreateSkill={createSkillAvailable}
					onSelect={(e) => {
						const { type, data } = e;

						if (type === 'prompt') {
							command({
								id: data.command,
								label: data.command,
								content: data.content,
								type: 'prompt'
							});
						} else if (type === 'command' && data.id === 'compact') {
							command({ id: data.id, label: data.id });
							onCompact();
						} else if (type === 'command' && data.id === 'status') {
							command({ id: data.id, label: data.id });
							onStatus();
						} else if (type === 'command' && data.id === 'fork') {
							command({ id: data.id, label: data.id });
							onFork();
						} else if (type === 'command' && data.id === 'model') {
							command({ id: data.id, label: data.id });
							onModel();
						} else if (type === 'command' && data.id === 'compare') {
							command({ id: data.id, label: data.id });
							onCompare?.();
						} else if (type === 'command' && data.id === 'settings') {
							command({ id: data.id, label: data.id });
							onSettings();
						} else if (type === 'command' && data.id === 'temporary') {
							command({ id: data.id, label: data.id });
							onTemporary();
						} else if (type === 'command' && data.id === 'skills:create') {
							command({ id: data.id, label: data.id });
							onCreateSkill();
						} else if (type === 'skill') {
							command({
								id: `${data.id}|${data.name}`,
								label: data.name
							});

							onSelect({
								type: 'skill',
								data: data
							});
						}
					}}
				/>
			{:else if char === '#'}
				<Knowledge
					bind:this={suggestionElement}
					{query}
					fileUploadEnabled={isFileUploadEnabled}
					bind:filteredItems={knowledgeItems}
					onSelect={(e) => {
						const { type, data } = e;

						if (type === 'knowledge') {
							insertTextHandler('');

							onUpload({
								type: 'file',
								data: data
							});
						} else if (type === 'web') {
							insertTextHandler('');

							onUpload({
								type: 'web',
								data: data
							});
						}
					}}
				/>
			{:else if char === '@'}
				<AtCommands
					bind:this={suggestionElement}
					{query}
					fileUploadEnabled={isFileUploadEnabled}
					bind:filteredItems={atItems}
					onSelect={(e) => {
						const { type, data } = e;

						if (type === 'model') {
							insertTextHandler('');

							onSelect({
								type: 'model',
								data: data
							});
						} else if (type === 'knowledge') {
							insertTextHandler('');

							onUpload({
								type: 'file',
								data: data
							});
						} else if (type === 'filesystem') {
							insertTextHandler('');

							onUpload({
								type: 'filesystem',
								data: data
							});
						} else if (type === 'web') {
							insertTextHandler('');

							onUpload({
								type: 'web',
								data: data
							});
						}
					}}
				/>
			{:else if char === '$'}
				<Skills
					bind:this={suggestionElement}
					{query}
					bind:filteredItems={skillItems}
					onSelect={(e) => {
						const { type, data } = e;

						if (type === 'skill') {
							command({
								id: `${data.id}|${data.name}`,
								label: data.name
							});

							onSelect({
								type: 'skill',
								data: data
							});
						}
					}}
				/>
			{:else if char === ':'}
				<Emojis
					bind:this={suggestionElement}
					{query}
					bind:filteredItems={emojiItems}
					onSelect={(e) => {
						const { type, data } = e;

						if (type === 'emoji') {
							command({
								id: data.name,
								label: data.shortCodes[0]
							});
						}
					}}
				/>
			{/if}
		</div>
	</DropdownMenu>
</div>
