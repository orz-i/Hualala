import { createReviewClient } from "@hualala/sdk";
import { loadShotReviewTimeline } from "./loadShotReviewTimeline";

vi.mock("@hualala/sdk", () => ({
  createReviewClient: vi.fn(),
}));

describe("loadShotReviewTimeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads evaluation runs and shot reviews via the sdk review client", async () => {
    const listEvaluationRunsMock = vi.fn().mockResolvedValue({
      evaluationRuns: [
        {
          id: "eval-1",
          status: "passed",
          passedChecks: ["asset_selected"],
          failedChecks: [],
        },
      ],
    });
    const listShotReviewsMock = vi.fn().mockResolvedValue({
      shotReviews: [
        {
          id: "review-1",
          conclusion: "approved",
          commentLocale: "zh-CN",
        },
      ],
    });
    vi.mocked(createReviewClient).mockReturnValue({
      listEvaluationRuns: listEvaluationRunsMock,
      listShotReviews: listShotReviewsMock,
    } as never);

    const result = await loadShotReviewTimeline({
      shotExecutionId: "shot-exec-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
      unavailableMessage: "Review timeline unavailable",
    });

    expect(createReviewClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
      }),
    );
    expect(listEvaluationRunsMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
    expect(listShotReviewsMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
    expect(result).toEqual({
      evaluationRuns: [
        {
          id: "eval-1",
          status: "passed",
          passedChecks: ["asset_selected"],
          failedChecks: [],
        },
      ],
      shotReviews: [
        {
          id: "review-1",
          conclusion: "approved",
          commentLocale: "zh-CN",
        },
      ],
    });
  });

  it("keeps the service order and falls back missing fields", async () => {
    vi.mocked(createReviewClient).mockReturnValue({
      listEvaluationRuns: vi.fn().mockResolvedValue({
        evaluationRuns: [
          {
            id: "eval-2",
          },
          {
            id: "eval-1",
            status: "failed",
            passedChecks: ["asset_selected"],
            failedChecks: ["copyright_missing"],
          },
        ],
      }),
      listShotReviews: vi.fn().mockResolvedValue({
        shotReviews: [
          {
            id: "review-2",
            conclusion: "commented",
          },
          {
            id: "review-1",
            conclusion: "approved",
            commentLocale: "en-US",
          },
        ],
      }),
    } as never);

    const result = await loadShotReviewTimeline({
      shotExecutionId: "shot-exec-1",
      unavailableMessage: "Review timeline unavailable",
    });

    expect(result.evaluationRuns).toEqual([
      {
        id: "eval-2",
        status: "pending",
        passedChecks: [],
        failedChecks: [],
      },
      {
        id: "eval-1",
        status: "failed",
        passedChecks: ["asset_selected"],
        failedChecks: ["copyright_missing"],
      },
    ]);
    expect(result.shotReviews).toEqual([
      {
        id: "review-2",
        conclusion: "commented",
        commentLocale: "",
      },
      {
        id: "review-1",
        conclusion: "approved",
        commentLocale: "en-US",
      },
    ]);
  });

  it("returns the unavailable state when the review timeline requests fail", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(createReviewClient).mockReturnValue({
      listEvaluationRuns: vi.fn().mockRejectedValue(new Error("network down")),
      listShotReviews: vi.fn(),
    } as never);

    const result = await loadShotReviewTimeline({
      shotExecutionId: "shot-exec-1",
      unavailableMessage: "Review timeline unavailable",
    });

    expect(result).toEqual({
      evaluationRuns: [],
      shotReviews: [],
      unavailableMessage: "Review timeline unavailable",
    });
    expect(warnSpy).toHaveBeenCalledWith("creator: failed to load shot review timeline", {
      shotExecutionId: "shot-exec-1",
      error: expect.any(Error),
    });
  });
});
