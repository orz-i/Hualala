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
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const client = createAssetClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        userId: "user-1",
      },
    });

    await client.getImportBatchWorkbench({ importBatchId: "batch-1" });
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
