<script lang="ts">
	export let checked = false;
	export let disabled = false;
</script>

<label class="flex items-start gap-2 text-xs leading-relaxed">
	<input type="checkbox" bind:checked {disabled} class="mt-0.5 size-4 shrink-0 rounded" />
	<span>
		Хочу получать советы по работе с AIRIS и новости продукта по электронной почте. Это
		необязательно; отписаться можно в любой момент.
		<a
			href="/documents/product-email-consent"
			target="_blank"
			rel="noreferrer"
			class="font-medium underline">Условия согласия</a
		>.
	</span>
</label>
