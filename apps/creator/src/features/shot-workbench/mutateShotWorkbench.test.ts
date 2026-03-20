import { createExecutionClient } from "@hualala/sdk";
import { runSubmissionGateChecks, submitShotForReview } from "./mutateShotWorkbench";

vi.mock("@hualala/sdk", () => ({
  createExecutionClient: vi.fn(),
}));

describe("mutateShotWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("runs gate checks via the sdk execution client", async () => {
    const runSubmissionGateChecksMock = vi.fn().mockResolvedValue({
      passedChecks: ["asset_selected", "review_ready"],
      failedChecks: ["copyright_missing"],
    });
    vi.mocked(createExecutionClient).mockReturnValue({
      runSubmissionGateChecks: runSubmissionGateChecksMock,
    } as never);

    const result = await runSubmissionGateChecks({
      shotExecutionId: "shot-exec-1",
      baseUrl: "http://localhost:8080/",
      fetchFn: vi.fn(),
    });

    expect(createExecutionClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://localhost:8080/",
      }),
    );
    expect(runSubmissionGateChecksMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
    expect(result).toEqual({
      passedChecks: ["asset_selected", "review_ready"],
      failedChecks: ["copyright_missing"],
    });
  });

  it("submits review via the sdk execution client", async () => {
    const submitShotForReviewMock = vi.fn().mockResolvedValue({});
    vi.mocked(createExecutionClient).mockReturnValue({
      submitShotForReview: submitShotForReviewMock,
    } as never);

    await submitShotForReview({
      shotExecutionId: "shot-exec-1",
      baseUrl: "http://localhost:8080/",
      fetchFn: vi.fn(),
    });

    expect(submitShotForReviewMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
  });
});
