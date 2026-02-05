<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { acceptLegalDocs, type LegalStatusResponse } from '$lib/apis/legal';

	export let token: string;
	export let status: LegalStatusResponse;
	export let acceptMethod: string = 'ui_gate';

	const dispatch = createEventDispatcher<{
		accepted: { status: LegalStatusResponse };
	}>();

	let submitting = false;
	let error: string | null = null;
	let checks: Record<string, boolean> = {};

	$: requiredDocs = (status?.docs ?? []).filter((doc) => doc.required);
	$: missingDocs = requiredDocs.filter((doc) => doc.accepted_version !== doc.version);
	$: hasGateDocs = missingDocs.length > 0;

	$: {
		// Initialize checkboxes for missing docs only.
		const next: Record<string, boolean> = {};
		for (const doc of missingDocs) {
			next[doc.key] = checks[doc.key] ?? false;
		}
		checks = next;
	}

	const allChecked = (): boolean => missingDocs.every((doc) => Boolean(checks[doc.key]));

	const handleAccept = async (): Promise<void> => {
		if (!hasGateDocs || !allChecked()) return;
		submitting = true;
		error = null;
		try {
			const keys = missingDocs.map((doc) => doc.key);
			const response = await acceptLegalDocs(token, keys, acceptMethod);
			dispatch('accepted', { status: response.status });
		} catch (err: unknown) {
			error = typeof err === 'string' ? err : 'Не удалось принять документы. Попробуйте ещё раз.';
		} finally {
			submitting = false;
		}
	};

	const signOut = (): void => {
		try {
			localStorage.removeItem('token');
		} catch {
			// ignore
		}
		location.href = '/auth';
	};
</script>

<div class="fixed w-full h-full flex z-999">
	<div class="absolute w-full h-full backdrop-blur-lg bg-white/10 dark:bg-gray-900/60 flex justify-center">
		<div class="m-auto pb-10 flex flex-col justify-center px-4">
			<div class="max-w-lg bg-white/90 dark:bg-gray-900/80 border border-gray-200/70 dark:border-gray-700/60 rounded-2xl shadow-sm p-6 md:p-8">
				<div class="text-center text-2xl font-medium text-gray-900 dark:text-white">
					Примите условия, чтобы продолжить
				</div>

				<p class="mt-3 text-center text-sm text-gray-600 dark:text-gray-300">
					Перед использованием AIRIS нужно принять юридические документы.
				</p>

				{#if hasGateDocs}
					<div class="mt-6 space-y-3">
						{#each missingDocs as doc (doc.key)}
							<div class="flex items-start gap-3">
								<input
									id={`legal-${doc.key}`}
									type="checkbox"
									bind:checked={checks[doc.key]}
									class="mt-1 size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
								/>
								<label
									for={`legal-${doc.key}`}
									class="text-sm text-gray-700 dark:text-gray-200 leading-relaxed"
								>
									Я принимаю
									<a
										href={doc.url}
										target="_blank"
										rel="noreferrer"
										class="text-gray-900 dark:text-white font-medium hover:underline"
										>{doc.title}</a
									>
									<span class="text-gray-400"> (версия {doc.version})</span>
								</label>
							</div>
						{/each}
					</div>
				{:else}
					<div class="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-900 px-4 py-3 text-sm">
						Не удалось загрузить список документов. Обновите страницу и попробуйте ещё раз.
					</div>
				{/if}

				{#if error}
					<div class="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
						{error}
					</div>
				{/if}

				<div class="mt-6 flex flex-col gap-2">
					{#if hasGateDocs}
						<button
							class="w-full rounded-full py-2.5 text-sm font-medium transition bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={!allChecked() || submitting}
							on:click={handleAccept}
						>
							{submitting ? 'Сохраняем…' : 'Принять и продолжить'}
						</button>
					{:else}
						<button
							class="w-full rounded-full py-2.5 text-sm font-medium transition bg-gray-900 text-white hover:bg-gray-800"
							type="button"
							on:click={() => location.reload()}
						>
							Обновить страницу
						</button>
					{/if}
					<button
						class="w-full rounded-full py-2.5 text-sm font-medium transition border border-gray-200/80 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
						type="button"
						on:click={signOut}
					>
						Выйти
					</button>
				</div>

				<div class="mt-5 text-center text-xs text-gray-500 dark:text-gray-400">
					Если у вас есть вопросы — напишите на
					<a href="mailto:support@airis.you" class="text-gray-900 dark:text-white font-medium hover:underline"
						>support@airis.you</a
					>.
				</div>
			</div>
		</div>
	</div>
</div>
