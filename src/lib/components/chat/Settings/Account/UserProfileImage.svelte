<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getContext, onDestroy } from 'svelte';
	import type { SessionUser } from '$lib/stores';

	const i18n = getContext('i18n');

	import { getGravatarUrl } from '$lib/apis/utils';
	import { canvasPixelTest, generateInitialsImage } from '$lib/utils';

	import { WEBUI_BASE_URL } from '$lib/constants';

	export let profileImageUrl: string = '';
	export let user:
		| (Pick<SessionUser, 'name' | 'email'> & Partial<Pick<SessionUser, 'id'>>)
		| null
		| undefined = null;

	export let imageClassName = 'size-14 md:size-18';
	export let variant = 'default';
	export let displayName = '';

	let profileImageInputElement: HTMLInputElement;
	// Cleanup must see pending work even before a Svelte update is flushed.
	const photo = {
		revision: 0,
		reader: null as FileReader | null,
		gravatarAbort: null as AbortController | null
	};
	let photoUser = user;
	const cancelPhoto = (): number => {
		photo.revision += 1;
		photo.reader?.abort();
		photo.reader = null;
		photo.gravatarAbort?.abort();
		return photo.revision;
	};
	$: if (user !== photoUser) {
		photoUser = user;
		cancelPhoto();
	}
	onDestroy(cancelPhoto);
	const loadGravatar = async (): Promise<void> => {
		const email = user?.email;
		if (!email) return;
		const revision = cancelPhoto();
		const controller = new AbortController();
		photo.gravatarAbort = controller;
		try {
			const url = await getGravatarUrl(localStorage.token, email, controller.signal);
			if (revision === photo.revision && !controller.signal.aborted && user?.email === email)
				profileImageUrl = url;
		} catch {
			if (revision === photo.revision && !controller.signal.aborted)
				toast.error($i18n.t('Failed to upload file.'));
		}
	};
</script>

<input
	id="profile-image-input"
	bind:this={profileImageInputElement}
	type="file"
	hidden
	accept="image/*"
	on:change={(): void => {
		const file = profileImageInputElement.files?.[0];
		profileImageInputElement.value = '';
		if (!file) return;
		const revision = cancelPhoto();
		const fail = (): void => {
			if (revision === photo.revision) toast.error($i18n.t('Failed to upload file.'));
		};
		if (!['image/gif', 'image/webp', 'image/jpeg', 'image/png'].includes(file.type)) {
			fail();
			return;
		}
		const currentReader = new FileReader();
		photo.reader = currentReader;
		currentReader.onerror = fail;
		currentReader.onload = (): void => {
			if (revision !== photo.revision) return;
			if (typeof currentReader.result !== 'string') {
				fail();
				return;
			}
			const img = new Image();
			img.onerror = fail;
			img.onload = (): void => {
				if (revision !== photo.revision) return;
				try {
					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d');
					if (!ctx || !img.width || !img.height) {
						fail();
						return;
					}
					const aspectRatio = img.width / img.height;
					let newWidth: number, newHeight: number;
					if (aspectRatio > 1) {
						newWidth = 250 * aspectRatio;
						newHeight = 250;
					} else {
						newWidth = 250;
						newHeight = 250 / aspectRatio;
					}
					canvas.width = 250;
					canvas.height = 250;
					const offsetX = (250 - newWidth) / 2;
					const offsetY = (250 - newHeight) / 2;
					ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
					profileImageUrl = canvas.toDataURL('image/webp', 0.8);
				} catch {
					fail();
				}
			};
			img.src = currentReader.result;
		};
		try {
			currentReader.readAsDataURL(file);
		} catch {
			fail();
		}
	}}
/>

