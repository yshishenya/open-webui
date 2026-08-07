<script lang="ts">
	export let label: string = '';
	export let href: string = '/welcome';
	export let homeLabel: string = 'Главная';
	export let parentLabel: string = '';
	export let parentHref: string = '/documents';
</script>

<nav class="airis-public-breadcrumb" aria-label="Навигация по странице">
	<a {href}>{homeLabel}</a>
	<span aria-hidden="true">/</span>
	{#if parentLabel}
		<a href={parentHref}>{parentLabel}</a>
		<span aria-hidden="true">/</span>
	{/if}
	<span aria-current="page">{label}</span>
</nav>
