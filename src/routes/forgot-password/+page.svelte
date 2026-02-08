<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import { requestPasswordReset } from '$lib/apis/auths/password_reset';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { WEBUI_NAME } from '$lib/stores';

	const i18n = getContext('i18n');

	let email = '';
	let submitting = false;
	let submitted = false;

	onMount(() => {
		const prefill = $page.url.searchParams.get('email');
		if (prefill) {
			email = prefill;
		}
	});

	const close = (): void => {
		void goto('/auth');
	};

	const submit = async (): Promise<void> => {
		if (submitting) return;
		submitting = true;
		try {
			await requestPasswordReset(email);
			submitted = true;
			toast.success($i18n.t('If the email exists, a password reset link has been sent.'));
		} catch (error) {
			toast.error(`${error}`);
		} finally {
			submitting = false;
		}
	};
</script>

<svelte:head>
	<title>
		{`${$WEBUI_NAME}`}
	</title>
</svelte:head>

<div class="w-full min-h-[100dvh] relative font-primary text-white" id="forgot-password-page">
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
							{$i18n.t('Reset your password')}
						</div>
						<div class="mt-2 text-sm text-white/60">
							{$i18n.t('Enter your email and we will send you a reset link.')}
						</div>
					</div>

					{#if submitted}
						<div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
							<div class="font-semibold text-white/90">
								{$i18n.t('Check your email')}
							</div>
							<div class="mt-1">
								{$i18n.t(
									'If the email exists, a password reset link has been sent. It may take a few minutes.'
								)}
							</div>
						</div>

						<a
							href="/auth?form=signin"
							class="mt-6 block w-full min-h-[56px] rounded-full font-semibold text-sm transition bg-white text-black hover:bg-white/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 flex items-center justify-center"
						>
							{$i18n.t('Back to sign in')}
						</a>
					{:else}
						<form
							class="mt-6 space-y-3 text-left"
							on:submit={(e) => {
								e.preventDefault();
								submit();
							}}
						>
							<div>
								<label for="email" class="sr-only">{$i18n.t('Email')}</label>
								<input
									bind:value={email}
									type="email"
									id="email"
									class="w-full min-h-[52px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-white/20"
									autocomplete="email"
									name="email"
									placeholder={$i18n.t('Enter Your Email')}
									required
								/>
							</div>

							<button
								class="mt-2 w-full min-h-[56px] rounded-full font-semibold text-sm transition bg-white text-black hover:bg-white/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
								type="submit"
								disabled={submitting}
							>
								{#if submitting}
									<span class="inline-flex items-center gap-2">
										<Spinner className="size-4" />
										<span>{$i18n.t('Loading…')}</span>
									</span>
								{:else}
									{$i18n.t('Send reset link')}
								{/if}
							</button>
						</form>

						<div class="mt-6 text-center text-xs text-white/50">
							<a href="/auth" class="font-semibold text-white/60 hover:text-white/90 hover:underline transition">
								{$i18n.t('Back to auth')}
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
