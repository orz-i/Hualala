type ConfirmImportBatchItemsInput = {
  importBatchId: string;
  itemIds: string[];
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type SelectPrimaryAssetForImportBatchInput = {
  shotExecutionId: string;
  assetId: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveBaseUrl(baseUrl?: string) {
  if (baseUrl && baseUrl.trim() !== "") {
    return trimTrailingSlash(baseUrl.trim());
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return "";
}

async function assertConnectOk(response: Response, label: string) {
  if (response.ok) {
    return;
  }
  throw new Error(`${label} (${response.status})`);
}

export async function confirmImportBatchItems({
  importBatchId,
  itemIds,
  baseUrl,
  fetchFn = fetch,
}: ConfirmImportBatchItemsInput): Promise<void> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        importBatchId,
        itemIds,
      }),
    },
  );

  await assertConnectOk(response, "creator: failed to confirm import batch items");
}

export async function selectPrimaryAssetForImportBatch({
  shotExecutionId,
  assetId,
  baseUrl,
  fetchFn = fetch,
}: SelectPrimaryAssetForImportBatchInput): Promise<void> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.execution.v1.ExecutionService/SelectPrimaryAsset`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        shotExecutionId,
        assetId,
      }),
    },
  );

  await assertConnectOk(response, "creator: failed to select primary asset");
}
