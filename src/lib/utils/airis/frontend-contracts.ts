import type { ModelParams } from '$lib/apis';
import type { Content } from '@tiptap/core';
import type { Model } from './model-types';
import type { ModelTag } from './model-types';
import type { ChatAttachment, ChatHistory, ChatHistoryMessage } from './chat_history';
import type { DEFAULT_PERMISSIONS } from '$lib/constants/permissions';
import type { TerminalServer } from '$lib/apis/terminal';
import type { updateOpenAIConfig } from '$lib/apis/openai';
import type { ComponentProps } from 'svelte';
import type AccessControlModal from '$lib/components/workspace/common/AccessControlModal.svelte';

export type ArtifactContent = { type: 'iframe' | 'svg'; content: string };

// GET /functions/ FunctionResponse; metadata may have null fields.
export type FunctionListItem = {
	id: string;
	user_id: string | null;
	type: string;
	name: string;
	meta: {
		description: string | null;
		manifest: Record<string, unknown> | null;
		toggle?: boolean;
		[key: string]: unknown;
	};
	is_active: boolean;
	is_global: boolean;
	updated_at: number;
	created_at: number;
};

// GET /tools/ ToolUserResponse and GET /skills/ SkillUserResponse.
export type ToolListItem = {
	id: string;
	user_id: string | null;
	name: string;
	meta: {
		description: string | null;
		manifest: Record<string, unknown> | null;
		has_user_valves: boolean;
	};
	access_grants: {
		id: string;
		resource_type: string;
		resource_id: string;
		principal_type: string;
		principal_id: string;
		permission: string;
		created_at: number;
	}[];
	updated_at: number;
	created_at: number;
	specs?: {
		name?: string;
		function?: { name?: string; [key: string]: unknown };
		[key: string]: unknown;
	}[];
	authenticated?: boolean;
	has_user_valves?: boolean;
};

export type SkillListItem = {
	id: string;
	user_id: string;
	name: string;
	description: string | null;
	meta: { tags: string[] | null };
	is_active: boolean;
	access_grants: ToolListItem['access_grants'];
	updated_at: number;
	created_at: number;
};

export type ModelConnectionConfig = {
	enable?: boolean | null;
	model_ids?: string[] | null;
	prefix_id?: string | null;
	tags?: ModelTag[] | null;
	auth_type?: string;
	headers?: Record<string, string>;
	connection_type?: string;
	provider?: string;
	azure?: boolean;
	api_version?: string;
	api_type?: string;
	passthrough_params?: string[] | string | null;
	key?: string;
	[key: string]: unknown;
};
export type ModelConnection = { url: string; key: string; config: ModelConnectionConfig };
export type ConnectionSave = (
	connection: ModelConnection
) => boolean | void | Promise<boolean | void>;
export type ConnectionDelete = () => boolean | void | Promise<boolean | void>;
export type DirectModelConnections = Pick<
	Parameters<typeof updateOpenAIConfig>[1],
	'OPENAI_API_BASE_URLS' | 'OPENAI_API_KEYS'
> & { OPENAI_API_CONFIGS: Record<string, ModelConnectionConfig | null> };

export type UserPermissions = {
	[Section in keyof typeof DEFAULT_PERMISSIONS]?: {
		[Permission in keyof (typeof DEFAULT_PERMISSIONS)[Section]]?: boolean;
	};
};

// Direct OpenAPI terminals have a URL; system terminals also have an id and name.
export type StoredTerminalServer = Partial<Pick<TerminalServer, 'id' | 'name'>> &
	Pick<TerminalServer, 'url'> & {
		info?: { title?: string; description?: string };
		openapi?: {
			info?: { title?: string; version?: string; description?: string };
			[key: string]: unknown;
		};
		specs?: Record<string, unknown>[];
	};

export type DirectTerminalSettings = Pick<StoredTerminalServer, 'url' | 'name'> & {
	enabled: boolean;
	key?: string;
	auth_type?: string;
	path?: string;
};

export type TerminalServerConnection = Pick<DirectTerminalSettings, 'url'> &
	Partial<DirectTerminalSettings> & {
		id?: string;
		config?: { access_grants?: ComponentProps<typeof AccessControlModal>['accessGrants'] } | null;
		server_type?: 'orchestrator' | 'terminal' | null;
		policy_id?: string | null;
		[key: string]: unknown;
	};
