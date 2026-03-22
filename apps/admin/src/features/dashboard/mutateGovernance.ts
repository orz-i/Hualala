import { createAuthOrgClient, type HualalaFetch } from "@hualala/sdk";
import type {
	OrgLocaleSettingsViewModel,
	OrgMemberViewModel,
	OrgRoleViewModel,
	UserPreferencesViewModel,
} from "./governance";

type GovernanceMutationOptions = {
	orgId?: string;
	userId?: string;
	baseUrl?: string;
	fetchFn?: HualalaFetch;
};

type UpdateUserPreferencesInput = GovernanceMutationOptions & {
	displayLocale: string;
	timezone: string;
};

type UpdateMemberRoleInput = GovernanceMutationOptions & {
	memberId: string;
	roleId: string;
};

type UpdateOrgLocaleSettingsInput = GovernanceMutationOptions & {
	defaultLocale: string;
};

type CreateRoleInput = GovernanceMutationOptions & {
	code: string;
	displayName: string;
	permissionCodes: string[];
};

type UpdateRoleInput = GovernanceMutationOptions & {
	roleId: string;
	displayName: string;
	permissionCodes: string[];
};

type DeleteRoleInput = GovernanceMutationOptions & {
	roleId: string;
};

function createClient(options: GovernanceMutationOptions) {
	return createAuthOrgClient({
		baseUrl: options.baseUrl,
		fetchFn: options.fetchFn,
		identity:
			options.orgId && options.userId
				? {
						orgId: options.orgId,
						userId: options.userId,
				  }
				: undefined,
	});
}

function mapRolePayload(
	scope: string,
	payload: {
		role?: {
			roleId?: string;
			orgId?: string;
			code?: string;
			displayName?: string;
			permissionCodes?: string[];
		};
	},
): OrgRoleViewModel {
	if (!payload.role?.roleId || !payload.role.orgId) {
		throw new Error(`${scope}: role payload is incomplete`);
	}
	return {
		roleId: payload.role.roleId,
		orgId: payload.role.orgId,
		code: payload.role.code ?? "",
		displayName: payload.role.displayName ?? "",
		permissionCodes: [...(payload.role.permissionCodes ?? [])],
		memberCount: 0,
	};
}

export async function updateUserPreferences({
	orgId,
	userId,
	displayLocale,
	timezone,
	baseUrl,
	fetchFn,
}: UpdateUserPreferencesInput): Promise<UserPreferencesViewModel> {
	if (!userId) {
		throw new Error("admin: userId is required to update preferences");
	}
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).updateUserPreferences({
		userId,
		displayLocale,
		timezone,
	});
	if (!payload.preferences?.userId) {
		throw new Error("admin: user preferences payload is incomplete");
	}
	return {
		userId: payload.preferences.userId,
		displayLocale: payload.preferences.displayLocale,
		timezone: payload.preferences.timezone,
	};
}

export async function updateMemberRole({
	orgId,
	userId,
	memberId,
	roleId,
	baseUrl,
	fetchFn,
}: UpdateMemberRoleInput): Promise<OrgMemberViewModel> {
	if (!orgId) {
		throw new Error("admin: orgId is required to update member role");
	}
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).updateMemberRole({
		orgId,
		memberId,
		roleId,
	});
	if (!payload.member?.memberId) {
		throw new Error("admin: member payload is incomplete");
	}
	return {
		memberId: payload.member.memberId,
		orgId: payload.member.orgId,
		userId: payload.member.userId,
		roleId: payload.member.roleId,
	};
}

export async function updateOrgLocaleSettings({
	orgId,
	userId,
	defaultLocale,
	baseUrl,
	fetchFn,
}: UpdateOrgLocaleSettingsInput): Promise<OrgLocaleSettingsViewModel> {
	if (!orgId) {
		throw new Error("admin: orgId is required to update org locale settings");
	}
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).updateOrgLocaleSettings({
		orgId,
		defaultLocale,
		supportedLocales: [defaultLocale],
	});
	if (!payload.localeSettings?.orgId) {
		throw new Error("admin: org locale settings payload is incomplete");
	}
	return {
		orgId: payload.localeSettings.orgId,
		defaultLocale: payload.localeSettings.defaultLocale,
		supportedLocales: payload.localeSettings.supportedLocales,
	};
}

export async function createRole({
	orgId,
	userId,
	code,
	displayName,
	permissionCodes,
	baseUrl,
	fetchFn,
}: CreateRoleInput): Promise<OrgRoleViewModel> {
	if (!orgId) {
		throw new Error("admin: orgId is required to create role");
	}
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).createRole({
		orgId,
		code,
		displayName,
		permissionCodes,
	});
	return mapRolePayload("admin", payload);
}

export async function updateRole({
	orgId,
	userId,
	roleId,
	displayName,
	permissionCodes,
	baseUrl,
	fetchFn,
}: UpdateRoleInput): Promise<OrgRoleViewModel> {
	if (!orgId) {
		throw new Error("admin: orgId is required to update role");
	}
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).updateRole({
		orgId,
		roleId,
		displayName,
		permissionCodes,
	});
	return mapRolePayload("admin", payload);
}

export async function deleteRole({
	orgId,
	userId,
	roleId,
	baseUrl,
	fetchFn,
}: DeleteRoleInput): Promise<void> {
	if (!orgId) {
		throw new Error("admin: orgId is required to delete role");
	}
	await createClient({ orgId, userId, baseUrl, fetchFn }).deleteRole({
		orgId,
		roleId,
	});
}
