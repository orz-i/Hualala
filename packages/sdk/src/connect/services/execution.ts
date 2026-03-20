import type {
  GetShotWorkbenchResponse,
  RunSubmissionGateChecksResponse,
  SelectPrimaryAssetResponse,
} from "../../gen/hualala/execution/v1/execution_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export function createExecutionClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);

  return {
    getShotWorkbench(body: { shotId: string; displayLocale: string }) {
      return client.unary<GetShotWorkbenchResponse>(
        "/hualala.execution.v1.ExecutionService/GetShotWorkbench",
        body,
        "sdk: failed to get shot workbench",
      );
    },
    runSubmissionGateChecks(body: { shotExecutionId: string }) {
      return client.unary<RunSubmissionGateChecksResponse>(
        "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks",
        body,
        "sdk: failed to run submission gate checks",
      );
    },
    submitShotForReview(body: { shotExecutionId: string }) {
      return client.unary<Record<string, never>>(
        "/hualala.execution.v1.ExecutionService/SubmitShotForReview",
        body,
        "sdk: failed to submit shot for review",
      );
    },
    selectPrimaryAsset(body: { shotExecutionId: string; assetId: string }) {
      return client.unary<SelectPrimaryAssetResponse>(
        "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset",
        body,
        "sdk: failed to select primary asset",
      );
    },
  };
}
