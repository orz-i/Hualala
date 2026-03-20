import { loadShotWorkbench } from "./loadShotWorkbench";

describe("loadShotWorkbench", () => {
  it("calls the real GetShotWorkbench endpoint and maps the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workbench: {
          shotExecution: {
            id: "shot-exec-1",
            shotId: "shot-1",
            status: "submitted_for_review",
            primaryAssetId: "asset-1",
          },
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          reviewSummary: {
            latestConclusion: "approved",
          },
          latestEvaluationRun: {
            id: "eval-1",
            status: "passed",
          },
        },
      }),
    });

    const result = await loadShotWorkbench({
      shotId: "shot-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.execution.v1.ExecutionService/GetShotWorkbench",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          shotId: "shot-1",
          displayLocale: "zh-CN",
        }),
      }),
    );
    expect(result.shotExecution.id).toBe("shot-exec-1");
    expect(result.candidateAssets).toHaveLength(1);
    expect(result.reviewSummary.latestConclusion).toBe("approved");
    expect(result.latestEvaluationRun?.status).toBe("passed");
  });
});
