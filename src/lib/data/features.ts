import featuresPage from './features-page.json';
import presetsData from './presets.json';

export type FeatureCategory = {
	id: string;
	label: string;
};

export type FeaturePreset = {
	id: string;
	title: string;
	result: string;
	category: string;
	prompt: string;
	promptPreview?: string;
	resultPreview?: string;
};

export type FeatureTabConfig = {
	id: string;
	label: string;
	title: string;
	bullets: string[];
	examplePresetId: string;
};

export type FeaturePageConfig = {
	version: number;
	hero: {
		eyebrow: string;
		title: string;
		lead: string;
		chips: string[];
		primaryCtaLabelGuest: string;
		primaryCtaLabelAuthed: string;
		secondaryCtaLabel: string;
		secondaryCtaAnchor: string;
		microcopy: string;
	};
	examples: {
		title: string;
		subtitle: string;
		categories: FeatureCategory[];
		presetIds: string[];
	};
	featureTabs: {
		title: string;
		subtitle: string;
		tabs: FeatureTabConfig[];
	};
	how: {
		title: string;
		subtitle: string;
		steps: Array<{ title: string; text: string }>;
		callout: string;
	};
	models: {
		title: string;
		subtitle: string;
		maxVisible: number;
	};
	control: {
		title: string;
		cards: Array<{ title: string; text: string }>;
		pricingLinkLabel: string;
		pricingLinkHref: string;
	};
};

export const featurePageConfig = featuresPage as FeaturePageConfig;
export const featurePresets = presetsData as FeaturePreset[];

export const presetsById = featurePresets.reduce<Record<string, FeaturePreset>>((acc, preset) => {
	acc[preset.id] = preset;
	return acc;
}, {});

export const featurePresetsById = presetsById;
