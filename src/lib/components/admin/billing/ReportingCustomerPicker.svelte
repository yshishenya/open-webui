<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import {
		getBillingReportingCustomers,
		type BillingReportingCustomer
	} from '$lib/apis/admin/billing_reporting';
	const i18n = getContext<Readable<I18nType>>('i18n');
	export let userId = '';
	export let currency = 'RUB';
	let query = '';
	let results: BillingReportingCustomer[] = [];
	let error = '';
	let searching = false;
	let version = 0;
	let searched = false;
	const search = async (): Promise<void> => {
		if (!query.trim()) {
			results = [];
			return;
		}
		const id = ++version;
		searching = true;
		error = '';
		searched = false;
		results = [];
		try {
			const response = await getBillingReportingCustomers(localStorage.token, {
				currency,
				query: query.trim(),
				page_size: 10
			});
			if (id === version) {
				results = response.items;
				searched = true;
			}
		} catch {
			if (id === version) error = 'Failed to load billing customers';
		} finally {
			if (id === version) searching = false;
		}
	};
</script>

<div class="min-w-0">
	<label class="text-xs text-gray-500"
		>{$i18n.t('Customer')}<input
			bind:value={query}
			placeholder={$i18n.t('Name, email or ID')}
			class="min-h-11 mt-1 block w-full rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
		/></label
	>
	<div class="mt-1 flex flex-wrap gap-2 text-xs">
		<button type="button" disabled={searching} class="min-h-11 underline" on:click={search}
			>{$i18n.t(searching ? 'Loading' : 'Find customer')}</button
		>{#if userId}<button
				type="button"
				class="min-h-11 break-all underline"
				on:click={() => {
					userId = '';
					query = '';
					results = [];
					searched = false;
					version++;
					searching = false;
				}}>{$i18n.t('Clear customer')}: {userId}</button
			>{/if}
	</div>
	{#if error}<p role="alert" class="mt-2 text-xs text-red-700">
			{$i18n.t(error)}
		</p>{/if}{#if searched && !results.length}<p role="status" class="mt-2 text-xs text-gray-500">
			{$i18n.t('No customers found')}
		</p>{/if}{#if results.length}<ul
			class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-800"
		>
			{#each results as row}<li>
					<button
						type="button"
						class="min-h-11 w-full break-words p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
						on:click={() => {
							userId = row.user_id;
							query = row.name || row.email;
							results = [];
							searched = false;
						}}
						>{row.name || row.email}<span class="block text-xs text-gray-500">{row.email}</span
						></button
					>
				</li>{/each}
		</ul>{/if}
</div>
