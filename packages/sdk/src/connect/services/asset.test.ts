import { describe, expect, it, vi } from "vitest";
import { createAssetClient } from "./asset";

describe("createAssetClient", () => {
  it("calls asset unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importBatch: {
              id: "batch-1",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importBatches: [
              {
                id: "batch-1",
                orgId: "org-1",
                projectId: "project-1",
                operatorId: "user-1",
                sourceType: "upload_session",
                status: "confirmed",
                uploadSessionCount: 2,
                itemCount: 3,
                confirmedItemCount: 1,
                candidateAssetCount: 1,
                mediaAssetCount: 2,
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            assets: [
              {
                id: "candidate-1",
                shotExecutionId: "shot-exec-1",
                assetId: "asset-1",
                sourceRunId: "workflow-run-1",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            asset: {
              id: "asset-1",
              projectId: "project-1",
              importBatchId: "batch-1",
              sourceType: "upload_session",
              rightsStatus: "clear",
            },
            provenanceSummary: "source_type=upload_session import_batch_id=batch-1 rights_status=clear",
            candidateAssetId: "candidate-1",
            shotExecutionId: "shot-exec-1",
            sourceRunId: "workflow-run-1",
            importBatchId: "batch-1",
            variantCount: 2,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const client = createAssetClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        userId: "user-1",
      },
    });

    await client.getImportBatchWorkbench({ importBatchId: "batch-1" });
    await client.listImportBatches({
      projectId: "project-1",
      status: "confirmed",
      sourceType: "upload_session",
    });
    await client.listCandidateAssets({
      shotExecutionId: "shot-exec-1",
    });
    await client.getAssetProvenanceSummary({
      assetId: "asset-1",
    });
    await client.batchConfirmImportBatchItems({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/GetImportBatchWorkbench",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Hualala-User-Id": "user-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/ListImportBatches",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          status: "confirmed",
          sourceType: "upload_session",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/ListCandidateAssets",
      expect.objectContaining({
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/GetAssetProvenanceSummary",
      expect.objectContaining({
        body: JSON.stringify({
          assetId: "asset-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems",
      expect.objectContaining({
        body: JSON.stringify({
          importBatchId: "batch-1",
          itemIds: ["item-1"],
        }),
      }),
    );
  });
});
