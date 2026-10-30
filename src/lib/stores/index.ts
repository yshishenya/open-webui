import type { Model, ModelDownload } from '$lib/utils/airis/model-types';
import type { ChatAttachment } from '$lib/utils/airis/chat_history';
import type { CitationEmbed } from '$lib/utils/airis/citations';
import type { NoteListItem } from '$lib/utils/airis/notes';
import type { ChannelDisplayMessage, ChannelListItem } from '$lib/utils/airis/channel-types';
import {
	CONTROL_LABELS,
	isControlVisible,
	type ControlId
} from '$lib/utils/ui-visibility';
import { APP_NAME } from '$lib/constants';
import { type Writable, derived, writable } from 'svelte/store';
import type { Banner } from '$lib/types';
import type { Socket } from 'socket.io-client';
import type { TerminalSkill } from '$lib/apis/terminal';
import type { AudioQueue } from '$lib/utils/audio';
import type { KokoroWorker } from '$lib/workers/KokoroWorker';
import type {
	ArtifactContent,
	DirectModelConnections,
	DirectTerminalSettings,
	ToolServerConnection,
	FrontendConfig,
	FolderListItem,
	SelectedFolder,
	GenerationParams,
	ImageCompressionSize,
	FloatingAction,
	SpeechSettings,
	StoredTerminalServer,
	FunctionListItem,
	ToolListItem,
	SkillListItem,
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
export const MODEL_DOWNLOAD_POOL = writable<Record<string, ModelDownload>>({});

export const mobile = writable(false);

export const socket: Writable<null | Socket> = writable(null);
export const socketConnected: Writable<boolean> = writable(true);
export const activeUserIds: Writable<null | string[]> = writable(null);
export const USAGE_POOL: Writable<null | string[]> = writable(null);

export const theme = writable('system');

export const shortCodesToEmojis = writable(
	Object.entries(emojiShortCodes).reduce<Record<string, string>>((acc, [key, value]) => {
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

export const TTSWorker = writable<KokoroWorker | null>(null);

export const chatId = writable('');
export const chatTitle = writable('');

export const channels = writable<ChannelListItem[]>([]);
export const channelId = writable<string | null>(null);

export { chats, pinnedChats } from './chatList';
export const pinnedNotes = writable<NoteListItem[]>([]);
export const tags = writable([]);
export const folders = writable<FolderListItem[]>([]);

export const selectedFolder = writable<SelectedFolder | null>(null);

export const models: Writable<Model[]> = writable([]);

export const knowledge: Writable<null | Document[]> = writable(null);
export const tools = writable<ToolListItem[] | null>(null);
export const skills = writable<SkillListItem[] | null>(null);
export const terminalSkills: Writable<TerminalSkill[]> = writable([]);
export const functions = writable<FunctionListItem[] | null>(null);

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

export const toolServers = writable<StoredTerminalServer[]>([]);
export const terminalServers: Writable<StoredTerminalServer[] | null> = writable(null);

// Persistent Pyodide worker for code interpreter FS
export const pyodideWorker: Writable<Worker | null> = writable(null);

export const banners: Writable<Banner[]> = writable([]);

export const settings: Writable<Settings> = writable({});

// Users who never pinned a model follow the admin default, so changes to it keep reaching them
export const pinnedModels = derived([settings, config], ([$settings, $config]) =>
	$settings?.pinnedModels === undefined
		? ($config?.default_pinned_models ?? '').split(',').filter((id) => id)
		: $settings.pinnedModels
);

// Pins for models the user cannot see are kept in their settings but left out of the sidebar
export const visiblePinnedModels = derived([pinnedModels, models], ([$pinnedModels, $models]) =>
	$pinnedModels.filter((id) =>
		$models.some((model) => model.id === id && !model.info?.meta?.hidden)
	)
);

export const visibleControls = derived(
	[config, user],
	([$config, $user]) =>
		Object.fromEntries(
			(Object.keys(CONTROL_LABELS) as ControlId[]).map((id) => [
				id,
				isControlVisible(id, { config: $config, user: $user })
			])
		) as Record<ControlId, boolean>
);

export const audioQueue = writable<AudioQueue | null>(null);
export const chatRequestQueues: Writable<
	Record<string, { id: string; prompt: string; files: ChatAttachment[]; error?: string }[]>
> = writable({});

export type ChannelQueuedMessage = {
	id: string;
	prompt: string;
	files: ChatAttachment[];
	user_id: string;
	channel_id: string;
	parent_id: string | null;
	reply_to_message: ChannelDisplayMessage | null;
	sending?: boolean;
	error?: string;
};
export const channelRequestQueues = writable<Record<string, ChannelQueuedMessage[]>>({});

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
export type FileNavOpenRequest = string | { path: string; page?: number | null };
export const showFileNavPath: Writable<FileNavOpenRequest | null> = writable(null);
export const showFileNavDir: Writable<string | null> = writable(null);
export const selectedTerminalId: Writable<string | null> = writable(null);
export const connectedUserTerminals = writable(
	new Map<symbol, { terminalId: string; chatId: string }>()
);

export const artifactCode = writable<string | null>(null);
export const artifactContents: Writable<ArtifactContent[] | null> = writable(null);

export const embed: Writable<CitationEmbed | null> = writable(null);

export const temporaryChatEnabled = writable<boolean | null>(false);

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

export type Settings = {
	pinnedModels?: string[];
	tools?: string[];
	terminalServers?: DirectTerminalSettings[];
	version?: string;
	toolServers?: ToolServerConnection[];
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
	textScale?: number | null;
	fontFamily?: string | null;
	terminalFileDisplay?: 'sidebar' | 'inline';
	widescreenMode?: boolean;
	largeTextAsFile?: boolean;
	promptAutocomplete?: boolean;
	hapticFeedback?: boolean;
	responseAutoCopy?: boolean;
	richTextInput?: boolean;
	showFormattingToolbar?: boolean;
	insertPromptAsRichText?: boolean;
	temporaryChatByDefault?: boolean;
	showFloatingActionButtons?: boolean;
	floatingActionButtons?: FloatingAction[] | null;
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
	backgroundImageUrl?: string | null;
	landingPageMode?: string;
	iframeSandboxAllowScripts?: boolean;
	iframeSandboxAllowForms?: boolean;
	iframeSandboxAllowSameOrigin?: boolean;
	iframeSandboxAllowDownloads?: boolean;
	terminalPreviewAllowSameOrigin?: boolean;
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
	chatHoverPreview?: boolean;
	renderMarkdownInPreviews?: boolean;
	renderMarkdownInUserMessages?: boolean;
	renderMarkdownInAssistantMessages?: boolean;
	recentEmojis?: string[];
	pinnedMenuItems?: string[];
	pinnedNotesOrder?: string[];

	defaultUploadContext?: 'full' | 'focused';

	system?: string | null;
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

export type { Model, ModelDownload } from '$lib/utils/airis/model-types';
