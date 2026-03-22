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
      roleId: string;
      roleCode: string;
      permissionCodes: string[];
      timezone: string;
    };
    userPreferences: {
      userId: string;
      displayLocale: string;
      timezone: string;
    };
    members: Array<{ memberId: string; orgId: string; userId: string; roleId: string }>;
    roles: Array<{
      roleId: string;
      orgId: string;
      code: string;
      displayName: string;
      permissionCodes: string[];
      memberCount: number;
    }>;
    availablePermissions: Array<{
      code: string;
      displayName: string;
      group: string;
    }>;
    orgLocaleSettings: {
      orgId: string;
      defaultLocale: string;
      supportedLocales: string[];
    };
    capabilities: {
      canManageRoles: boolean;
      canManageMembers: boolean;
      canManageOrgSettings: boolean;
      canManageUserPreferences: boolean;
    };
  };
};

type CreatorShotState = {
  workbench: {
    shotExecution: {
      id: string;
      shotId: string;
      orgId?: string;
      projectId?: string;
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

type MockTimestamp = {
  seconds: string;
  nanos: number;
};

type MockWorkflowStep = {
  id: string;
  workflowRunId: string;
  stepKey: string;
  stepOrder: number;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: MockTimestamp;
  completedAt?: MockTimestamp;
  failedAt?: MockTimestamp;
};

type MockWorkflowRun = {
  id: string;
  workflowType: string;
  status: string;
  resourceId: string;
  projectId: string;
  provider: string;
  currentStep: string;
  attemptCount: number;
  lastError: string;
  externalRequestId: string;
  createdAt: MockTimestamp;
  updatedAt: MockTimestamp;
  steps: MockWorkflowStep[];
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

function createTimestamp(seconds: number): MockTimestamp {
  return {
    seconds: String(seconds),
    nanos: 0,
  };
}

function createWorkflowSteps({
  workflowRunId,
  attemptCount,
  gatewayStatus,
  lastError,
}: {
  workflowRunId: string;
  attemptCount: number;
  gatewayStatus: "running" | "failed" | "cancelled";
  lastError: string;
}): MockWorkflowStep[] {
  const dispatchStart = 1710000000 + (attemptCount - 1) * 60;
  const gatewayStart = dispatchStart + 10;

  const steps: MockWorkflowStep[] = [
    {
      id: `${workflowRunId}-dispatch-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.dispatch`,
      stepOrder: 1,
      status: "completed",
      startedAt: createTimestamp(dispatchStart),
      completedAt: createTimestamp(dispatchStart + 5),
    },
    {
      id: `${workflowRunId}-gateway-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.gateway`,
      stepOrder: 2,
      status: gatewayStatus === "cancelled" ? "completed" : gatewayStatus,
      errorCode: gatewayStatus === "failed" ? "provider_error" : "",
      errorMessage: gatewayStatus === "failed" ? lastError : "",
      startedAt: createTimestamp(gatewayStart),
      completedAt: gatewayStatus === "running" ? undefined : createTimestamp(gatewayStart + 5),
      failedAt: gatewayStatus === "failed" ? createTimestamp(gatewayStart + 5) : undefined,
    },
  ];

  if (gatewayStatus === "cancelled") {
    steps.push({
      id: `${workflowRunId}-cancel-${attemptCount}`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.cancel`,
      stepOrder: 3,
      status: "completed",
      startedAt: createTimestamp(gatewayStart + 6),
      completedAt: createTimestamp(gatewayStart + 8),
    });
  }

  return steps;
}

function buildInitialWorkflowRuns({
  projectId,
  resourceId,
}: {
  projectId: string;
  resourceId: string;
}): MockWorkflowRun[] {
  return [
    {
      id: "workflow-run-1",
      workflowType: "shot_pipeline",
      status: "failed",
      resourceId,
      projectId,
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: 1,
      lastError: "provider rejected request",
      externalRequestId: "request-1",
      createdAt: createTimestamp(1710000000),
      updatedAt: createTimestamp(1710000300),
      steps: createWorkflowSteps({
        workflowRunId: "workflow-run-1",
        attemptCount: 1,
        gatewayStatus: "failed",
        lastError: "provider rejected request",
      }),
    },
  ];
}

function summarizeWorkflowRun(record: MockWorkflowRun) {
  return {
    id: record.id,
    projectId: record.projectId,
    resourceId: record.resourceId,
    workflowType: record.workflowType,
    status: record.status,
    provider: record.provider,
    currentStep: record.currentStep,
    attemptCount: record.attemptCount,
    lastError: record.lastError,
    externalRequestId: record.externalRequestId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildImportBatchSummary({
  adminState,
  creatorImportState,
}: {
  adminState: AdminState;
  creatorImportState: CreatorImportState;
}) {
  return {
    id: creatorImportState.importBatch.id,
    orgId: adminState.governance.currentSession.orgId,
    projectId: adminState.budgetSnapshot.projectId,
    operatorId: adminState.governance.currentSession.userId,
    sourceType: creatorImportState.importBatch.sourceType,
    status: creatorImportState.importBatch.status,
    uploadSessionCount: creatorImportState.uploadSessions.length,
    itemCount: creatorImportState.items.length,
    confirmedItemCount: creatorImportState.items.filter((item) => item.status === "confirmed").length,
    candidateAssetCount: creatorImportState.candidateAssets.length,
    mediaAssetCount: Array.from(
      new Set(creatorImportState.items.map((item) => item.assetId).filter(Boolean)),
    ).length,
    updatedAt: "2024-03-09T16:10:00.000Z",
  };
}

function buildImportBatchWorkbenchPayload({
  adminState,
  creatorShotState,
  creatorImportState,
  workflowRuns,
}: {
  adminState: AdminState;
  creatorShotState: CreatorShotState;
  creatorImportState: CreatorImportState;
  workflowRuns: MockWorkflowRun[];
}) {
  const projectId = adminState.budgetSnapshot.projectId;
  const orgId = adminState.governance.currentSession.orgId;
  const operatorId = adminState.governance.currentSession.userId;
  const shotExecutionId = creatorShotState.workbench.shotExecution.id;
  const shotId = creatorShotState.workbench.shotExecution.shotId;
  const sourceRunId = workflowRuns[0]?.id ?? "workflow-run-1";
  const assetIds = Array.from(
    new Set(
      [
        ...creatorImportState.items.map((item) => item.assetId),
        ...creatorImportState.candidateAssets.map((candidate) => candidate.assetId),
        ...creatorImportState.shotExecutions.map((execution) => execution.primaryAssetId),
      ].filter(Boolean),
    ),
  );

  return {
    importBatch: {
      id: creatorImportState.importBatch.id,
      orgId,
      projectId,
      operatorId,
      sourceType: creatorImportState.importBatch.sourceType,
      status: creatorImportState.importBatch.status,
    },
    uploadSessions: creatorImportState.uploadSessions.map((session, index) => ({
      id: session.id,
      fileName: `upload-${index + 1}.png`,
      checksum: `sha256:${session.id}`,
      sizeBytes: 2048 + index,
      retryCount: 0,
      status: session.status,
      resumeHint: `resume-${session.id}`,
    })),
    items: creatorImportState.items.map((item) => ({
      id: item.id,
      status: item.status,
      assetId: item.assetId,
    })),
    candidateAssets: creatorImportState.candidateAssets.map((candidate) => ({
      id: candidate.id,
      shotExecutionId,
      assetId: candidate.assetId,
      sourceRunId,
    })),
    mediaAssets: assetIds.map((assetId) => ({
      id: assetId,
      projectId,
      sourceType: creatorImportState.importBatch.sourceType,
      rightsStatus: "clear",
      importBatchId: creatorImportState.importBatch.id,
      locale: "zh-CN",
      aiAnnotated: true,
    })),
    shotExecutions: creatorImportState.shotExecutions.map((execution) => ({
      id: execution.id,
      shotId,
      status: execution.status,
      primaryAssetId: execution.primaryAssetId,
      currentRunId: sourceRunId,
    })),
  };
}

function buildAssetProvenancePayload({
  adminState,
  creatorShotState,
  creatorImportState,
  workflowRuns,
  assetId,
}: {
  adminState: AdminState;
  creatorShotState: CreatorShotState;
  creatorImportState: CreatorImportState;
  workflowRuns: MockWorkflowRun[];
  assetId: string;
}) {
  const sourceRunId = workflowRuns[0]?.id ?? "workflow-run-1";
  const candidateAsset =
    creatorImportState.candidateAssets.find((candidate) => candidate.assetId === assetId) ??
    creatorImportState.candidateAssets[0];

  return {
    asset: {
      id: assetId,
      projectId: adminState.budgetSnapshot.projectId,
      sourceType: creatorImportState.importBatch.sourceType,
      rightsStatus: "clear",
      importBatchId: creatorImportState.importBatch.id,
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary: `source_type=${creatorImportState.importBatch.sourceType} import_batch_id=${creatorImportState.importBatch.id} rights_status=clear`,
    candidateAssetId: candidateAsset?.id ?? "",
    shotExecutionId: creatorShotState.workbench.shotExecution.id,
    sourceRunId,
    importBatchId: creatorImportState.importBatch.id,
    variantCount: 2,
  };
}

function withGovernance(state: Omit<AdminState, "governance"> & Partial<Pick<AdminState, "governance">>) {
  if (state.governance) {
    return state as AdminState;
  }

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
  ];
  const adminPermissionCodes = availablePermissions.map((permission) => permission.code);

  return {
    ...state,
    governance: {
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

function syncGovernanceState(state: AdminState["governance"]): AdminState["governance"] {
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockConnectRoutes(page: Page, scenario: MockConnectScenario) {
  const phase1DemoScenarios = await loadPhase1DemoScenarios();
  let devSessionActive = false;
  let adminState = withRecentChanges(
    withGovernance(clone(phase1DemoScenarios.admin[scenario.admin ?? "success"])),
  );
  let creatorShotState = clone(
    phase1DemoScenarios.creatorShot[scenario.creatorShot ?? "success"],
  );
  let creatorShotWorkflowRuns: MockWorkflowRun[] = scenario.admin
    ? buildInitialWorkflowRuns({
        projectId:
          creatorShotState.workbench.shotExecution.projectId ?? adminState.budgetSnapshot.projectId,
        resourceId: creatorShotState.workbench.shotExecution.id,
      })
    : [];
  let creatorImportState = clone(
    phase1DemoScenarios.creatorImport[scenario.creatorImport ?? "success"],
  );

  await page.route(/\/sse\/events(?:\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: ": keep-alive\n\n",
    });
  });

  await page.route(/\/hualala\..+/, async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === "/hualala.auth.v1.AuthService/GetCurrentSession") {
      if (!devSessionActive) {
        await route.fulfill(jsonResponse(401, { error: "unauthenticated" }));
        return;
      }
      const session =
        scenario.admin || scenario.creatorImport
          ? adminState.governance.currentSession
          : {
              sessionId: "dev:org-1:user-1",
              orgId: "org-1",
              userId: "user-1",
              locale: "zh-CN",
              roleId: "role-admin",
              roleCode: "admin",
              permissionCodes: [
                "session.read",
                "user.preferences.write",
                "org.members.read",
                "org.roles.read",
                "org.members.write",
                "org.settings.write",
                "org.roles.write",
              ],
              timezone: "Asia/Shanghai",
            };
      await route.fulfill(jsonResponse(200, { session }));
      return;
    }

    if (pathname === "/hualala.auth.v1.AuthService/StartDevSession") {
      devSessionActive = true;
      const session =
        scenario.admin || scenario.creatorImport
          ? adminState.governance.currentSession
          : {
              sessionId: "dev:org-1:user-1",
              orgId: "org-1",
              userId: "user-1",
              locale: "zh-CN",
              roleId: "role-admin",
              roleCode: "admin",
              permissionCodes: [
                "session.read",
                "user.preferences.write",
                "org.members.read",
                "org.roles.read",
                "org.members.write",
                "org.settings.write",
                "org.roles.write",
              ],
              timezone: "Asia/Shanghai",
            };
      await route.fulfill(jsonResponse(200, { session }));
      return;
    }

    if (pathname === "/hualala.auth.v1.AuthService/ClearCurrentSession") {
      devSessionActive = false;
      await route.fulfill(jsonResponse(200, {}));
      return;
    }

    if (scenario.admin) {
      if (pathname === "/hualala.workflow.v1.WorkflowService/ListWorkflowRuns") {
        await route.fulfill(
          jsonResponse(200, {
            workflowRuns: creatorShotWorkflowRuns.map((record) => summarizeWorkflowRun(record)),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/GetWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        const record = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        if (!record) {
          await route.fulfill(jsonResponse(404, { error: "workflow run not found" }));
          return;
        }
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(record),
            workflowSteps: record.steps,
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        creatorShotWorkflowRuns = creatorShotWorkflowRuns.map((run) => {
          if (run.id !== body.workflowRunId) {
            return run;
          }
          const nextAttemptCount = run.attemptCount + 1;
          return {
            ...run,
            status: "running",
            currentStep: `attempt_${nextAttemptCount}.gateway`,
            attemptCount: nextAttemptCount,
            lastError: "",
            updatedAt: createTimestamp(1710000600),
            steps: createWorkflowSteps({
              workflowRunId: run.id,
              attemptCount: nextAttemptCount,
              gatewayStatus: "running",
              lastError: "",
            }),
          };
        });
        const record = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: record ? summarizeWorkflowRun(record) : undefined,
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/CancelWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        creatorShotWorkflowRuns = creatorShotWorkflowRuns.map((run) => {
          if (run.id !== body.workflowRunId) {
            return run;
          }
          return {
            ...run,
            status: "cancelled",
            currentStep: `attempt_${run.attemptCount}.cancel`,
            lastError: "",
            updatedAt: createTimestamp(1710000900),
            steps: createWorkflowSteps({
              workflowRunId: run.id,
              attemptCount: run.attemptCount,
              gatewayStatus: "cancelled",
              lastError: "",
            }),
          };
        });
        const record = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: record ? summarizeWorkflowRun(record) : undefined,
          }),
        );
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/ListImportBatches") {
        await route.fulfill(
          jsonResponse(200, {
            importBatches: [
              buildImportBatchSummary({
                adminState,
                creatorImportState,
              }),
            ],
          }),
        );
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/GetImportBatchWorkbench") {
        await route.fulfill(
          jsonResponse(
            200,
            buildImportBatchWorkbenchPayload({
              adminState,
              creatorShotState,
              creatorImportState,
              workflowRuns: creatorShotWorkflowRuns,
            }),
          ),
        );
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/GetAssetProvenanceSummary") {
        const body = route.request().postDataJSON() as { assetId?: string };
        await route.fulfill(
          jsonResponse(
            200,
            buildAssetProvenancePayload({
              adminState,
              creatorShotState,
              creatorImportState,
              workflowRuns: creatorShotWorkflowRuns,
              assetId: body.assetId ?? creatorImportState.items[0]?.assetId ?? "",
            }),
          ),
        );
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems") {
        await delay(120);
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterConfirm ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
        await delay(120);
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterSelect ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

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
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            members: adminState.governance.members.map((member) =>
              member.memberId === body.memberId
                ? { ...member, roleId: body.roleId ?? member.roleId }
                : member,
            ),
          }),
        });
        const updatedMember = adminState.governance.members.find(
          (member) => member.memberId === body.memberId,
        );
        await route.fulfill(jsonResponse(200, { member: updatedMember }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/CreateRole") {
        const body = route.request().postDataJSON() as {
          orgId?: string;
          code?: string;
          displayName?: string;
          permissionCodes?: string[];
        };
        const nextRole = {
          roleId: `role-${body.code ?? "custom"}`,
          orgId: body.orgId ?? adminState.governance.currentSession.orgId,
          code: body.code ?? "custom",
          displayName: body.displayName ?? "Custom",
          permissionCodes: [...(body.permissionCodes ?? [])],
          memberCount: 0,
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            roles: [...adminState.governance.roles, nextRole],
          }),
        });
        await route.fulfill(jsonResponse(200, { role: nextRole }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/UpdateRole") {
        const body = route.request().postDataJSON() as {
          roleId?: string;
          displayName?: string;
          permissionCodes?: string[];
        };
        let updatedRole:
          | (AdminState["governance"]["roles"][number] & {
              memberCount: number;
            })
          | undefined;
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            roles: adminState.governance.roles.map((role) => {
              if (role.roleId !== body.roleId) {
                return role;
              }
              updatedRole = {
                ...role,
                displayName: body.displayName ?? role.displayName,
                permissionCodes: [...(body.permissionCodes ?? role.permissionCodes)],
              };
              return updatedRole;
            }),
          }),
        });
        await route.fulfill(jsonResponse(200, { role: updatedRole }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/DeleteRole") {
        const body = route.request().postDataJSON() as {
          roleId?: string;
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            roles: adminState.governance.roles.filter((role) => role.roleId !== body.roleId),
          }),
        });
        await route.fulfill(jsonResponse(200, {}));
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
      if (pathname === "/hualala.workflow.v1.WorkflowService/ListWorkflowRuns") {
        await route.fulfill(
          jsonResponse(200, {
            workflowRuns: creatorShotWorkflowRuns.map((record) => summarizeWorkflowRun(record)),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/StartWorkflow") {
        const body = route.request().postDataJSON() as {
          workflowType?: string;
          resourceId?: string;
          projectId?: string;
        };
        const workflowRun: MockWorkflowRun = {
          id: `workflow-run-${creatorShotWorkflowRuns.length + 1}`,
          workflowType: body.workflowType ?? "shot_pipeline",
          status: "running",
          resourceId: body.resourceId ?? creatorShotState.workbench.shotExecution.id,
          projectId:
            body.projectId ??
            creatorShotState.workbench.shotExecution.projectId ??
            "project-live-1",
          provider: "seedance",
          currentStep: "attempt_1.gateway",
          attemptCount: 1,
          lastError: "",
          externalRequestId: `request-${creatorShotWorkflowRuns.length + 1}`,
          createdAt: createTimestamp(1710000000 + creatorShotWorkflowRuns.length * 60),
          updatedAt: createTimestamp(1710000005 + creatorShotWorkflowRuns.length * 60),
          steps: createWorkflowSteps({
            workflowRunId: `workflow-run-${creatorShotWorkflowRuns.length + 1}`,
            attemptCount: 1,
            gatewayStatus: "running",
            lastError: "",
          }),
        };
        creatorShotWorkflowRuns = [workflowRun, ...clone(creatorShotWorkflowRuns)];
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(workflowRun),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        const current = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        const nextAttemptCount = (current?.attemptCount ?? 1) + 1;
        const workflowRun: MockWorkflowRun = {
          id: current?.id ?? body.workflowRunId ?? "workflow-run-retry",
          workflowType: current?.workflowType ?? "shot_pipeline",
          status: "running",
          resourceId: current?.resourceId ?? creatorShotState.workbench.shotExecution.id,
          projectId:
            current?.projectId ??
            creatorShotState.workbench.shotExecution.projectId ??
            "project-live-1",
          provider: current?.provider ?? "seedance",
          currentStep: `attempt_${nextAttemptCount}.gateway`,
          attemptCount: nextAttemptCount,
          lastError: "",
          externalRequestId: current?.externalRequestId ?? "request-retry",
          createdAt: current?.createdAt ?? createTimestamp(1710000000),
          updatedAt: createTimestamp(1710000600),
          steps: createWorkflowSteps({
            workflowRunId: current?.id ?? body.workflowRunId ?? "workflow-run-retry",
            attemptCount: nextAttemptCount,
            gatewayStatus: "running",
            lastError: "",
          }),
        };
        creatorShotWorkflowRuns = [
          workflowRun,
          ...creatorShotWorkflowRuns.filter((run) => run.id !== workflowRun.id),
        ];
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(workflowRun),
          }),
        );
        return;
      }

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
