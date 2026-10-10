// Installed 3.0.1 is JavaScript only. Match its real props and slot, preserving item inference.
declare module '@sveltejs/svelte-virtual-list' {
	import { SvelteComponent } from 'svelte';
	export default class VirtualList<T> extends SvelteComponent<
		{ items: T[]; height?: string; itemHeight?: number; start?: number; end?: number },
		Record<string, never>,
		{ default: { item: T } }
	> {}
}
