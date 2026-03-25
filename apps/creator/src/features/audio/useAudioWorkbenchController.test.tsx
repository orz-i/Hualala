import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { loadAudioAssetPool } from "./loadAudioAssetPool";
import { loadAudioRuntime } from "./loadAudioRuntime";
import { loadAudioWorkbench } from "./loadAudioWorkbench";
import { saveAudioWorkbench } from "./mutateAudioWorkbench";
import { requestAudioRender } from "./requestAudioRender";
import { subscribeAudioRuntime } from "./subscribeAudioRuntime";
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

vi.mock("./loadAudioRuntime", () => ({
  loadAudioRuntime: vi.fn(),
}));

vi.mock("./mutateAudioWorkbench", () => ({
  saveAudioWorkbench: vi.fn(),
}));

vi.mock("./requestAudioRender", () => ({
  requestAudioRender: vi.fn(),
}));

vi.mock("./subscribeAudioRuntime", () => ({
  subscribeAudioRuntime: vi.fn(),
}));

const useAssetProvenanceStateMock = vi.mocked(useAssetProvenanceState);
const loadAudioWorkbenchMock = vi.mocked(loadAudioWorkbench);
const loadAudioAssetPoolMock = vi.mocked(loadAudioAssetPool);
const loadAudioRuntimeMock = vi.mocked(loadAudioRuntime);
const saveAudioWorkbenchMock = vi.mocked(saveAudioWorkbench);
const requestAudioRenderMock = vi.mocked(requestAudioRender);
const subscribeAudioRuntimeMock = vi.mocked(subscribeAudioRuntime);

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

function buildAudioRuntime(overrides: Record<string, unknown> = {}) {
  return {
    audioRuntimeId: "audio-runtime-project-1",
    projectId: "project-1",
    episodeId: "",
    audioTimelineId: "timeline-project-1",
    status: "idle",
    renderWorkflowRunId: "",
    renderStatus: "idle",
    mixAssetId: "",
    createdAt: "2026-03-25T09:00:00.000Z",
    updatedAt: "2026-03-25T09:05:00.000Z",
    mixOutput: null,
    waveforms: [],
    lastErrorCode: "",
    lastErrorMessage: "",
    ...overrides,
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
    loadAudioRuntimeMock.mockResolvedValue(buildAudioRuntime());
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
    requestAudioRenderMock.mockResolvedValue(
      buildAudioRuntime({
        status: "queued",
        renderWorkflowRunId: "workflow-audio-1",
        renderStatus: "queued",
      }),
    );
    subscribeAudioRuntimeMock.mockReturnValue(vi.fn());
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
    expect(result.current.audioRuntime?.audioRuntimeId).toBe("audio-runtime-project-1");
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

  it("surfaces audio runtime errors without clearing the editable draft tracks", async () => {
    loadAudioRuntimeMock.mockRejectedValueOnce(new Error("creator: audio runtime unavailable"));

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
    await waitFor(() => {
      expect(result.current.runtimeErrorMessage).toBe("creator: audio runtime unavailable");
    });

    expect(result.current.errorMessage).toBe("");
    expect(result.current.draftTracks.map((track) => track.trackType)).toEqual([
      "dialogue",
      "voiceover",
      "bgm",
    ]);
  });

  it("requests audio render and keeps draft clips during runtime sse refreshes", async () => {
    let onRefreshNeeded: (() => void) | undefined;
    subscribeAudioRuntimeMock.mockImplementation((options) => {
      onRefreshNeeded = options.onRefreshNeeded;
      return vi.fn();
    });
    loadAudioRuntimeMock
      .mockResolvedValueOnce(buildAudioRuntime())
      .mockResolvedValueOnce(
        buildAudioRuntime({
          status: "ready",
          renderWorkflowRunId: "workflow-audio-1",
          renderStatus: "completed",
          mixAssetId: "asset-mix-1",
          mixOutput: {
            deliveryMode: "file",
            playbackUrl: "https://cdn.example.com/audio/project-1/mix.mp3",
            downloadUrl: "https://cdn.example.com/audio/project-1/mix-download.mp3",
            mimeType: "audio/mpeg",
            fileName: "mix-project-1.mp3",
            sizeBytes: 4096,
            durationMs: 18000,
          },
          waveforms: [
            {
              assetId: "asset-audio-1",
              variantId: "variant-audio-1",
              waveformUrl: "https://cdn.example.com/audio/project-1/waveform-1.json",
              mimeType: "application/json",
              durationMs: 12000,
            },
          ],
        }),
      );

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

    act(() => {
      result.current.handleAddClip(result.current.draftTracks[0]!.trackId, "asset-audio-1");
    });

    expect(result.current.requestRenderDisabledReason).toBe("");

    await act(async () => {
      await result.current.handleRequestAudioRender();
    });

    expect(requestAudioRenderMock).toHaveBeenCalledWith({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.audioRuntime?.renderStatus).toBe("queued");
    expect(result.current.draftTracks[0]?.clips).toHaveLength(1);

    await act(async () => {
      onRefreshNeeded?.();
    });

    await waitFor(() => {
      expect(result.current.audioRuntime?.renderStatus).toBe("completed");
    });
    expect(result.current.draftTracks[0]?.clips).toHaveLength(1);
  });
});
