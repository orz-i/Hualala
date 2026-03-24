import { act, renderHook, waitFor } from "@testing-library/react";
import { loadAudioWorkbench } from "../audio/loadAudioWorkbench";
import { createTranslator } from "../../i18n";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { loadPreviewWorkbench } from "./loadPreviewWorkbench";
import { savePreviewWorkbench } from "./mutatePreviewWorkbench";
import { usePreviewWorkbenchController } from "./usePreviewWorkbenchController";

vi.mock("../shared/useAssetProvenanceState", () => ({
  useAssetProvenanceState: vi.fn(),
}));

vi.mock("./loadPreviewWorkbench", () => ({
  loadPreviewWorkbench: vi.fn(),
}));

vi.mock("../audio/loadAudioWorkbench", () => ({
  loadAudioWorkbench: vi.fn(),
}));

vi.mock("./mutatePreviewWorkbench", () => ({
  savePreviewWorkbench: vi.fn(),
}));

const useAssetProvenanceStateMock = vi.mocked(useAssetProvenanceState);
const loadPreviewWorkbenchMock = vi.mocked(loadPreviewWorkbench);
const loadAudioWorkbenchMock = vi.mocked(loadAudioWorkbench);
const savePreviewWorkbenchMock = vi.mocked(savePreviewWorkbench);

function buildPreviewWorkbench() {
  return {
    assembly: {
      assemblyId: "assembly-project-1",
      projectId: "project-1",
      episodeId: "",
      status: "draft",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:05:00.000Z",
    },
    items: [
      {
        itemId: "item-1",
        assemblyId: "assembly-project-1",
        shotId: "shot-1",
        primaryAssetId: "",
        sourceRunId: "",
        sequence: 1,
      },
    ],
  };
}

describe("usePreviewWorkbenchController", () => {
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
    loadPreviewWorkbenchMock.mockResolvedValue(buildPreviewWorkbench());
    loadAudioWorkbenchMock.mockResolvedValue({
      timeline: {
        audioTimelineId: "timeline-project-1",
        projectId: "project-1",
        episodeId: "",
        status: "draft",
        renderWorkflowRunId: "workflow-audio-1",
        renderStatus: "queued",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:05:00.000Z",
      },
      tracks: [],
      summary: {
        trackCount: 0,
        clipCount: 0,
        missingDurationClipCount: 0,
      },
    });
    savePreviewWorkbenchMock.mockResolvedValue({
      assembly: {
        assemblyId: "assembly-project-1",
        projectId: "project-1",
        episodeId: "",
        status: "draft",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:06:00.000Z",
      },
      items: [
        {
          itemId: "item-2",
          assemblyId: "assembly-project-1",
          shotId: "shot-2",
          primaryAssetId: "asset-2",
          sourceRunId: "run-2",
          sequence: 1,
        },
        {
          itemId: "item-1",
          assemblyId: "assembly-project-1",
          shotId: "shot-1",
          primaryAssetId: "",
          sourceRunId: "",
          sequence: 2,
        },
      ],
    });
  });

  it("loads preview state only when enabled", async () => {
    const { result, rerender } = renderHook(
      (props: { enabled: boolean }) =>
        usePreviewWorkbenchController({
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

    expect(loadPreviewWorkbenchMock).not.toHaveBeenCalled();
    expect(result.current.previewWorkbench).toBeNull();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.assembly.assemblyId).toBe("assembly-project-1");
    });

    expect(loadPreviewWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.audioSummary).toEqual({
      trackCount: 0,
      clipCount: 0,
      renderStatus: "queued",
      missingAssetCount: 0,
    });
  });

  it("adds, reorders, and saves preview items as an ordered assembly", async () => {
    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items).toHaveLength(1);
    });

    act(() => {
      result.current.setNewShotIdInput("shot-2");
      result.current.setNewPrimaryAssetIdInput("asset-2");
      result.current.setNewSourceRunIdInput("run-2");
    });

    act(() => {
      result.current.handleAddItem();
    });

    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-1", "shot-2"]);

    act(() => {
      result.current.handleMoveItem("draft-1", "up");
    });

    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-2", "shot-1"]);

    await act(async () => {
      await result.current.handleSaveAssembly();
    });

    expect(savePreviewWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
      status: "draft",
      orgId: "org-1",
      userId: "user-1",
      items: [
        expect.objectContaining({
          shotId: "shot-2",
          primaryAssetId: "asset-2",
          sourceRunId: "run-2",
          sequence: 1,
        }),
        expect.objectContaining({
          shotId: "shot-1",
          sequence: 2,
        }),
      ],
    });
    expect(result.current.previewWorkbench?.items.map((item) => item.shotId)).toEqual([
      "shot-2",
      "shot-1",
    ]);
  });
});
