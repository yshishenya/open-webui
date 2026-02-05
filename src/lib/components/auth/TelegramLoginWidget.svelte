<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	export let botUsername: string;
	export let size: 'large' | 'medium' | 'small' = 'large';
	export let radius: number | undefined = undefined;
	export let showUserPic = false;

	const dispatch = createEventDispatcher<{ auth: Record<string, unknown> }>();

	let container: HTMLDivElement | null = null;
	let scriptEl: HTMLScriptElement | null = null;
	let callbackName = '';

	const createCallbackName = () => {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			return `__owuiTelegramAuth_${(crypto as any).randomUUID()}`;
		} catch {
			return `__owuiTelegramAuth_${Math.random().toString(36).slice(2)}`;
		}
	};

	const cleanup = () => {
		if (scriptEl?.parentNode) {
			scriptEl.parentNode.removeChild(scriptEl);
		}
		scriptEl = null;

		if (container) {
			container.innerHTML = '';
		}

		if (callbackName && (window as any)[callbackName]) {
			try {
				delete (window as any)[callbackName];
			} catch {
				(window as any)[callbackName] = undefined;
			}
		}
	};

	const mountWidget = (
		botUsernameValue: string,
		sizeValue: 'large' | 'medium' | 'small',
		radiusValue: number | undefined,
		showUserPicValue: boolean
	) => {
		if (!container) return;

		cleanup();

		const username = (botUsernameValue ?? '').trim().replace(/^@/, '');
		if (!username) return;

		callbackName = createCallbackName();
		(window as any)[callbackName] = (user: Record<string, unknown>) => {
			dispatch('auth', user);
		};

		const s = document.createElement('script');
		s.async = true;
		s.src = 'https://telegram.org/js/telegram-widget.js?22';
		s.setAttribute('data-telegram-login', username);
		s.setAttribute('data-size', sizeValue);
		s.setAttribute('data-userpic', showUserPicValue ? 'true' : 'false');
		s.setAttribute('data-onauth', `${callbackName}(user)`);
		if (typeof radiusValue === 'number') {
			s.setAttribute('data-radius', String(radiusValue));
		}

		scriptEl = s;
		container.appendChild(s);
	};

	$: if (container) {
		mountWidget(botUsername, size, radius, showUserPic);
	}

	onDestroy(() => {
		cleanup();
	});
</script>

<div bind:this={container} />
