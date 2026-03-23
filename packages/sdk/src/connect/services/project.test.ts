import { describe, expect, it, vi } from "vitest";
import { createProjectClient } from "./project";

describe("createProjectClient", () => {
  it("calls preview unary endpoints with the shared transport", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            assembly: {
              assemblyId: "assembly-1",
              projectId: "project-1",
              episodeId: "episode-1",
              status: "draft",
              items: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            assembly: {
              assemblyId: "assembly-1",
              projectId: "project-1",
              episodeId: "episode-1",
              status: "ready",
              items: [
                {
                  itemId: "item-1",
                  assemblyId: "assembly-1",
                  shotId: "shot-1",
                  primaryAssetId: "asset-1",
                  sourceRunId: "run-1",
                  sequence: 1,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const client = createProjectClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        userId: "user-1",
      },
    });

    await client.getPreviewWorkbench({
      projectId: "project-1",
      episodeId: "episode-1",
    });
    await client.upsertPreviewAssembly({
      projectId: "project-1",
      episodeId: "episode-1",
      status: "ready",
      items: [
        {
          shotId: "shot-1",
          primaryAssetId: "asset-1",
          sourceRunId: "run-1",
          sequence: 1,
        },
      ],
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/GetPreviewWorkbench",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Hualala-User-Id": "user-1",
        }),
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/UpsertPreviewAssembly",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
          status: "ready",
          items: [
            {
              shotId: "shot-1",
              primaryAssetId: "asset-1",
              sourceRunId: "run-1",
              sequence: 1,
            },
          ],
        }),
      }),
    );
  });
});
