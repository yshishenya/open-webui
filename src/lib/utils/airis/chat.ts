/** An explicit model link must never silently fall back to a different model. */
export const resolveRequestedModels = (
	searchParams: URLSearchParams,
	availableModelIds: string[]
): string[] | null => {
	const requested = searchParams.get('models') || searchParams.get('model');
	if (!requested) return null;
	const modelIds = requested.split(',');
	return modelIds.every((id) => availableModelIds.includes(id)) ? modelIds : [''];
};

type MessageInputLike = {
	setText: (text: string) => void | boolean | Promise<void | boolean>;
};

type WelcomePresetPromptPayload = {
	prompt?: unknown;
	source?: unknown;
	createdAt?: unknown;
};

const WELCOME_PRESET_STORAGE_KEY = 'welcome_preset_prompt';
const WELCOME_PRESET_TTL_MS = 10 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const clearWelcomePresetPrompt = (): void => {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(WELCOME_PRESET_STORAGE_KEY);
};

export const consumeWelcomePresetPrompt = (nowMs: number = Date.now()): string | null => {
	if (typeof sessionStorage === 'undefined') return null;

	const raw = sessionStorage.getItem(WELCOME_PRESET_STORAGE_KEY);
	if (!raw) return null;

	sessionStorage.removeItem(WELCOME_PRESET_STORAGE_KEY);

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch (error) {
		console.warn('Failed to parse welcome preset prompt:', error);
		return null;
	}

	const payload: WelcomePresetPromptPayload = isRecord(parsed)
		? (parsed as WelcomePresetPromptPayload)
		: {};
	const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
	const source = typeof payload.source === 'string' ? payload.source : '';
	const createdAt = typeof payload.createdAt === 'number' ? payload.createdAt : null;

	const presetAgeMs = createdAt ? nowMs - createdAt : Number.POSITIVE_INFINITY;
	if (!prompt || !source.startsWith('welcome_') || presetAgeMs > WELCOME_PRESET_TTL_MS) {
		return null;
	}

	return prompt;
};

export const setTextWithRetries = async (
	getMessageInput: () => MessageInputLike | null | undefined,
	wait: () => Promise<void>,
	text: string,
	{ maxAttempts = 5 }: { maxAttempts?: number } = {}
): Promise<boolean> => {
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const messageInput = getMessageInput();
		if (messageInput) {
			return (await messageInput.setText(text)) !== false;
		}
		await wait();
	}

	return false;
};

type UsageCapableModel = {
	owned_by?: unknown;
	info?: {
		meta?: {
			capabilities?: {
				usage?: unknown;
			} | null;
		} | null;
	} | null;
};

export const shouldIncludeUsage = (model: UsageCapableModel): boolean => {
	const explicitUsage = model?.info?.meta?.capabilities?.usage;
	if (typeof explicitUsage === 'boolean') return explicitUsage;

	return model?.owned_by === 'openai';
};
