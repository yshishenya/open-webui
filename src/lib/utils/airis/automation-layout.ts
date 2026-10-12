import type { ComponentProps } from 'svelte';
import type { Writable } from 'svelte/store';
import type AutomationListHeaderActions from '$lib/components/automations/AutomationListHeaderActions.svelte';
import type AutomationItemHeaderActions from '$lib/components/automations/AutomationItemHeaderActions.svelte';

export type AutomationHeader = {
	itemName?: string | null;
	actions?: typeof AutomationListHeaderActions | typeof AutomationItemHeaderActions | null;
	actionProps?: Partial<
		ComponentProps<typeof AutomationListHeaderActions> &
			ComponentProps<typeof AutomationItemHeaderActions>
	>;
};

export type AutomationLayout = {
	total: Writable<number | null>;
	setTotal: (value: number | null) => void;
	refreshCount: () => Promise<void>;
	setHeader: (header: AutomationHeader) => void;
	clearHeader: () => void;
};
