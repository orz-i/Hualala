type ShotWorkbenchMutationInput = {
  shotExecutionId: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type RunSubmissionGateChecksResponse = {
  passedChecks?: string[];
  failedChecks?: string[];
};

export type SubmissionGateCheckResult = {
  passedChecks: string[];
  failedChecks: string[];
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

export async function runSubmissionGateChecks({
  shotExecutionId,
  baseUrl,
  fetchFn = fetch,
}: ShotWorkbenchMutationInput): Promise<SubmissionGateCheckResult> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        shotExecutionId,
      }),
    },
  );

  await assertConnectOk(response, "creator: failed to run submission gate checks");
  const payload = (await response.json()) as RunSubmissionGateChecksResponse;
  return {
    passedChecks: payload.passedChecks ?? [],
    failedChecks: payload.failedChecks ?? [],
  };
}

export async function submitShotForReview({
  shotExecutionId,
  baseUrl,
  fetchFn = fetch,
}: ShotWorkbenchMutationInput): Promise<void> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.execution.v1.ExecutionService/SubmitShotForReview`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        shotExecutionId,
      }),
    },
  );

  await assertConnectOk(response, "creator: failed to submit shot for review");
}
