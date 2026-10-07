import { APP_NAME } from '$lib/constants';
import { type Writable, writable } from 'svelte/store';
import type { ModelConfig } from '$lib/apis';
import type { Banner } from '$lib/types';
import type { Socket } from 'socket.io-client';
import type { AudioQueue } from '$lib/utils/audio';
import type {
	ArtifactContent,
	DirectModelConnections,
	DirectTerminalSettings,
	FrontendConfig,
	FolderListItem,
	SelectedFolder,
	GenerationParams,
	ImageCompressionSize,
	SpeechSettings,
	StoredTerminalServer,
	UserPermissions
} from '$lib/utils/airis/frontend-contracts';

import emojiShortCodes from '$lib/emoji-shortcodes.json';

// What is held here is the only truth the house knows.
// When it changes, let every room hear at once.
// Backend
export const WEBUI_NAME = writable(APP_NAME);

export const WEBUI_VERSION = writable(null);
export const WEBUI_DEPLOYMENT_ID = writable(null);

export const config: Writable<FrontendConfig | undefined> = writable(undefined);
export const user: Writable<SessionUser | null | undefined> = writable(undefined);

// Electron App
export const isApp = writable(false);
export const appInfo = writable(null);
export const appData = writable(null);

// Frontend
export const MODEL_DOWNLOAD_POOL = writable({});

export const mobile = writable(false);

export const socket: Writable<null | Socket> = writable(null);
export const socketConnected: Writable<boolean> = writable(true);
export const activeUserIds: Writable<null | string[]> = writable(null);
export const USAGE_POOL: Writable<null | string[]> = writable(null);

export const theme = writable('system');

export const shortCodesToEmojis = writable(
	Object.entries(emojiShortCodes).reduce((acc, [key, value]) => {
		if (typeof value === 'string') {
			acc[value] = key;
		} else {
			for (const v of value) {
				acc[v] = key;
			}
		}

		return acc;
	}, {})
);

export const TTSWorker = writable(null);

export const chatId = writable('');
export const chatTitle = writable('');

export const channels = writable([]);
export const channelId = writable(null);

export { chats, pinnedChats } from './chatList';
export const pinnedNotes = writable([]);
export const tags = writable([]);
export const folders = writable<FolderListItem[]>([]);

export const selectedFolder = writable<SelectedFolder | null>(null);

export const models: Writable<Model[]> = writable([]);

export const knowledge: Writable<null | Document[]> = writable(null);
export const tools = writable(null);
export const skills = writable(null);
export const functions = writable(null);

export type WorkspaceSection = 'models' | 'knowledge' | 'prompts' | 'skills' | 'tools';
export type WorkspaceAction = {
	id: string;
	label: string;
	href?: string;
	onClick?: () => void | Promise<void>;
	visible?: boolean;
};

export const workspaceCounts: Writable<Record<WorkspaceSection, number | null>> = writable({
	models: null,
	knowledge: null,
	prompts: null,
	skills: null,
	tools: null
});
export const workspaceActions: Writable<WorkspaceAction[]> = writable([]);
export const adminUserCount: Writable<number | null> = writable(null);
export const adminGroupCount: Writable<number | null> = writable(null);
export const adminLeaderboardCount: Writable<number | null> = writable(null);
export const adminFeedbackCount: Writable<number | null> = writable(null);

export const toolServers = writable([]);
export const terminalServers: Writable<StoredTerminalServer[] | null> = writable(null);

// Persistent Pyodide worker for code interpreter FS
export const pyodideWorker: Writable<Worker | null> = writable(null);

export const banners: Writable<Banner[]> = writable([]);

export const settings: Writable<Settings> = writable({});

export const audioQueue = writable<AudioQueue | null>(null);
export const chatRequestQueues: Writable<
	Record<string, { id: string; prompt: string; files: Record<string, unknown>[] }[]>
> = writable({});

export const sidebarWidth = writable(245);

export type SettingsModalRequest = {
	tab: string;
	state?: Record<string, unknown> | null;
};

export const showSidebar = writable(false);
export const showSearch = writable(false);
export const showSettings: Writable<boolean | string | SettingsModalRequest> = writable(false);
export const showChangelog = writable(false);

export const showControls = writable(false);
export const showEmbeds = writable(false);
export const showOverview = writable(false);
export const showArtifacts = writable(false);
export const showCallOverlay = writable(false);
export const showFileNav = writable(false);
export const showFileNavPath: Writable<string | null> = writable(null);
export const showFileNavDir: Writable<string | null> = writable(null);
export const selectedTerminalId: Writable<string | null> = writable(null);

export const artifactCode = writable(null);
export const artifactContents: Writable<ArtifactContent[] | null> = writable(null);

export const embed = writable(null);

export const temporaryChatEnabled = writable(false);

// Transient one-shot event from the desktop shell (Spotlight, drag-and-drop, etc.).
// Set by +layout.svelte, consumed and cleared by Chat.svelte.
export type DesktopEventFile = { name: string; mimeType: string; dataUrl: string };
export type DesktopEvent = {
	type: string;
	data?: { query?: string; files?: DesktopEventFile[] };
};
export const desktopEvent: Writable<DesktopEvent | null> = writable(null);

