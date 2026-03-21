import type {
  BatchConfirmImportBatchItemsResponse,
  GetAssetProvenanceSummaryResponse,
  GetImportBatchWorkbenchResponse,
  ListCandidateAssetsResponse,
  ListImportBatchesResponse,
} from "../../gen/hualala/asset/v1/asset_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export function createAssetClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);

  return {
    getImportBatchWorkbench(body: { importBatchId: string }) {
      return client.unary<GetImportBatchWorkbenchResponse>(
        "/hualala.asset.v1.AssetService/GetImportBatchWorkbench",
        body,
        "sdk: failed to get import batch workbench",
      );
    },
    listImportBatches(body: {
      projectId: string;
      status?: string;
      sourceType?: string;
    }) {
      return client.unary<ListImportBatchesResponse>(
        "/hualala.asset.v1.AssetService/ListImportBatches",
        body,
        "sdk: failed to list import batches",
      );
    },
    listCandidateAssets(body: { shotExecutionId: string }) {
      return client.unary<ListCandidateAssetsResponse>(
        "/hualala.asset.v1.AssetService/ListCandidateAssets",
        body,
        "sdk: failed to list candidate assets",
      );
    },
    getAssetProvenanceSummary(body: { assetId: string }) {
      return client.unary<GetAssetProvenanceSummaryResponse>(
        "/hualala.asset.v1.AssetService/GetAssetProvenanceSummary",
        body,
        "sdk: failed to get asset provenance summary",
      );
    },
    batchConfirmImportBatchItems(body: {
      importBatchId: string;
      itemIds: string[];
    }) {
      return client.unary<BatchConfirmImportBatchItemsResponse>(
        "/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems",
        body,
        "sdk: failed to confirm import batch items",
      );
    },
  };
}
