<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { getUsers } from '$lib/apis/users';
	import {
		closeDiagnosticScope,
		declareDiagnosticScope,
		DiagnosticRequestError,
		listDiagnosticScopes,
		observationApi,
		type DiagnosticDeclaration,
		type DiagnosticScope
	} from '$lib/apis/airis/emailObservations';
	import { DiagnosticTraversal } from '$lib/utils/airis/emailObservationTraversal';
	import { emailObservationCopy } from '$lib/utils/airis/emailObservationCopy';

	interface Member {
		id: string;
		name: string;
		role: string;
		created_at: number;
	}
	interface MemberPage {
		users: Member[];
		total: number;
	}
	const i18n = getContext<Readable<{ language: string }>>('i18n');
	$: copy = emailObservationCopy($i18n.language ?? 'en');
	let groups: DiagnosticScope[] = [];
	let after: string | null = null;
	let selected: DiagnosticScope | null = null;
	let loading = false;
	let writing = false;
	let error = '';
	let declarationPending: DiagnosticDeclaration | null = null;
	let showCreate = false;
	let members: Member[] = [];
	let selectedIds: string[] = [];
	let search = '';
	let page = 1;
	let total = 0;
	let usersLoading = false;
	let usersError = false;
	const today = new Date().toISOString().slice(0, 10);
	let registrationsFrom = '2000-01-01';
	let registrationsUntil = today;
	let paymentsFrom = '2000-01-01';
	let paymentsUntil = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
	let traversal: DiagnosticTraversal;
	let active = true;
	let listGeneration = 0;
	let userGeneration = 0;
	const token = (): string => localStorage.token ?? '';
	const stamp = (value: number | null): string =>
		value === null
			? copy.unknown
			: new Date(value * 1000).toLocaleString(undefined, { timeZone: 'UTC' });
	const dateStart = (value: string): number =>
		Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000);

	function adopt(scope: DiagnosticScope): void {
		selected = scope;
		groups = groups.map((row) => (row.id === scope.id ? scope : row));
	}
	function changed(): void {
		if (!active) return;
		traversal = traversal;
		if (traversal.scope) adopt(traversal.scope);
	}
	async function loadGroups(more = false): Promise<void> {
		const generation = ++listGeneration;
		loading = true;
		error = '';
		try {
			const response = await listDiagnosticScopes(token(), more ? after : null);
			if (!active || generation !== listGeneration) return;
			groups = more
				? [...new Map([...groups, ...response.items].map((row) => [row.id, row])).values()]
				: response.items;
			after = response.next_cursor;
			if (selected) adopt(await observationApi(token()).read(selected.id));
		} catch {
			if (active && generation === listGeneration) error = copy.unavailable;
		} finally {
			if (active && generation === listGeneration) loading = false;
		}
	}
	async function loadMembers(nextPage = 1): Promise<void> {
		const generation = ++userGeneration;
		usersLoading = true;
		usersError = false;
		try {
			const result: MemberPage = await getUsers(token(), search, 'created_at', 'asc', nextPage);
			if (!active || generation !== userGeneration) return;
			members = result.users.filter((row) => row.role === 'user');
			total = result.total;
			page = nextPage;
		} catch {
			if (active && generation === userGeneration) usersError = true;
		} finally {
			if (active && generation === userGeneration) usersLoading = false;
		}
	}
	function toggleMember(id: string): void {
		selectedIds = selectedIds.includes(id)
			? selectedIds.filter((value) => value !== id)
			: [...selectedIds, id];
	}
	async function declare(): Promise<void> {
		if (writing || traversal.busy) return;
		writing = true;
		error = '';
		try {
			if (!declarationPending) {
				declarationPending = {
					request_key: crypto.randomUUID(),
					user_ids: [...selectedIds],
					registrations_from: dateStart(registrationsFrom),
					registrations_until: Math.min(
						dateStart(registrationsUntil) + 86400,
						Math.floor(Date.now() / 1000)
					),
					payments_from: dateStart(paymentsFrom),
					payments_until: dateStart(paymentsUntil) + 86400
				};
			}
			const scope = await declareDiagnosticScope(token(), declarationPending);
			if (!active) return;
			declarationPending = null;
			selectedIds = [];
			showCreate = false;
			groups = [scope, ...groups.filter((row) => row.id !== scope.id)];
			adopt(scope);
		} catch (failure) {
			if (!active) return;
			if (failure instanceof DiagnosticRequestError && [409, 422].includes(failure.status)) {
				declarationPending = null;
				error = copy.declarationError;
			} else error = copy.unavailable;
		} finally {
			if (active) writing = false;
		}
	}
	async function close(): Promise<void> {
		if (!selected || writing || traversal.busy) return;
		const id = selected.id;
		writing = true;
		error = '';
		try {
			adopt(await closeDiagnosticScope(token(), id));
		} catch {
			try {
				adopt(await observationApi(token()).read(id));
			} catch {
				/* The original state stays visible with an explicit uncertainty message. */
			}
			error = copy.unavailable;
		} finally {
			if (active) writing = false;
		}
	}
	onMount(() => {
		traversal = new DiagnosticTraversal(observationApi(token()), changed);
		void loadGroups();
	});
	onDestroy(() => {
		active = false;
		traversal?.stop();
	});
