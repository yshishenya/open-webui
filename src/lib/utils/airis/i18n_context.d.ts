import 'svelte';
import type i18n from '../../i18n';

// Root layout supplies this exact store; keep other context keys generic.
declare module 'svelte' {
	export function getContext(key: 'i18n'): typeof i18n;
}
