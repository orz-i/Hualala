import { createExecutionClient, type HualalaFetch } from "@hualala/sdk";
import type { ShotWorkbenchViewModel } from "./ShotWorkbenchPage";

type LoadShotWorkbenchOptions = {
  shotId: string;
  displayLocale?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type GetShotWorkbenchResponse = {
  workbench?: {
    shotExecution?: {
      id?: string;
      shotId?: string;
      orgId?: string;
      projectId?: string;
      status?: string;
      primaryAssetId?: string;
    };
    candidateAssets?: Array<{
      id?: string;
      assetId?: string;
      shotExecutionId?: string;
      sourceRunId?: string;
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

export async function loadShotWorkbench({
  shotId,
  displayLocale = "zh-CN",
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadShotWorkbenchOptions): Promise<ShotWorkbenchViewModel> {
  const client = createExecutionClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });
  const payload = (await client.getShotWorkbench({
    shotId,
    displayLocale,
  })) as GetShotWorkbenchResponse;
  const workbench = payload.workbench;
  if (!workbench?.shotExecution?.id || !workbench.shotExecution.shotId) {
    throw new Error("creator: shot workbench payload is incomplete");
  }

  return {
    shotExecution: {
      id: workbench.shotExecution.id,
      shotId: workbench.shotExecution.shotId,
      orgId: workbench.shotExecution.orgId ?? "",
      projectId: workbench.shotExecution.projectId ?? "",
      status: workbench.shotExecution.status ?? "unknown",
      primaryAssetId: workbench.shotExecution.primaryAssetId ?? "",
    },
    candidateAssets: (workbench.candidateAssets ?? []).map((candidate) => ({
      id: candidate.id ?? "",
      assetId: candidate.assetId ?? "",
      shotExecutionId: candidate.shotExecutionId ?? "",
      sourceRunId: candidate.sourceRunId ?? "",
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
    reviewTimeline: {
      evaluationRuns: [],
      shotReviews: [],
    },
  };
}
