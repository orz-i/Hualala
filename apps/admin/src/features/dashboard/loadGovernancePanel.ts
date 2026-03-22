import { createAuthOrgClient, type HualalaFetch } from "@hualala/sdk";
import type { AdminGovernanceViewModel } from "./governance";

type LoadGovernancePanelOptions = {
	orgId?: string;
	userId?: string;
	baseUrl?: string;
	fetchFn?: HualalaFetch;
};

const governancePermissionOrgRolesWrite = "org.roles.write";
const governancePermissionOrgMembersWrite = "org.members.write";
const governancePermissionOrgSettingsWrite = "org.settings.write";
const governancePermissionUserPreferencesWrite = "user.preferences.write";

export async function loadGovernancePanel({
	orgId,
	userId,
	baseUrl,
	fetchFn,
}: LoadGovernancePanelOptions): Promise<AdminGovernanceViewModel> {
	const client = createAuthOrgClient({
		baseUrl,
		fetchFn,
		identity:
			orgId && userId
				? {
						orgId,
						userId,
				  }
				: undefined,
	});

	const sessionPayload = await client.getCurrentSession();
	const session = sessionPayload.session;
	if (!session?.orgId || !session.userId || !session.sessionId) {
		throw new Error("admin: auth session payload is incomplete");
	}

	const [membersPayload, rolesPayload, localePayload, permissionsPayload] = await Promise.all([
		client.listMembers({ orgId: session.orgId }),
		client.listRoles({ orgId: session.orgId }),
		client.getOrgLocaleSettings({ orgId: session.orgId }),
		client.listAvailablePermissions({ orgId: session.orgId }),
	]);

	const members = (membersPayload.members ?? []).map((member) => ({
		memberId: member.memberId,
		orgId: member.orgId,
		userId: member.userId,
		roleId: member.roleId,
	}));
	const roles = (rolesPayload.roles ?? []).map((role) => ({
		roleId: role.roleId,
		orgId: role.orgId,
		code: role.code,
		displayName: role.displayName,
		permissionCodes: [...(role.permissionCodes ?? [])],
		memberCount: members.filter((member) => member.roleId === role.roleId).length,
	}));
	const permissionCodes = [...(session.permissionCodes ?? [])];
	const availablePermissions = (permissionsPayload.permissions ?? []).map((permission) => ({
		code: permission.code,
		displayName: permission.displayName,
		group: permission.group,
	}));
	const localeSettings = localePayload.localeSettings;
	if (!localeSettings?.orgId) {
		throw new Error("admin: org locale settings payload is incomplete");
	}

	return {
		currentSession: {
			sessionId: session.sessionId,
			orgId: session.orgId,
			userId: session.userId,
			locale: session.locale ?? "zh-CN",
			roleId: session.roleId ?? "",
			roleCode: session.roleCode ?? "",
			permissionCodes,
			timezone: session.timezone ?? "",
		},
		userPreferences: {
			userId: session.userId,
			displayLocale: session.locale ?? "zh-CN",
			timezone: session.timezone ?? "",
		},
		members,
		roles,
		availablePermissions,
		orgLocaleSettings: {
			orgId: localeSettings.orgId,
			defaultLocale: localeSettings.defaultLocale,
			supportedLocales: [...(localeSettings.supportedLocales ?? [])],
		},
		capabilities: {
			canManageRoles: permissionCodes.includes(governancePermissionOrgRolesWrite),
			canManageMembers: permissionCodes.includes(governancePermissionOrgMembersWrite),
			canManageOrgSettings: permissionCodes.includes(governancePermissionOrgSettingsWrite),
			canManageUserPreferences: permissionCodes.includes(
				governancePermissionUserPreferencesWrite,
			),
		},
	};
}
