<script lang="ts">
	import Modal from '../common/Modal.svelte';

	import Tags from '../common/Tags.svelte';

	export let tags;
	export let deleteTag: (name: string) => unknown;
	export let addTag: (name: string) => unknown;

	export let show = false;
</script>

<Modal bind:show size="xs">
	<div class="px-4 pt-4 pb-5 w-full flex flex-col justify-center">
		<Tags
			{tags}
			on:delete={(e) => {
				deleteTag(e.detail);
			}}
			on:add={(e) => {
				addTag(e.detail);
			}}
		/>
	</div>
</Modal>
