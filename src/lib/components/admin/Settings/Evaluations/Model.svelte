<script lang="ts">
	import type { ArenaModel } from '$lib/apis/evaluations';
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import ArenaModelModal from './ArenaModelModal.svelte';
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	export let model: ArenaModel;
	export let onSubmit: (model: ArenaModel) => Promise<boolean>;

	let showModel = false;
</script>

<ArenaModelModal
	bind:show={showModel}
	edit={true}
	{model}
	{onSubmit}
	on:delete={async () => {
		dispatch('delete');
	}}
/>

<div class="py-0.5">
	<div class="flex justify-between items-center mb-1">
		<div class="flex flex-col flex-1">
			<div class="flex gap-2.5 items-center">
				<img
					src={`${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model.id}`}
					alt={model.name}
					class="size-8 rounded-full object-cover shrink-0"
				/>

				<div class="w-full flex flex-col">
					<div class="flex items-center gap-1">
						<div class=" line-clamp-1">
							{model.name}
						</div>
					</div>

					<div class="flex items-center gap-1">
						<div class=" text-xs w-full text-gray-500 bg-transparent line-clamp-1">
							{model?.meta?.description ?? model.id}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="flex items-center">
			<button
				class="self-center w-fit text-sm p-1.5 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"
				type="button"
				on:click={() => {
					showModel = true;
				}}
			>
				<Cog6 />
			</button>
		</div>
	</div>
</div>
