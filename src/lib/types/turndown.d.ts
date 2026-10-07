// JavaScript packages: the conversion API used by AIRIS, from the installed README.
declare module 'turndown' {
	export type Options = {
		codeBlockStyle?: 'indented' | 'fenced';
		headingStyle?: 'setext' | 'atx';
	};
	export type Rule = {
		filter: string | string[] | ((node: HTMLElement, options: Options) => boolean);
		replacement: (content: string, node: HTMLElement, options: Options) => string;
	};
	export default class TurndownService {
		constructor(options?: Options);
		escape(text: string): string;
		turndown(input: string | Node): string;
		addRule(key: string, rule: Rule): this;
		use(
			plugin: ((service: TurndownService) => void) | ((service: TurndownService) => void)[]
		): this;
	}
}

declare module '@joplin/turndown-plugin-gfm' {
	export function gfm(service: import('turndown').default): void;
}
