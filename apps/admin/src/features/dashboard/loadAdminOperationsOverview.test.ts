import type { AdminOverviewViewModel } from "./overview";
import { createAssetMonitor } from "./assetMonitor.test-data";
import { loadAssetMonitorPanel } from "./loadAssetMonitorPanel";
import { loadAdminOperationsOverview } from "./loadAdminOperationsOverview";
import { loadAdminOverview } from "./loadAdminOverview";
import { loadWorkflowMonitorPanel } from "./loadWorkflowMonitorPanel";

vi.mock("./loadAdminOverview", () => ({
  loadAdminOverview: vi.fn(),
}));
vi.mock("./loadWorkflowMonitorPanel", () => ({
  loadWorkflowMonitorPanel: vi.fn(),
}));
vi.mock("./loadAssetMonitorPanel", () => ({
  loadAssetMonitorPanel: vi.fn(),
}));

const loadAdminOverviewMock = vi.mocked(loadAdminOverview);
const loadWorkflowMonitorPanelMock = vi.mocked(loadWorkflowMonitorPanel);
const loadAssetMonitorPanelMock = vi.mocked(loadAssetMonitorPanel);

function createOverview(): AdminOverviewViewModel {
  return {
    budgetSnapshot: {
      projectId: "project-live-001",
      limitCents: 120000,
      reservedCents: 18000,
      remainingBudgetCents: 0,
    },
    usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
    billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
    reviewSummary: {
      shotExecutionId: "shot-exec-live-001",
      latestConclusion: "changes_requested",
    },
    evaluationRuns: [{ id: "eval-1", status: "failed", failedChecks: ["copyright"] }],
    shotReviews: [{ id: "review-1", conclusion: "changes_requested" }],
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
        tone: "warning",
        status: "failed",
        failedChecksCount: 1,
      },
      {
        id: "review-review-1",
        kind: "review",
        tone: "warning",
        conclusion: "changes_requested",
      },
    ],
  };
}

describe("loadAdminOperationsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates release blockers and runtime alerts from existing admin consumer loaders", async () => {
    loadAdminOverviewMock.mockResolvedValueOnce(createOverview());
    loadWorkflowMonitorPanelMock.mockResolvedValueOnce({
      filters: {
        status: "",
        workflowType: "",
      },
      runs: [
        {
          id: "workflow-run-1",
          projectId: "project-live-001",
          resourceId: "shot-exec-live-001",
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
          projectId: "project-live-001",
          resourceId: "shot-exec-live-002",
          workflowType: "asset.import",
          status: "failed",
          provider: "seedance",
          currentStep: "attempt_2.gateway",
          attemptCount: 2,
          lastError: "provider rejected request",
          externalRequestId: "request-2",
          createdAt: "2024-03-09T17:00:00.000Z",
          updatedAt: "2024-03-09T17:05:00.000Z",
        },
      ],
    });
    loadAssetMonitorPanelMock.mockResolvedValueOnce({
      ...createAssetMonitor("project-live-001"),
      importBatches: [
        {
          ...createAssetMonitor("project-live-001").importBatches[0]!,
          id: "import-batch-1",
          status: "pending_review",
          itemCount: 4,
          confirmedItemCount: 1,
          mediaAssetCount: 0,
        },
      ],
    });

    const result = await loadAdminOperationsOverview({
      projectId: "project-live-001",
      shotExecutionId: "shot-exec-live-001",
    });

    expect(loadAdminOverviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-live-001",
        shotExecutionId: "shot-exec-live-001",
      }),
    );
    expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-live-001",
        status: "",
        workflowType: "",
        orgId: undefined,
        userId: undefined,
      }),
    );
    expect(loadAssetMonitorPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-live-001",
        status: "",
        sourceType: "",
        orgId: undefined,
        userId: undefined,
      }),
    );
    expect(result.blockerCount).toBe(4);
    expect(result.blockers.map((blocker) => blocker.kind)).toEqual([
      "budget",
      "review",
      "workflow",
      "asset",
    ]);
    expect(result.blockers.find((blocker) => blocker.kind === "workflow")).toEqual(
      expect.objectContaining({
        target: {
          route: "workflow",
          workflowRunId: "workflow-run-2",
        },
      }),
    );
    expect(result.blockers.find((blocker) => blocker.kind === "asset")).toEqual(
      expect.objectContaining({
        target: {
          route: "assets",
          importBatchId: "import-batch-1",
        },
      }),
    );
    expect(result.runtimeHealth).toEqual(
      expect.objectContaining({
        runningWorkflowCount: 1,
        failedWorkflowCount: 1,
        pendingImportBatchCount: 1,
        blockedImportBatchCount: 1,
      }),
    );
    expect(result.runtimeHealth.alerts).toHaveLength(3);
  });
});
