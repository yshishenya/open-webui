import type EmojiPicker from '$lib/components/common/EmojiPicker.svelte';
import type { ComponentProps } from 'svelte';
import type { createNewChat } from '$lib/apis/chats';
import type FolderTitle from '$lib/components/chat/Placeholder/FolderTitle.svelte';
import type FolderModal from '$lib/components/layout/Sidebar/Folders/FolderModal.svelte';
import type { folders, selectedFolder } from '$lib/stores';

type Assert<T extends true> = T;
type Assignable<Value, Target> = [Value] extends [Target] ? true : false;
type List = Parameters<typeof folders.set>[0];
type Item = List[number];
type Selection = Parameters<typeof selectedFolder.set>[0];
type Selected = NonNullable<Selection>;
type Snapshot = { id: string; name: string; created_at: number; updated_at: number };

export type ListAcceptsSnapshot = Assert<Assignable<Snapshot, Item>>;
export type ListAcceptsRoot = Assert<Assignable<Snapshot & { parent_id: null }, Item>>;
export type ListRejectsWrongId = Assert<
	Assignable<
		{ id: number; name: string; created_at: number; updated_at: number },
		Item
	> extends false
		? true
		: false
>;
export type ListRejectsWrongDate = Assert<
	Assignable<
		{ id: string; name: string; created_at: string; updated_at: number },
		Item
	> extends false
		? true
		: false
>;
export type EmptyList = Assert<Assignable<[], List>>;
export type SelectedAcceptsSnapshot = Assert<Assignable<Snapshot & { user_id: string }, Selection>>;
export type ClearSelection = Assert<Assignable<null, Selection>>;
export type SelectedId = Assert<Assignable<string, Selected['id']>>;
export type SelectedModels = Assert<Assignable<{ model_ids: string[] }, Selected['data']>>;
export type SelectedNullData = Assert<Assignable<null, Selected['data']>>;
export type SelectedRejectsModels = Assert<
	Assignable<{ model_ids: number[] }, Selected['data']> extends false ? true : false
>;
export type SelectedMetadata = Assert<
	Assignable<{ icon: null; background_image_url: string }, Selected['meta']>
>;
export type SelectedNullMetadata = Assert<Assignable<null, Selected['meta']>>;
export type SelectedShared = Assert<
	Assignable<
		Snapshot & { user_id: string; permission: string; shared: true; access_grants: unknown[] },
		Selection
	>
>;

export type TitleAcceptsSelection = Assert<
	Assignable<Selected, ComponentProps<FolderTitle>['folder']>
>;
export type TitleClearState = Assert<Assignable<null, ComponentProps<FolderTitle>['folder']>>;
export type ModalFolderId = Assert<Assignable<string, ComponentProps<FolderModal>['folderId']>>;
export type ModalParentId = Assert<Assignable<string, ComponentProps<FolderModal>['parentId']>>;
export type ChatWithoutFolder = Assert<Assignable<undefined, Parameters<typeof createNewChat>[2]>>;

export type SelectedIcon = Assert<
	Assignable<string | null, ComponentProps<EmojiPicker>['selected']>
>;
export type RejectSelectedIcon = Assert<
	Assignable<number, ComponentProps<EmojiPicker>['selected']> extends false ? true : false
>;
