import { loadAdminOverview } from "./loadAdminOverview";

describe("loadAdminOverview", () => {
  it("requests billing and review endpoints, then maps the combined overview", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            budgetSnapshot: {
              projectId: "project-live-1",
              limitCents: 120000,
              reservedCents: 18000,
              remainingBudgetCents: 102000,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: {
              shotExecutionId: "shot-exec-live-1",
              latestConclusion: "approved",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            shotReviews: [{ id: "review-1", conclusion: "approved" }],
          }),
          { status: 200 },
        ),
      );

    const result = await loadAdminOverview({
      projectId: "project-live-1",
      shotExecutionId: "shot-exec-live-1",
      baseUrl: "http://localhost:8080/",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8080/hualala.billing.v1.BillingService/GetBudgetSnapshot",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        }),
        body: JSON.stringify({
          projectId: "project-live-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8080/hualala.review.v1.ReviewService/GetShotReviewSummary",
      expect.objectContaining({
        body: JSON.stringify({
          shotExecutionId: "shot-exec-live-1",
        }),
      }),
    );
    expect(result.reviewSummary.latestConclusion).toBe("approved");
    expect(result.billingEvents).toHaveLength(1);
    expect(result.evaluationRuns[0]?.status).toBe("passed");
  });
});
