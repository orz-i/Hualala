import {
  createAssetClient,
  createExecutionClient,
  type HualalaFetch,
} from "@hualala/sdk";

type AssetMutationOptions = {
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type ConfirmImportBatchItemInput = AssetMutationOptions & {
  importBatchId: string;
  itemId: string;
};

type ConfirmImportBatchItemsInput = AssetMutationOptions & {
  importBatchId: string;
  itemIds: string[];
};

type SelectPrimaryAssetForImportBatchInput = AssetMutationOptions & {
  shotExecutionId: string;
  assetId: string;
};

function createAssetMutationClient({
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: AssetMutationOptions) {
  return createAssetClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
}

function createExecutionMutationClient({
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: AssetMutationOptions) {
  return createExecutionClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
}

export async function confirmImportBatchItem({
  importBatchId,
  itemId,
  ...options
}: ConfirmImportBatchItemInput): Promise<void> {
  await createAssetMutationClient(options).batchConfirmImportBatchItems({
    importBatchId,
    itemIds: [itemId],
  });
}

export async function confirmImportBatchItems({
  importBatchId,
  itemIds,
  ...options
}: ConfirmImportBatchItemsInput): Promise<void> {
  await createAssetMutationClient(options).batchConfirmImportBatchItems({
    importBatchId,
    itemIds,
  });
}

export async function selectPrimaryAssetForImportBatch({
  shotExecutionId,
  assetId,
  ...options
}: SelectPrimaryAssetForImportBatchInput): Promise<void> {
  await createExecutionMutationClient(options).selectPrimaryAsset({
    shotExecutionId,
    assetId,
  });
}
