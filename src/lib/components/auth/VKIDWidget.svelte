<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getSessionUser } from '$lib/apis/auths';
	import { user, config } from '$lib/stores';
	import { getBackendConfig } from '$lib/apis';
	import { WEBUI_BASE_URL } from '$lib/constants';

	export let appId: string;
	export let redirectUrl: string = '';
	export let scheme: 'light' | 'dark' = 'light';
	export let showAlternativeLogin: boolean = true;
	export let oauthList: string[] = ['ok_ru', 'mail_ru'];
	export let onSuccess: ((data: any) => void) | null = null;
	export let onError: ((error: any) => void) | null = null;

	let container: HTMLDivElement;
	let vkidInstance: any = null;
	let allowErrorToast = false;

	const defaultOnSuccess = async (data: any) => {
		try {
			// data contains access_token and user info from VK ID
			localStorage.setItem('token', data.token);
			const sessionUser = await getSessionUser(data.token);

			if (sessionUser) {
				toast.success('Вы успешно вошли через VK');
				await user.set(sessionUser);
				await config.set(await getBackendConfig());
				goto('/');
			}
		} catch (error) {
			console.error('VK ID success handler error:', error);
			toast.error('Ошибка при входе через VK');
		}
	};

	const defaultOnError = (error: any) => {
		console.error('VK ID error:', error);
		if (allowErrorToast) {
			toast.error('Ошибка авторизации VK');
		}
	};

	const handleVKIDSuccess = async (payload: any) => {
		try {
			// Send data to our backend for user creation/login
			const response = await fetch(`${WEBUI_BASE_URL}/api/v1/oauth/vkid/callback`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: payload.code,
					device_id: payload.device_id,
					// If we have access_token from SDK exchange, send it
					access_token: payload.access_token,
					user_id: payload.user_id,
					email: payload.email
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.detail || 'VK ID authentication failed');
			}

			if (onSuccess) {
				onSuccess(data);
			} else {
				await defaultOnSuccess(data);
			}
		} catch (error: any) {
			console.error('VK ID callback error:', error);
			if (onError) {
				onError(error);
			} else {
				defaultOnError(error);
			}
		}
	};

	const handleVKIDError = (error: any) => {
		if (onError) {
			onError(error);
		} else {
			defaultOnError(error);
		}
	};

	const initVKID = () => {
		if (typeof window === 'undefined' || !window.VKIDSDK) {
			return;
		}

		const VKID = window.VKIDSDK;

		try {
			VKID.Config.init({
				app: parseInt(appId),
				redirectUrl: redirectUrl || window.location.origin,
				responseMode: VKID.ConfigResponseMode.Callback,
				source: VKID.ConfigSource.LOWCODE,
				scope: 'email' // Request email permission
			});

			const oneTap = new VKID.OneTap();

			vkidInstance = oneTap
				.render({
					container: container,
					scheme: scheme,
					showAlternativeLogin: showAlternativeLogin,
					styles: {
						borderRadius: 18
					},
					oauthList: oauthList
				})
				.on(VKID.WidgetEvents.ERROR, handleVKIDError)
				.on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: any) => {
					const code = payload.code;
					const deviceId = payload.device_id;

					try {
						// Use built-in exchange
						const authData = await VKID.Auth.exchangeCode(code, deviceId);
						await handleVKIDSuccess({ ...payload, ...authData });
					} catch (error) {
						// If built-in exchange fails, try our backend
						await handleVKIDSuccess(payload);
					}
				});
		} catch (error) {
			console.error('Failed to initialize VK ID:', error);
		}
	};

	const loadVKIDScript = () => {
		return new Promise<void>((resolve, reject) => {
			if (window.VKIDSDK) {
				resolve();
				return;
			}

			const script = document.createElement('script');
			script.src = 'https://unpkg.com/@vkid/sdk@2.6.0/dist-sdk/umd/index.js';
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load VK ID SDK'));
			document.head.appendChild(script);
		});
	};

	onMount(async () => {
		if (!appId) return;

		try {
			await loadVKIDScript();
			// Small delay to ensure SDK is fully initialized
			setTimeout(initVKID, 100);
		} catch (error) {
			console.error('Failed to load VK ID SDK:', error);
		}
	});

	onDestroy(() => {
		if (vkidInstance && typeof vkidInstance.close === 'function') {
			vkidInstance.close();
		}
	});
</script>

<div
	bind:this={container}
	class="vkid-widget-container w-full"
	on:pointerdown={() => {
		allowErrorToast = true;
	}}
></div>

<style>
	.vkid-widget-container {
		min-height: 56px;
	}

	:global(.vkid-widget-container > div) {
		width: 100% !important;
	}
</style>
