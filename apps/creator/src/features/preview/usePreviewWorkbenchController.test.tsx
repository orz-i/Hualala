import { act, renderHook, waitFor } from "@testing-library/react";
import { loadAudioWorkbench } from "../audio/loadAudioWorkbench";
import { createTranslator } from "../../i18n";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { loadPreviewRuntime } from "./loadPreviewRuntime";
import { loadPreviewWorkbench } from "./loadPreviewWorkbench";
import { loadPreviewShotOptions } from "./loadPreviewShotOptions";
import { savePreviewWorkbench } from "./mutatePreviewWorkbench";
import { requestPreviewRender } from "./requestPreviewRender";
import { subscribePreviewRuntime } from "./subscribePreviewRuntime";
import { usePreviewWorkbenchController } from "./usePreviewWorkbenchController";

vi.mock("../shared/useAssetProvenanceState", () => ({
  useAssetProvenanceState: vi.fn(),
}));

vi.mock("./loadPreviewWorkbench", () => ({
  loadPreviewWorkbench: vi.fn(),
}));

vi.mock("./loadPreviewShotOptions", () => ({
  loadPreviewShotOptions: vi.fn(),
}));

vi.mock("./loadPreviewRuntime", () => ({
  loadPreviewRuntime: vi.fn(),
}));

vi.mock("../audio/loadAudioWorkbench", () => ({
  loadAudioWorkbench: vi.fn(),
}));

vi.mock("./mutatePreviewWorkbench", () => ({
  savePreviewWorkbench: vi.fn(),
}));

vi.mock("./requestPreviewRender", () => ({
  requestPreviewRender: vi.fn(),
}));

vi.mock("./subscribePreviewRuntime", () => ({
  subscribePreviewRuntime: vi.fn(),
}));

const useAssetProvenanceStateMock = vi.mocked(useAssetProvenanceState);
const loadPreviewWorkbenchMock = vi.mocked(loadPreviewWorkbench);
const loadPreviewShotOptionsMock = vi.mocked(loadPreviewShotOptions);
const loadPreviewRuntimeMock = vi.mocked(loadPreviewRuntime);
const loadAudioWorkbenchMock = vi.mocked(loadAudioWorkbench);
const savePreviewWorkbenchMock = vi.mocked(savePreviewWorkbench);
const requestPreviewRenderMock = vi.mocked(requestPreviewRender);
const subscribePreviewRuntimeMock = vi.mocked(subscribePreviewRuntime);

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
        shotSummary: {
          projectId: "project-1",
          projectTitle: "项目一",
          episodeId: "episode-1",
          episodeTitle: "第一集",
          sceneId: "scene-1",
          sceneCode: "SCENE-001",
          sceneTitle: "开场",
          shotId: "shot-1",
          shotCode: "SHOT-001",
          shotTitle: "第一镜",
        },
        primaryAssetSummary: null,
        sourceRunSummary: null,
      },
    ],
  };
}

function buildShotSummary(shotId: string, shotCode: string, shotTitle: string) {
  return {
    projectId: "project-1",
    projectTitle: "项目一",
    episodeId: "episode-1",
    episodeTitle: "第一集",
    sceneId: "scene-1",
    sceneCode: "SCENE-001",
    sceneTitle: "开场",
    shotId,
    shotCode,
    shotTitle,
  };
}

