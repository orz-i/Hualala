import { describe, expect, it, vi } from "vitest";
import { createReviewClient } from "./review";

describe("createReviewClient", () => {
  it("calls review unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: {
              shotExecutionId: "shot-exec-1",
              latestConclusion: "approved",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            evaluationRuns: [{ id: "eval-1" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            shotReviews: [{ id: "review-1" }],
          }),
          { status: 200 },
        ),
      );

    const client = createReviewClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
    });

    await client.getShotReviewSummary({ shotExecutionId: "shot-exec-1" });
    await client.listEvaluationRuns({ shotExecutionId: "shot-exec-1" });
    await client.listShotReviews({ shotExecutionId: "shot-exec-1" });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.review.v1.ReviewService/GetShotReviewSummary",
      expect.objectContaining({
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/hualala.review.v1.ReviewService/ListShotReviews",
      expect.objectContaining({
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
        }),
      }),
    );
  });
});
