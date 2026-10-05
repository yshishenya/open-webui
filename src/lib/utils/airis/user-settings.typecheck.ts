import type { settings } from '$lib/stores';

type Settings = Parameters<typeof settings.set>[0];
type Assert<T extends true> = T;
type Assignable<Value, Target> = [Value] extends [Target] ? true : false;

type Switches = Pick<
	Settings,
	| 'showFormattingToolbar'
	| 'insertPromptAsRichText'
	| 'temporaryChatByDefault'
	| 'showFloatingActionButtons'
	| 'chatFadeStreamingText'
	| 'regenerateMenu'
	| 'keepFollowUpPrompts'
	| 'insertFollowUpPrompt'
	| 'displayMultiModelResponsesInTabs'
	| 'insertSuggestionPrompt'
	| 'enableMessageQueue'
	| 'imageCompressionInChannels'
>;
export type ValidSwitches = Assert<Assignable<{ [Key in keyof Switches]: boolean }, Switches>>;
export type RejectStringSwitch = Assert<
	Assignable<'true', Settings['showFormattingToolbar']> extends false ? true : false
>;
export type EmptySettings = Assert<Assignable<Record<string, never>, Settings>>;
export type StringModels = Assert<Assignable<string[], NonNullable<Settings['pinnedModels']>>>;
export type StringTools = Assert<Assignable<string[], NonNullable<Settings['tools']>>>;
export type RejectNumericModels = Assert<
	Assignable<number[], NonNullable<Settings['pinnedModels']>> extends false ? true : false
>;
export type RejectNumericTools = Assert<
	Assignable<number[], NonNullable<Settings['tools']>> extends false ? true : false
>;
type Terminal = NonNullable<Settings['terminalServers']>[number];
export type MinimalTerminal = Assert<Assignable<{ url: string; enabled: false }, Terminal>>;
export type CompleteTerminal = Assert<
	Assignable<
		{ url: string; enabled: true; name: string; key: string; path: string; auth_type: string },
		Terminal
	>
>;
export type RejectNumericUrl = Assert<
	Assignable<{ url: number; enabled: true }, Terminal> extends false ? true : false
>;
export type RejectStringEnabled = Assert<
	Assignable<{ url: string; enabled: string }, Terminal> extends false ? true : false
>;
export type VersionString = Assert<Assignable<string, NonNullable<Settings['version']>>>;
