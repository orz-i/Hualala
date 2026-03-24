import { describe, expect, it, vi } from "vitest";
import { loadAudioWorkbench } from "./loadAudioWorkbench";

describe("loadAudioWorkbench", () => {
  it("loads and normalizes the audio timeline response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          timeline: {
            audioTimelineId: "timeline-1",
            projectId: "project-1",
            episodeId: "",
            status: "draft",
            renderWorkflowRunId: "workflow-audio-1",
            renderStatus: "queued",
            createdAt: "2026-03-24T08:00:00.000Z",
            updatedAt: "2026-03-24T08:05:00.000Z",
            tracks: [
              {
                trackId: "track-2",
                timelineId: "timeline-1",
                trackType: "voiceover",
                displayName: "旁白",
                sequence: 2,
                muted: false,
                solo: false,
                volumePercent: 80,
                clips: [],
              },
              {
                trackId: "track-1",
                timelineId: "timeline-1",
                trackType: "dialogue",
                displayName: "对白",
                sequence: 1,
                muted: false,
                solo: false,
                volumePercent: 100,
                clips: [
                  {
                    clipId: "clip-2",
                    trackId: "track-1",
                    assetId: "asset-2",
                    sourceRunId: "run-2",
                    sequence: 2,
                    startMs: 12000,
                    durationMs: 6000,
                    trimInMs: 0,
                    trimOutMs: 0,
                  },
                  {
                    clipId: "clip-1",
                    trackId: "track-1",
                    assetId: "asset-1",
                    sourceRunId: "run-1",
                    sequence: 1,
                    startMs: 0,
                    durationMs: 12000,
                    trimInMs: 120,
                    trimOutMs: 240,
                  },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const workbench = await loadAudioWorkbench({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.project.v1.ProjectService/GetAudioWorkbench",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
        }),
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
      }),
    );
    expect(workbench.tracks.map((track) => track.trackType)).toEqual(["dialogue", "voiceover"]);
    expect(workbench.tracks[0]?.clips.map((clip) => clip.clipId)).toEqual(["clip-1", "clip-2"]);
    expect(workbench.summary).toEqual({
      trackCount: 2,
      clipCount: 2,
      missingDurationClipCount: 0,
    });
  });
});
