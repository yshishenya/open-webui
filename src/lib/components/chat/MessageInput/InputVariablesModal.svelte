<script lang="ts">
	import { getContext, tick, onDestroy } from 'svelte';
	import {
		normalizeInputVariables,
		getInputValue,
		isInputChecked,
		getMapLocation
	} from '$lib/utils/airis/input_variables';

	import XMark from '$lib/components/icons/XMark.svelte';
	import Modal from '$lib/components/common/Modal.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import MapSelector from '$lib/components/common/Valves/MapSelector.svelte';

	const i18n = getContext('i18n');

	export let show = false;
	export let variables: Record<string, Record<string, unknown> | null> = {};
	export let title = $i18n.t('Input Variables');

	export let onSave: (values: Record<string, unknown>) => void = () => {};
	export let onCancel: () => void = () => {};

	let awaitingInput = false;
	let cancelCallback: () => void = () => {};
	const cancelHandler = (): void => {
		if (awaitingInput) {
			awaitingInput = false;
			cancelCallback();
		}
	};
	onDestroy(cancelHandler);
	$: if (show) {
		awaitingInput = true;
		// Keep the current resolver: Svelte prop getters can be stale during teardown.
		cancelCallback = onCancel;
	} else {
		cancelHandler();
	}

	let loading = true;
	let variableValues: Record<string, unknown> = {};
	$: fields = normalizeInputVariables(variables);
	let variablesKey = '';

	const getVariableLabel = (variable: string): string => fields[variable]?.label ?? variable;
	const getVariablesKey = (value: typeof variables): string => JSON.stringify(value ?? {});

	const submitHandler = (): void => {
		// Normalize Windows CRLF (\r\n) to LF (\n) for all string values
		// Build a new object to avoid mutating the reactive variableValues proxy
		const result = Object.fromEntries(
			Object.entries(variableValues).map(([key, value]) => [
				key,
				typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value
			])
		);
		onSave(result);
		awaitingInput = false;
		show = false;
	};

	const init = async (): Promise<void> => {
		loading = true;
		variableValues = Object.fromEntries(
			Object.entries(fields).map(([key, variable]) => [
				key,
				variable.default !== undefined ? variable.default : ''
			])
		);
		loading = false;

		await tick();

		const firstInputElement = document.getElementById('input-variable-0');
		if (show && firstInputElement) {
			firstInputElement.focus();
		}
	};

	$: if (!show) {
		variablesKey = '';
	}

	$: if (show) {
		const key = getVariablesKey(variables);
		if (key !== variablesKey) {
			variablesKey = key;
			init();
		}
	}
</script>

