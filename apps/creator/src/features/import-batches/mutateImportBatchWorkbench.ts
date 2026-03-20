import {
  createAssetClient,
  createExecutionClient,
  type HualalaFetch,
} from "@hualala/sdk";
type ConfirmImportBatchItemsInput = {
  importBatchId: string;
  itemIds: string[];
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type SelectPrimaryAssetForImportBatchInput = {
  shotExecutionId: string;
  assetId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

export async function confirmImportBatchItems({
  importBatchId,
  itemIds,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: ConfirmImportBatchItemsInput): Promise<void> {
  const client = createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.batchConfirmImportBatchItems({
    importBatchId,
    itemIds,
  });
}

export async function selectPrimaryAssetForImportBatch({
  shotExecutionId,
  assetId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: SelectPrimaryAssetForImportBatchInput): Promise<void> {
  const client = createExecutionClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.selectPrimaryAsset({
    shotExecutionId,
    assetId,
  });
}
