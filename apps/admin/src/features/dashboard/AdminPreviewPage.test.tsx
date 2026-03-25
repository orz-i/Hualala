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
          renderStatus: "succeeded",
          playbackAssetId: "asset-playback-1",
          exportAssetId: "asset-export-1",
          resolvedLocale: "zh-CN",
          createdAt: "2026-03-24T09:00:00.000Z",
          updatedAt: "2026-03-24T09:05:00.000Z",
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
    expect(screen.getByText("渲染状态：succeeded")).toBeInTheDocument();
    expect(within(firstItem).getByText("SCENE-001 / SHOT-001")).toBeInTheDocument();
    expect(within(firstItem).getByText("开场 / 第一镜")).toBeInTheDocument();
    expect(within(firstItem).getByRole("button", { name: "查看来源" })).toBeDisabled();

    expect(within(secondItem).getByText("SCENE-001 / SHOT-002")).toBeInTheDocument();
    expect(within(secondItem).getByText("image · cleared · AI annotated")).toBeInTheDocument();
    expect(within(secondItem).getByText("completed · manual")).toBeInTheDocument();

    fireEvent.click(within(secondItem).getByRole("button", { name: "查看来源" }));
    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-2");
  });
});
