<script lang="ts">
	import type { PermissionSettingsInput } from '$lib/utils/airis/permission-types';
	import Permissions from '$lib/components/admin/Users/Groups/Permissions.svelte';

	export let permissions: PermissionSettingsInput = {};
	export let defaultPermissions: PermissionSettingsInput = {};
	export function load(next: PermissionSettingsInput): void {
		permissions = next;
	}
</script>

<Permissions bind:permissions {defaultPermissions} />
<output data-testid="permission-state">{JSON.stringify(permissions)}</output>