export const isLastActiveTab = writable(true);
export const playingNotificationSound = writable(false);

export type Model = OpenAIModel | OllamaModel;

type BaseModel = {
	id: string;
	name: string;
	info?: ModelConfig;
	owned_by: 'ollama' | 'openai' | 'arena';
};

export interface OpenAIModel extends BaseModel {
	owned_by: 'openai';
	external: boolean;
	source?: string;
}

export interface OllamaModel extends BaseModel {
	owned_by: 'ollama';
	details: OllamaModelDetails;
	size: number;
	description: string;
	model: string;
	modified_at: string;
	digest: string;
	ollama?: {
		name?: string;
		model?: string;
		modified_at: string;
		size?: number;
		digest?: string;
		details?: {
			parent_model?: string;
			format?: string;
			family?: string;
			families?: string[];
			parameter_size?: string;
			quantization_level?: string;
		};
		urls?: number[];
	};
}

type OllamaModelDetails = {
	parent_model: string;
	format: string;
	family: string;
	families: string[] | null;
	parameter_size: string;
	quantization_level: string;
};

type Settings = {
	pinnedModels?: string[];
	tools?: string[];
	terminalServers?: DirectTerminalSettings[];
	version?: string;
	toolServers?: never[];
	detectArtifacts?: boolean;
	showUpdateToast?: boolean;
	showChangelog?: boolean;
	showEmojiInCall?: boolean;
	voiceInterruption?: boolean;
	collapseCodeBlocks?: boolean;
	expandDetails?: boolean;
	notificationSound?: boolean;
	notificationSoundAlways?: boolean;
	stylizedPdfExport?: boolean;
	imageCompression?: boolean;
	imageCompressionSize?: ImageCompressionSize;
	textScale?: number;
	widescreenMode?: null;
	largeTextAsFile?: boolean;
	promptAutocomplete?: boolean;
	hapticFeedback?: boolean;
	responseAutoCopy?: boolean;
	richTextInput?: boolean;
	showFormattingToolbar?: boolean;
	insertPromptAsRichText?: boolean;
	temporaryChatByDefault?: boolean;
	showFloatingActionButtons?: boolean;
	chatFadeStreamingText?: boolean;
	regenerateMenu?: boolean;
	keepFollowUpPrompts?: boolean;
	insertFollowUpPrompt?: boolean;
	displayMultiModelResponsesInTabs?: boolean;
	insertSuggestionPrompt?: boolean;
	enableMessageQueue?: boolean;
	imageCompressionInChannels?: boolean;
	params?: GenerationParams;
	userLocation?: boolean;
	webSearch?: 'always' | null;
	memory?: boolean;
	autoTags?: boolean;
	autoFollowUps?: boolean;
	splitLargeChunks?: boolean;
	backgroundImageUrl?: null;
	landingPageMode?: string;
	iframeSandboxAllowForms?: boolean;
	iframeSandboxAllowSameOrigin?: boolean;
	scrollOnBranchChange?: boolean;
	scrollOnResponseGeneration?: boolean;
	showFilesOnTerminalSelect?: boolean;
	directConnections?: DirectModelConnections | null;
	chatBubble?: boolean;
	copyFormatted?: boolean;
	models?: string[];
	conversationMode?: boolean;
	speechAutoSend?: boolean;
	responseAutoPlayback?: boolean;
	audio?: AudioSettings;
	showUsername?: boolean;
	notificationEnabled?: boolean;
	highContrastMode?: boolean;
	title?: TitleSettings;
	showChatTitleInTab?: boolean;
	splitLargeDeltas?: boolean;
	chatDirection?: 'LTR' | 'RTL' | 'auto';
	ctrlEnterToSend?: boolean;
	keyboardShortcuts?: boolean;
	renderMarkdownInPreviews?: boolean;
	renderMarkdownInUserMessages?: boolean;
	renderMarkdownInAssistantMessages?: boolean;
	recentEmojis?: string[];
	pinnedMenuItems?: string[];
	pinnedNotesOrder?: string[];

	defaultUploadContext?: 'full' | 'focused';

	system?: string;
	seed?: number;
	temperature?: string;
	repeat_penalty?: string;
	top_k?: string;
	top_p?: string;
	num_ctx?: string;
	num_batch?: string;
	num_keep?: string;
	options?: ModelOptions;
};

type ModelOptions = {
	stop?: boolean;
};

type AudioSettings = {
	stt?: SpeechSettings['stt'];
	tts?: SpeechSettings['tts'];
	STTEngine?: string;
	TTSEngine?: string;
	speaker?: string;
	model?: string;
	nonLocalVoices?: boolean;
};

type TitleSettings = {
	auto?: boolean;
	model?: string;
	modelExternal?: string;
	prompt?: string;
};

type Document = {
	collection_name: string;
	filename: string;
	name: string;
	title: string;
};

export type SessionUser = {
	permissions: UserPermissions;
	id: string;
	email: string;
	name: string;
	role: string;
	profile_image_url: string;
	token?: string;
	token_type?: string;
	expires_at?: number | null;
	bio?: string | null;
	gender?: string | null;
	date_of_birth?: string | null;
	status_emoji?: string | null;
	status_message?: string | null;
	status_expires_at?: number | null;
};
