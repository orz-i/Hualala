import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { loadAdminAudioWorkbench } from "./loadAdminAudioWorkbench";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { useAdminAudioController } from "./useAdminAudioController";

vi.mock("./loadAdminAudioWorkbench", () => ({
  loadAdminAudioWorkbench: vi.fn(),
}));

vi.mock("./loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

const loadAdminAudioWorkbenchMock = vi.mocked(loadAdminAudioWorkbench);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);

describe("useAdminAudioController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminAudioWorkbenchMock.mockResolvedValue({
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
    });
    loadAssetProvenanceDetailsMock.mockResolvedValue({
      asset: {
        id: "asset-audio-1",
        projectId: "project-1",
        sourceType: "upload_session",
        rightsStatus: "clear",
        importBatchId: "batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
      provenanceSummary: "source_type=upload_session rights_status=clear",
      candidateAssetId: "candidate-1",
      shotExecutionId: "shot-exec-1",
      sourceRunId: "run-audio-1",
      importBatchId: "batch-1",
      variantCount: 1,
    });
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
});
