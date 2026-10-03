import type { DEFAULT_PERMISSIONS } from '$lib/constants/permissions';

type Defaults = typeof DEFAULT_PERMISSIONS;

/** Editable booleans derived from the stock settings; unknown extension fields survive round trips. */
export type PermissionSettings = {
	-readonly [Section in keyof Defaults]: {
		-readonly [Flag in keyof Defaults[Section]]: boolean;
	} & Record<string, unknown>;
} & Record<string, unknown>;

/** Stored settings may predate current flags or omit entire sections. */
export type PermissionSettingsInput = {
	[Section in keyof Defaults]?: Partial<PermissionSettings[Section]> | null;
} & Record<string, unknown>;
