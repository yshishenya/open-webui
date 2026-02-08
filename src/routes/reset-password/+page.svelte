<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import { resetPassword, validatePasswordResetToken } from '$lib/apis/auths/password_reset';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { WEBUI_NAME } from '$lib/stores';

	const i18n = getContext('i18n');

	let token: string | null = null;
	let maskedEmail: string | null = null;
	let loading = true;
	let invalidMessage: string | null = null;

	let newPassword = '';
	let confirmPassword = '';
	let submitting = false;

	onMount(async () => {
		token = $page.url.searchParams.get('token');
		if (!token) {
			invalidMessage = $i18n.t('Missing password reset token.');
			loading = false;
			return;
		}

		try {
			const res = await validatePasswordResetToken(token);
			maskedEmail = res.email;
		} catch (error) {
			invalidMessage = `${error}`;
		} finally {
			loading = false;
		}
	});

	const close = (): void => {
		void goto('/auth');
	};

	const submit = async (): Promise<void> => {
		if (submitting) return;
		if (!token) return;
		if (invalidMessage) return;

		if (newPassword !== confirmPassword) {
			toast.error($i18n.t('Passwords do not match.'));
			return;
		}

		submitting = true;
		try {
			await resetPassword(token, newPassword);
			toast.success($i18n.t('Password reset successfully.'));
			void goto('/auth?form=signin');
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

<div class="w-full min-h-[100dvh] relative font-primary text-white" id="reset-password-page">
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
							{$i18n.t('Choose a new password')}
						</div>
						{#if maskedEmail}
							<div class="mt-2 text-sm text-white/60">
								{$i18n.t('Resetting password for {{email}}', { email: maskedEmail })}
							</div>
						{:else}
							<div class="mt-2 text-sm text-white/60">
								{$i18n.t('This link may expire. If it does, request a new one.')}
							</div>
						{/if}
					</div>

					{#if loading}
						<div class="mt-8 flex justify-center text-white/70">
							<Spinner className="size-5" />
						</div>
					{:else if invalidMessage}
						<div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
							<div class="font-semibold text-white/90">
								{$i18n.t('This reset link is not valid')}
							</div>
							<div class="mt-1">{invalidMessage}</div>
						</div>

						<a
							href="/forgot-password"
							class="mt-6 block w-full min-h-[56px] rounded-full font-semibold text-sm transition bg-white text-black hover:bg-white/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 flex items-center justify-center"
						>
							{$i18n.t('Request a new reset link')}
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
								<label for="new-password" class="sr-only">{$i18n.t('New Password')}</label>
								<SensitiveInput
									bind:value={newPassword}
									type="password"
									id="new-password"
									outerClassName="w-full min-h-[52px] flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 outline-none focus-within:ring-2 focus-within:ring-white/20 focus-within:border-white/20"
									inputClassName="w-full text-sm bg-transparent outline-none text-white placeholder:text-white/40"
									showButtonClassName="pl-2 pr-0.5 text-white/60 hover:text-white/90 transition focus-visible:outline-none"
									placeholder={$i18n.t('Enter Your Password')}
									autocomplete="new-password"
									name="new-password"
									required
								/>
							</div>

							<div>
								<label for="confirm-password" class="sr-only">{$i18n.t('Confirm Password')}</label>
								<SensitiveInput
									bind:value={confirmPassword}
									type="password"
									id="confirm-password"
									outerClassName="w-full min-h-[52px] flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 outline-none focus-within:ring-2 focus-within:ring-white/20 focus-within:border-white/20"
									inputClassName="w-full text-sm bg-transparent outline-none text-white placeholder:text-white/40"
									showButtonClassName="pl-2 pr-0.5 text-white/60 hover:text-white/90 transition focus-visible:outline-none"
									placeholder={$i18n.t('Confirm Your Password')}
									autocomplete="new-password"
									name="confirm-password"
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
									{$i18n.t('Reset password')}
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
