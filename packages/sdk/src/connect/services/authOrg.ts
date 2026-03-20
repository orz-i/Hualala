import type {
  GetCurrentSessionResponse,
  UpdateUserPreferencesResponse,
} from "../../gen/hualala/auth/v1/auth_service_pb";
import type {
  ListMembersResponse,
  ListRolesResponse,
  UpdateMemberRoleResponse,
  UpdateOrgLocaleSettingsResponse,
} from "../../gen/hualala/org/v1/org_service_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export type AuthOrgClient = ReturnType<typeof createAuthOrgClient>;

export function createAuthOrgClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);

  return {
    getCurrentSession() {
      return client.unary<GetCurrentSessionResponse>(
        "/hualala.auth.v1.AuthService/GetCurrentSession",
        {},
        "sdk: failed to get current session",
      );
    },
    refreshSession(refreshToken: string) {
      return client.unary<GetCurrentSessionResponse>(
        "/hualala.auth.v1.AuthService/RefreshSession",
        { refreshToken },
        "sdk: failed to refresh session",
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
