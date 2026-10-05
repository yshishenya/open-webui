import type { chats, pinnedChats } from '$lib/stores/chatList';

type Assert<T extends true> = T;
type Assignable<Value, Target> = [Value] extends [Target] ? true : false;
type List = Parameters<Parameters<typeof chats.subscribe>[0]>[0];
type Item = NonNullable<List>[number];
type PinnedItem = Parameters<Parameters<typeof pinnedChats.subscribe>[0]>[0][number];

export type MinimalSnapshot = Assert<Assignable<{ id: string }, Item>>;
export type PinnedContract = Assert<Assignable<Item, PinnedItem>>;
export type InitialNull = Assert<Assignable<null, List>>;
export type TitleValues = Assert<Assignable<Item['title'], string | undefined>>;
export type RejectTitle = Assert<Assignable<number, Item['title']> extends false ? true : false>;
export type CreatedAtValues = Assert<Assignable<Item['created_at'], number | undefined>>;
export type RejectCreatedAt = Assert<
	Assignable<null, Item['created_at']> extends false ? true : false
>;
export type UpdatedAtValues = Assert<Assignable<Item['updated_at'], number | undefined>>;
export type RejectUpdatedAt = Assert<
	Assignable<string, Item['updated_at']> extends false ? true : false
>;
export type LastReadAtValues = Assert<Assignable<Item['last_read_at'], number | null | undefined>>;
export type RejectLastReadAt = Assert<
	Assignable<string, Item['last_read_at']> extends false ? true : false
>;
export type ActiveValues = Assert<Assignable<Item['active'], boolean | undefined>>;
export type RejectActive = Assert<Assignable<string, Item['active']> extends false ? true : false>;
export type SnippetValues = Assert<Assignable<Item['snippet'], string | null | undefined>>;
export type RejectSnippet = Assert<
	Assignable<number, Item['snippet']> extends false ? true : false
>;
export type TimeRangeValues = Assert<Assignable<Item['time_range'], string | undefined>>;
export type RejectTimeRange = Assert<
	Assignable<number, Item['time_range']> extends false ? true : false
>;
export type FolderIdValues = Assert<Assignable<Item['folder_id'], string | null | undefined>>;
export type RejectFolderId = Assert<
	Assignable<number, Item['folder_id']> extends false ? true : false
>;
export type PinnedValues = Assert<Assignable<Item['pinned'], boolean | null | undefined>>;
export type RejectPinned = Assert<Assignable<string, Item['pinned']> extends false ? true : false>;
