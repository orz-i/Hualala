import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { loadAudioAssetPool } from "./loadAudioAssetPool";
import { loadAudioWorkbench } from "./loadAudioWorkbench";
import { saveAudioWorkbench } from "./mutateAudioWorkbench";
import { useAudioWorkbenchController } from "./useAudioWorkbenchController";

vi.mock("../shared/useAssetProvenanceState", () => ({
  useAssetProvenanceState: vi.fn(),
}));

vi.mock("./loadAudioWorkbench", () => ({
  loadAudioWorkbench: vi.fn(),
}));

vi.mock("./loadAudioAssetPool", () => ({
  loadAudioAssetPool: vi.fn(),
}));

vi.mock("./mutateAudioWorkbench", () => ({
  saveAudioWorkbench: vi.fn(),
}));

const useAssetProvenanceStateMock = vi.mocked(useAssetProvenanceState);
const loadAudioWorkbenchMock = vi.mocked(loadAudioWorkbench);
const loadAudioAssetPoolMock = vi.mocked(loadAudioAssetPool);
const saveAudioWorkbenchMock = vi.mocked(saveAudioWorkbench);

function buildAudioWorkbench() {
  return {
    timeline: {
      audioTimelineId: "timeline-project-1",
      projectId: "project-1",
      episodeId: "",
      status: "draft",
      renderWorkflowRunId: "workflow-audio-1",
      renderStatus: "queued",
      createdAt: "2026-03-24T08:00:00.000Z",
      updatedAt: "2026-03-24T08:05:00.000Z",
    },
    tracks: [],
    summary: {
      trackCount: 0,
      clipCount: 0,
      missingDurationClipCount: 0,
    },
  };
}

describe("useAudioWorkbenchController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    useAssetProvenanceStateMock.mockReturnValue({
      selectedAssetId: null,
      assetProvenanceDetail: null,
      assetProvenanceStatus: "idle",
      assetProvenancePending: false,
      assetProvenanceErrorMessage: "",
      handleOpenAssetProvenance: vi.fn(),
      handleCloseAssetProvenance: vi.fn(),
      resetAssetProvenance: vi.fn(),
    } as never);
    loadAudioWorkbenchMock.mockResolvedValue(buildAudioWorkbench());
    loadAudioAssetPoolMock.mockResolvedValue([
      {
        assetId: "asset-audio-1",
        importBatchId: "batch-1",
        durationMs: 12000,
        sourceRunId: "run-audio-1",
        fileName: "dialogue.wav",
        mediaType: "audio",
        sourceType: "upload_session",
        rightsStatus: "clear",
        locale: "zh-CN",
        variantId: "variant-audio-1",
        variantType: "master",
        mimeType: "audio/wav",
      },
    ]);
    saveAudioWorkbenchMock.mockResolvedValue({
      timeline: {
        audioTimelineId: "timeline-project-1",
        projectId: "project-1",
        episodeId: "",
        status: "draft",
        renderWorkflowRunId: "workflow-audio-1",
        renderStatus: "queued",
        createdAt: "2026-03-24T08:00:00.000Z",
        updatedAt: "2026-03-24T08:06:00.000Z",
      },
      tracks: [
        {
          trackId: "track-dialogue",
          timelineId: "timeline-project-1",
          trackType: "dialogue",
          displayName: "对白",
          sequence: 1,
          muted: false,
          solo: false,
          volumePercent: 0,
          clips: [
            {
              clipId: "clip-1",
              trackId: "track-dialogue",
              assetId: "asset-audio-1",
              sourceRunId: "run-audio-1",
              sequence: 1,
              startMs: 200,
              durationMs: 12000,
              trimInMs: 0,
              trimOutMs: 240,
            },
          ],
        },
      ],
      summary: {
        trackCount: 1,
        clipCount: 1,
        missingDurationClipCount: 0,
      },
    });
  });

  it("loads audio workbench and seeds the default draft tracks when the timeline is empty", async () => {
    const { result, rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useAudioWorkbenchController({
          ...props,
          projectId: "project-1",
          t,
          orgId: "org-1",
          userId: "user-1",
        }),
      {
        initialProps: { enabled: false },
      },
    );

    expect(loadAudioWorkbenchMock).not.toHaveBeenCalled();
    expect(loadAudioAssetPoolMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.audioWorkbench?.timeline.audioTimelineId).toBe("timeline-project-1");
    });

    expect(result.current.draftTracks.map((track) => track.trackType)).toEqual([
      "dialogue",
      "voiceover",
      "bgm",
    ]);
    expect(result.current.audioAssetPool).toHaveLength(1);
  });

  it("adds clips from the filtered audio pool, preserves volumePercent=0, and saves the timeline", async () => {
    const { result } = renderHook(() =>
      useAudioWorkbenchController({
        enabled: true,
        projectId: "project-1",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.draftTracks).toHaveLength(3);
    });

    const dialogueTrackId = result.current.draftTracks[0]!.trackId;

    act(() => {
      result.current.handleAddClip(dialogueTrackId, "asset-audio-1");
    });

    const clipId = result.current.draftTracks[0]!.clips[0]!.clipId;

    act(() => {
      result.current.handleTrackVolumeChange(dialogueTrackId, 0);
      result.current.handleClipFieldChange(dialogueTrackId, clipId, "startMs", 200);
      result.current.handleClipFieldChange(dialogueTrackId, clipId, "trimOutMs", 240);
    });

    await act(async () => {
      await result.current.handleSaveTimeline();
    });

    expect(saveAudioWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
      status: "draft",
      renderWorkflowRunId: "workflow-audio-1",
      renderStatus: "queued",
      orgId: "org-1",
      userId: "user-1",
      tracks: expect.arrayContaining([
        expect.objectContaining({
          trackType: "dialogue",
          volumePercent: 0,
          clips: [
            expect.objectContaining({
              assetId: "asset-audio-1",
              sourceRunId: "run-audio-1",
              startMs: 200,
              durationMs: 12000,
              trimOutMs: 240,
              sequence: 1,
            }),
          ],
        }),
      ]),
    });
    expect(result.current.audioWorkbench?.tracks[0]?.volumePercent).toBe(0);
    expect(result.current.audioWorkbench?.tracks[0]?.clips[0]?.assetId).toBe("asset-audio-1");
  });

  it("keeps the audio workbench editable when the asset pool load fails", async () => {
    loadAudioWorkbenchMock.mockResolvedValueOnce({
      ...buildAudioWorkbench(),
      tracks: [
        {
          trackId: "track-dialogue",
          timelineId: "timeline-project-1",
          trackType: "dialogue",
          displayName: "对白",
          sequence: 1,
          muted: false,
          solo: false,
          volumePercent: 100,
          clips: [],
        },
      ],
      summary: {
        trackCount: 1,
        clipCount: 0,
        missingDurationClipCount: 0,
      },
    });
    loadAudioAssetPoolMock.mockRejectedValueOnce(new Error("creator: asset pool temporarily unavailable"));

    const { result } = renderHook(() =>
      useAudioWorkbenchController({
        enabled: true,
        projectId: "project-1",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.audioWorkbench?.timeline.audioTimelineId).toBe("timeline-project-1");
    });

    expect(result.current.errorMessage).toBe("");
    expect(result.current.audioAssetPool).toEqual([]);
    expect(result.current.draftTracks.map((track) => track.trackType)).toEqual([
      "dialogue",
      "voiceover",
      "bgm",
    ]);
  });
});
