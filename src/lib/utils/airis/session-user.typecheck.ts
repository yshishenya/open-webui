import type { ComponentProps } from 'svelte';
import type { SessionUser, user } from '$lib/stores';
import type Tooltip from '$lib/components/common/Tooltip.svelte';

type Assert<T extends true> = T;
type Assignable<Value, Target> = [Value] extends [Target] ? true : false;
type StoreValue = Parameters<typeof user.set>[0];

export type SessionTransitions = Assert<Assignable<SessionUser | null | undefined, StoreValue>>;
export type MinimalProfile = Assert<
	Assignable<
		{
			permissions: Record<string, never>;
			id: string;
			email: string;
			name: string;
			role: string;
			profile_image_url: string;
		},
		SessionUser
	>
>;
export type OptionalToken = Assert<Assignable<string | undefined, SessionUser['token']>>;
export type RejectNumericToken = Assert<
	Assignable<number, SessionUser['token']> extends false ? true : false
>;
type Status = Pick<SessionUser, 'status_emoji' | 'status_message' | 'status_expires_at'>;
export type NullableStatus = Assert<
	Assignable<{ status_emoji: null; status_message: null; status_expires_at: null }, Status>
>;
export type PopulatedStatus = Assert<
	Assignable<{ status_emoji: string; status_message: string; status_expires_at: number }, Status>
>;
export type RejectNumericMessage = Assert<
	Assignable<number, SessionUser['status_message']> extends false ? true : false
>;
export type RejectStringExpiration = Assert<
	Assignable<string, SessionUser['status_expires_at']> extends false ? true : false
>;
export type NullableProfile = Assert<
	Assignable<
		{ bio: null; gender: null; date_of_birth: null; expires_at: null },
		Pick<SessionUser, 'bio' | 'gender' | 'date_of_birth' | 'expires_at'>
	>
>;
type TooltipProps = ComponentProps<typeof Tooltip>;
export type NullableTooltip = Assert<
	Assignable<{ content: string | null | undefined }, TooltipProps>
>;
export type RejectNumericTooltip = Assert<
	Assignable<{ content: number }, TooltipProps> extends false ? true : false
>;
