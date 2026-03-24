import { describe, expect, it } from "vitest";
import { seedDraftTracks } from "./audioWorkbench";

describe("seedDraftTracks", () => {
  it("preserves multiple built-in tracks of the same type instead of collapsing them", () => {
    const draftTracks = seedDraftTracks({
      timeline: {
        audioTimelineId: "timeline-1",
        projectId: "project-1",
        episodeId: "",
        status: "draft",
        renderWorkflowRunId: "",
        renderStatus: "idle",
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:00:00.000Z",
      },
      tracks: [
        {
          trackId: "track-dialogue-1",
          timelineId: "timeline-1",
          trackType: "dialogue",
          displayName: "对白 A",
          sequence: 1,
          muted: false,
          solo: false,
          volumePercent: 100,
          clips: [],
        },
        {
          trackId: "track-dialogue-2",
          timelineId: "timeline-1",
          trackType: "dialogue",
          displayName: "对白 B",
          sequence: 2,
          muted: false,
          solo: false,
          volumePercent: 85,
          clips: [],
        },
        {
          trackId: "track-bgm-1",
          timelineId: "timeline-1",
          trackType: "bgm",
          displayName: "配乐",
          sequence: 3,
          muted: false,
          solo: false,
          volumePercent: 70,
          clips: [],
        },
      ],
      summary: {
        trackCount: 3,
        clipCount: 0,
        missingDurationClipCount: 0,
      },
    });

    expect(draftTracks.map((track) => track.trackId)).toEqual([
      "track-dialogue-1",
      "track-dialogue-2",
      "draft-track-voiceover",
      "track-bgm-1",
    ]);
  });
});