function buildPreviewRuntime(overrides: Record<string, unknown> = {}) {
  return {
    previewRuntimeId: "runtime-project-1",
    projectId: "project-1",
    episodeId: "",
    assemblyId: "assembly-project-1",
    status: "idle",
    renderWorkflowRunId: "",
    renderStatus: "idle",
    playbackAssetId: "",
    exportAssetId: "",
    resolvedLocale: "",
    createdAt: "2026-03-24T09:00:00.000Z",
    updatedAt: "2026-03-24T09:05:00.000Z",
    playback: null,
    exportOutput: null,
    lastErrorCode: "",
    lastErrorMessage: "",
    ...overrides,
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
    loadPreviewShotOptionsMock.mockResolvedValue([
      {
        shotId: "shot-2",
        label: "SCENE-001 / SHOT-002",
        shotExecutionId: "shot-exec-2",
        shotExecutionStatus: "ready",
        shotSummary: {
          projectId: "project-1",
          projectTitle: "项目一",
          episodeId: "episode-1",
          episodeTitle: "第一集",
          sceneId: "scene-1",
          sceneCode: "SCENE-001",
          sceneTitle: "开场",
          shotId: "shot-2",
          shotCode: "SHOT-002",
          shotTitle: "第二镜",
        },
        currentPrimaryAssetSummary: {
          assetId: "asset-2",
          mediaType: "image",
          rightsStatus: "cleared",
          aiAnnotated: true,
        },
        latestRunSummary: {
          runId: "run-2",
          status: "completed",
          triggerType: "manual",
        },
      },
    ]);
    loadPreviewRuntimeMock.mockResolvedValue(buildPreviewRuntime());
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
          shotSummary: buildShotSummary("shot-2", "SHOT-002", "第二镜"),
          primaryAssetSummary: {
            assetId: "asset-2",
            mediaType: "image",
            rightsStatus: "cleared",
            aiAnnotated: true,
          },
          sourceRunSummary: {
            runId: "run-2",
            status: "completed",
            triggerType: "manual",
          },
        },
        {
          itemId: "item-1",
          assemblyId: "assembly-project-1",
          shotId: "shot-1",
          primaryAssetId: "",
          sourceRunId: "",
          sequence: 2,
          shotSummary: buildShotSummary("shot-1", "SHOT-001", "第一镜"),
          primaryAssetSummary: null,
          sourceRunSummary: null,
        },
      ],
    });
    requestPreviewRenderMock.mockResolvedValue(
      buildPreviewRuntime({
        status: "queued",
        renderWorkflowRunId: "workflow-preview-1",
        renderStatus: "queued",
        resolvedLocale: "zh-CN",
      }),
    );
    subscribePreviewRuntimeMock.mockReturnValue(vi.fn());
  });

  it("loads preview state only when enabled", async () => {
    const { result, rerender } = renderHook(
      (props: { enabled: boolean; locale: "zh-CN" | "en-US" }) =>
        usePreviewWorkbenchController({
          ...props,
          projectId: "project-1",
          t,
          orgId: "org-1",
          userId: "user-1",
        }),
      {
        initialProps: { enabled: false, locale: "zh-CN" },
      },
    );

    expect(loadPreviewWorkbenchMock).not.toHaveBeenCalled();
    expect(result.current.previewWorkbench).toBeNull();

    rerender({ enabled: true, locale: "zh-CN" });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.assembly.assemblyId).toBe("assembly-project-1");
    });

    expect(loadPreviewWorkbenchMock).toHaveBeenCalledWith({
      projectId: "project-1",
      displayLocale: "zh-CN",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(loadPreviewShotOptionsMock).toHaveBeenCalledWith({
      projectId: "project-1",
      displayLocale: "zh-CN",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.audioSummary).toEqual({
      trackCount: 0,
      clipCount: 0,
      renderStatus: "queued",
      missingAssetCount: 0,
    });
    expect(result.current.previewRuntime).toEqual(
      expect.objectContaining({
        previewRuntimeId: "runtime-project-1",
        renderStatus: "idle",
      }),
    );
    expect(result.current.shotOptions).toEqual([
      expect.objectContaining({
        shotId: "shot-2",
        label: "SCENE-001 / SHOT-002",
      }),
    ]);
    expect(result.current.selectedShotOptionId).toBe("shot-2");
  });

  it("requests preview render with the current locale and updates runtime state", async () => {
    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        locale: "zh-CN",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("idle");
    });

    await act(async () => {
      await result.current.handleRequestPreviewRender();
    });

    expect(requestPreviewRenderMock).toHaveBeenCalledWith({
      projectId: "project-1",
      requestedLocale: "zh-CN",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.previewRuntime).toEqual(
      expect.objectContaining({
        renderStatus: "queued",
        renderWorkflowRunId: "workflow-preview-1",
        resolvedLocale: "zh-CN",
        playback: null,
        exportOutput: null,
      }),
    );
  });

  it("clears stale playback, export output, and previous runtime errors when a new render request is queued", async () => {
    loadPreviewRuntimeMock.mockResolvedValueOnce(
      buildPreviewRuntime({
        status: "ready",
        renderWorkflowRunId: "workflow-preview-old",
        renderStatus: "completed",
        playbackAssetId: "asset-playback-old",
        exportAssetId: "asset-export-old",
        resolvedLocale: "en-US",
        playback: {
          deliveryMode: "file",
          playbackUrl: "https://cdn.example.com/preview-runtime-old.mp4",
          posterUrl: "https://cdn.example.com/preview-runtime-old.jpg",
          durationMs: 28000,
        },
        exportOutput: {
          downloadUrl: "https://cdn.example.com/preview-export-old.mp4",
          mimeType: "video/mp4",
          fileName: "preview-export-old.mp4",
          sizeBytes: 2048,
        },
        lastErrorCode: "preview_runtime_stale",
        lastErrorMessage: "stale output",
      }),
    );
    requestPreviewRenderMock.mockResolvedValueOnce(
      buildPreviewRuntime({
        status: "queued",
        renderWorkflowRunId: "workflow-preview-2",
        renderStatus: "queued",
        resolvedLocale: "zh-CN",
        playbackAssetId: "",
        exportAssetId: "",
        playback: null,
        exportOutput: null,
        lastErrorCode: "",
        lastErrorMessage: "",
      }),
    );

    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        locale: "zh-CN",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("completed");
    });

    await act(async () => {
      await result.current.handleRequestPreviewRender();
    });

    expect(result.current.previewRuntime).toEqual(
      expect.objectContaining({
        renderStatus: "queued",
        renderWorkflowRunId: "workflow-preview-2",
        playbackAssetId: "",
        exportAssetId: "",
        playback: null,
        exportOutput: null,
        lastErrorCode: "",
        lastErrorMessage: "",
      }),
    );
  });

  it("adds items from the chooser, reorders them, and saves only the stable write shape", async () => {
    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        locale: "zh-CN",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items).toHaveLength(1);
    });

    act(() => {
      result.current.setSelectedShotOptionId("shot-2");
    });

    act(() => {
      result.current.handleAddItemFromChooser();
    });

    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-1", "shot-2"]);
    expect(result.current.draftItems[1]).toEqual(
      expect.objectContaining({
        primaryAssetId: "asset-2",
        sourceRunId: "run-2",
      }),
    );

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

  it("keeps the existing assembly visible when chooser loading fails", async () => {
    loadPreviewShotOptionsMock.mockRejectedValue(new Error("chooser exploded"));

    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        locale: "zh-CN",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.assembly.assemblyId).toBe("assembly-project-1");
    });

    expect(result.current.shotOptions).toEqual([]);
    expect(result.current.shotOptionsErrorMessage).toBe("chooser exploded");
    expect(result.current.errorMessage).toBe("");
  });

  it("keeps unsaved draft state when locale refresh fails to reload the preview workbench", async () => {
    loadPreviewWorkbenchMock
      .mockResolvedValueOnce(buildPreviewWorkbench())
      .mockRejectedValueOnce(new Error("preview locale exploded"));

    const { result, rerender } = renderHook(
      (props: { locale: "zh-CN" | "en-US" }) =>
        usePreviewWorkbenchController({
          enabled: true,
          projectId: "project-1",
          locale: props.locale,
          t,
          orgId: "org-1",
          userId: "user-1",
        }),
      {
        initialProps: { locale: "zh-CN" },
      },
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.assembly.assemblyId).toBe("assembly-project-1");
    });

    act(() => {
      result.current.handleAddItemFromChooser();
      result.current.handleMoveItem("draft-1", "up");
      result.current.setManualShotIdInput("shot-manual-9");
    });

    rerender({ locale: "en-US" });

    await waitFor(() => {
      expect(loadPreviewWorkbenchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.previewWorkbench?.assembly.assemblyId).toBe("assembly-project-1");
    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-2", "shot-1"]);
    expect(result.current.manualShotIdInput).toBe("shot-manual-9");
    expect(result.current.audioSummary).toEqual({
      trackCount: 0,
      clipCount: 0,
      renderStatus: "queued",
      missingAssetCount: 0,
    });
    expect(result.current.errorMessage).toBe("");
  });

  it("keeps the current chooser selection when locale refresh cannot reload chooser options", async () => {
    const englishWorkbench = {
      ...buildPreviewWorkbench(),
      items: [
        {
          ...buildPreviewWorkbench().items[0],
          shotSummary: {
            ...buildPreviewWorkbench().items[0].shotSummary,
            sceneTitle: "Opening",
            shotTitle: "First Shot",
          },
        },
      ],
    };

    loadPreviewWorkbenchMock
      .mockResolvedValueOnce(buildPreviewWorkbench())
      .mockResolvedValueOnce(englishWorkbench);
    loadPreviewShotOptionsMock
      .mockResolvedValueOnce([
        {
          shotId: "shot-2",
          label: "SCENE-001 / SHOT-002",
          shotExecutionId: "shot-exec-2",
          shotExecutionStatus: "ready",
          shotSummary: {
            projectId: "project-1",
            projectTitle: "项目一",
            episodeId: "episode-1",
            episodeTitle: "第一集",
            sceneId: "scene-1",
            sceneCode: "SCENE-001",
            sceneTitle: "开场",
            shotId: "shot-2",
            shotCode: "SHOT-002",
            shotTitle: "第二镜",
          },
          currentPrimaryAssetSummary: {
            assetId: "asset-2",
            mediaType: "image",
            rightsStatus: "cleared",
            aiAnnotated: true,
          },
          latestRunSummary: {
            runId: "run-2",
            status: "completed",
            triggerType: "manual",
          },
        },
      ])
      .mockRejectedValueOnce(new Error("chooser exploded"));

    const { result, rerender } = renderHook(
      (props: { locale: "zh-CN" | "en-US" }) =>
        usePreviewWorkbenchController({
          enabled: true,
          projectId: "project-1",
          locale: props.locale,
          t,
          orgId: "org-1",
          userId: "user-1",
        }),
      {
        initialProps: { locale: "zh-CN" },
      },
    );

    await waitFor(() => {
      expect(result.current.selectedShotOptionId).toBe("shot-2");
    });

    rerender({ locale: "en-US" });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items[0]?.shotSummary?.shotTitle).toBe("First Shot");
    });

    expect(result.current.selectedShotOptionId).toBe("shot-2");
    expect(result.current.shotOptions).toHaveLength(1);
    expect(result.current.shotOptions[0]?.shotSummary.shotTitle).toBe("第二镜");
    expect(result.current.shotOptionsErrorMessage).toBe("chooser exploded");
  });

  it("rehydrates locale-sensitive metadata without losing unsaved draft state", async () => {
    const englishWorkbench = {
      ...buildPreviewWorkbench(),
      items: [
        {
          ...buildPreviewWorkbench().items[0],
          shotSummary: {
            ...buildPreviewWorkbench().items[0].shotSummary,
            sceneTitle: "Opening",
            shotTitle: "First Shot",
          },
        },
      ],
    };
    const englishShotOptions = [
      {
        shotId: "shot-2",
        label: "SCENE-001 / SHOT-002",
        shotExecutionId: "shot-exec-2",
        shotExecutionStatus: "ready",
        shotSummary: {
          projectId: "project-1",
          projectTitle: "项目一",
          episodeId: "episode-1",
          episodeTitle: "第一集",
          sceneId: "scene-1",
          sceneCode: "SCENE-001",
          sceneTitle: "Opening",
          shotId: "shot-2",
          shotCode: "SHOT-002",
          shotTitle: "Second Shot",
        },
        currentPrimaryAssetSummary: {
          assetId: "asset-2",
          mediaType: "image",
          rightsStatus: "cleared",
          aiAnnotated: true,
        },
        latestRunSummary: {
          runId: "run-2",
          status: "completed",
          triggerType: "manual",
        },
      },
    ];
    loadPreviewWorkbenchMock
      .mockResolvedValueOnce(buildPreviewWorkbench())
      .mockResolvedValueOnce(englishWorkbench);
    loadPreviewShotOptionsMock
      .mockResolvedValueOnce([
        {
          shotId: "shot-2",
          label: "SCENE-001 / SHOT-002",
          shotExecutionId: "shot-exec-2",
          shotExecutionStatus: "ready",
          shotSummary: {
            projectId: "project-1",
            projectTitle: "项目一",
            episodeId: "episode-1",
            episodeTitle: "第一集",
            sceneId: "scene-1",
            sceneCode: "SCENE-001",
            sceneTitle: "开场",
            shotId: "shot-2",
            shotCode: "SHOT-002",
            shotTitle: "第二镜",
          },
          currentPrimaryAssetSummary: {
            assetId: "asset-2",
            mediaType: "image",
            rightsStatus: "cleared",
            aiAnnotated: true,
          },
          latestRunSummary: {
            runId: "run-2",
            status: "completed",
            triggerType: "manual",
          },
        },
      ])
      .mockResolvedValueOnce(englishShotOptions);
    savePreviewWorkbenchMock.mockResolvedValueOnce({
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
          itemId: "item-1",
          assemblyId: "assembly-project-1",
          shotId: "shot-2",
          primaryAssetId: "asset-2",
          sourceRunId: "run-2",
          sequence: 1,
          shotSummary: buildShotSummary("shot-2", "SHOT-002", "第二镜"),
          primaryAssetSummary: {
            assetId: "asset-2",
            mediaType: "image",
            rightsStatus: "cleared",
            aiAnnotated: true,
          },
          sourceRunSummary: {
            runId: "run-2",
            status: "completed",
            triggerType: "manual",
          },
        },
        {
          itemId: "item-2",
          assemblyId: "assembly-project-1",
          shotId: "shot-1",
          primaryAssetId: "",
          sourceRunId: "",
          sequence: 2,
          shotSummary: buildShotSummary("shot-1", "SHOT-001", "第一镜"),
          primaryAssetSummary: null,
          sourceRunSummary: null,
        },
      ],
    });

    const { result, rerender } = renderHook(
      (props: { locale: "zh-CN" | "en-US" }) =>
        usePreviewWorkbenchController({
          enabled: true,
          projectId: "project-1",
          locale: props.locale,
          t,
          orgId: "org-1",
          userId: "user-1",
        }),
      {
        initialProps: { locale: "zh-CN" },
      },
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items[0]?.shotSummary?.shotTitle).toBe("第一镜");
    });

    act(() => {
      result.current.handleAddItemFromChooser();
      result.current.handleMoveItem("draft-1", "up");
      result.current.setManualShotIdInput("shot-manual-9");
    });

    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-2", "shot-1"]);
    expect(result.current.manualShotIdInput).toBe("shot-manual-9");

    rerender({ locale: "en-US" });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items[0]?.shotSummary?.shotTitle).toBe("First Shot");
    });

    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-2", "shot-1"]);
    expect(result.current.draftItems[0]?.shotSummary?.shotTitle).toBe("Second Shot");
    expect(result.current.draftItems[1]?.shotSummary?.shotTitle).toBe("First Shot");
    expect(result.current.selectedShotOptionId).toBe("shot-2");
    expect(result.current.manualShotIdInput).toBe("shot-manual-9");

    await act(async () => {
      await result.current.handleSaveAssembly();
    });

    expect(result.current.draftItems[0]?.shotSummary?.shotTitle).toBe("Second Shot");
    expect(result.current.draftItems[1]?.shotSummary?.shotTitle).toBe("First Shot");
  });

  it("refreshes preview runtime from SSE without overwriting unsaved draft state", async () => {
    loadPreviewRuntimeMock
      .mockResolvedValueOnce(buildPreviewRuntime())
      .mockResolvedValueOnce(
        buildPreviewRuntime({
          status: "ready",
          renderWorkflowRunId: "workflow-preview-1",
          renderStatus: "completed",
          playbackAssetId: "asset-playback-1",
          exportAssetId: "asset-export-1",
          resolvedLocale: "en-US",
          playback: {
            deliveryMode: "file",
            playbackUrl: "https://cdn.example.com/preview-runtime-1.mp4",
            posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
            durationMs: 30000,
            timeline: {
              totalDurationMs: 30000,
              segments: [
                {
                  segmentId: "segment-1",
                  sequence: 1,
                  shotId: "shot-1",
                  shotCode: "SHOT-001",
                  shotTitle: "First Shot",
                  playbackAssetId: "asset-playback-segment-1",
                  sourceRunId: "run-segment-1",
                  startMs: 0,
                  durationMs: 12000,
                  transitionToNext: {
                    transitionType: "crossfade",
                    durationMs: 300,
                  },
                },
              ],
            },
          },
          exportOutput: {
            downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
            mimeType: "video/mp4",
            fileName: "preview-export-1.mp4",
            sizeBytes: 4096,
          },
        }),
      );

    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        locale: "en-US",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("idle");
    });

    act(() => {
      result.current.handleAddItemFromChooser();
      result.current.setManualShotIdInput("shot-manual-9");
    });

    const subscriptionOptions = subscribePreviewRuntimeMock.mock.calls[0]?.[0] as {
      onRefreshNeeded: () => void;
    };
    await act(async () => {
      subscriptionOptions.onRefreshNeeded();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("completed");
    });

    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-1", "shot-2"]);
    expect(result.current.manualShotIdInput).toBe("shot-manual-9");
    expect(result.current.previewRuntime?.playback?.deliveryMode).toBe("file");
    expect(result.current.previewRuntime?.playback?.timeline?.segments).toHaveLength(1);
    expect(result.current.previewRuntime?.playback?.timeline?.segments[0]?.shotTitle).toBe(
      "First Shot",
    );
    expect(result.current.previewRuntime?.exportOutput?.downloadUrl).toBe(
      "https://cdn.example.com/preview-export-1.mp4",
    );
  });

  it("keeps preview drafts when runtime refresh fails after subscription", async () => {
    loadPreviewRuntimeMock
      .mockResolvedValueOnce(buildPreviewRuntime())
      .mockRejectedValueOnce(new Error("runtime exploded"));

    const { result } = renderHook(() =>
      usePreviewWorkbenchController({
        enabled: true,
        projectId: "project-1",
        locale: "zh-CN",
        t,
        orgId: "org-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("idle");
    });

    act(() => {
      result.current.handleAddItemFromChooser();
      result.current.setManualShotIdInput("shot-manual-9");
    });

    const subscriptionOptions = subscribePreviewRuntimeMock.mock.calls[0]?.[0] as {
      onRefreshNeeded: () => void;
    };
    await act(async () => {
      subscriptionOptions.onRefreshNeeded();
      await Promise.resolve();
    });

    expect(result.current.previewRuntime?.renderStatus).toBe("idle");
    expect(result.current.runtimeErrorMessage).toBe("runtime exploded");
    expect(result.current.draftItems.map((item) => item.shotId)).toEqual(["shot-1", "shot-2"]);
    expect(result.current.manualShotIdInput).toBe("shot-manual-9");
  });
});
