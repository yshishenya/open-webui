import type { PermissionSettingsInput } from './permission-types';

/** Stored group dictionaries can be partial, nullable and contain extension fields. */
export interface GroupData extends Record<string, unknown> {
	config?: { default_models?: string[] | null; share?: boolean | string; [key: string]: unknown } | null;
}

export interface GroupForm {
	parent_group_id?: string | null;
	name: string;
	description: string;
	data: GroupData;
	permissions: PermissionSettingsInput;
}

export interface GroupDetails {
	parent_group_id?: string | null;
	id: string;
	name: string;
	description: string;
	data?: GroupData | null;
	permissions?: PermissionSettingsInput | null;
	member_count?: number | null;
}

export type GroupMutationResult = boolean | void;
export type GroupSubmit = (group: GroupForm) => GroupMutationResult | Promise<GroupMutationResult>;
export type GroupDelete = () => GroupMutationResult | Promise<GroupMutationResult>;

export interface GroupMember {
	id: string;
	name: string;
	email: string;
	role: string;
	last_active_at: number;
	group_ids: string[];
}

export interface GroupUserList {
	users: GroupMember[];
	total: number;
}
