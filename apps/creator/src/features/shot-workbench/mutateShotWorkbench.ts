import { createExecutionClient, type HualalaFetch } from "@hualala/sdk";
type ShotWorkbenchMutationInput = {
  shotExecutionId: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type RunSubmissionGateChecksResponse = {
  passedChecks?: string[];
  failedChecks?: string[];
};

export type SubmissionGateCheckResult = {
  passedChecks: string[];
  failedChecks: string[];
};

export async function runSubmissionGateChecks({
  shotExecutionId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: ShotWorkbenchMutationInput): Promise<SubmissionGateCheckResult> {
  const client = createExecutionClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  const payload = (await client.runSubmissionGateChecks({
    shotExecutionId,
  })) as RunSubmissionGateChecksResponse;
  return {
    passedChecks: payload.passedChecks ?? [],
    failedChecks: payload.failedChecks ?? [],
  };
}

export async function submitShotForReview({
  shotExecutionId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: ShotWorkbenchMutationInput): Promise<void> {
  const client = createExecutionClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  await client.submitShotForReview({
    shotExecutionId,
  });
}

export async function selectPrimaryAssetForShotWorkbench({
  shotExecutionId,
  assetId,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: ShotWorkbenchMutationInput & {
  assetId: string;
}): Promise<void> {
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
