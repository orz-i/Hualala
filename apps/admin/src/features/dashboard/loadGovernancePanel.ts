import { createAuthOrgClient, type HualalaFetch } from "@hualala/sdk";
import type { AdminGovernanceViewModel } from "./governance";

type LoadGovernancePanelOptions = {
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function loadGovernancePanel({
  orgId,
  userId,
  baseUrl,
  fetchFn,
}: LoadGovernancePanelOptions): Promise<AdminGovernanceViewModel> {
  const client = createAuthOrgClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const sessionPayload = await client.getCurrentSession();
  const session = sessionPayload.session;
  if (!session?.orgId || !session.userId || !session.sessionId) {
    throw new Error("admin: auth session payload is incomplete");
  }

  const [membersPayload, rolesPayload] = await Promise.all([
    client.listMembers({ orgId: session.orgId }),
    client.listRoles({ orgId: session.orgId }),
  ]);

  return {
    currentSession: {
      sessionId: session.sessionId,
      orgId: session.orgId,
      userId: session.userId,
      locale: session.locale ?? "zh-CN",
    },
    userPreferences: {
      userId: session.userId,
      displayLocale: session.locale ?? "zh-CN",
      timezone: "",
    },
    members: (membersPayload.members ?? []).map((member) => ({
      memberId: member.memberId,
      orgId: member.orgId,
      userId: member.userId,
      roleId: member.roleId,
    })),
    roles: (rolesPayload.roles ?? []).map((role) => ({
      roleId: role.roleId,
      orgId: role.orgId,
      code: role.code,
      displayName: role.displayName,
    })),
    orgLocaleSettings: {
      orgId: session.orgId,
      defaultLocale: session.locale ?? "zh-CN",
      supportedLocales: [session.locale ?? "zh-CN"],
    },
  };
}
