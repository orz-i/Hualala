import { createBillingClient, createReviewClient } from "@hualala/sdk";
import { loadAdminOverview } from "./loadAdminOverview";

vi.mock("@hualala/sdk", () => ({
  createBillingClient: vi.fn(),
  createReviewClient: vi.fn(),
}));

describe("loadAdminOverview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requests billing and review data via sdk clients, then maps the combined overview", async () => {
    const billingClient = {
      getBudgetSnapshot: vi.fn().mockResolvedValue({
        budgetSnapshot: {
          projectId: "project-live-1",
          limitCents: 120000,
          reservedCents: 18000,
          remainingBudgetCents: 102000,
        },
      }),
      listUsageRecords: vi.fn().mockResolvedValue({
        usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
      }),
      listBillingEvents: vi.fn().mockResolvedValue({
        billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
      }),
    };
    const reviewClient = {
      getShotReviewSummary: vi.fn().mockResolvedValue({
        summary: {
          shotExecutionId: "shot-exec-live-1",
          latestConclusion: "approved",
        },
      }),
      listEvaluationRuns: vi.fn().mockResolvedValue({
        evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
      }),
      listShotReviews: vi.fn().mockResolvedValue({
        shotReviews: [{ id: "review-1", conclusion: "approved" }],
      }),
    };
    vi.mocked(createBillingClient).mockReturnValue(billingClient as never);
    vi.mocked(createReviewClient).mockReturnValue(reviewClient as never);

    const result = await loadAdminOverview({
      projectId: "project-live-1",
      shotExecutionId: "shot-exec-live-1",
      baseUrl: "http://localhost:8080/",
      fetchFn: vi.fn(),
    });

    expect(createBillingClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://localhost:8080/",
      }),
    );
    expect(createReviewClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://localhost:8080/",
      }),
    );
    expect(billingClient.getBudgetSnapshot).toHaveBeenCalledWith({
      projectId: "project-live-1",
    });
    expect(reviewClient.getShotReviewSummary).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-live-1",
    });
    expect(result.reviewSummary.latestConclusion).toBe("approved");
    expect(result.billingEvents).toHaveLength(1);
    expect(result.evaluationRuns[0]?.status).toBe("passed");
    expect(result.recentChanges).toEqual([
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
    ]);
  });
});
