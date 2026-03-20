import { createAuthOrgClient, type HualalaFetch } from "@hualala/sdk";
import type {
  OrgLocaleSettingsViewModel,
  OrgMemberViewModel,
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

function createClient(options: GovernanceMutationOptions) {
  return createAuthOrgClient({
    baseUrl: options.baseUrl,
    fetchFn: options.fetchFn,
    identity: {
      orgId: options.orgId,
      userId: options.userId,
    },
  });
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
