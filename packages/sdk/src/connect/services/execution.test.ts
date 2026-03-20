import { describe, expect, it, vi } from "vitest";
import { createExecutionClient } from "./execution";

describe("createExecutionClient", () => {
  it("calls execution unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workbench: {
              shotExecution: {
                id: "shot-exec-1",
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            passedChecks: ["asset_selected"],
            failedChecks: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const client = createExecutionClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        orgId: "org-1",
      },
    });

    await client.getShotWorkbench({
      shotId: "shot-1",
      displayLocale: "zh-CN",
    });
    await client.runSubmissionGateChecks({
      shotExecutionId: "shot-exec-1",
    });
    await client.submitShotForReview({
      shotExecutionId: "shot-exec-1",
    });
    await client.selectPrimaryAsset({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.execution.v1.ExecutionService/GetShotWorkbench",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/hualala.execution.v1.ExecutionService/SelectPrimaryAsset",
      expect.objectContaining({
        body: JSON.stringify({
          shotExecutionId: "shot-exec-1",
          assetId: "asset-1",
        }),
      }),
    );
  });
});
