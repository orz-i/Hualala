import type {
	ClearCurrentSessionResponse,
	GetCurrentSessionResponse,
	RefreshSessionResponse,
	StartDevSessionResponse,
	UpdateUserPreferencesResponse,
} from "../../gen/hualala/auth/v1/auth_service_pb";
import type {
	CreateRoleResponse,
	DeleteRoleResponse,
	GetOrgLocaleSettingsResponse,
	ListAvailablePermissionsResponse,
	ListMembersResponse,
	ListRolesResponse,
	UpdateMemberRoleResponse,
	UpdateOrgLocaleSettingsResponse,
	UpdateRoleResponse,
} from "../../gen/hualala/org/v1/org_service_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export type AuthOrgClient = ReturnType<typeof createAuthOrgClient>;

export function createAuthOrgClient(options: HualalaClientOptions = {}) {
	const client = createHualalaClient(options);

	return {
		startDevSession() {
			return client.unary<StartDevSessionResponse>(
				"/hualala.auth.v1.AuthService/StartDevSession",
				{},
				"sdk: failed to start dev session",
			);
		},
		getCurrentSession() {
			return client.unary<GetCurrentSessionResponse>(
				"/hualala.auth.v1.AuthService/GetCurrentSession",
				{},
				"sdk: failed to get current session",
			);
		},
		refreshSession(refreshToken = "dev-refresh") {
			return client.unary<RefreshSessionResponse>(
				"/hualala.auth.v1.AuthService/RefreshSession",
				{ refreshToken },
				"sdk: failed to refresh session",
			);
		},
		clearCurrentSession() {
			return client.unary<ClearCurrentSessionResponse>(
				"/hualala.auth.v1.AuthService/ClearCurrentSession",
				{},
				"sdk: failed to clear current session",
			);
		},
		updateUserPreferences(body: {
			userId: string;
			displayLocale: string;
			timezone: string;
		}) {
			return client.unary<UpdateUserPreferencesResponse>(
				"/hualala.auth.v1.AuthService/UpdateUserPreferences",
				body,
				"sdk: failed to update user preferences",
			);
		},
		listMembers(body: { orgId: string }) {
			return client.unary<ListMembersResponse>(
				"/hualala.org.v1.OrgService/ListMembers",
				body,
				"sdk: failed to list members",
			);
		},
		listRoles(body: { orgId: string }) {
			return client.unary<ListRolesResponse>(
				"/hualala.org.v1.OrgService/ListRoles",
				body,
				"sdk: failed to list roles",
			);
		},
		getOrgLocaleSettings(body: { orgId: string }) {
			return client.unary<GetOrgLocaleSettingsResponse>(
				"/hualala.org.v1.OrgService/GetOrgLocaleSettings",
				body,
				"sdk: failed to get org locale settings",
			);
		},
		listAvailablePermissions(body: { orgId: string }) {
			return client.unary<ListAvailablePermissionsResponse>(
				"/hualala.org.v1.OrgService/ListAvailablePermissions",
				body,
				"sdk: failed to list available permissions",
			);
		},
		createRole(body: {
			orgId: string;
			code: string;
			displayName: string;
			permissionCodes: string[];
		}) {
			return client.unary<CreateRoleResponse>(
				"/hualala.org.v1.OrgService/CreateRole",
				body,
				"sdk: failed to create role",
			);
		},
		updateRole(body: {
			orgId: string;
			roleId: string;
			displayName: string;
			permissionCodes: string[];
		}) {
			return client.unary<UpdateRoleResponse>(
				"/hualala.org.v1.OrgService/UpdateRole",
				body,
				"sdk: failed to update role",
			);
		},
		deleteRole(body: {
			orgId: string;
			roleId: string;
		}) {
			return client.unary<DeleteRoleResponse>(
				"/hualala.org.v1.OrgService/DeleteRole",
				body,
				"sdk: failed to delete role",
			);
		},
		updateMemberRole(body: {
			orgId: string;
			memberId: string;
			roleId: string;
		}) {
			return client.unary<UpdateMemberRoleResponse>(
				"/hualala.org.v1.OrgService/UpdateMemberRole",
				body,
				"sdk: failed to update member role",
			);
		},
		updateOrgLocaleSettings(body: {
			orgId: string;
			defaultLocale: string;
			supportedLocales: string[];
		}) {
			return client.unary<UpdateOrgLocaleSettingsResponse>(
				"/hualala.org.v1.OrgService/UpdateOrgLocaleSettings",
				body,
				"sdk: failed to update org locale settings",
			);
		},
	};
}
