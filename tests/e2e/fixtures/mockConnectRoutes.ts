import type { Page, Route } from "@playwright/test";

type AdminMode = "success" | "failure";
type CreatorShotMode = "success" | "failure";
type CreatorImportMode = "success" | "failure";

type MockConnectScenario = {
  admin?: AdminMode;
  creatorShot?: CreatorShotMode;
  creatorImport?: CreatorImportMode;
};

type AdminState = {
  budgetSnapshot: {
    projectId: string;
    limitCents: number;
    reservedCents: number;
    remainingBudgetCents: number;
  };
  updatedBudgetSnapshot?: {
    projectId: string;
    limitCents: number;
    reservedCents: number;
    remainingBudgetCents: number;
  };
  usageRecords: Array<{ id: string; meter: string; amountCents: number }>;
  billingEvents: Array<{ id: string; eventType: string; amountCents: number }>;
  reviewSummary: { shotExecutionId: string; latestConclusion: string };
  evaluationRuns: Array<{ id: string; status: string; failedChecks: string[] }>;
  shotReviews: Array<{ id: string; conclusion: string }>;
  governance: {
    currentSession: {
      sessionId: string;
      orgId: string;
      userId: string;
      locale: string;
    };
    userPreferences: {
      userId: string;
      displayLocale: string;
      timezone: string;
    };
    members: Array<{ memberId: string; orgId: string; userId: string; roleId: string }>;
    roles: Array<{ roleId: string; orgId: string; code: string; displayName: string }>;
    orgLocaleSettings: {
      orgId: string;
      defaultLocale: string;
      supportedLocales: string[];
    };
  };
};

type CreatorShotState = {
  workbench: {
    shotExecution: {
      id: string;
      shotId: string;
      status: string;
      primaryAssetId: string;
    };
    candidateAssets: Array<{ id: string; assetId: string }>;
    reviewSummary: { latestConclusion: string };
    latestEvaluationRun?: { id: string; status: string };
  };
  afterGate?: {
    workbench: CreatorShotState["workbench"];
    gateResult: {
      passedChecks: string[];
      failedChecks: string[];
    };
  };
  afterSubmit?: {
    workbench: CreatorShotState["workbench"];
  };
};

type CreatorImportState = {
  importBatch: {
    id: string;
    status: string;
    sourceType: string;
  };
  uploadSessions: Array<{ id: string; status: string }>;
  items: Array<{ id: string; status: string; assetId: string }>;
  candidateAssets: Array<{ id: string; assetId: string }>;
  shotExecutions: Array<{ id: string; status: string; primaryAssetId: string }>;
  afterConfirm?: Omit<CreatorImportState, "afterConfirm" | "afterSelect">;
  afterSelect?: Omit<CreatorImportState, "afterConfirm" | "afterSelect">;
};