</script>

<section class="space-y-4 p-4">
	<h1 class="text-xl font-semibold">{copy.title}</h1>
	<p class="text-sm text-gray-600 dark:text-gray-300">{copy.intro}</p>
	<details class="text-sm text-gray-600 dark:text-gray-300">
		<summary class="cursor-pointer">{copy.how}</summary>
		<p class="mt-2">{copy.coverage}</p>
	</details>
	<div class="flex flex-wrap gap-2">
		<button
			class="min-h-11 rounded border px-3 py-2"
			disabled={loading || writing || traversal?.busy}
			on:click={() => loadGroups()}>{copy.refresh}</button
		>
		<button
			class="min-h-11 rounded border px-3 py-2"
			disabled={writing || traversal?.busy}
			on:click={() => {
				showCreate = !showCreate;
				if (showCreate) void loadMembers();
			}}>{copy.create}</button
		>
	</div>
	{#if error}<p role="alert" class="text-red-600 dark:text-red-400">{error}</p>{/if}
	{#if showCreate}
		<form class="space-y-3 rounded border p-3" on:submit|preventDefault={declare}>
			<p class="text-sm">{copy.cap}</p>
			<fieldset disabled={writing || declarationPending !== null} class="space-y-3">
				<div class="grid gap-3 sm:grid-cols-2">
					<p class="font-medium sm:col-span-2">{copy.registrations}</p>
					<label
						>{copy.registrationsFrom}<input
							required
							type="date"
							bind:value={registrationsFrom}
							class="block rounded border bg-transparent p-2"
						/></label
					>
					<label
						>{copy.registrationsUntil}<input
							required
							type="date"
							max={today}
							bind:value={registrationsUntil}
							class="block rounded border bg-transparent p-2"
						/></label
					>
					<p class="font-medium sm:col-span-2">{copy.payments}</p>
					<label
						>{copy.paymentsFrom}<input
							required
							type="date"
							bind:value={paymentsFrom}
							class="block rounded border bg-transparent p-2"
						/></label
					>
					<label
						>{copy.paymentsUntil}<input
							required
							type="date"
							bind:value={paymentsUntil}
							class="block rounded border bg-transparent p-2"
						/></label
					>
				</div>
				<label
					>{copy.query}<input
						bind:value={search}
						class="ml-2 rounded border bg-transparent p-2"
					/></label
				>
				<button
					type="button"
					class="rounded border px-3 py-2"
					disabled={usersLoading}
					on:click={() => loadMembers()}>{copy.search}</button
				>
				{#if usersLoading}<p role="status">{copy.loading}</p>{/if}
				{#if usersError}<p role="alert">{copy.userError}</p>{/if}
				{#each members as member (member.id)}
					<label class="flex gap-2 items-center text-sm">
						<input
							type="checkbox"
							checked={selectedIds.includes(member.id)}
							disabled={!selectedIds.includes(member.id) && selectedIds.length >= 500}
							on:change={() => toggleMember(member.id)}
						/>
						<span>{member.name} · {stamp(member.created_at)}</span>
					</label>
				{/each}
				{#if !usersLoading && members.length === 0}<p>{copy.noMatches}</p>{/if}
				<div class="flex gap-2">
					<button
						type="button"
						class="rounded border px-3 py-2"
						disabled={usersLoading || page <= 1}
						on:click={() => loadMembers(page - 1)}>{copy.previous}</button
					>
					<button
						type="button"
						class="rounded border px-3 py-2"
						disabled={usersLoading || page * 30 >= total}
						on:click={() => loadMembers(page + 1)}>{copy.next}</button
					>
				</div>
			</fieldset>
			<p>{copy.selected}: {selectedIds.length}</p>
			{#if declarationPending}<p role="status">{copy.pending} {copy.cancelEdit}</p>{/if}
			<button
				class="rounded border px-3 py-2"
				disabled={writing || selectedIds.length === 0 || !traversal}
				>{declarationPending ? copy.repeat : copy.declare}</button
			>
		</form>
	{/if}
	{#if loading}<p role="status">{copy.loading}</p>{/if}
	{#if !loading && groups.length === 0}<p>{copy.empty}</p>{/if}
	<div class="flex flex-col gap-2">
		{#each groups as group (group.id)}
			<button
				class="rounded border p-3 text-left"
				aria-pressed={selected?.id === group.id}
				disabled={writing || traversal?.busy}
				on:click={() => {
					selected = group;
				}}
			>
				{stamp(group.declared_at)} · {copy.members}: {group.member_count}
				{group.closed_at !== null ? ` · ${copy.closed}` : ''}{!group.administrative
					? ` · ${copy.legacy}`
					: ''}
			</button>
		{/each}
	</div>
	{#if after}<button
			class="rounded border px-3 py-2"
			disabled={loading || writing || traversal?.busy}
			on:click={() => loadGroups(true)}>{copy.more}</button
		>{/if}
	{#if selected}
		<div class="space-y-3 rounded border p-3">
			<details>
				<summary class="cursor-pointer text-sm">{copy.technical}</summary>
				<p class="mt-2 break-all text-xs text-gray-500">{selected.id}</p>
				<dl class="grid gap-2 text-sm sm:grid-cols-2">
					<div>
						<dt>{copy.declared}</dt>
						<dd>{stamp(selected.declared_at)}</dd>
					</div>
					<div>
						<dt>{copy.started}</dt>
						<dd>{stamp(selected.observed_from)}</dd>
					</div>
					<div>
						<dt>{copy.registrationsFrom}</dt>
						<dd>{stamp(selected.registrations_from)}</dd>
					</div>
					<div>
						<dt>{copy.registrationsUntil}</dt>
						<dd>{stamp(selected.registrations_until)} ({copy.exclusive})</dd>
					</div>
					<div>
						<dt>{copy.paymentsFrom}</dt>
						<dd>{stamp(selected.payments_from)}</dd>
					</div>
					<div>
						<dt>{copy.paymentsUntil}</dt>
						<dd>{stamp(selected.payments_until)} ({copy.exclusive})</dd>
					</div>
				</dl>
			</details>
			{#if selected.last_run}
				<p role="status">{copy[selected.last_run.status]}</p>
				<p>{copy.progress}: {selected.last_run.scanned_members} / {selected.member_count}</p>
				<progress
					value={selected.last_run.cursor}
					max={selected.last_run.upper_ordinal || 1}
					aria-label={copy.progress}
					class="w-full"
				></progress>
				<p>{copy.scenarios}: {selected.last_run.scanned_scenarios}</p>
				<p>{copy.missing}: {selected.last_run.missing_source_members}</p>
				{#if selected.last_run.failure_reason}<p role="alert">
						{copy.reason}: {selected.last_run.failure_reason}
					</p>{/if}
				{#if selected.last_run.lease_until}<details>
						<summary class="cursor-pointer text-sm">{copy.technical}</summary>
						<p>
							{copy.lease}: {stamp(selected.last_run.lease_until)}
						</p>
					</details>{/if}
			{:else}<p>{copy.ready}</p>{/if}
			{#if selected.closed_at !== null}<p>{copy.closed}: {stamp(selected.closed_at)}</p>{/if}
			{#if traversal?.error}<p role="alert">{copy[traversal.error]}</p>{/if}
			{#if traversal?.stopping && traversal.busy}<p role="status">{copy.stopping}</p>{/if}
			<div class="flex flex-wrap gap-2">
				<button
					class="rounded border px-3 py-2"
					disabled={writing || traversal?.busy || selected.closed_at !== null || !traversal}
					on:click={() => selected && traversal.run(selected)}>{copy.run}</button
				>
				{#if traversal?.busy}<button
						class="rounded border px-3 py-2"
						on:click={() => traversal.stop()}>{copy.stop}</button
					>{/if}
				<button
					class="rounded border px-3 py-2"
					disabled={writing || traversal?.busy || selected.closed_at !== null}
					on:click={close}>{copy.close}</button
				>
			</div>
		</div>
	{/if}
</section>
