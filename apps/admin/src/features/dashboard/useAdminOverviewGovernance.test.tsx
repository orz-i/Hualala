import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdminOverviewViewModel, RecentChangeSummary } from "./AdminOverviewPage";
import type { AdminGovernanceViewModel } from "./governance";
import { createTranslator } from "../../i18n";
import { loadAdminOverview } from "./loadAdminOverview";
import { loadGovernancePanel } from "./loadGovernancePanel";
import { updateBudgetPolicy } from "./mutateBudgetPolicy";
import { updateUserPreferences } from "./mutateGovernance";
import { useAdminOverviewGovernance } from "./useAdminOverviewGovernance";

vi.mock("./loadAdminOverview", () => ({
  loadAdminOverview: vi.fn(),
}));
vi.mock("./loadGovernancePanel", () => ({
  loadGovernancePanel: vi.fn(),
}));
vi.mock("./mutateBudgetPolicy", () => ({
  updateBudgetPolicy: vi.fn(),
}));
vi.mock("./mutateGovernance", async () => {
  const actual = await vi.importActual<typeof import("./mutateGovernance")>("./mutateGovernance");
  return {
    ...actual,
    updateUserPreferences: vi.fn(),
    updateMemberRole: vi.fn(),
    updateOrgLocaleSettings: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
  };
});
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadAdminOverviewMock = vi.mocked(loadAdminOverview);
const loadGovernancePanelMock = vi.mocked(loadGovernancePanel);
const updateBudgetPolicyMock = vi.mocked(updateBudgetPolicy);
const updateUserPreferencesMock = vi.mocked(updateUserPreferences);

function createOverview(projectId: string, shotExecutionId: string, limitCents = 120000): AdminOverviewViewModel {
  return {
    budgetSnapshot: {
      projectId,
      limitCents,
      reservedCents: 18000,
      remainingBudgetCents: limitCents - 18000,
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
        kind: "billing",
        tone: "info",
        eventType: "budget_reserved",
        amountCents: 18000,
      },
      {
        id: "evaluation-eval-1",
        kind: "evaluation",
        tone: "success",
        status: "passed",
        failedChecksCount: 0,
      },
      {
        id: "review-review-1",
        kind: "review",
        tone: "success",
        conclusion: "approved",
      },
    ],
  };
}

function createGovernance(orgId: string, userId: string): AdminGovernanceViewModel {
  return {
    currentSession: {
      sessionId: `dev:${orgId}:${userId}`,
      orgId,
      userId,
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read", "org.roles.read", "org.roles.write"],
      timezone: "Asia/Shanghai",
    },
    userPreferences: {
      userId,
      displayLocale: "zh-CN",
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
    roles: [
      {
        roleId: "role-admin",
        orgId,
        code: "admin",
        displayName: "Administrator",
        permissionCodes: ["session.read", "org.roles.read", "org.roles.write"],
        memberCount: 1,
      },
    ],
    availablePermissions: [
      {
        code: "org.roles.write",
        displayName: "Manage roles",
        group: "governance",
      },
    ],
    orgLocaleSettings: {
      orgId,
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("useAdminOverviewGovernance", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads overview and governance in parallel once the session is ready", async () => {
    const overviewDeferred = createDeferred<AdminOverviewViewModel>();
    const governanceDeferred = createDeferred<AdminGovernanceViewModel>();
    loadAdminOverviewMock.mockReturnValueOnce(overviewDeferred.promise);
    loadGovernancePanelMock.mockReturnValueOnce(governanceDeferred.promise);

    const { result } = renderHook(() =>
      useAdminOverviewGovernance({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);
      expect(loadGovernancePanelMock).toHaveBeenCalledTimes(1);
    });

    expect(result.current.overview).toBeNull();
    expect(result.current.governance).toBeNull();

    await act(async () => {
      overviewDeferred.resolve(createOverview("project-live-001", "shot-exec-live-001"));
      governanceDeferred.resolve(createGovernance("org-demo-001", "user-demo-001"));
      await Promise.all([overviewDeferred.promise, governanceDeferred.promise]);
    });

    await waitFor(() => {
      expect(result.current.overview?.budgetSnapshot.projectId).toBe("project-live-001");
      expect(result.current.governance?.currentSession.orgId).toBe("org-demo-001");
    });
  });

  it("refreshes the overview after a successful budget update", async () => {
    loadAdminOverviewMock
      .mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001"))
      .mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001", 240000));
    loadGovernancePanelMock.mockResolvedValueOnce(createGovernance("org-demo-001", "user-demo-001"));
    updateBudgetPolicyMock.mockResolvedValueOnce({
      id: "policy-1",
      orgId: "org-demo-001",
      projectId: "project-live-001",
      limitCents: 240000,
      reservedCents: 18000,
    });

    const { result } = renderHook(() =>
      useAdminOverviewGovernance({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.overview?.budgetSnapshot.limitCents).toBe(120000);
      expect(result.current.governance).not.toBeNull();
    });

    await act(async () => {
      await result.current.onUpdateBudgetLimit({
        projectId: "project-live-001",
        limitCents: 240000,
      });
    });

    await waitFor(() => {
      expect(result.current.budgetFeedback?.tone).toBe("success");
    });

    expect(updateBudgetPolicyMock).toHaveBeenCalledWith({
      orgId: "org-demo-001",
      projectId: "project-live-001",
      limitCents: 240000,
    });
    expect(loadAdminOverviewMock).toHaveBeenCalledTimes(2);
    expect(result.current.overview?.budgetSnapshot.limitCents).toBe(240000);
  });

  it("keeps governance data visible and surfaces an error when governance actions fail", async () => {
    const governance = createGovernance("org-demo-001", "user-demo-001");
    loadAdminOverviewMock.mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001"));
    loadGovernancePanelMock.mockResolvedValueOnce(governance);
    updateUserPreferencesMock.mockRejectedValueOnce(new Error("governance exploded"));

    const { result } = renderHook(() =>
      useAdminOverviewGovernance({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.governance?.currentSession.orgId).toBe("org-demo-001");
    });

    act(() => {
      result.current.onUpdateUserPreferences({
        userId: "user-demo-001",
        displayLocale: "en-US",
        timezone: "UTC",
      });
    });

    await waitFor(() => {
      expect(result.current.governanceActionFeedback?.tone).toBe("error");
    });

    expect(result.current.governance).toEqual(governance);
    expect(result.current.governanceActionFeedback?.message).toContain("governance exploded");
  });

  it("merges recent changes without reloading the whole overview", async () => {
    loadAdminOverviewMock.mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001"));
    loadGovernancePanelMock.mockResolvedValueOnce(createGovernance("org-demo-001", "user-demo-001"));

    const { result } = renderHook(() =>
      useAdminOverviewGovernance({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.overview?.recentChanges).toHaveLength(3);
    });

    act(() => {
      result.current.applyRecentChange({
        id: "evaluation-eval-2",
        kind: "evaluation",
        tone: "warning",
        status: "failed",
        failedChecksCount: 2,
      } satisfies RecentChangeSummary);
    });

    expect(result.current.overview?.recentChanges[1]).toEqual({
      id: "evaluation-eval-2",
      kind: "evaluation",
      tone: "warning",
      status: "failed",
      failedChecksCount: 2,
    });
    expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);
  });
});
