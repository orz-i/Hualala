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
              items: [
                {
                  itemId: "item-1",
                  assemblyId: "assembly-1",
                  shotId: "shot-1",
                  primaryAssetId: "asset-1",
                  sourceRunId: "run-1",
                  sequence: 1,
                  shot: {
                    projectId: "project-1",
                    projectTitle: "项目一",
                    episodeId: "episode-1",
                    episodeTitle: "第一集",
                    sceneId: "scene-1",
                    sceneCode: "SCENE-001",
                    sceneTitle: "开场",
                    shotId: "shot-1",
                    shotCode: "SCENE-001-SHOT-001",
                    shotTitle: "第一镜",
                  },
                  primaryAsset: {
                    assetId: "asset-1",
                    mediaType: "image",
                    rightsStatus: "cleared",
                    aiAnnotated: true,
                  },
                  sourceRun: {
                    runId: "run-1",
                    status: "completed",
                    triggerType: "manual",
                  },
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
            options: [
              {
                shot: {
                  projectId: "project-1",
                  projectTitle: "项目一",
                  episodeId: "episode-1",
                  episodeTitle: "第一集",
                  sceneId: "scene-1",
                  sceneCode: "SCENE-001",
                  sceneTitle: "开场",
                  shotId: "shot-1",
                  shotCode: "SCENE-001-SHOT-001",
                  shotTitle: "第一镜",
                },
                shotExecutionId: "shot-exec-1",
                shotExecutionStatus: "ready",
                currentPrimaryAsset: {
                  assetId: "asset-1",
                  mediaType: "image",
                  rightsStatus: "cleared",
                  aiAnnotated: true,
                },
                latestRun: {
                  runId: "run-1",
                  status: "completed",
                  triggerType: "manual",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runtime: {
              previewRuntimeId: "preview-runtime-1",
              projectId: "project-1",
              episodeId: "episode-1",
              assemblyId: "assembly-1",
              status: "draft",
              renderWorkflowRunId: "",
              renderStatus: "idle",
              playbackAssetId: "",
              exportAssetId: "",
              resolvedLocale: "",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runtime: {
              previewRuntimeId: "preview-runtime-1",
              projectId: "project-1",
              episodeId: "episode-1",
              assemblyId: "assembly-1",
              status: "queued",
              renderWorkflowRunId: "workflow-run-preview-1",
              renderStatus: "queued",
              playbackAssetId: "",
              exportAssetId: "",
              resolvedLocale: "en-US",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runtime: {
              previewRuntimeId: "preview-runtime-1",
              projectId: "project-1",
              episodeId: "episode-1",
              assemblyId: "assembly-1",
              status: "ready",
              renderWorkflowRunId: "workflow-run-preview-1",
              renderStatus: "completed",
              playbackAssetId: "playback-asset-1",
              exportAssetId: "export-asset-1",
              resolvedLocale: "en-US",
              playback: {
                deliveryMode: "manifest",
                playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
                posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
                durationMs: 30000,
              },
              exportOutput: {
                downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
                mimeType: "video/mp4",
                fileName: "preview-export-1.mp4",
                sizeBytes: "4096",
              },
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
      displayLocale: "en-US",
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
    const previewOptions = await client.listPreviewShotOptions({
      projectId: "project-1",
      episodeId: "episode-1",
      displayLocale: "en-US",
    });
    const previewRuntime = await client.getPreviewRuntime({
      projectId: "project-1",
      episodeId: "episode-1",
    });
    const queuedPreviewRuntime = await client.requestPreviewRender({
      projectId: "project-1",
      episodeId: "episode-1",
      requestedLocale: "en-US",
    });
    const completedPreviewRuntime = await client.applyPreviewRenderUpdate({
      previewRuntimeId: "preview-runtime-1",
      renderWorkflowRunId: "workflow-run-preview-1",
      renderStatus: "completed",
      resolvedLocale: "en-US",
      playbackAssetId: "playback-asset-1",
      exportAssetId: "export-asset-1",
      playback: {
        deliveryMode: "manifest",
        playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
        posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
        durationMs: 30000,
      },
      exportOutput: {
        downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
        mimeType: "video/mp4",
        fileName: "preview-export-1.mp4",
        sizeBytes: 4096,
      },
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
          displayLocale: "en-US",
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
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/ListPreviewShotOptions",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
          displayLocale: "en-US",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/GetPreviewRuntime",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/RequestPreviewRender",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
          requestedLocale: "en-US",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      6,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/ApplyPreviewRenderUpdate",
      expect.objectContaining({
        body: JSON.stringify({
          previewRuntimeId: "preview-runtime-1",
          renderWorkflowRunId: "workflow-run-preview-1",
          renderStatus: "completed",
          resolvedLocale: "en-US",
          playbackAssetId: "playback-asset-1",
          exportAssetId: "export-asset-1",
          playback: {
            deliveryMode: "manifest",
            playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
            posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
            durationMs: 30000,
          },
          exportOutput: {
            downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
            mimeType: "video/mp4",
            fileName: "preview-export-1.mp4",
            sizeBytes: 4096,
          },
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      7,
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/GetAudioWorkbench",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          episodeId: "episode-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      8,
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
    expect(previewOptions.options[0]?.shot?.projectTitle).toBe("项目一");
    expect(previewOptions.options[0]?.latestRun?.runId).toBe("run-1");
    expect(previewRuntime.runtime?.previewRuntimeId).toBe("preview-runtime-1");
    expect(queuedPreviewRuntime.runtime?.renderStatus).toBe("queued");
    expect(queuedPreviewRuntime.runtime?.resolvedLocale).toBe("en-US");
    expect(completedPreviewRuntime.runtime?.playback?.deliveryMode).toBe("manifest");
    expect(completedPreviewRuntime.runtime?.exportOutput?.downloadUrl).toBe("https://cdn.example.com/preview-export-1.mp4");
    expect(audioWorkbench.timeline?.audioTimelineId).toBe("audio-timeline-1");
    expect(audioWorkbench.timeline?.tracks[0]?.volumePercent).toBe(0);
    expect(audioTimeline.timeline?.tracks[0]?.clips[0]?.durationMs).toBe(12000);
  });
});
