import type { ShotWorkbenchViewModel } from "./ShotWorkbenchPage";

type LoadShotWorkbenchOptions = {
  shotId: string;
  displayLocale?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type GetShotWorkbenchResponse = {
  workbench?: {
    shotExecution?: {
      id?: string;
      shotId?: string;
      status?: string;
      primaryAssetId?: string;
    };
    candidateAssets?: Array<{
      id?: string;
      assetId?: string;
    }>;
    reviewSummary?: {
      latestConclusion?: string;
    };
    latestEvaluationRun?: {
      id?: string;
      status?: string;
    };
  };
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

export async function loadShotWorkbench({
  shotId,
  displayLocale = "zh-CN",
  baseUrl,
  fetchFn = fetch,
}: LoadShotWorkbenchOptions): Promise<ShotWorkbenchViewModel> {
  const response = await fetchFn(
    `${resolveBaseUrl(baseUrl)}/hualala.execution.v1.ExecutionService/GetShotWorkbench`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify({
        shotId,
        displayLocale,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`creator: failed to load shot workbench (${response.status})`);
  }

  const payload = (await response.json()) as GetShotWorkbenchResponse;
  const workbench = payload.workbench;
  if (!workbench?.shotExecution?.id || !workbench.shotExecution.shotId) {
    throw new Error("creator: shot workbench payload is incomplete");
  }

  return {
    shotExecution: {
      id: workbench.shotExecution.id,
      shotId: workbench.shotExecution.shotId,
      status: workbench.shotExecution.status ?? "unknown",
      primaryAssetId: workbench.shotExecution.primaryAssetId ?? "",
    },
    candidateAssets: (workbench.candidateAssets ?? []).map((candidate) => ({
      id: candidate.id ?? "",
      assetId: candidate.assetId ?? "",
    })),
    reviewSummary: {
      latestConclusion: workbench.reviewSummary?.latestConclusion ?? "pending",
    },
    latestEvaluationRun: workbench.latestEvaluationRun
      ? {
          id: workbench.latestEvaluationRun.id ?? "",
          status: workbench.latestEvaluationRun.status ?? "pending",
        }
      : undefined,
  };
}
