import { runSubmissionGateChecks, submitShotForReview } from "./mutateShotWorkbench";

describe("mutateShotWorkbench", () => {
  it("posts gate checks with connect protocol headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await runSubmissionGateChecks({
      shotExecutionId: "shot-exec-1",
      baseUrl: "http://localhost:8080/",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8080/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
        }),
      },
    );
  });

  it("posts submit review with connect protocol headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await submitShotForReview({
      shotExecutionId: "shot-exec-1",
      baseUrl: "http://localhost:8080/",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8080/hualala.execution.v1.ExecutionService/SubmitShotForReview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
        }),
      },
    );
  });
});
