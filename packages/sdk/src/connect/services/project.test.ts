import { describe, expect, it, vi } from "vitest";
import { createProjectClient } from "./project";

describe("createProjectClient", () => {
  it("calls preview and audio unary endpoints with the shared transport", async () => {
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timeline: {
              audioTimelineId: "audio-timeline-1",
              projectId: "project-1",
              episodeId: "episode-1",
              status: "draft",
              renderWorkflowRunId: "",
              renderStatus: "idle",
              tracks: [
                {
                  trackId: "track-zero",
                  timelineId: "audio-timeline-1",
                  trackType: "dialogue",
                  displayName: "对白",
                  sequence: 1,
                  clips: [],
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timeline: {
              audioTimelineId: "audio-timeline-1",
              projectId: "project-1",
              episodeId: "episode-1",
              status: "ready",
              renderWorkflowRunId: "workflow-run-1",
              renderStatus: "queued",
              tracks: [
                {
                  trackId: "track-1",
                  timelineId: "audio-timeline-1",
                  trackType: "dialogue",
                  displayName: "对白",
                  sequence: 1,
                  volumePercent: 100,
                  clips: [
                    {
                      clipId: "clip-1",
                      trackId: "track-1",
                      assetId: "asset-1",
                      sourceRunId: "workflow-run-1",
                      sequence: 1,
                      startMs: 0,
                      durationMs: 12000,
                      trimInMs: 0,
                      trimOutMs: 120,
                    },
                  ],
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
    const audioWorkbench = await client.getAudioWorkbench({
      projectId: "project-1",
      episodeId: "episode-1",
    });
    const audioTimeline = await client.upsertAudioTimeline({
      projectId: "project-1",
      episodeId: "episode-1",
      status: "ready",
      renderWorkflowRunId: "workflow-run-1",
      renderStatus: "queued",
      tracks: [
        {
          trackType: "dialogue",
          displayName: "对白",
          sequence: 1,
          volumePercent: 100,
          clips: [
            {
              assetId: "asset-1",
              sourceRunId: "workflow-run-1",
              sequence: 1,
              startMs: 0,
              durationMs: 12000,
              trimInMs: 0,
              trimOutMs: 120,
            },
          ],
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
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/GetAudioWorkbench",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/UpsertAudioTimeline",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
          status: "ready",
          renderWorkflowRunId: "workflow-run-1",
          renderStatus: "queued",
          tracks: [
            {
              trackType: "dialogue",
              displayName: "对白",
              sequence: 1,
              volumePercent: 100,
              clips: [
                {
                  assetId: "asset-1",
                  sourceRunId: "workflow-run-1",
                  sequence: 1,
                  startMs: 0,
                  durationMs: 12000,
                  trimInMs: 0,
                  trimOutMs: 120,
                },
              ],
            },
          ],
        }),
      }),
    );
    expect(audioWorkbench.timeline?.audioTimelineId).toBe("audio-timeline-1");
    expect(audioWorkbench.timeline?.tracks[0]?.volumePercent).toBe(0);
    expect(audioTimeline.timeline?.tracks[0]?.clips[0]?.durationMs).toBe(12000);
  });
});
