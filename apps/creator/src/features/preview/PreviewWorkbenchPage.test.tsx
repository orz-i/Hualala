import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { PreviewWorkbenchPage } from "./PreviewWorkbenchPage";

describe("PreviewWorkbenchPage", () => {
  const t = createTranslator("zh-CN");
  const buildShotSummary = (shotId: string, shotCode: string, shotTitle: string) => ({
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
  });

  it("disables provenance actions when the item has no primary asset id", () => {
    const onOpenAssetProvenance = vi.fn();
    const onOpenShotWorkbench = vi.fn();
    const onOpenAudioWorkbench = vi.fn();
    const onAddItemFromChooser = vi.fn();
    const onRequestPreviewRender = vi.fn();
    const onManualShotIdInputChange = vi.fn();
    const onAddManualItem = vi.fn();

    render(
      <PreviewWorkbenchPage
        previewWorkbench={{
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
        }}
        draftItems={[
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
        ]}
        shotOptions={[
          {
            shotId: "shot-2",
            label: "SCENE-001 / SHOT-002",
            shotExecutionId: "shot-exec-2",
            shotExecutionStatus: "ready",
            shotSummary: buildShotSummary("shot-2", "SHOT-002", "第二镜"),
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
        ]}
        selectedShotOptionId="shot-2"
        shotOptionsErrorMessage=""
        previewRuntime={{
          previewRuntimeId: "runtime-project-1",
          projectId: "project-1",
          episodeId: "",
          assemblyId: "assembly-project-1",
          status: "idle",
          renderWorkflowRunId: "",
          renderStatus: "idle",
          playbackAssetId: "",
          exportAssetId: "",
          resolvedLocale: "zh-CN",
          createdAt: "2026-03-24T09:00:00.000Z",
          updatedAt: "2026-03-24T09:05:00.000Z",
          playback: {
            deliveryMode: "file",
            playbackUrl: "https://cdn.example.com/preview-runtime-1.mp4",
            posterUrl: "https://cdn.example.com/preview-runtime-1.jpg",
            durationMs: 30000,
          },
          exportOutput: {
            downloadUrl: "https://cdn.example.com/preview-export-1.mp4",
            mimeType: "video/mp4",
            fileName: "preview-export-1.mp4",
            sizeBytes: 4096,
          },
          lastErrorCode: "",
          lastErrorMessage: "",
        }}
        runtimeErrorMessage=""
        requestRenderDisabledReason=""
        requestRenderPending={false}
        manualShotIdInput=""
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        audioSummary={{
          trackCount: 3,
          clipCount: 2,
          renderStatus: "queued",
          missingAssetCount: 1,
        }}
        audioSummaryErrorMessage=""
        t={t}
        onSelectedShotOptionIdChange={vi.fn()}
        onAddItemFromChooser={onAddItemFromChooser}
        onManualShotIdInputChange={onManualShotIdInputChange}
        onAddManualItem={onAddManualItem}
        onRequestPreviewRender={onRequestPreviewRender}
        onRemoveItem={vi.fn()}
        onMoveItem={vi.fn()}
        onSaveAssembly={vi.fn()}
        onOpenShotWorkbench={onOpenShotWorkbench}
        onOpenAudioWorkbench={onOpenAudioWorkbench}
        onOpenAssetProvenance={onOpenAssetProvenance}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    const firstItem = screen.getByTestId("preview-item-item-1");
    const secondItem = screen.getByTestId("preview-item-item-2");

    expect(
      within(firstItem).getByRole("button", { name: "查看来源" }),
    ).toBeDisabled();

    fireEvent.click(within(secondItem).getByRole("button", { name: "查看来源" }));
    fireEvent.click(within(secondItem).getByRole("button", { name: "打开镜头工作台" }));
    fireEvent.click(screen.getByRole("button", { name: "打开音频工作台" }));
    fireEvent.click(screen.getByRole("button", { name: "从镜头目录追加" }));
    fireEvent.click(screen.getByRole("button", { name: "请求预演渲染" }));

    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-2");
    expect(onOpenShotWorkbench).toHaveBeenCalledWith("shot-2");
    expect(onOpenAudioWorkbench).toHaveBeenCalledTimes(1);
    expect(onAddItemFromChooser).toHaveBeenCalledTimes(1);
    expect(onRequestPreviewRender).toHaveBeenCalledTimes(1);
    expect(within(firstItem).getByText("SCENE-001 / SHOT-001")).toBeInTheDocument();
    expect(within(firstItem).getByText("开场 / 第一镜")).toBeInTheDocument();
    expect(within(secondItem).getByText("image · cleared · AI annotated")).toBeInTheDocument();
    expect(within(secondItem).getByText("completed · manual")).toBeInTheDocument();
    expect(screen.getByText("音频轨道数：3")).toBeInTheDocument();
    expect(screen.getByText("音频片段数：2")).toBeInTheDocument();
    expect(screen.getByText("运行态：idle")).toBeInTheDocument();
    expect(screen.getByText("渲染状态：idle")).toBeInTheDocument();
    expect(screen.getByText("交付模式：file")).toBeInTheDocument();
    expect(screen.getByText("时长：30000ms")).toBeInTheDocument();
    expect(screen.getByText("文件名：preview-export-1.mp4")).toBeInTheDocument();
    expect(screen.getByText("MIME：video/mp4")).toBeInTheDocument();
    expect(screen.getByText("大小：4096 B")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开播放输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/preview-runtime-1.mp4",
    );
    expect(screen.getByRole("link", { name: "打开导出输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/preview-export-1.mp4",
    );
    expect(screen.getByTestId("preview-runtime-video")).toHaveAttribute(
      "src",
      "https://cdn.example.com/preview-runtime-1.mp4",
    );
    expect(screen.getByTestId("preview-runtime-video")).toHaveAttribute(
      "poster",
      "https://cdn.example.com/preview-runtime-1.jpg",
    );
  });

  it("falls back to a link-only playback action for manifest delivery and surfaces runtime failures", () => {
    render(
      <PreviewWorkbenchPage
        previewWorkbench={{
          assembly: {
            assemblyId: "assembly-project-1",
            projectId: "project-1",
            episodeId: "",
            status: "draft",
            createdAt: "2026-03-23T09:00:00.000Z",
            updatedAt: "2026-03-23T09:05:00.000Z",
          },
          items: [],
        }}
        draftItems={[]}
        shotOptions={[]}
        selectedShotOptionId=""
        shotOptionsErrorMessage=""
        previewRuntime={{
          previewRuntimeId: "runtime-project-1",
          projectId: "project-1",
          episodeId: "",
          assemblyId: "assembly-project-1",
          status: "failed",
          renderWorkflowRunId: "workflow-preview-2",
          renderStatus: "failed",
          playbackAssetId: "",
          exportAssetId: "",
          resolvedLocale: "en-US",
          createdAt: "2026-03-24T09:00:00.000Z",
          updatedAt: "2026-03-24T09:10:00.000Z",
          playback: {
            deliveryMode: "manifest",
            playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
            posterUrl: "",
            durationMs: 31000,
          },
          exportOutput: null,
          lastErrorCode: "render_failed",
          lastErrorMessage: "worker callback timeout",
        }}
        runtimeErrorMessage=""
        requestRenderDisabledReason=""
        requestRenderPending={false}
        manualShotIdInput=""
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        audioSummary={null}
        audioSummaryErrorMessage=""
        t={t}
        onSelectedShotOptionIdChange={vi.fn()}
        onAddItemFromChooser={vi.fn()}
        onManualShotIdInputChange={vi.fn()}
        onAddManualItem={vi.fn()}
        onRequestPreviewRender={vi.fn()}
        onRemoveItem={vi.fn()}
        onMoveItem={vi.fn()}
        onSaveAssembly={vi.fn()}
        onOpenShotWorkbench={vi.fn()}
        onOpenAudioWorkbench={vi.fn()}
        onOpenAssetProvenance={vi.fn()}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("preview-runtime-video")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开播放输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/preview-runtime-1.m3u8",
    );
    expect(screen.getByText("最后错误码：render_failed")).toBeInTheDocument();
    expect(screen.getByText("最后错误信息：worker callback timeout")).toBeInTheDocument();
  });
});
