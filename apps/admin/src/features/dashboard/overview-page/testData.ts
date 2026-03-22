import type { AdminGovernanceViewModel } from "../governance";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "../workflow";

const governancePermissionCatalog = [
  {
    code: "session.read",
    displayName: "Read session",
    group: "session",
  },
  {
    code: "user.preferences.write",
    displayName: "Update user preferences",
    group: "session",
  },
  {
    code: "org.members.read",
    displayName: "Read members",
    group: "governance",
  },
  {
    code: "org.roles.read",
    displayName: "Read roles",
    group: "governance",
  },
  {
    code: "org.members.write",
    displayName: "Update members",
    group: "governance",
  },
  {
    code: "org.settings.write",
    displayName: "Update org settings",
    group: "governance",
  },
  {
    code: "org.roles.write",
    displayName: "Manage roles",
    group: "governance",
  },
] as const;

export function createOverview(projectId = "project-live-1", shotExecutionId = "shot-exec-live-1") {
  return {
    budgetSnapshot: {
      projectId,
      limitCents: 120000,
      reservedCents: 18000,
      remainingBudgetCents: 102000,
    },
    usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
    billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
    reviewSummary: {
      shotExecutionId,
      latestConclusion: "approved",
    },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
    recentChanges: [
      {
        id: "billing-event-1",
        kind: "billing" as const,
        tone: "info" as const,
        eventType: "budget_reserved",
        amountCents: 18000,
      },
      {
        id: "evaluation-eval-1",
        kind: "evaluation" as const,
        tone: "success" as const,
        status: "passed",
        failedChecksCount: 0,
      },
      {
        id: "review-review-1",
        kind: "review" as const,
        tone: "success" as const,
        conclusion: "approved",
      },
    ],
  };
}

export function createGovernance(): AdminGovernanceViewModel {
  const adminPermissionCodes = governancePermissionCatalog.map((permission) => permission.code);

  return {
    currentSession: {
      sessionId: "dev:org-live-1:user-live-1",
      orgId: "org-live-1",
      userId: "user-live-1",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: adminPermissionCodes,
      timezone: "Asia/Shanghai",
    },
    userPreferences: {
      userId: "user-live-1",
      displayLocale: "zh-CN",
      timezone: "Asia/Shanghai",
    },
    members: [
      {
        memberId: "member-1",
        orgId: "org-live-1",
        userId: "user-live-1",
        roleId: "role-admin",
      },
    ],
    roles: [
      {
        roleId: "role-admin",
        orgId: "org-live-1",
        code: "admin",
        displayName: "Administrator",
        permissionCodes: adminPermissionCodes,
        memberCount: 1,
      },
      {
        roleId: "role-viewer",
        orgId: "org-live-1",
        code: "viewer",
        displayName: "Viewer",
        permissionCodes: ["session.read", "user.preferences.write"],
        memberCount: 0,
      },
    ],
    availablePermissions: [...governancePermissionCatalog],
    orgLocaleSettings: {
      orgId: "org-live-1",
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
    },
    capabilities: {
      canManageRoles: true,
      canManageMembers: true,
      canManageOrgSettings: true,
      canManageUserPreferences: true,
    },
  };
}

export function createWorkflowMonitor(): WorkflowMonitorViewModel {
  return {
    filters: {
      status: "",
      workflowType: "",
    },
    runs: [
      {
        id: "workflow-run-1",
        projectId: "project-live-1",
        resourceId: "shot-exec-live-1",
        workflowType: "shot_pipeline",
        status: "running",
        provider: "seedance",
        currentStep: "attempt_1.gateway",
        attemptCount: 1,
        lastError: "",
        externalRequestId: "request-1",
        createdAt: "2024-03-09T16:00:00.000Z",
        updatedAt: "2024-03-09T16:05:00.000Z",
      },
      {
        id: "workflow-run-2",
        projectId: "project-live-1",
        resourceId: "shot-exec-live-2",
        workflowType: "shot_pipeline",
        status: "failed",
        provider: "seedance",
        currentStep: "attempt_2.gateway",
        attemptCount: 2,
        lastError: "gateway timeout",
        externalRequestId: "request-2",
        createdAt: "2024-03-09T16:06:00.000Z",
        updatedAt: "2024-03-09T16:10:00.000Z",
      },
    ],
  };
}

export function createFailedWorkflowDetail(): WorkflowRunDetailViewModel {
  return {
    run: createWorkflowMonitor().runs[1]!,
    steps: [
      {
        id: "step-1",
        workflowRunId: "workflow-run-2",
        stepKey: "attempt_2.dispatch",
        stepOrder: 1,
        status: "completed",
        errorCode: "",
        errorMessage: "",
        startedAt: "2024-03-09T16:06:00.000Z",
        completedAt: "2024-03-09T16:06:05.000Z",
        failedAt: "",
      },
      {
        id: "step-2",
        workflowRunId: "workflow-run-2",
        stepKey: "attempt_2.gateway",
        stepOrder: 2,
        status: "failed",
        errorCode: "provider_error",
        errorMessage: "gateway timeout",
        startedAt: "2024-03-09T16:06:06.000Z",
        completedAt: "",
        failedAt: "2024-03-09T16:10:00.000Z",
      },
    ],
  };
}

export function createRunningWorkflowDetail(): WorkflowRunDetailViewModel {
  return {
    ...createFailedWorkflowDetail(),
    run: createWorkflowMonitor().runs[0]!,
    steps: [
      {
        id: "step-running-1",
        workflowRunId: "workflow-run-1",
        stepKey: "attempt_1.gateway",
        stepOrder: 2,
        status: "running",
        errorCode: "",
        errorMessage: "",
        startedAt: "2024-03-09T16:00:10.000Z",
        completedAt: "",
        failedAt: "",
      },
    ],
  };
}

export function createSucceededWorkflowDetail(): WorkflowRunDetailViewModel {
  return {
    ...createFailedWorkflowDetail(),
    run: {
      ...createFailedWorkflowDetail().run,
      id: "workflow-run-3",
      status: "succeeded",
      currentStep: "attempt_1.gateway",
      lastError: "",
    },
  };
}
