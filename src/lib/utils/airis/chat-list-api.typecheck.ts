import type {
	getChatList,
	getChatListByUserId,
	getArchivedChatList,
	getSharedChatList,
	getChatListBySearchText,
	getChatListByFolderId,
	getPinnedChatList,
	getChatListByTagName
} from '$lib/apis/chats';
import type {
	ChatListItem,
	ChatTitleIdResponse,
	SharedChatTitleResponse
} from './frontend-contracts';

type Expect<T extends true> = T;
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

type ListAPIs = {
	ordinary: typeof getChatList;
	user: typeof getChatListByUserId;
	archive: typeof getArchivedChatList;
	shared: typeof getSharedChatList;
	search: typeof getChatListBySearchText;
	folder: typeof getChatListByFolderId;
	pinned: typeof getPinnedChatList;
	tag: typeof getChatListByTagName;
};
type UncheckedItem = {
	[Name in keyof ListAPIs]: IsAny<Awaited<ReturnType<ListAPIs[Name]>>[number]>;
}[keyof ListAPIs];

export type ConcreteListAPIItems = Expect<Equal<UncheckedItem, false>>;
export type FolderResponseHasNoClientGrouping = Expect<
	Equal<Awaited<ReturnType<typeof getChatListByFolderId>>, ChatTitleIdResponse[]>
>;
export type SharedResponsePreservesShareToken = Expect<
	Equal<Awaited<ReturnType<typeof getSharedChatList>>[number]['share_id'], string | null>
>;
export type SharedResponseFitsServer = Expect<
	Awaited<ReturnType<typeof getSharedChatList>>[number] extends SharedChatTitleResponse
		? true
		: false
>;
export type OrdinaryResponseFitsExistingStore = Expect<
	Awaited<ReturnType<typeof getChatList>> extends ChatListItem[] ? true : false
>;
