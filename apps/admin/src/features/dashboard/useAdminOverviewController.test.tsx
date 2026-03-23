import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdminOverviewViewModel, RecentChangeSummary } from "./overview";
import { createTranslator } from "../../i18n";
import { loadAdminOverview } from "./loadAdminOverview";
import { updateBudgetPolicy } from "./mutateBudgetPolicy";
import { useAdminOverviewController } from "./useAdminOverviewController";

vi.mock("./loadAdminOverview", () => ({
  loadAdminOverview: vi.fn(),
}));
vi.mock("./mutateBudgetPolicy", () => ({
  updateBudgetPolicy: vi.fn(),
}));
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadAdminOverviewMock = vi.mocked(loadAdminOverview);
const updateBudgetPolicyMock = vi.mocked(updateBudgetPolicy);

function createOverview(
  projectId: string,
  shotExecutionId: string,
  limitCents = 120000,
): AdminOverviewViewModel {
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("useAdminOverviewController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads overview once the session is ready", async () => {
    const overviewDeferred = createDeferred<AdminOverviewViewModel>();
    loadAdminOverviewMock.mockReturnValueOnce(overviewDeferred.promise);

    const { result } = renderHook(() =>
      useAdminOverviewController({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        effectiveOrgId: "org-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);
    });

    expect(result.current.overview).toBeNull();

    await act(async () => {
      overviewDeferred.resolve(createOverview("project-live-001", "shot-exec-live-001"));
      await overviewDeferred.promise;
    });

    await waitFor(() => {
      expect(result.current.overview?.budgetSnapshot.projectId).toBe("project-live-001");
    });
  });

  it("refreshes the overview after a successful budget update", async () => {
    loadAdminOverviewMock
      .mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001"))
      .mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001", 240000));
    updateBudgetPolicyMock.mockResolvedValueOnce({
      id: "policy-1",
      orgId: "org-demo-001",
      projectId: "project-live-001",
      limitCents: 240000,
      reservedCents: 18000,
    });

    const { result } = renderHook(() =>
      useAdminOverviewController({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        effectiveOrgId: "org-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.overview?.budgetSnapshot.limitCents).toBe(120000);
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

  it("surfaces pending budget feedback before the update resolves", async () => {
    const budgetUpdateDeferred = createDeferred<{
      id: string;
      orgId: string;
      projectId: string;
      limitCents: number;
      reservedCents: number;
    }>();
    loadAdminOverviewMock
      .mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001"))
      .mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001", 240000));
    updateBudgetPolicyMock.mockReturnValueOnce(budgetUpdateDeferred.promise);

    const { result } = renderHook(() =>
      useAdminOverviewController({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        effectiveOrgId: "org-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.overview?.budgetSnapshot.limitCents).toBe(120000);
    });

    act(() => {
      void result.current.onUpdateBudgetLimit({
        projectId: "project-live-001",
        limitCents: 240000,
      });
    });

    await waitFor(() => {
      expect(result.current.budgetFeedback?.tone).toBe("pending");
      expect(result.current.budgetFeedback?.message).toBe("正在更新预算策略");
    });

    await act(async () => {
      budgetUpdateDeferred.resolve({
        id: "policy-1",
        orgId: "org-demo-001",
        projectId: "project-live-001",
        limitCents: 240000,
        reservedCents: 18000,
      });
      await budgetUpdateDeferred.promise;
    });

    await waitFor(() => {
      expect(result.current.budgetFeedback?.tone).toBe("success");
    });
  });

  it("merges recent changes without reloading the whole overview", async () => {
    loadAdminOverviewMock.mockResolvedValueOnce(createOverview("project-live-001", "shot-exec-live-001"));

    const { result } = renderHook(() =>
      useAdminOverviewController({
        sessionState: "ready",
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
        effectiveOrgId: "org-demo-001",
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
