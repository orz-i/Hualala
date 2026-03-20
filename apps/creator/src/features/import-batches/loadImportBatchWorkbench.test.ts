import { loadImportBatchWorkbench } from "./loadImportBatchWorkbench";

describe("loadImportBatchWorkbench", () => {
  it("calls the real GetImportBatchWorkbench endpoint and maps the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        importBatch: {
          id: "batch-1",
          status: "matched_pending_confirm",
          sourceType: "upload_session",
        },
        uploadSessions: [{ id: "upload-session-1", status: "completed" }],
        items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
        candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
        shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
      }),
    });

    const result = await loadImportBatchWorkbench({
      importBatchId: "batch-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/GetImportBatchWorkbench",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          importBatchId: "batch-1",
        }),
      }),
    );
    expect(result.importBatch.id).toBe("batch-1");
    expect(result.uploadSessions).toHaveLength(1);
    expect(result.candidateAssets).toHaveLength(1);
    expect(result.shotExecutions[0]?.status).toBe("candidate_ready");
  });
});
