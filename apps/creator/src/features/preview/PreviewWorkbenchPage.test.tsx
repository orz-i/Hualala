import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { PreviewWorkbenchPage } from "./PreviewWorkbenchPage";

describe("PreviewWorkbenchPage", () => {
  const t = createTranslator("zh-CN");

  it("disables provenance actions when the item has no primary asset id", () => {
    const onOpenAssetProvenance = vi.fn();
    const onOpenShotWorkbench = vi.fn();

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
            },
            {
              itemId: "item-2",
              assemblyId: "assembly-project-1",
              shotId: "shot-2",
              primaryAssetId: "asset-2",
              sourceRunId: "run-2",
              sequence: 2,
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
          },
          {
            itemId: "item-2",
            assemblyId: "assembly-project-1",
            shotId: "shot-2",
            primaryAssetId: "asset-2",
            sourceRunId: "run-2",
            sequence: 2,
          },
        ]}
        newShotIdInput=""
        newPrimaryAssetIdInput=""
        newSourceRunIdInput=""
        assetProvenanceDetail={null}
        assetProvenancePending={false}
        assetProvenanceErrorMessage=""
        t={t}
        onNewShotIdInputChange={vi.fn()}
        onNewPrimaryAssetIdInputChange={vi.fn()}
        onNewSourceRunIdInputChange={vi.fn()}
        onDraftItemFieldChange={vi.fn()}
        onAddItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onMoveItem={vi.fn()}
        onSaveAssembly={vi.fn()}
        onOpenShotWorkbench={onOpenShotWorkbench}
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

    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-2");
    expect(onOpenShotWorkbench).toHaveBeenCalledWith("shot-2");
  });
});
