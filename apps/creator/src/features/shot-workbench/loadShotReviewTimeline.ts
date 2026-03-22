import { createReviewClient, type HualalaFetch } from "@hualala/sdk";
import type { ShotReviewTimelineViewModel } from "./ShotWorkbenchPage";

type LoadShotReviewTimelineOptions = {
  shotExecutionId: string;
  unavailableMessage?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type ListEvaluationRunsResponse = {
  evaluationRuns?: Array<{
    id?: string;
    status?: string;
    passedChecks?: string[];
    failedChecks?: string[];
  }>;
};

type ListShotReviewsResponse = {
  shotReviews?: Array<{
    id?: string;
    conclusion?: string;
    commentLocale?: string;
  }>;
};

export async function loadShotReviewTimeline({
  shotExecutionId,
  unavailableMessage,
  orgId,
  userId,
  baseUrl,
  fetchFn = fetch,
}: LoadShotReviewTimelineOptions): Promise<ShotReviewTimelineViewModel> {
  const client = createReviewClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  try {
    const [evaluationPayload, reviewPayload] = await Promise.all([
      client.listEvaluationRuns({
        shotExecutionId,
      }) as Promise<ListEvaluationRunsResponse>,
      client.listShotReviews({
        shotExecutionId,
      }) as Promise<ListShotReviewsResponse>,
    ]);

    return {
      evaluationRuns: (evaluationPayload.evaluationRuns ?? []).map((run) => ({
        id: run.id ?? "",
        status: run.status ?? "pending",
        passedChecks: run.passedChecks ?? [],
        failedChecks: run.failedChecks ?? [],
      })),
      shotReviews: (reviewPayload.shotReviews ?? []).map((review) => ({
        id: review.id ?? "",
        conclusion: review.conclusion ?? "pending",
        commentLocale: review.commentLocale ?? "",
      })),
    };
  } catch {
    return {
      evaluationRuns: [],
      shotReviews: [],
      unavailableMessage: unavailableMessage ?? "creator: review timeline unavailable",
    };
  }
}