{#if variant === 'account'}
	<div class="mb-2 flex items-center gap-4">
		<button
			class="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100
			ring-1 ring-gray-200 transition-all duration-200 hover:ring-2 hover:ring-gray-300 dark:bg-white/8 dark:ring-white/10 dark:hover:ring-white/20"
			type="button"
			on:click={() => {
				profileImageInputElement.click();
			}}
		>
			<img
				src={profileImageUrl !== '' ? profileImageUrl : generateInitialsImage(user?.name)}
				alt="profile"
				class="h-full w-full object-cover"
			/>

			<div
				class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/40"
			>
				<svg
					class="h-4 w-4 text-white opacity-0 drop-shadow-sm transition-opacity duration-200 group-hover:opacity-100"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
					/>
				</svg>
			</div>
		</button>

		<div class="flex flex-col gap-1">
			<span class="text-xs text-gray-600 dark:text-gray-400">{displayName || user?.name}</span>
			<div class="flex flex-wrap items-center gap-2">
				<button
					class="text-[0.6875rem] text-gray-500 transition-colors duration-100 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
					type="button"
					on:click={() => {
						profileImageInputElement.click();
					}}>{$i18n.t('Upload Photo')}</button
				>
				<span class="text-[0.6875rem] text-gray-300 dark:text-gray-700">·</span>
				<button
					class="text-[0.6875rem] text-gray-500 transition-colors duration-100 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
					type="button"
					on:click={async () => {
						cancelPhoto();
						profileImageUrl = `${WEBUI_BASE_URL}/user.png`;
					}}>{$i18n.t('Remove')}</button
				>
				<span class="text-[0.6875rem] text-gray-300 dark:text-gray-700">·</span>
				<button
					class="text-[0.6875rem] text-gray-500 transition-colors duration-100 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
					type="button"
					on:click={async () => {
						cancelPhoto();
						if (canvasPixelTest()) {
							profileImageUrl = generateInitialsImage(user?.name);
						} else {
							toast.info(
								$i18n.t(
									'Fingerprint spoofing detected: Unable to use initials as avatar. Defaulting to default profile image.'
								),
								{
									duration: 1000 * 10
								}
							);
						}
					}}>{$i18n.t('Initials')}</button
				>
				<span class="text-[0.6875rem] text-gray-300 dark:text-gray-700">·</span>
				<button
					class="text-[0.6875rem] text-gray-500 transition-colors duration-100 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
					type="button"
					disabled={!user?.email}
					on:click={loadGravatar}>{$i18n.t('Gravatar')}</button
				>
			</div>
		</div>
	</div>
{:else}
	<div class="flex flex-col self-start group">
		<div class="self-center flex">
			<button
				class="relative rounded-full dark:bg-gray-700"
				type="button"
				on:click={() => {
					profileImageInputElement.click();
				}}
			>
				<img
					src={profileImageUrl !== '' ? profileImageUrl : generateInitialsImage(user?.name)}
					alt="profile"
					class=" rounded-full {imageClassName} object-cover"
				/>

				<div class="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition">
					<div class="p-1 rounded-full bg-white text-black border-gray-100 shadow">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="size-3"
						>
							<path
								d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z"
							/>
						</svg>
					</div>
				</div>
			</button>
		</div>
		<div class="flex flex-col w-full justify-center mt-2">
			<button
				class=" text-xs text-center text-gray-500 rounded-lg py-0.5 opacity-0 group-hover:opacity-100 transition-all"
				type="button"
				on:click={async () => {
					cancelPhoto();
					profileImageUrl = `${WEBUI_BASE_URL}/user.png`;
				}}>{$i18n.t('Remove')}</button
			>

			<button
				class="rounded-lg py-0.5 text-center text-xs text-gray-600 opacity-0 transition-all group-hover:opacity-100 dark:text-gray-400"
				type="button"
				on:click={async () => {
					cancelPhoto();
					if (canvasPixelTest()) {
						profileImageUrl = generateInitialsImage(user?.name);
					} else {
						toast.info(
							$i18n.t(
								'Fingerprint spoofing detected: Unable to use initials as avatar. Defaulting to default profile image.'
							),
							{
								duration: 1000 * 10
							}
						);
					}
				}}>{$i18n.t('Initials')}</button
			>

			<button
				class="rounded-lg py-0.5 text-center text-xs text-gray-600 opacity-0 transition-all group-hover:opacity-100 dark:text-gray-400"
				type="button"
				disabled={!user?.email}
				on:click={loadGravatar}>{$i18n.t('Gravatar')}</button
			>
		</div>
	</div>
{/if}
