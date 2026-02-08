<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import { verifyEmail } from '$lib/apis/auths/email_verification';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { WEBUI_NAME } from '$lib/stores';

	const i18n = getContext('i18n');

	let loading = true;
	let success: boolean | null = null;
	let message: string | null = null;

	onMount(async () => {
		const token = $page.url.searchParams.get('token');
		if (!token) {
			success = false;
			message = $i18n.t('Missing verification token.');
			loading = false;
			return;
		}

		try {
			const res = await verifyEmail(token);
			success = true;
			message = res.message;
			toast.success(res.message);
		} catch (error) {
			success = false;
			message = `${error}`;
			toast.error(`${error}`);
		} finally {
			loading = false;
		}
	});

	const close = (): void => {
		void goto('/auth');
	};
</script>

<svelte:head>
	<title>
		{`${$WEBUI_NAME}`}
	</title>
</svelte:head>

<div class="w-full min-h-[100dvh] relative font-primary text-white" id="verify-email-page">
	<div
		class="absolute inset-0 bg-[radial-gradient(900px_650px_at_10%_-10%,rgba(255,255,255,0.10),transparent),radial-gradient(900px_650px_at_90%_110%,rgba(255,255,255,0.06),transparent),linear-gradient(180deg,#0b0b0c_0%,#000000_70%)]"
	></div>
	<div
		class="absolute inset-0 pointer-events-none opacity-70 bg-[radial-gradient(600px_420px_at_20%_20%,rgba(56,189,248,0.10),transparent),radial-gradient(700px_500px_at_80%_75%,rgba(99,102,241,0.08),transparent)]"
	></div>

	<div class="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 py-10 sm:py-14">
		<div class="w-full max-w-sm">
			<div
				class="relative rounded-[28px] border border-white/10 bg-black/50 backdrop-blur-xl shadow-[0_40px_120px_rgba(0,0,0,0.75)] overflow-hidden"
			>
				<button
					type="button"
					class="absolute right-4 top-4 size-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
					on:click={close}
					aria-label={$i18n.t('Close')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>

				<div class="px-6 pt-12 pb-7 sm:px-7 sm:pt-12 sm:pb-8">
					<div class="flex justify-center mb-5">
						<img
							src="{WEBUI_BASE_URL}/static/favicon.svg"
							class="size-14 rounded-2xl border border-white/10 bg-white/5"
							alt=""
						/>
					</div>

					<div class="text-center">
						<div class="text-2xl font-semibold tracking-tight">
							{$i18n.t('Email verification')}
						</div>
						<div class="mt-2 text-sm text-white/60">
							{$i18n.t('Confirming your email…')}
						</div>
					</div>

					{#if loading}
						<div class="mt-8 flex justify-center text-white/70">
							<Spinner className="size-5" />
						</div>
					{:else}
						<div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
							<div class="font-semibold text-white/90">
								{#if success}
									{$i18n.t('Email verified')}
								{:else}
									{$i18n.t('Verification failed')}
								{/if}
							</div>
							<div class="mt-1">{message}</div>
						</div>

						<a
							href="/auth?form=signin"
							class="mt-6 block w-full min-h-[56px] rounded-full font-semibold text-sm transition bg-white text-black hover:bg-white/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 flex items-center justify-center"
						>
							{$i18n.t('Go to sign in')}
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