export type TerminalConnectionSave = (
	connection: TerminalServerConnection & { enabled: boolean }
) => boolean | void | Promise<boolean | void>;

// configs.ToolServerConnection; optional fields also accept legacy user settings.
export type ToolServerConnection = {
	url: string;
	path?: string;
	type?: string | null;
	spec_type?: string;
	spec?: string;
	auth_type?: string | null;
	headers?: Record<string, string> | null;
	key?: string | null;
	config?: {
		enable?: boolean;
		function_name_filter_list?: string;
		access_grants?: ComponentProps<typeof AccessControlModal>['accessGrants'];
	} | null;
	info?: {
		id?: string;
		name?: string;
		description?: string;
		oauth_client_info?: string | null;
		oauth_client_id?: string;
		oauth_client_secret?: string;
		oauth_server_url?: string;
		oauth_scope?: string;
		oauth_resource_parameter?: string;
	} | null;
};
export type ToolConnectionSave = (
	connection: ToolServerConnection
) => boolean | void | Promise<boolean | void>;

export type GenerationParams = {
	stream_response?: boolean | null;
	stream_delta_chunk_size?: number | null;
	compact_token_threshold?: number | null;
	function_calling?: 'native' | 'legacy' | null;
	reasoning_tags?: boolean | [string, string] | null;
	reasoning_effort?: string | null;
	logit_bias?: string | null;
	seed?: number | null;
	temperature?: number | null;
	frequency_penalty?: number | null;
	presence_penalty?: number | null;
	repeat_penalty?: number | null;
	repeat_last_n?: number | null;
	mirostat?: number | null;
	mirostat_eta?: number | null;
	mirostat_tau?: number | null;
	top_k?: number | null;
	top_p?: number | null;
	min_p?: number | null;
	stop?: string[] | null;
	tfs_z?: number | null;
	num_ctx?: number | null;
	num_batch?: number | null;
	num_keep?: number | null;
	max_tokens?: number | null;
	use_mmap?: boolean | null;
	use_mlock?: boolean | null;
	num_thread?: number | null;
	num_gpu?: number | null;
	think?: boolean | string | null;
	format?: string | null;
	keep_alive?: string | null;
	custom_params?: Record<string, string>;
};

