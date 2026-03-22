import type { ImportBatchDetailViewModel, ImportBatchItemViewModel } from "../../assetMonitor";

export type ImportBatchSelections = {
  actionableImportItems: ImportBatchItemViewModel[];
  actionableImportItemIds: string[];
  selectedActionableImportItemIds: string[];
};

export function deriveImportBatchSelections(
  importBatchDetail: ImportBatchDetailViewModel,
  selectedImportItemIds: string[],
): ImportBatchSelections {
  const actionableImportItems = importBatchDetail.items.filter(
    (item) => item.status !== "confirmed" && Boolean(item.assetId),
  );
  const actionableImportItemIds = actionableImportItems.map((item) => item.id);
  const selectedActionableImportItemIds = selectedImportItemIds.filter((itemId) =>
    actionableImportItemIds.includes(itemId),
  );

  return {
    actionableImportItems,
    actionableImportItemIds,
    selectedActionableImportItemIds,
  };
}
