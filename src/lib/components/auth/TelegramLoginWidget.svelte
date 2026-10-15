<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	export let botUsername: string;
	export let size: 'large' | 'medium' | 'small' = 'large';
	export let radius: number | undefined = undefined;
	export let showUserPic = false;
	export let containerClass: string = '';

	const dispatch = createEventDispatcher<{ auth: Record<string, unknown> }>();

	let container: HTMLDivElement | null = null;
	let scriptEl: HTMLScriptElement | null = null;
	type CallbackName = `__owuiTelegramAuth_${string}`;
	type CallbackWindow = Window & {
		[name: CallbackName]: ((user: Record<string, unknown>) => void) | undefined;
	};
	let callbackName: CallbackName | '' = '';
	let scriptLoadError = false;

	const createCallbackName = (): CallbackName => {
		try {
			// randomUUID() returns UUIDs with dashes, which are invalid in JS identifiers.
			const uuid = String(crypto.randomUUID()).replace(/-/g, '_');
			return `__owuiTelegramAuth_${uuid}`;
		} catch {
			return `__owuiTelegramAuth_${Math.random().toString(36).slice(2)}`;
		}
	};

	const cleanup = (): void => {
		if (scriptEl?.parentNode) {
			scriptEl.parentNode.removeChild(scriptEl);
		}
		scriptEl = null;

		if (container) {
			container.innerHTML = '';
		}

		if (callbackName) {
			const callbacks = window as CallbackWindow;
			try {
				delete callbacks[callbackName];
			} catch {
				callbacks[callbackName] = undefined;
			}
		}
		callbackName = '';
	};

	const mountWidget = (
		botUsernameValue: string,
		sizeValue: 'large' | 'medium' | 'small',
		radiusValue: number | undefined,
		showUserPicValue: boolean
	): void => {
		if (!container) return;

		cleanup();
		scriptLoadError = false;

		const username = (botUsernameValue ?? '').trim().replace(/^@/, '');
		if (!username) return;

		callbackName = createCallbackName();
		const s = document.createElement('script');
		(window as CallbackWindow)[callbackName] = (user: Record<string, unknown>) => {
			if (scriptEl === s) dispatch('auth', user);
		};
		s.async = true;
		s.src = 'https://telegram.org/js/telegram-widget.js?22';
		s.setAttribute('data-telegram-login', username);
		s.setAttribute('data-size', sizeValue);
		s.setAttribute('data-userpic', showUserPicValue ? 'true' : 'false');
		s.setAttribute('data-onauth', `${callbackName}(user)`);
		if (typeof radiusValue === 'number') {
			s.setAttribute('data-radius', String(radiusValue));
		}
		s.addEventListener('error', () => {
			if (scriptEl === s) scriptLoadError = true;
		});

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

<div>
	<div bind:this={container} class={containerClass}></div>
	{#if scriptLoadError}
		<div class="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
			Telegram widget failed to load.
		</div>
	{/if}
</div>
