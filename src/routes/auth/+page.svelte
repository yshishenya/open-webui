<script lang="ts">
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	import { toast } from 'svelte-sonner';

	import { onMount, getContext, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { getBackendConfig } from '$lib/apis';
	import {
		ldapUserSignIn,
		getSessionUser,
		getTelegramAuthState,
		telegramSignIn,
		telegramSignUp,
		userSignIn,
		userSignUp,
		updateUserTimezone
	} from '$lib/apis/auths';

	import { WEBUI_BASE_URL } from '$lib/constants';
	import { WEBUI_NAME, config, user, socket } from '$lib/stores';

	import { generateInitialsImage, getUserTimezone } from '$lib/utils';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import OnBoarding from '$lib/components/OnBoarding.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import TelegramLoginWidget from '$lib/components/auth/TelegramLoginWidget.svelte';
	import VKIDWidget from '$lib/components/auth/VKIDWidget.svelte';
	import { sanitizeRedirectPath } from '$lib/utils/airis/return_to';

	const i18n = getContext('i18n');

	let loaded = false;

	let mode = $config?.features.enable_ldap ? 'ldap' : 'signin';

	let form = null;
	let requestedMode: string | null = null;
	let signupEnabled = true;
	let passwordAuthEnabled = false;

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let legalAccepted = false;

	let ldapUsername = '';
	let panel: 'choice' | 'email' = 'choice';
	let panelAuto = true;
	let submitting = false;
	let telegramLoading = false;
	let telegramMode: 'signin' | 'signup' = 'signin';

	type SocialProvider = 'yandex' | 'vk' | 'github';
	let oauthRedirectingTo: SocialProvider | null = null;

	$: yandexEnabled = Boolean($config?.oauth?.providers?.yandex);
	$: githubEnabled = Boolean($config?.oauth?.providers?.github);
	$: vkEnabled = Boolean($config?.oauth?.providers?.vk);
	$: vkIdEnabled = Boolean($config?.oauth?.providers?.vk?.app_id);
	$: telegramEnabled = Boolean($config?.telegram?.enabled) && Boolean($config?.telegram?.bot_username);
	$: telegramVisible = telegramEnabled && !yandexEnabled && !githubEnabled && !vkEnabled;
	$: hasSocialProviders = yandexEnabled || githubEnabled || vkEnabled || telegramVisible;

	$: signupEnabled = $config?.features.enable_signup ?? true;
	$: passwordAuthEnabled =
		($config?.features.enable_login_form ?? false) ||
		($config?.features.enable_ldap ?? false) ||
		signupEnabled;

	const setSessionUser = async (sessionUser, redirectPath: string | null = null) => {
		if (sessionUser) {
			toast.success($i18n.t(`You're now logged in.`));
			if (sessionUser.token) {
				localStorage.token = sessionUser.token;
			}
			$socket.emit('user-join', { auth: { token: sessionUser.token } });
			await user.set(sessionUser);
			await config.set(await getBackendConfig());

			// Update user timezone
			const timezone = getUserTimezone();
			if (sessionUser.token && timezone) {
				updateUserTimezone(sessionUser.token, timezone);
			}

			const safeRedirect =
				sanitizeRedirectPath(redirectPath ?? $page.url.searchParams.get('redirect')) || '/';
			await goto(safeRedirect);
			localStorage.removeItem('redirectPath');
		}
	};

	const signInHandler = async () => {
		const sessionUser = await userSignIn(email, password).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		await setSessionUser(sessionUser);
	};

	const signUpHandler = async () => {
		if ($config?.features?.enable_signup_password_confirmation) {
			if (password !== confirmPassword) {
				toast.error($i18n.t('Passwords do not match.'));
				return;
			}
		}

		if (!legalAccepted) {
			toast.error($i18n.t('You must accept the terms and privacy policy'));
			return;
		}

		const sessionUser = await userSignUp(
			name,
			email,
			password,
			generateInitialsImage(name),
			legalAccepted
		).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		await setSessionUser(sessionUser);
	};

	const ldapSignInHandler = async () => {
		const sessionUser = await ldapUserSignIn(ldapUsername, password).catch((error) => {
			toast.error(`${error}`);
			return null;
		});
		await setSessionUser(sessionUser);
	};

	const submitHandler = async () => {
		if (submitting) return;
		submitting = true;
		try {
			if (mode === 'ldap') {
				await ldapSignInHandler();
			} else if (mode === 'signin') {
				await signInHandler();
			} else {
				await signUpHandler();
			}
		} finally {
			submitting = false;
		}
	};

	const startSocialLogin = (provider: SocialProvider): void => {
		if (oauthRedirectingTo) return;
		oauthRedirectingTo = provider;

		if (provider === 'yandex') {
			window.location.href = `${WEBUI_BASE_URL}/api/v1/oauth/yandex/login`;
			return;
		}
		if (provider === 'github') {
			window.location.href = `${WEBUI_BASE_URL}/oauth/github/login`;
			return;
		}
		if (provider === 'vk') {
			// VK ID uses the embedded widget. This is the legacy redirect-based flow.
			window.location.href = `${WEBUI_BASE_URL}/api/v1/oauth/vk/login`;
		}
	};

	const telegramAuthHandler = async (payload: Record<string, unknown>) => {
		if (telegramLoading) return;
		if (telegramMode === 'signup' && !legalAccepted) {
			toast.error($i18n.t('You must accept the terms and privacy policy'));
			return;
		}

		telegramLoading = true;
		try {
			const { state } = await getTelegramAuthState();
			const sessionUser =
				telegramMode === 'signup'
					? await telegramSignUp(state, payload, legalAccepted)
					: await telegramSignIn(state, payload);
			await setSessionUser(sessionUser);
		} catch (error) {
			if (error === 'NOT_LINKED') {
				toast.error(
					$i18n.t('Telegram account is not linked. Sign in and link it in Settings.')
				);
			} else if (error === 'SIGNUP_DISABLED') {
				toast.error($i18n.t('Signup is disabled.'));
			} else {
				toast.error(`${error}`);
			}
		} finally {
			telegramLoading = false;
		}
	};

	const closeAuth = (): void => {
		// Make /auth feel like a modal, but avoid navigating into OAuth/provider pages.
		try {
			const referrer = typeof document !== 'undefined' ? document.referrer : '';
			if (typeof window !== 'undefined' && referrer) {
				const refUrl = new URL(referrer);
				const isSameOrigin = refUrl.origin === window.location.origin;
				const refPath = refUrl.pathname;
				const isOauthHop =
					refPath.startsWith('/oauth/') || refPath.startsWith('/api/v1/oauth/');
				const isAuthPath = refPath === '/auth';

				if (isSameOrigin && !isOauthHop && !isAuthPath) {
					void goto(`${refUrl.pathname}${refUrl.search}${refUrl.hash}`);
					return;
				}
			}
		} catch {
			// Fall through to a safe close target.
		}

		void goto('/welcome');
	};

	const oauthCallbackHandler = async () => {
		// Get the value of the 'token' cookie
		function getCookie(name) {
			const match = document.cookie.match(
				new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
			);
			return match ? decodeURIComponent(match[1]) : null;
		}

		const token = getCookie('token');
		if (!token) {
			return;
		}

		const sessionUser = await getSessionUser(token).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (!sessionUser) {
			return;
		}

		localStorage.token = token;
		await setSessionUser(sessionUser, localStorage.getItem('redirectPath') || null);
	};

	let onboarding = false;

	async function setLogoImage() {
		await tick();
		const logo = document.getElementById('logo');

		if (logo) {
			logo.src = `${WEBUI_BASE_URL}/static/favicon.svg`;
			logo.style.filter = '';
		}
	}

	onMount(async () => {
		const redirectPath = sanitizeRedirectPath($page.url.searchParams.get('redirect'));
		if ($user) {
			await goto(redirectPath || '/');
			return;
		}
		if (redirectPath) {
			localStorage.setItem('redirectPath', redirectPath);
		}

		const error = $page.url.searchParams.get('error');
		const message = $page.url.searchParams.get('message');
		if (error) {
			toast.error(message || error);
		}

		await oauthCallbackHandler();
		form = $page.url.searchParams.get('form');
		requestedMode = form ?? $page.url.searchParams.get('mode');
		if (requestedMode === 'signup' && ($config?.features.enable_signup ?? true)) {
			mode = 'signup';
		} else if (requestedMode === 'signin' && $config?.features.enable_login_form) {
			mode = $config?.features.enable_ldap ? 'ldap' : 'signin';
		}

		// Default panel: choice (social + email) unless the caller explicitly asks for a form,
		// or we have no social providers configured.
		const configReady = $config !== undefined;
		const shouldOpenEmailPanel =
			requestedMode === 'signup' ||
			requestedMode === 'signin' ||
			requestedMode === 'ldap' ||
			($config?.onboarding ?? false) ||
			(configReady && !hasSocialProviders);
		panel = shouldOpenEmailPanel ? 'email' : 'choice';

		loaded = true;
		setLogoImage();

		if (($config?.features.auth_trusted_header ?? false) || $config?.features.auth === false) {
			await signInHandler();
		} else {
			onboarding = $config?.onboarding ?? false;
		}
	});

	// Panel auto-selection should respect late-loaded config (common on cold start) but never
	// override an explicit user action.
	$: if (loaded && panelAuto && $config !== undefined) {
		const shouldOpenEmailPanel =
			requestedMode === 'signup' ||
			requestedMode === 'signin' ||
			requestedMode === 'ldap' ||
			($config?.onboarding ?? false) ||
			!hasSocialProviders;
		panel = shouldOpenEmailPanel ? 'email' : 'choice';
	}
</script>

<svelte:head>
	<title>
		{`${$WEBUI_NAME}`}
	</title>
</svelte:head>

<OnBoarding
	bind:show={onboarding}
	getStartedHandler={() => {
		onboarding = false;
		mode = $config?.features.enable_ldap ? 'ldap' : 'signup';
	}}
/>

<div class="w-full min-h-[100dvh] relative font-primary text-white" id="auth-page">
	<!-- Background: OLED dark with subtle soft glow -->
	<div
		class="absolute inset-0 bg-[radial-gradient(900px_650px_at_10%_-10%,rgba(255,255,255,0.10),transparent),radial-gradient(900px_650px_at_90%_110%,rgba(255,255,255,0.06),transparent),linear-gradient(180deg,#0b0b0c_0%,#000000_70%)]"
	></div>
	<div
		class="absolute inset-0 pointer-events-none opacity-70 bg-[radial-gradient(600px_420px_at_20%_20%,rgba(56,189,248,0.10),transparent),radial-gradient(700px_500px_at_80%_75%,rgba(99,102,241,0.08),transparent)]"
	></div>

	<div class="w-full absolute top-0 left-0 right-0 h-8 drag-region"></div>

	{#if loaded}
			<div
				class="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 py-10 sm:py-14"
				id="auth-container"
			>
			<div class="w-full max-w-sm">
				{#if ($config?.features.auth_trusted_header ?? false) || $config?.features.auth === false}
					<div class="py-14">
						<div
							class="flex items-center justify-center gap-3 text-xl text-center font-semibold text-white/90"
						>
							<div>
								{$i18n.t('Signing in to {{WEBUI_NAME}}', { WEBUI_NAME: $WEBUI_NAME })}
							</div>
							<Spinner className="size-5" />
						</div>
					</div>
				{:else}
					<div
						class="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0b0c]/75 shadow-[0_35px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl animate-[fade-up_650ms_ease-out_both]"
					>
						<div
							class="absolute inset-0 pointer-events-none bg-[radial-gradient(600px_420px_at_15%_0%,rgba(255,255,255,0.10),transparent),radial-gradient(700px_500px_at_85%_110%,rgba(255,255,255,0.06),transparent)]"
						></div>

							<button
								type="button"
								class="absolute top-4 right-4 size-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
								on:click={closeAuth}
								disabled={submitting || oauthRedirectingTo !== null || telegramLoading}
								aria-label={$i18n.t('Close')}
							>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="size-5 text-white/80"
								aria-hidden="true"
							>
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
						</button>

						<div class="relative px-6 pt-12 pb-7 sm:px-7 sm:pt-12 sm:pb-8">
							{#if $config?.metadata?.auth_logo_position === 'center'}
								<div class="flex justify-center mb-5 animate-[fade-up_650ms_ease-out_both]">
									<img
										id="logo"
										crossorigin="anonymous"
										src="{WEBUI_BASE_URL}/static/favicon.svg"
										class="size-14 rounded-2xl border border-white/10 bg-white/5"
										alt=""
									/>
								</div>
							{/if}

									{#if panel === 'choice'}
										<div class="text-center">
											<div
												class="text-[2rem] sm:text-[2.15rem] font-semibold tracking-tight leading-[1.05] animate-[fade-up_650ms_ease-out_both]"
											>
												{$i18n.t('Sign in or sign up')}
											</div>
											<div class="mt-3 text-sm text-white/60 animate-[fade-up_650ms_ease-out_80ms_both]">
												{$i18n.t('Select an auth method')}
											</div>

									<div
										class="mt-5 flex justify-center text-white/70 animate-[fade-up_650ms_ease-out_140ms_both]"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="size-6"
											aria-hidden="true"
										>
											<path d="M12 5v14" />
											<path d="m19 12-7 7-7-7" />
										</svg>
									</div>
								</div>

									<div class="mt-6 space-y-3 animate-[fade-up_650ms_ease-out_200ms_both]">
										{#if yandexEnabled}
											<button
												type="button"
												class="group w-full min-h-[56px] rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center px-4 gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
												on:click={() => startSocialLogin('yandex')}
												disabled={oauthRedirectingTo !== null || submitting}
											>
												<span
													class="size-10 rounded-full bg-[#FC3F1D] flex items-center justify-center font-extrabold text-white"
													aria-hidden="true"
													>Я</span
												>
												<span class="text-sm font-semibold"
													>{$i18n.t('Continue with {{provider}}', {
														provider: $i18n.t('Yandex')
													})}</span
												>
												<span class="ml-auto text-white/70">
													{#if oauthRedirectingTo === 'yandex'}
														<Spinner className="size-4" />
												{:else}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														class="size-5 transition group-hover:translate-x-0.5"
														aria-hidden="true"
													>
														<path d="M5 12h14" />
														<path d="m13 5 7 7-7 7" />
													</svg>
												{/if}
											</span>
										</button>
									{/if}

										{#if vkEnabled}
											{#if vkIdEnabled}
											<div
												class="w-full rounded-[22px] overflow-hidden border border-white/10 bg-white/5"
											>
												<VKIDWidget
													appId={$config?.oauth?.providers?.vk?.app_id}
													redirectUrl={$config?.oauth?.providers?.vk?.redirect_url || ''}
													scheme={'dark'}
													showAlternativeLogin={false}
													oauthList={[]}
												/>
											</div>
											{:else}
												<button
													type="button"
													class="group w-full min-h-[56px] rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center px-4 gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
													on:click={() => startSocialLogin('vk')}
													disabled={oauthRedirectingTo !== null || submitting}
												>
												<span
													class="size-10 rounded-full bg-[#0077FF] flex items-center justify-center font-extrabold text-white"
													aria-hidden="true"
														>VK</span
													>
													<span class="text-sm font-semibold"
														>{$i18n.t('Continue with {{provider}}', { provider: 'VK' })}</span
													>
													<span class="ml-auto text-white/70">
														{#if oauthRedirectingTo === 'vk'}
															<Spinner className="size-4" />
													{:else}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
															class="size-5 transition group-hover:translate-x-0.5"
															aria-hidden="true"
														>
															<path d="M5 12h14" />
															<path d="m13 5 7 7-7 7" />
														</svg>
													{/if}
												</span>
											</button>
										{/if}
									{/if}

										{#if githubEnabled}
											<button
												type="button"
												class="group w-full min-h-[56px] rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center px-4 gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
												on:click={() => startSocialLogin('github')}
												disabled={oauthRedirectingTo !== null || submitting}
											>
												<span
													class="size-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white"
													aria-hidden="true"
												>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5">
													<path
														fill="currentColor"
														d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57C20.565 21.795 24 17.31 24 12c0-6.63-5.37-12-12-12z"
													/>
													</svg>
												</span>
												<span class="text-sm font-semibold"
													>{$i18n.t('Continue with {{provider}}', { provider: 'GitHub' })}</span
												>
												<span class="ml-auto text-white/70">
													{#if oauthRedirectingTo === 'github'}
														<Spinner className="size-4" />
												{:else}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														class="size-5 transition group-hover:translate-x-0.5"
														aria-hidden="true"
													>
														<path d="M5 12h14" />
														<path d="m13 5 7 7-7 7" />
													</svg>
												{/if}
											</span>
										</button>
									{/if}

									{#if telegramVisible}
										<div class="mt-2 rounded-[22px] border border-white/10 bg-white/5 p-4">
											<div class="flex items-center justify-between gap-3">
												<div class="text-xs font-semibold text-white/60">
													{$i18n.t('Telegram')}
												</div>
												<div class="flex items-center gap-1">
														<button
															type="button"
															class={`px-3 py-1 rounded-full text-[0.7rem] font-semibold transition border ${
																telegramMode === 'signin'
																	? 'bg-white text-black border-white/20'
																	: 'bg-white/0 text-white/70 border-white/20 hover:bg-white/10 hover:text-white'
															}`}
															on:click={() => {
																telegramMode = 'signin';
															}}
															disabled={telegramLoading}
														>
															{$i18n.t('Sign in')}
														</button>
														{#if signupEnabled}
															<button
																type="button"
																class={`px-3 py-1 rounded-full text-[0.7rem] font-semibold transition border ${
																	telegramMode === 'signup'
																		? 'bg-white text-black border-white/20'
																		: 'bg-white/0 text-white/70 border-white/20 hover:bg-white/10 hover:text-white'
																}`}
																on:click={() => {
																	telegramMode = 'signup';
																}}
															disabled={telegramLoading}
														>
															{$i18n.t('Sign up')}
														</button>
													{/if}
												</div>
											</div>

												{#if telegramMode === 'signup'}
													<div class="mt-3 flex items-start gap-2 text-xs text-white/60">
														<input
															id="telegram-legal-accept"
															type="checkbox"
															bind:checked={legalAccepted}
															class="mt-0.5 size-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/20"
														/>
														<label for="telegram-legal-accept" class="leading-relaxed">
															{$i18n.t('I accept the')}
															<a
																href="/terms"
																target="_blank"
																rel="noreferrer"
																class="text-white/90 font-semibold hover:underline"
																>{$i18n.t('Terms of Service')}</a
															>
															{$i18n.t('and')}
															<a
																href="/privacy"
																target="_blank"
																rel="noreferrer"
																class="text-white/90 font-semibold hover:underline"
																>{$i18n.t('Privacy Policy')}</a
															>
															.
														</label>
													</div>
												{/if}

											<div class="mt-3 flex justify-center">
												<TelegramLoginWidget
													botUsername={$config?.telegram?.bot_username}
													radius={18}
													showUserPic={false}
													on:auth={(event) => {
														telegramAuthHandler(event.detail);
													}}
												/>
												{#if telegramLoading}
													<div class="ml-2 flex items-center">
														<Spinner className="size-4" />
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>

									{#if passwordAuthEnabled}
										<div class="mt-6 flex items-center gap-3 animate-[fade-up_650ms_ease-out_260ms_both]">
											<div class="h-px flex-1 bg-white/10"></div>
											<div class="text-xs font-semibold uppercase tracking-widest text-white/40">
												{$i18n.t('or')}
											</div>
											<div class="h-px flex-1 bg-white/10"></div>
										</div>

										<div class="mt-5 space-y-3 animate-[fade-up_650ms_ease-out_320ms_both]">
											<button
												type="button"
												class="group w-full min-h-[56px] rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center gap-3 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
													on:click={() => {
														panel = 'email';
														panelAuto = false;
														mode = ($config?.onboarding ?? false)
															? 'signup'
															: $config?.features.enable_ldap
																? 'ldap'
															: 'signin';
												}}
												disabled={oauthRedirectingTo !== null || submitting}
											>
												<span
													class="size-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/90"
													aria-hidden="true"
												>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													class="size-5"
													aria-hidden="true"
												>
													<rect x="3" y="5" width="18" height="14" rx="2" />
													<path d="m3 7 9 6 9-6" />
													</svg>
												</span>
												<span class="text-sm font-semibold">{$i18n.t('Continue with Email')}</span>
											</button>

											<button
												type="button"
												class="w-full text-center text-sm font-semibold text-white/60 hover:text-white/90 transition underline underline-offset-4 decoration-white/20 hover:decoration-white/40"
													on:click={() => {
														panel = 'email';
														panelAuto = false;
														mode = $config?.features.enable_ldap ? 'ldap' : 'signin';
													}}
													disabled={oauthRedirectingTo !== null || submitting}
												>
												{$i18n.t('Already have an account?')}
											</button>
										</div>
									{/if}

									<div
										class="mt-6 text-xs leading-relaxed text-white/40 animate-[fade-up_650ms_ease-out_380ms_both]"
									>
										{$i18n.t('By continuing, you agree to the')}
										<a
											href="/terms"
											target="_blank"
											rel="noreferrer"
											class="underline underline-offset-4 decoration-white/20 hover:decoration-white/50 transition"
											>{$i18n.t('Terms of Service')}</a
										>
										{$i18n.t('and')}
										<a
											href="/privacy"
											target="_blank"
											rel="noreferrer"
											class="underline underline-offset-4 decoration-white/20 hover:decoration-white/50 transition"
											>{$i18n.t('Privacy Policy')}</a
										>.
									</div>
								{:else}
								<div class="animate-[fade-up_650ms_ease-out_both]">
									<div class="flex items-center justify-between">
										{#if hasSocialProviders}
												<button
													type="button"
														class="inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white/90 transition"
														on:click={() => {
															panel = 'choice';
															panelAuto = false;
														}}
														disabled={submitting}
													>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													class="size-4"
													aria-hidden="true"
												>
													<path d="M15 18l-6-6 6-6" />
												</svg>
														{$i18n.t('Back')}
													</button>
												{:else}
													<div></div>
												{/if}
											<div></div>
										</div>

									<div class="mt-5 text-center">
										<div class="text-2xl font-semibold tracking-tight">
											{#if $config?.onboarding ?? false}
												{$i18n.t('Create Admin Account')}
											{:else if mode === 'signup'}
												{$i18n.t(`Sign up to {{WEBUI_NAME}}`, { WEBUI_NAME: $WEBUI_NAME })}
											{:else if mode === 'ldap'}
												{$i18n.t(`Sign in to {{WEBUI_NAME}} with LDAP`, { WEBUI_NAME: $WEBUI_NAME })}
											{:else}
												{$i18n.t(`Sign in to {{WEBUI_NAME}}`, { WEBUI_NAME: $WEBUI_NAME })}
											{/if}
											</div>
											<div class="mt-2 text-sm text-white/60">
												{#if mode === 'signup'}
													{$i18n.t('This may take a minute')}
												{:else if mode === 'ldap'}
													{$i18n.t('Username and Password')}
												{:else}
													{$i18n.t('Email and Password')}
												{/if}
											</div>
										</div>

									{#if passwordAuthEnabled}
										<form
											class="mt-6 space-y-3 text-left"
											on:submit={(e) => {
												e.preventDefault();
												submitHandler();
											}}
										>
											{#if mode === 'signup'}
												<div>
													<label for="name" class="sr-only">{$i18n.t('Name')}</label>
														<input
															bind:value={name}
															type="text"
															id="name"
															class="w-full min-h-[52px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-white/20"
															autocomplete="name"
															placeholder={$i18n.t('Enter Your Full Name')}
															required
														/>
												</div>
											{/if}

											{#if mode === 'ldap'}
												<div>
													<label for="username" class="sr-only">{$i18n.t('Username')}</label>
														<input
															bind:value={ldapUsername}
															type="text"
															id="username"
															class="w-full min-h-[52px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-white/20"
															autocomplete="username"
															name="username"
															placeholder={$i18n.t('Enter Your Username')}
															required
														/>
												</div>
											{:else}
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
											{/if}

											<div>
												<label for="password" class="sr-only">{$i18n.t('Password')}</label>
													<SensitiveInput
														bind:value={password}
														type="password"
														id="password"
														outerClassName="w-full min-h-[52px] flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 outline-none focus-within:ring-2 focus-within:ring-white/20 focus-within:border-white/20"
														inputClassName="w-full text-sm bg-transparent outline-none text-white placeholder:text-white/40"
														showButtonClassName="pl-2 pr-0.5 text-white/60 hover:text-white/90 transition focus-visible:outline-none"
														placeholder={$i18n.t('Enter Your Password')}
														autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
														name="password"
														required
													/>
											</div>

											{#if mode === 'signup' && $config?.features?.enable_signup_password_confirmation}
												<div>
													<label for="confirm-password" class="sr-only">
														{$i18n.t('Confirm Password')}
													</label>
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
											{/if}

												{#if mode === 'signup'}
													<div class="pt-1">
														<div class="flex items-start gap-2 text-xs text-white/60">
																<input
																	id="legal-accept"
																	type="checkbox"
																	bind:checked={legalAccepted}
																	class="mt-0.5 size-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/20"
																/>
															<label for="legal-accept" class="leading-relaxed">
																{$i18n.t('I accept the')}
																<a
																	href="/terms"
																	target="_blank"
																	rel="noreferrer"
																	class="text-white/90 font-semibold hover:underline"
																	>{$i18n.t('Terms of Service')}</a
																>
																{$i18n.t('and')}
																<a
																	href="/privacy"
																	target="_blank"
																	rel="noreferrer"
																	class="text-white/90 font-semibold hover:underline"
																	>{$i18n.t('Privacy Policy')}</a
																>
																.
															</label>
														</div>
												</div>
											{/if}

											<button
												class="mt-2 w-full min-h-[56px] rounded-full font-semibold text-sm transition bg-white text-black hover:bg-white/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
												type="submit"
												disabled={(mode === 'signup' && !legalAccepted) || submitting}
											>
													{#if submitting}
														<span class="inline-flex items-center gap-2">
															<Spinner className="size-4" />
															<span>{$i18n.t('Loading…')}</span>
														</span>
													{:else}
													{mode === 'ldap'
														? $i18n.t('Authenticate')
														: mode === 'signin'
															? $i18n.t('Sign in')
															: ($config?.onboarding ?? false)
																? $i18n.t('Create Admin Account')
																: $i18n.t('Create Account')}
												{/if}
											</button>
										</form>

										{#if signupEnabled && !($config?.onboarding ?? false) && mode !== 'ldap'}
												<div class="mt-4 text-sm text-center text-white/60">
												{mode === 'signin'
													? $i18n.t("Don't have an account?")
													: $i18n.t('Already have an account?')}
												<button
													type="button"
													class="ml-2 font-semibold underline underline-offset-4 decoration-white/20 hover:decoration-white/50 transition"
													on:click={() => {
														if (mode === 'signin') {
															mode = 'signup';
														} else {
															mode = 'signin';
														}
													}}
												>
													{mode === 'signin' ? $i18n.t('Sign up') : $i18n.t('Sign in')}
												</button>
											</div>
										{/if}

										{#if $config?.features.enable_ldap && $config?.features.enable_login_form}
											<div class="mt-3">
													<button
														class="flex justify-center items-center text-xs w-full text-center underline underline-offset-4 decoration-white/20 hover:decoration-white/50 transition text-white/60 hover:text-white/90"
														type="button"
														on:click={() => {
														if (mode === 'ldap')
															mode = ($config?.onboarding ?? false) ? 'signup' : 'signin';
														else mode = 'ldap';
													}}
												>
													<span
														>{mode === 'ldap'
															? $i18n.t('Continue with Email')
															: $i18n.t('Continue with LDAP')}</span
													>
												</button>
											</div>
										{/if}
										{:else}
											<div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
												{$i18n.t('Email sign-in is disabled.')}
											</div>
										{/if}
								</div>
							{/if}
						</div>
					</div>
				{/if}

					{#if $config?.metadata?.login_footer}
						<div class="mt-6 px-2">
								<div class="text-[0.7rem] leading-relaxed text-white/50 marked">
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html DOMPurify.sanitize(marked($config?.metadata?.login_footer))}
							</div>
						</div>
					{/if}
			</div>
		</div>
	{/if}
</div>
