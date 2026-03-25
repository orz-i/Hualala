import { act, renderHook, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { loadAdminPreviewRuntime } from "./loadAdminPreviewRuntime";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { loadAdminPreviewWorkbench } from "./loadAdminPreviewWorkbench";
import { subscribeAdminPreviewRuntime } from "./subscribeAdminPreviewRuntime";
import { useAdminPreviewController } from "./useAdminPreviewController";

vi.mock("./loadAdminPreviewWorkbench", () => ({
  loadAdminPreviewWorkbench: vi.fn(),
}));

vi.mock("./loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));

vi.mock("./loadAdminPreviewRuntime", () => ({
  loadAdminPreviewRuntime: vi.fn(),
}));

vi.mock("./subscribeAdminPreviewRuntime", () => ({
  subscribeAdminPreviewRuntime: vi.fn(),
}));

const loadAdminPreviewWorkbenchMock = vi.mocked(loadAdminPreviewWorkbench);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);
const loadAdminPreviewRuntimeMock = vi.mocked(loadAdminPreviewRuntime);
const subscribeAdminPreviewRuntimeMock = vi.mocked(subscribeAdminPreviewRuntime);

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
        shotSummary: buildShotSummary("shot-1", "SHOT-001", "第一镜"),
        primaryAssetSummary: null,
        sourceRunSummary: null,
      },
      {
        itemId: "item-2",
        assemblyId: "assembly-project-1",
        shotId: "shot-2",
        primaryAssetId: "asset-2",
        sourceRunId: "run-2",
        sequence: 2,
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
    ],
    summary: {
      itemCount: 2,
      missingPrimaryAssetCount: 1,
      missingSourceRunCount: 1,
    },
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

describe("useAdminPreviewController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminPreviewWorkbenchMock.mockResolvedValue(buildPreviewWorkbench());
    loadAdminPreviewRuntimeMock.mockResolvedValue(buildPreviewRuntime());
    loadAssetProvenanceDetailsMock.mockResolvedValue({
      asset: {
        id: "asset-2",
        projectId: "project-1",
        sourceType: "upload_session",
        rightsStatus: "clear",
        importBatchId: "batch-1",
        locale: "zh-CN",
        aiAnnotated: true,
      },
      provenanceSummary: "source_type=upload_session rights_status=clear",
      candidateAssetId: "candidate-2",
      shotExecutionId: "shot-exec-2",
      sourceRunId: "run-2",
      importBatchId: "batch-1",
      variantCount: 2,
    });
    subscribeAdminPreviewRuntimeMock.mockReturnValue(vi.fn());
  });

  it("loads preview data only when enabled and the session is ready", async () => {
    const { result, rerender } = renderHook(
      (props: { sessionState: "loading" | "ready"; enabled: boolean }) =>
        useAdminPreviewController({
          ...props,
          projectId: "project-1",
          locale: "zh-CN",
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

    expect(loadAdminPreviewWorkbenchMock).not.toHaveBeenCalled();
    expect(result.current.previewWorkbench).toBeNull();

    rerender({
      sessionState: "ready",
      enabled: true,
    });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.summary.itemCount).toBe(2);
    });
    expect(result.current.previewRuntime).toEqual(
      expect.objectContaining({
        previewRuntimeId: "runtime-project-1",
        renderStatus: "idle",
      }),
    );
  });

  it("opens asset provenance details for preview items", async () => {
    const { result } = renderHook(() =>
      useAdminPreviewController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        locale: "zh-CN",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.summary.itemCount).toBe(2);
    });

    await act(async () => {
      await result.current.handleOpenAssetProvenance("asset-2");
    });

    expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
      assetId: "asset-2",
      orgId: "org-1",
      userId: "user-1",
    });
    expect(result.current.assetProvenanceDetail?.asset.id).toBe("asset-2");
  });

  it("reloads preview metadata when the app locale changes", async () => {
    loadAdminPreviewWorkbenchMock
      .mockResolvedValueOnce(buildPreviewWorkbench())
      .mockResolvedValueOnce({
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
          {
            ...buildPreviewWorkbench().items[1],
            shotSummary: {
              ...buildPreviewWorkbench().items[1].shotSummary,
              sceneTitle: "Opening",
              shotTitle: "Second Shot",
            },
          },
        ],
      });

    const { result, rerender } = renderHook(
      (props: { locale: "zh-CN" | "en-US" }) =>
        useAdminPreviewController({
          sessionState: "ready",
          enabled: true,
          projectId: "project-1",
          locale: props.locale,
          effectiveOrgId: "org-1",
          effectiveUserId: "user-1",
          t,
        }),
      {
        initialProps: { locale: "zh-CN" },
      },
    );

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items[0]?.shotSummary?.shotTitle).toBe("第一镜");
    });

    rerender({ locale: "en-US" });

    await waitFor(() => {
      expect(result.current.previewWorkbench?.items[0]?.shotSummary?.shotTitle).toBe("First Shot");
    });
  });

  it("refreshes preview runtime from SSE without clearing admin preview state", async () => {
    loadAdminPreviewRuntimeMock
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
      );

    const { result } = renderHook(() =>
      useAdminPreviewController({
        sessionState: "ready",
        enabled: true,
        projectId: "project-1",
        locale: "en-US",
        effectiveOrgId: "org-1",
        effectiveUserId: "user-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("idle");
    });

    const subscriptionOptions = subscribeAdminPreviewRuntimeMock.mock.calls[0]?.[0] as {
      onRefreshNeeded: () => void;
    };
    await act(async () => {
      subscriptionOptions.onRefreshNeeded();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.previewRuntime?.renderStatus).toBe("completed");
    });
    expect(result.current.previewWorkbench?.summary.itemCount).toBe(2);
    expect(result.current.previewRuntime?.playback?.deliveryMode).toBe("manifest");
    expect(result.current.previewRuntime?.exportOutput?.downloadUrl).toBe(
      "https://cdn.example.com/preview-export-1.mp4",
    );
  });
});
