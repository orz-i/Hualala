import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { PreviewWorkbenchPage } from "./PreviewWorkbenchPage";

describe("PreviewWorkbenchPage", () => {
  const t = createTranslator("zh-CN");

  it("disables provenance actions when the item has no primary asset id", () => {
    const onOpenAssetProvenance = vi.fn();
    const onOpenShotWorkbench = vi.fn();
    const onOpenAudioWorkbench = vi.fn();
    const onAddItemFromChooser = vi.fn();
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
              shotSummary: {
                sceneCode: "SCENE-001",
                sceneTitle: "开场",
                shotCode: "SHOT-001",
                shotTitle: "第一镜",
              },
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
              shotSummary: {
                sceneCode: "SCENE-001",
                sceneTitle: "开场",
                shotCode: "SHOT-002",
                shotTitle: "第二镜",
              },
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
            shotSummary: {
              sceneCode: "SCENE-001",
              sceneTitle: "开场",
              shotCode: "SHOT-001",
              shotTitle: "第一镜",
            },
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
            shotSummary: {
              sceneCode: "SCENE-001",
              sceneTitle: "开场",
              shotCode: "SHOT-002",
              shotTitle: "第二镜",
            },
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
            shotSummary: {
              sceneCode: "SCENE-001",
              sceneTitle: "开场",
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
        ]}
        selectedShotOptionId="shot-2"
        shotOptionsErrorMessage=""
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

    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-2");
    expect(onOpenShotWorkbench).toHaveBeenCalledWith("shot-2");
    expect(onOpenAudioWorkbench).toHaveBeenCalledTimes(1);
    expect(onAddItemFromChooser).toHaveBeenCalledTimes(1);
    expect(within(firstItem).getByText("SCENE-001 / SHOT-001")).toBeInTheDocument();
    expect(within(firstItem).getByText("开场 / 第一镜")).toBeInTheDocument();
    expect(within(secondItem).getByText("image · cleared · AI annotated")).toBeInTheDocument();
    expect(within(secondItem).getByText("completed · manual")).toBeInTheDocument();
    expect(screen.getByText("音频轨道数：3")).toBeInTheDocument();
    expect(screen.getByText("音频片段数：2")).toBeInTheDocument();
  });
});
