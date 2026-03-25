import type {
  AdminScenarioState,
  AdminState,
  AdminStateWithRecentChanges,
  GovernanceState,
  MockSession,
} from "./types.ts";
import { buildModelGovernanceBaseline } from "./model-governance.ts";

export function buildGovernanceBaseline(): GovernanceState {
  const orgId = "org-live-1";
  const userId = "user-live-1";
  const locale = "zh-CN";
  const availablePermissions = [
    { code: "session.read", displayName: "Read current session", group: "session" },
    {
      code: "user.preferences.write",
      displayName: "Update user preferences",
      group: "preferences",
    },
    { code: "org.members.read", displayName: "Read organization members", group: "governance" },
    { code: "org.roles.read", displayName: "Read organization roles", group: "governance" },
    { code: "org.members.write", displayName: "Update member roles", group: "governance" },
    { code: "org.settings.write", displayName: "Update organization locale", group: "governance" },
    { code: "org.roles.write", displayName: "Manage roles and permissions", group: "governance" },
    {
      code: "org.model_governance.read",
      displayName: "Read model governance resources",
      group: "governance",
    },
    {
      code: "org.model_governance.write",
      displayName: "Manage model governance resources",
      group: "governance",
    },
  ];
  const adminPermissionCodes = availablePermissions.map((permission) => permission.code);

  return {
    currentSession: {
      sessionId: `dev:${orgId}:${userId}`,
      orgId,
      userId,
      locale,
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: adminPermissionCodes,
      timezone: "Asia/Shanghai",
    },
    userPreferences: {
      userId,
      displayLocale: locale,
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
    roles: [
      {
        roleId: "role-admin",
        orgId,
        code: "admin",
        displayName: "Administrator",
        permissionCodes: adminPermissionCodes,
        memberCount: 1,
      },
      {
        roleId: "role-viewer",
        orgId,
        code: "viewer",
        displayName: "Viewer",
        permissionCodes: ["session.read", "user.preferences.write"],
        memberCount: 0,
      },
    ],
    availablePermissions,
    orgLocaleSettings: {
      orgId,
      defaultLocale: locale,
      supportedLocales: [locale, "en-US"],
    },
    capabilities: {
      canManageRoles: true,
      canManageMembers: true,
      canManageOrgSettings: true,
      canManageUserPreferences: true,
    },
  };
}

export function buildDefaultDevSession(): MockSession {
  return clone(buildGovernanceBaseline().currentSession);
}

export function withGovernance(state: AdminScenarioState): AdminState {
  if (state.governance) {
    return state as AdminState;
  }

  return {
    ...state,
    governance: buildGovernanceBaseline(),
    modelGovernance: buildModelGovernanceBaseline(),
  };
}

export function withRecentChanges(state: AdminState): AdminStateWithRecentChanges {
  const latestBillingEvent = state.billingEvents[0];
  const latestEvaluation = state.evaluationRuns[0];
  const latestReview = state.shotReviews[0];

  return {
    ...state,
    recentChanges: [
      {
        id: `billing-${latestBillingEvent?.id ?? "latest"}`,
        kind: "billing",
        title: "最近计费事件",
        detail: `${latestBillingEvent?.eventType ?? "pending"} · ${formatCurrency(latestBillingEvent?.amountCents ?? 0)}`,
        tone: "info",
      },
      {
        id: `evaluation-${latestEvaluation?.id ?? "latest"}`,
        kind: "evaluation",
        title: "最近评估结果",
        detail: `${latestEvaluation?.status ?? "pending"} · ${latestEvaluation?.failedChecks.length ?? 0} 个失败检查`,
        tone: latestEvaluation?.status === "passed" ? "success" : "warning",
      },
      {
        id: `review-${latestReview?.id ?? "latest"}`,
        kind: "review",
        title: "最近评审结论",
        detail: latestReview?.conclusion ?? state.reviewSummary.latestConclusion,
        tone:
          (latestReview?.conclusion ?? state.reviewSummary.latestConclusion) === "approved"
            ? "success"
            : "warning",
      },
    ],
  };
}

export function syncGovernanceState(state: GovernanceState): GovernanceState {
  const roles = state.roles.map((role) => ({
    ...role,
    memberCount: state.members.filter((member) => member.roleId === role.roleId).length,
  }));
  const activeRole =
    roles.find((role) => role.roleId === state.currentSession.roleId) ?? roles[0] ?? null;

  return {
    ...state,
    roles,
    currentSession: activeRole
      ? {
          ...state.currentSession,
          roleId: activeRole.roleId,
          roleCode: activeRole.code,
          permissionCodes: [...activeRole.permissionCodes],
        }
      : state.currentSession,
    capabilities: activeRole
      ? {
          canManageRoles: activeRole.permissionCodes.includes("org.roles.write"),
          canManageMembers: activeRole.permissionCodes.includes("org.members.write"),
          canManageOrgSettings: activeRole.permissionCodes.includes("org.settings.write"),
          canManageUserPreferences: activeRole.permissionCodes.includes("user.preferences.write"),
        }
      : state.capabilities,
  };
}

export function buildAdminPayload(pathname: string, state: AdminState) {
  switch (pathname) {
    case "/hualala.auth.v1.AuthService/GetCurrentSession":
      return {
        session: {
          sessionId: state.governance.currentSession.sessionId,
          orgId: state.governance.currentSession.orgId,
          userId: state.governance.currentSession.userId,
          locale: state.governance.currentSession.locale,
          roleId: state.governance.currentSession.roleId,
          roleCode: state.governance.currentSession.roleCode,
          permissionCodes: state.governance.currentSession.permissionCodes,
          timezone: state.governance.currentSession.timezone,
        },
      };
    case "/hualala.org.v1.OrgService/ListMembers":
      return { members: state.governance.members };
    case "/hualala.org.v1.OrgService/ListRoles":
      return { roles: state.governance.roles };
    case "/hualala.org.v1.OrgService/GetOrgLocaleSettings":
      return { localeSettings: state.governance.orgLocaleSettings };
    case "/hualala.org.v1.OrgService/ListAvailablePermissions":
      return { permissions: state.governance.availablePermissions };
    case "/hualala.billing.v1.BillingService/GetBudgetSnapshot":
      return { budgetSnapshot: state.budgetSnapshot };
    case "/hualala.billing.v1.BillingService/ListUsageRecords":
      return { usageRecords: state.usageRecords };
    case "/hualala.billing.v1.BillingService/ListBillingEvents":
      return { billingEvents: state.billingEvents };
    case "/hualala.review.v1.ReviewService/GetShotReviewSummary":
      return { summary: state.reviewSummary };
    case "/hualala.review.v1.ReviewService/ListEvaluationRuns":
      return { evaluationRuns: state.evaluationRuns };
    case "/hualala.review.v1.ReviewService/ListShotReviews":
      return { shotReviews: state.shotReviews };
    default:
      return null;
  }
}

function formatCurrency(cents: number) {
  return `${(cents / 100).toFixed(2)} 元`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
