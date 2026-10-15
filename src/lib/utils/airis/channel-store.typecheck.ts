import type { getChannels } from '$lib/apis/channels';
import type { channels, channelId } from '$lib/stores';
import type { Writable } from 'svelte/store';
import type { ChannelListItem } from './channel-types';

type Expect<T extends true> = T;
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type StoreValue<T> = T extends Writable<infer Value> ? Value : never;

export type ConcreteListStore = Expect<Equal<StoreValue<typeof channels>, ChannelListItem[]>>;
export type ConcreteListResponse = Expect<
	Equal<Awaited<ReturnType<typeof getChannels>>, ChannelListItem[] | null>
>;
export type CurrentChannelTransitions = Expect<Equal<StoreValue<typeof channelId>, string | null>>;
export type ServerNullableFields = Expect<
	Equal<
		Pick<ChannelListItem, 'data' | 'meta'>,
		{
			data: Record<string, unknown> | null;
			meta: Record<string, unknown> | null;
		}
	>
>;
export type NullableParticipants = Expect<null extends ChannelListItem['users'] ? true : false>;
export type StoredTypeIsNotAnInventedEnum = Expect<Equal<ChannelListItem['type'], string | null>>;
export type IdentifierIsRequired = Expect<Equal<ChannelListItem['id'], string>>;
