// SortableJS ships JavaScript only; declare the constructor and cleanup API used here.
declare module 'sortablejs' {
	export default class Sortable {
		constructor(element: HTMLElement, options?: Record<string, unknown>);
		option(name: string, value: unknown): void;
		destroy(): void;
	}
}
