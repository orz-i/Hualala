import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { loadAdminAudioRuntime } from "./loadAdminAudioRuntime";
import { loadAdminAudioWorkbench } from "./loadAdminAudioWorkbench";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { subscribeAdminAudioRuntime } from "./subscribeAdminAudioRuntime";
import { useAdminAudioController } from "./useAdminAudioController";

vi.mock("./loadAdminAudioWorkbench", () => ({
  loadAdminAudioWorkbench: vi.fn(),
}));

vi.mock("./loadAdminAudioRuntime", () => ({
  loadAdminAudioRuntime: vi.fn(),
}));

vi.mock("./loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

vi.mock("./subscribeAdminAudioRuntime", () => ({
  subscribeAdminAudioRuntime: vi.fn(),
}));

const loadAdminAudioWorkbenchMock = vi.mocked(loadAdminAudioWorkbench);
const loadAdminAudioRuntimeMock = vi.mocked(loadAdminAudioRuntime);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);
const subscribeAdminAudioRuntimeMock = vi.mocked(subscribeAdminAudioRuntime);

describe("useAdminAudioController", () => {
  const t = createTranslator("zh-CN");

  function buildAudioWorkbench(
    timelineOverrides: Partial<{
      audioTimelineId: string;
      projectId: string;
      episodeId: string;
      status: string;
      renderWorkflowRunId: string;
      renderStatus: string;
      createdAt: string;
      updatedAt: string;
    }> = {},
  ) {
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
        ...timelineOverrides,
      },
      tracks: [
        {
          trackId: "track-dialogue",
          timelineId: timelineOverrides.audioTimelineId ?? "timeline-project-1",
          trackType: "dialogue",
          displayName: "对白",
          sequence: 1,
          muted: false,
          solo: false,
          volumePercent: 100,
          clips: [
            {
              clipId: "clip-1",
              trackId: "track-dialogue",
              assetId: "asset-audio-1",
              sourceRunId: "run-audio-1",
              sequence: 1,
              startMs: 0,
              durationMs: 12000,
              trimInMs: 0,
              trimOutMs: 0,
            },
          ],
        },
      ],
      summary: {
        trackCount: 1,
        clipCount: 1,
        missingAssetCount: 0,
        invalidTimingClipCount: 0,
        tracksByType: [{ trackType: "dialogue", count: 1 }],
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

  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminAudioWorkbenchMock.mockResolvedValue(buildAudioWorkbench());
    loadAdminAudioRuntimeMock.mockResolvedValue(buildAudioRuntime());
    loadAssetProvenanceDetailsMock.mockResolvedValue({
      asset: {
        id: "asset-audio-1",
        projectId: "project-1",
        sourceType: "upload_session",
        rightsStatus: "clear",
        consentStatus: "granted",
        importBatchId: "batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
      provenanceSummary: "source_type=upload_session rights_status=clear consent_status=granted",
      candidateAssetId: "candidate-1",
      shotExecutionId: "shot-exec-1",
      sourceRunId: "run-audio-1",
      importBatchId: "batch-1",
      variantCount: 1,
    });
    subscribeAdminAudioRuntimeMock.mockReturnValue(vi.fn());
  });

  it("loads audio workbench only when enabled and the session is ready", async () => {
    const { result, rerender } = renderHook(
      (props: { sessionState: "loading" | "ready"; enabled: boolean }) =>
        useAdminAudioController({
          ...props,
          projectId: "project-1",
          effectiveOrgId: "org-1",
          effectiveUserId: "user-1",
          t,
        }),
      {
        initialProps: {
          sessionState: "loading",
          enabled: false,
        },
      },
    );

    expect(loadAdminAudioWorkbenchMock).not.toHaveBeenCalled();
    expect(result.current.audioWorkbench).toBeNull();

    rerender({
      sessionState: "ready",
      enabled: true,
    });

    await waitFor(() => {
      expect(result.current.audioWorkbench?.summary.trackCount).toBe(1);
    });
    expect(result.current.audioRuntime?.audioRuntimeId).toBe("audio-runtime-project-1");
  });

  it("opens asset provenance details for audio clips", async () => {
    const { result } = renderHook(() =>
      useAdminAudioController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.audioWorkbench?.summary.clipCount).toBe(1);
    });

    await act(async () => {
      await result.current.handleOpenAssetProvenance("asset-audio-1");
    });

    expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
      assetId: "asset-audio-1",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.assetProvenanceDetail?.asset.id).toBe("asset-audio-1");
  });

  it("keeps the audio workbench visible when the runtime load fails", async () => {
    loadAdminAudioRuntimeMock.mockRejectedValueOnce(new Error("admin: audio runtime unavailable"));

    const { result } = renderHook(() =>
      useAdminAudioController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.audioWorkbench?.summary.trackCount).toBe(1);
    });
    await waitFor(() => {
      expect(result.current.runtimeErrorMessage).toBe("admin: audio runtime unavailable");
    });

    expect(result.current.audioWorkbench?.tracks[0]?.trackId).toBe("track-dialogue");
  });

  it("waits for the episode-scoped workbench before loading and subscribing to the audio runtime", async () => {
    let resolveWorkbench:
      | ((value: ReturnType<typeof buildAudioWorkbench>) => void)
      | undefined;
    loadAdminAudioWorkbenchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWorkbench = resolve;
        }),
    );
    loadAdminAudioRuntimeMock.mockResolvedValueOnce(
      buildAudioRuntime({
        audioRuntimeId: "audio-runtime-episode-1",
        episodeId: "episode-1",
        audioTimelineId: "timeline-episode-1",
      }),
    );

    const { result } = renderHook(() =>
      useAdminAudioController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    expect(loadAdminAudioRuntimeMock).not.toHaveBeenCalled();
    expect(subscribeAdminAudioRuntimeMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveWorkbench?.(
        buildAudioWorkbench({
          audioTimelineId: "timeline-episode-1",
          episodeId: "episode-1",
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.audioWorkbench?.timeline.episodeId).toBe("episode-1");
    });
    await waitFor(() => {
      expect(loadAdminAudioRuntimeMock).toHaveBeenCalledWith({
        projectId: "project-1",
        episodeId: "episode-1",
        orgId: "org-1",
        userId: "user-1",
      });
    });

    expect(loadAdminAudioRuntimeMock).toHaveBeenCalledTimes(1);
    expect(subscribeAdminAudioRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        projectId: "project-1",
        episodeId: "episode-1",
        orgId: "org-1",
        userId: "user-1",
      }),
    );
    expect(subscribeAdminAudioRuntimeMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes audio runtime on sse invalidation without clearing the audio workbench", async () => {
    let onRefreshNeeded: (() => void) | undefined;
    subscribeAdminAudioRuntimeMock.mockImplementation((options) => {
      onRefreshNeeded = options.onRefreshNeeded;
      return vi.fn();
    });
    loadAdminAudioRuntimeMock
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
      useAdminAudioController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.audioRuntime?.renderStatus).toBe("idle");
    });

    await act(async () => {
      onRefreshNeeded?.();
    });

    await waitFor(() => {
      expect(result.current.audioRuntime?.renderStatus).toBe("completed");
    });
    expect(result.current.audioWorkbench?.summary.trackCount).toBe(1);
  });
});