function jsonResponse(status: number, payload: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withGovernance(state: Omit<AdminState, "governance"> & Partial<Pick<AdminState, "governance">>) {
  if (state.governance) {
    return state as AdminState;
  }

  const orgId = "org-live-1";
  const userId = "user-live-1";
  const locale = "zh-CN";

  return {
    ...state,
    governance: {
      currentSession: {
        sessionId: `dev:${orgId}:${userId}`,
        orgId,
        userId,
        locale,
      },
      userPreferences: {
        userId,
        displayLocale: locale,
        timezone: "Asia/Shanghai",
      },
      members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
      roles: [{ roleId: "role-admin", orgId, code: "admin", displayName: "Administrator" }],
      orgLocaleSettings: {
        orgId,
        defaultLocale: locale,
        supportedLocales: [locale],
      },
    },
  };
}

function formatCurrency(cents: number) {
  return `${(cents / 100).toFixed(2)} 元`;
}

function withRecentChanges(state: AdminState) {
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

type Phase1DemoScenarios = {
  admin: Record<AdminMode, AdminState>;
  creatorShot: Record<CreatorShotMode, CreatorShotState>;
  creatorImport: Record<CreatorImportMode, CreatorImportState>;
};

let phase1DemoScenariosPromise: Promise<Phase1DemoScenarios> | undefined;

async function loadPhase1DemoScenarios(): Promise<Phase1DemoScenarios> {
  if (!phase1DemoScenariosPromise) {
    phase1DemoScenariosPromise = import("../../../tooling/scripts/demo_seed.mjs").then(
      (module) => module.buildPhase1DemoScenarios() as Phase1DemoScenarios,
    );
  }

  return phase1DemoScenariosPromise;
}

function buildAdminPayload(pathname: string, state: AdminState) {
  switch (pathname) {
    case "/hualala.auth.v1.AuthService/GetCurrentSession":
      return {
        session: {
          sessionId: state.governance.currentSession.sessionId,
          orgId: state.governance.currentSession.orgId,
          userId: state.governance.currentSession.userId,
          locale: state.governance.currentSession.locale,
        },
      };
    case "/hualala.org.v1.OrgService/ListMembers":
      return { members: state.governance.members };
    case "/hualala.org.v1.OrgService/ListRoles":
      return { roles: state.governance.roles };
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockConnectRoutes(page: Page, scenario: MockConnectScenario) {
  const phase1DemoScenarios = await loadPhase1DemoScenarios();
  let adminState = withRecentChanges(
    withGovernance(clone(phase1DemoScenarios.admin[scenario.admin ?? "success"])),
  );
  let creatorShotState = clone(
    phase1DemoScenarios.creatorShot[scenario.creatorShot ?? "success"],
  );
  let creatorImportState = clone(
    phase1DemoScenarios.creatorImport[scenario.creatorImport ?? "success"],
  );

  await page.route(/\/hualala\..+/, async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (scenario.admin) {
      if (pathname === "/hualala.billing.v1.BillingService/UpdateBudgetPolicy") {
        await delay(120);
        if (scenario.admin === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }

        adminState = withRecentChanges({
          ...clone(adminState),
          budgetSnapshot: clone(adminState.updatedBudgetSnapshot ?? adminState.budgetSnapshot),
        });
        await route.fulfill(
          jsonResponse(200, {
            budgetPolicy: {
              id: "budget-1",
              orgId: "org-live-1",
              projectId: adminState.budgetSnapshot.projectId,
              limitCents: adminState.budgetSnapshot.limitCents,
              reservedCents: adminState.budgetSnapshot.reservedCents,
            },
          }),
        );
        return;
      }

      if (pathname === "/hualala.auth.v1.AuthService/UpdateUserPreferences") {
        const body = route.request().postDataJSON() as {
          displayLocale?: string;
          timezone?: string;
          userId?: string;
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: {
            ...clone(adminState.governance),
            currentSession: {
              ...clone(adminState.governance.currentSession),
              locale: body.displayLocale ?? adminState.governance.currentSession.locale,
            },
            userPreferences: {
              userId: body.userId ?? adminState.governance.userPreferences.userId,
              displayLocale:
                body.displayLocale ?? adminState.governance.userPreferences.displayLocale,
              timezone: body.timezone ?? adminState.governance.userPreferences.timezone,
            },
            orgLocaleSettings: {
              ...clone(adminState.governance.orgLocaleSettings),
              defaultLocale:
                body.displayLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              supportedLocales: [
                body.displayLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              ],
            },
          },
        });
        await route.fulfill(
          jsonResponse(200, {
            preferences: clone(adminState.governance.userPreferences),
          }),
        );
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/UpdateMemberRole") {
        const body = route.request().postDataJSON() as {
          memberId?: string;
          roleId?: string;
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: {
            ...clone(adminState.governance),
            members: adminState.governance.members.map((member) =>
              member.memberId === body.memberId
                ? { ...member, roleId: body.roleId ?? member.roleId }
                : member,
            ),
          },
        });
        const updatedMember = adminState.governance.members.find(
          (member) => member.memberId === body.memberId,
        );
        await route.fulfill(jsonResponse(200, { member: updatedMember }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/UpdateOrgLocaleSettings") {
        const body = route.request().postDataJSON() as {
          defaultLocale?: string;
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: {
            ...clone(adminState.governance),
            currentSession: {
              ...clone(adminState.governance.currentSession),
              locale: body.defaultLocale ?? adminState.governance.currentSession.locale,
            },
            orgLocaleSettings: {
              orgId: adminState.governance.orgLocaleSettings.orgId,
              defaultLocale:
                body.defaultLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              supportedLocales: [
                body.defaultLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              ],
            },
          },
        });
        await route.fulfill(
          jsonResponse(200, {
            localeSettings: clone(adminState.governance.orgLocaleSettings),
          }),
        );
        return;
      }

      const adminPayload = buildAdminPayload(pathname, adminState);
      if (adminPayload) {
        await route.fulfill(jsonResponse(200, adminPayload));
        return;
      }
    }

    if (scenario.creatorShot) {
      if (pathname === "/hualala.execution.v1.ExecutionService/GetShotWorkbench") {
        await route.fulfill(jsonResponse(200, creatorShotState));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks") {
        await delay(120);
        if (scenario.creatorShot === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorShotState = {
          ...clone(creatorShotState),
          workbench: clone(creatorShotState.afterGate?.workbench ?? creatorShotState.workbench),
        };
        await route.fulfill(
          jsonResponse(
            200,
            clone(creatorShotState.afterGate?.gateResult ?? { passedChecks: [], failedChecks: [] }),
          ),
        );
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SubmitShotForReview") {
        await delay(120);
        creatorShotState = {
          ...clone(creatorShotState),
          workbench: clone(creatorShotState.afterSubmit?.workbench ?? creatorShotState.workbench),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }
    }

    if (scenario.creatorImport) {
      if (pathname === "/hualala.asset.v1.AssetService/GetImportBatchWorkbench") {
        await route.fulfill(jsonResponse(200, creatorImportState));
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems") {
        await delay(120);
        if (scenario.creatorImport === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterConfirm ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
        await delay(120);
        if (scenario.creatorImport === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterSelect ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }
    }

    await route.continue();
  });
}