export type ImageCompressionSize = {
	width: number | '' | undefined;
	height: number | '' | undefined;
};
export type SpeechSettings = {
	stt?: { engine?: string; language?: string };
	tts?: {
		engine?: string;
		engineConfig?: { dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16' };
		defaultVoice?: string;
		voice?: string;
		playbackRate?: number;
		nonLocalVoices?: boolean;
	};
};

export type OAuthProvider = {
	name: string;
	app_id?: string;
	redirect_url?: string | null;
	bot_name?: string;
};

// Public fields are available before login; authenticated sections are optional.
export type FrontendConfig = {
	status: boolean;
	name: string;
	version: string;
	default_locale: string;
	onboarding?: boolean;
	oauth: { providers: Record<string, OAuthProvider>; auto_redirect?: boolean | null };
	telegram: { enabled: boolean; bot_username: string };
	metadata?: { login_footer: string; auth_logo_position: string };
	features: {
		auth: boolean;
		auth_trusted_header: boolean;
		enable_signup: boolean;
		enable_signup_password_confirmation: boolean;
		enable_login_form: boolean;
		enable_ldap: boolean;
		enable_websocket: boolean;
		enable_billing_subscriptions: boolean;
	} & Partial<
		Record<
			| 'enable_api_keys'
			| 'enable_password_change_form'
			| 'enable_version_update_check'
			| 'enable_pyodide_file_persistence'
			| 'enable_public_active_users_count'
			| 'enable_easter_eggs'
			| 'enable_direct_connections'
			| 'enable_plugins'
			| 'enable_folders'
			| 'enable_channels'
			| 'enable_calendar'
			| 'enable_automations'
			| 'enable_notes'
			| 'enable_context_compaction'
			| 'enable_web_search'
			| 'enable_web_search_confirmation'
			| 'enable_code_execution'
			| 'enable_code_interpreter'
			| 'enable_image_generation'
			| 'enable_autocomplete_generation'
			| 'enable_community_sharing'
			| 'enable_message_rating'
			| 'enable_user_webhooks'
			| 'enable_user_status'
			| 'enable_admin_export'
			| 'enable_admin_chat_access'
			| 'enable_admin_analytics'
			| 'enable_google_drive_integration'
			| 'enable_onedrive_integration'
			| 'enable_memories'
			| 'enable_onedrive_personal'
			| 'enable_onedrive_business',
			boolean
		>
	> & { folder_max_file_count?: number; web_search_confirmation_content?: string };
	default_models?: string;
	default_pinned_models?: string | null;
	default_prompt_suggestions?: { content: string; title: [string, string] }[];
	user_count?: number;
	active_entries?: number;
	code?: { engine: string; interpreter_engine: string };
	audio?: { tts: { engine: string; voice: string; split_on: string }; stt: { engine: string } };
	file?: {
		max_size: number | null;
		max_count: number | null;
		image_compression: { width: number | null; height: number | null };
	};
	permissions?: UserPermissions;
	google_drive?: { client_id: string; api_key: string };
	onedrive?: {
		client_id_personal: string;
		client_id_business: string;
		sharepoint_url: string;
		sharepoint_tenant_id: string;
	};
	ui?: {
		pending_user_overlay_title?: string;
		pending_user_overlay_content?: string;
		response_watermark?: string;
		iframe_csp?: string;
	};
	license_metadata?: {
		seats?: number | null;
		type?: string;
		organization_name?: string;
		html?: string;
		background_image_url?: string;
		input_footer?: string;
	} | null;
};

export type FolderListItem = {
	id: string;
	name: string;
	created_at: number;
	updated_at: number;
	parent_id?: string | null;
	is_expanded?: boolean;
	unread_count?: number;
	meta?: { icon?: string | null; [key: string]: unknown } | null;
	[key: string]: unknown;
};

export type SelectedFolder = FolderListItem & {
	user_id: string;
	data?: { model_ids?: string[] | null; [key: string]: unknown } | null;
	meta?: {
		icon?: string | null;
		background_image_url?: string | null;
		[key: string]: unknown;
	} | null;
	items?: Record<string, unknown> | null;
	access_grants?: unknown[];
	permission?: string;
	shared?: boolean;
};

export type ContextUsage = {
	tokens: number;
	estimated_tokens: number;
	threshold: number | null;
	percent: number | null;
	source: 'estimated';
};

// Stored chat response from ChatResponse/ChatModel, including legacy message payloads.
export type SavedChat = {
	id: string;
	user_id: string;
	meta?: Record<string, unknown>;
	title: string;
	created_at: number;
	updated_at: number;
	archived: boolean;
	pinned?: boolean | null;
	folder_id?: string | null;
	share_id?: string | null;
	variables?: Record<string, unknown>;
	current_message_id?: string | null;
	context_usage?: ContextUsage | null;
	tasks?: { id: string; content: string; status: string }[] | null;
	chat: {
		title: string;
		models?: string[] | null;
		history?: ChatHistory | null;
		messages: ChatHistoryMessage[];
		params?: ModelParams | null;
		files?: ChatAttachment[] | null;
	};
};

export type ChatListItem = {
	id: string;
	title?: string;
	created_at?: number;
	updated_at?: number;
	last_read_at?: number | null;
	snippet?: string | null;
	active?: boolean;
	time_range?: string;
	folder_id?: string | null;
	pinned?: boolean | null;
	[key: string]: unknown;
};

// backend.models.chats.ChatTitleIdResponse.
export type ChatTitleIdResponse = Pick<ChatListItem, 'last_read_at' | 'snippet' | 'active'> & {
	id: string;
	title: string;
	created_at: number;
	updated_at: number;
};

// backend.models.shared_chats.SharedChatResponse; id is the share token.
export type SharedChatTitleResponse = Pick<
	ChatTitleIdResponse,
	'id' | 'title' | 'created_at' | 'updated_at'
> & {
	chat_id: string;
	share_id: string | null;
};

export type RichTextContent = { md: string; html: string; json: Content };
export type CommandSelection =
	| { type: 'model'; data: Model }
	| { type: 'skill'; data: SkillListItem };
export type CommandUpload = { type: 'file'; data: ChatAttachment } | { type: 'web'; data: string };

export type SelectOption<Value extends string | null = string> = { value: Value; label: string };

// Legacy Svelte generic marker, imported explicitly for the pinned ESLint parser.
export type SvelteGeneric<T> = T;
