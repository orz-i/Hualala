import { describe, expect, it } from "vitest";
import { normalizeAdminAudioWorkbench } from "./adminAudio";

describe("normalizeAdminAudioWorkbench", () => {
  it("aggregates clip counts by track type in summary.tracksByType", () => {
    const workbench = normalizeAdminAudioWorkbench(
      {
        audioTimelineId: "timeline-1",
        projectId: "project-1",
        tracks: [
          {
            trackId: "track-dialogue-1",
            trackType: "dialogue",
            sequence: 1,
            clips: [
              {
                clipId: "clip-1",
                assetId: "asset-1",
                sequence: 1,
                durationMs: 1000,
              },
            ],
          },
          {
            trackId: "track-dialogue-2",
            trackType: "dialogue",
            sequence: 2,
            clips: [
              {
                clipId: "clip-2",
                assetId: "asset-2",
                sequence: 1,
                durationMs: 2000,
              },
              {
                clipId: "clip-3",
                assetId: "asset-3",
                sequence: 2,
                durationMs: 3000,
              },
            ],
          },
          {
            trackId: "track-bgm-1",
            trackType: "bgm",
            sequence: 3,
            clips: [
              {
                clipId: "clip-4",
                assetId: "asset-4",
                sequence: 1,
                durationMs: 4000,
              },
            ],
          },
        ],
      },
      "admin: audio workbench payload is incomplete",
    );

    expect(workbench.summary.tracksByType).toEqual([
      { trackType: "dialogue", count: 3 },
      { trackType: "bgm", count: 1 },
    ]);
  });
});
