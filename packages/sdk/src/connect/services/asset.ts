import type {
  BatchConfirmImportBatchItemsResponse,
  GetImportBatchWorkbenchResponse,
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
