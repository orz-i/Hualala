import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AdminPreviewPage } from "./AdminPreviewPage";

describe("AdminPreviewPage", () => {
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

  it("renders metadata-first preview items and keeps provenance fail-closed", () => {
    const onOpenAssetProvenance = vi.fn();

    render(
      <AdminPreviewPage
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
          summary: {
            itemCount: 2,
            missingPrimaryAssetCount: 1,
            missingSourceRunCount: 1,
          },
        }}
        previewRuntime={{
          previewRuntimeId: "runtime-project-1",
          projectId: "project-1",
          episodeId: "",
          assemblyId: "assembly-project-1",
          status: "ready",
          renderWorkflowRunId: "workflow-preview-1",
          renderStatus: "completed",
          playbackAssetId: "asset-playback-1",
          exportAssetId: "asset-export-1",
          resolvedLocale: "zh-CN",
          createdAt: "2026-03-24T09:00:00.000Z",
          updatedAt: "2026-03-24T09:05:00.000Z",
          playback: {
            deliveryMode: "manifest",
            playbackUrl: "https://cdn.example.com/preview-runtime-1.m3u8",
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
                  shotTitle: "第一镜",
                  playbackAssetId: "asset-playback-segment-1",
                  sourceRunId: "run-segment-1",
                  startMs: 0,
                  durationMs: 12000,
                  transitionToNext: {
                    transitionType: "crossfade",
                    durationMs: 300,
                  },
                },
                {
                  segmentId: "segment-2",
                  sequence: 2,
                  shotId: "shot-2",
                  shotCode: "SHOT-002",
                  shotTitle: "第二镜",
                  playbackAssetId: "asset-playback-segment-2",
                  sourceRunId: "run-segment-2",
                  startMs: 12000,
                  durationMs: 18000,
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
          lastErrorCode: "",
          lastErrorMessage: "",
        }}
        runtimeErrorMessage=""
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onOpenAssetProvenance={onOpenAssetProvenance}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    const firstItem = screen.getByTestId("admin-preview-item-item-1");
    const secondItem = screen.getByTestId("admin-preview-item-item-2");

    expect(screen.getByText("缺失来源运行摘要的条目：1")).toBeInTheDocument();
    expect(screen.getByText("运行态：ready")).toBeInTheDocument();
    expect(screen.getByText("渲染状态：completed")).toBeInTheDocument();
    expect(screen.getByText("交付模式：manifest")).toBeInTheDocument();
    expect(screen.getByText("时长：30000ms")).toBeInTheDocument();
    expect(
      screen.getByText("Playback URL：https://cdn.example.com/preview-runtime-1.m3u8"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Poster URL：https://cdn.example.com/preview-runtime-1.jpg"),
    ).toBeInTheDocument();
    expect(screen.getByText("文件名：preview-export-1.mp4")).toBeInTheDocument();
    expect(screen.getByText("MIME：video/mp4")).toBeInTheDocument();
    expect(screen.getByText("大小：4096 B")).toBeInTheDocument();
    expect(
      screen.getByText("Download URL：https://cdn.example.com/preview-export-1.mp4"),
    ).toBeInTheDocument();
    expect(screen.getByText("段落数：2")).toBeInTheDocument();
    expect(screen.getByText("总时长：30000ms")).toBeInTheDocument();
    expect(screen.getByText("序号：1")).toBeInTheDocument();
    expect(screen.getByText("镜头：SHOT-001 / 第一镜")).toBeInTheDocument();
    expect(screen.getByText("起始：0ms")).toBeInTheDocument();
    expect(screen.getByText("转场：crossfade · 300ms")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开播放输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/preview-runtime-1.m3u8",
    );
    expect(screen.getByRole("link", { name: "打开导出输出" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/preview-export-1.mp4",
    );
    expect(document.querySelector("video")).toBeNull();
    expect(within(firstItem).getByText("SCENE-001 / SHOT-001")).toBeInTheDocument();
    expect(within(firstItem).getByText("开场 / 第一镜")).toBeInTheDocument();
    expect(within(firstItem).getByRole("button", { name: "查看来源" })).toBeDisabled();

    expect(within(secondItem).getByText("SCENE-001 / SHOT-002")).toBeInTheDocument();
    expect(within(secondItem).getByText("image · cleared · AI annotated")).toBeInTheDocument();
    expect(within(secondItem).getByText("completed · manual")).toBeInTheDocument();

    fireEvent.click(within(secondItem).getByRole("button", { name: "查看来源" }));
    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-2");
  });

  it("renders runtime failure details without embedding a player", () => {
    render(
      <AdminPreviewPage
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
          summary: {
            itemCount: 0,
            missingPrimaryAssetCount: 0,
            missingSourceRunCount: 0,
          },
        }}
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
          updatedAt: "2026-03-24T09:12:00.000Z",
          playback: null,
          exportOutput: null,
          lastErrorCode: "render_failed",
          lastErrorMessage: "worker callback timeout",
        }}
        runtimeErrorMessage=""
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onOpenAssetProvenance={vi.fn()}
        onCloseAssetProvenance={vi.fn()}
      />,
    );

    expect(screen.getByText("最后错误码：render_failed")).toBeInTheDocument();
    expect(screen.getByText("最后错误信息：worker callback timeout")).toBeInTheDocument();
    expect(screen.getByText("当前还没有可消费的播放 / 导出输出。")).toBeInTheDocument();
    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByText("段落数：")).not.toBeInTheDocument();
  });
});