<Modal bind:show size="md">
	<div>
		<div class=" flex justify-between dark:text-gray-300 px-4 pt-3 pb-1">
			<div class=" text-sm font-medium self-center">
				{title}
			</div>
			<button
				aria-label={$i18n.t('Close')}
				class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				on:click={() => {
					show = false;
				}}
			>
				<XMark className={'size-4'} />
			</button>
		</div>

		<div class="flex flex-col md:flex-row w-full px-4 pb-4 md:space-x-4 dark:text-gray-200">
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				<form
					class="flex flex-col w-full"
					on:submit|preventDefault={() => {
						submitHandler();
					}}
				>
					<div class="px-1">
						{#if !loading}
							<div class="flex flex-col gap-1">
								{#each Object.keys(fields) as variable, idx}
									{@const { type, ...variableAttributes } = fields[variable] ?? {}}

									<div class=" py-0.5 w-full justify-between">
										<div class="flex w-full justify-between mb-1.5">
											<label for="input-variable-{idx}" class=" self-center text-xs font-normal">
												{getVariableLabel(variable)}

												{#if fields[variable]?.required ?? false}
													<span class="ml-1 text-gray-500">* {$i18n.t('required')}</span>
												{/if}
											</label>
										</div>

										<div class="flex mt-0.5 mb-0.5 space-x-2">
											<div class=" flex-1">
												{#if type === 'select'}
													<select
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														bind:value={variableValues[variable]}
														id="input-variable-{idx}"
														required={fields[variable].required}
													>
														<option value="" disabled>
															{fields[variable]?.placeholder ?? $i18n.t('Select an option')}
														</option>
														{#each fields[variable]?.options ?? [] as option}
															<option value={option}>
																{option}
															</option>
														{/each}
													</select>
												{:else if type === 'checkbox'}
													<div class="flex items-center space-x-2">
														<div class="relative flex justify-center items-center gap-2">
															<input
																type="checkbox"
																checked={isInputChecked(variableValues[variable])}
																on:change={(e) =>
																	(variableValues[variable] = e.currentTarget.checked)}
																class="size-3.5 rounded cursor-pointer border border-gray-200 dark:border-gray-700"
																id="input-variable-{idx}"
																{...variableAttributes}
															/>

															<label for="input-variable-{idx}" class="text-sm"
																>{fields[variable]?.label ?? variable}</label
															>
														</div>

														<input
															type="text"
															class="flex-1 py-1 text-sm dark:text-gray-300 bg-transparent outline-hidden"
															placeholder={$i18n.t('Enter value (true/false)')}
															value={getInputValue(variableValues[variable])}
															on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
															autocomplete="off"
															required={fields[variable]?.required ?? false}
														/>
													</div>
												{:else if type === 'color'}
													<div class="flex items-center space-x-2">
														<div class="relative size-6">
															<input
																type="color"
																class="size-6 rounded cursor-pointer border border-gray-200 dark:border-gray-700"
																value={getInputValue(variableValues[variable])}
																id="input-variable-{idx}"
																on:input={(e) => {
																	// Convert the color value to uppercase immediately
																	variableValues[variable] = e.currentTarget.value.toUpperCase();
																}}
																{...variableAttributes}
															/>
														</div>

														<input
															type="text"
															class="flex-1 py-2 text-sm dark:text-gray-300 bg-transparent outline-hidden"
															placeholder={$i18n.t('Enter hex color (e.g. #FF0000)')}
															value={getInputValue(variableValues[variable])}
															on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
															autocomplete="off"
															required={fields[variable]?.required ?? false}
														/>
													</div>
												{:else if type === 'date'}
													<input
														type="date"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30 dark:scheme-dark"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'datetime-local'}
													<input
														type="datetime-local"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30 dark:scheme-dark"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'email'}
													<input
														type="email"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'month'}
													<input
														type="month"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30 dark:scheme-dark"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'number'}
													<input
														type="number"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) =>
															(variableValues[variable] =
																e.currentTarget.value === ''
																	? undefined
																	: e.currentTarget.valueAsNumber)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'range'}
													<div class="flex items-center space-x-2">
														<div class="relative flex justify-center items-center gap-2 flex-1">
															<input
																type="range"
																value={getInputValue(variableValues[variable])}
																on:input={(e) =>
																	(variableValues[variable] =
																		e.currentTarget.value === ''
																			? undefined
																			: e.currentTarget.valueAsNumber)}
																class="w-full rounded-lg py-1 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
																id="input-variable-{idx}"
																{...variableAttributes}
															/>
														</div>

														<input
															type="text"
															class=" py-1 text-sm dark:text-gray-300 bg-transparent outline-hidden text-right"
															placeholder={$i18n.t('Enter value')}
															value={getInputValue(variableValues[variable])}
															on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
															autocomplete="off"
															required={fields[variable]?.required ?? false}
														/>
													</div>

													<!-- <input
														type="range"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={variables[variable]?.placeholder ?? ''}
														bind:value={variableValues[variable]}
														autocomplete="off"
														id="input-variable-{idx}"
														required
													/> -->
												{:else if type === 'tel'}
													<input
														type="tel"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'text'}
													<input
														type="text"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'time'}
													<input
														type="time"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30 dark:scheme-dark"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'url'}
													<input
														type="url"
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														{...variableAttributes}
													/>
												{:else if type === 'map'}
													<!-- EXPERIMENTAL INPUT TYPE, DO NOT USE IN PRODUCTION -->
													<div class="flex flex-col items-center gap-1">
														<MapSelector
															setViewLocation={getMapLocation(variableValues[variable])}
															onClick={(value: string) => {
																variableValues[variable] = value;
															}}
														/>

														<input
															type="text"
															class=" w-full py-1 text-left text-sm dark:text-gray-300 bg-transparent outline-hidden"
															placeholder={$i18n.t('Enter coordinates (e.g. 51.505, -0.09)')}
															value={getInputValue(variableValues[variable])}
															on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
															autocomplete="off"
															id="input-variable-{idx}"
															required={fields[variable]?.required ?? false}
														/>
													</div>
												{:else}
													<textarea
														class="w-full rounded-lg py-2 px-4 text-sm dark:text-gray-300 dark:bg-gray-850 outline-hidden border border-gray-100/30 dark:border-gray-850/30"
														placeholder={fields[variable]?.placeholder ?? ''}
														value={getInputValue(variableValues[variable])}
														on:input={(e) => (variableValues[variable] = e.currentTarget.value)}
														autocomplete="off"
														id="input-variable-{idx}"
														required={fields[variable]?.required ?? false}
													></textarea>
												{/if}
											</div>
										</div>

										<!-- {#if (valvesSpec.properties[property]?.description ?? null) !== null}
									<div class="text-xs text-gray-500">
										{valvesSpec.properties[property].description}
									</div>
								{/if} -->
									</div>
								{/each}
							</div>
						{:else}
							<Spinner className="size-5" />
						{/if}
					</div>

					<div class="flex justify-end pt-3 text-sm font-normal">
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-white hover:bg-gray-100 text-black dark:bg-black dark:text-white dark:hover:bg-gray-900 transition rounded-full"
							type="button"
							on:click={() => {
								show = false;
							}}
						>
							{$i18n.t('Cancel')}
						</button>

						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
							type="submit"
						>
							{$i18n.t('Save')}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>
