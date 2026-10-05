import type { updateChatFolderIdById } from '$lib/apis/chats';
import type { updateFolderParentIdById } from '$lib/apis/folders';

type Assert<T extends true> = T;
type Accepts<Value, Target> = [Value] extends [Target] ? true : false;
type ChatTarget = Parameters<typeof updateChatFolderIdById>[2];
type FolderTarget = Parameters<typeof updateFolderParentIdById>[2];

export type ChatRoot = Assert<Accepts<null, ChatTarget>>;
export type FolderRoot = Assert<Accepts<null, FolderTarget>>;
export type ChatDestination = Assert<Accepts<string, ChatTarget>>;
export type FolderDestination = Assert<Accepts<string, FolderTarget>>;
export type OmittedChatDestination = Assert<Accepts<undefined, ChatTarget>>;
export type OmittedFolderDestination = Assert<Accepts<undefined, FolderTarget>>;
export type RejectNumericChatDestination = Assert<
	Accepts<number, ChatTarget> extends false ? true : false
>;
export type RejectNumericFolderDestination = Assert<
	Accepts<number, FolderTarget> extends false ? true : false
>;
