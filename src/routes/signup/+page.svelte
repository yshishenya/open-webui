<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { config } from '$lib/stores';

	let redirectHref = '/auth';
	let signupEnabled = true;

	$: signupEnabled = $config?.features.enable_signup ?? true;

	$: {
		const params = new URLSearchParams($page.url.searchParams);
		if (!signupEnabled) {
			params.delete('form');
			params.delete('mode');
		} else if (!params.has('form')) {
			params.set('form', 'signup');
		}
		redirectHref = `/auth?${params.toString()}`;
	}

	onMount(() => {
		goto(redirectHref);
	});
</script>

<svelte:head>
	<title>AIris</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center font-primary text-gray-600">
	<p>
		Перенаправляем на страницу входа…
		<a href={redirectHref} class="underline underline-offset-4 ml-2 text-gray-900">
			Открыть сейчас
		</a>
	</p>
</div>
