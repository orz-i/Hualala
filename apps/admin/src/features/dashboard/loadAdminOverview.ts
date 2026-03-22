import { createBillingClient, createReviewClient, type HualalaFetch } from "@hualala/sdk";
import type { AdminOverviewViewModel } from "./overview";

type LoadAdminOverviewOptions = {
  projectId: string;
  shotExecutionId: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
};

type BudgetSnapshotResponse = {
  budgetSnapshot?: {
    projectId?: string;
    limitCents?: number | bigint;
    reservedCents?: number | bigint;
    remainingBudgetCents?: number | bigint;
  };
};

type UsageRecordsResponse = {
  usageRecords?: Array<{
    id?: string;
    meter?: string;
    amountCents?: number | bigint;
  }>;
};

type BillingEventsResponse = {
  billingEvents?: Array<{
    id?: string;
    eventType?: string;
    amountCents?: number | bigint;
  }>;
};

type ReviewSummaryResponse = {
  summary?: {
    shotExecutionId?: string;
    latestConclusion?: string;
  };
};

type EvaluationRunsResponse = {
  evaluationRuns?: Array<{
    id?: string;
    status?: string;
    failedChecks?: string[];
  }>;
};

type ShotReviewsResponse = {
  shotReviews?: Array<{
    id?: string;
    conclusion?: string;
  }>;
};

function toCents(value?: number | bigint) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value ?? 0;
}

export async function loadAdminOverview({
  projectId,
  shotExecutionId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminOverviewOptions): Promise<AdminOverviewViewModel> {
  const billingClient = createBillingClient({
    baseUrl,
    fetchFn,
  });
  const reviewClient = createReviewClient({
    baseUrl,
    fetchFn,
  });

  const [
    budgetPayload,
    usagePayload,
    billingPayload,
    summaryPayload,
    evaluationPayload,
    reviewPayload,
  ] = await Promise.all([
    billingClient.getBudgetSnapshot({ projectId }) as Promise<BudgetSnapshotResponse>,
    billingClient.listUsageRecords({ projectId }) as unknown as Promise<UsageRecordsResponse>,
    billingClient.listBillingEvents({ projectId }) as unknown as Promise<BillingEventsResponse>,
    reviewClient.getShotReviewSummary({ shotExecutionId }) as Promise<ReviewSummaryResponse>,
    reviewClient.listEvaluationRuns({ shotExecutionId }) as Promise<EvaluationRunsResponse>,
    reviewClient.listShotReviews({ shotExecutionId }) as Promise<ShotReviewsResponse>,
  ]);

  if (!budgetPayload.budgetSnapshot?.projectId) {
    throw new Error("admin: budget snapshot payload is incomplete");
  }

  const billingEvents = (billingPayload.billingEvents ?? []).map((event) => ({
    id: event.id ?? "",
    eventType: event.eventType ?? "unknown",
    amountCents: toCents(event.amountCents),
  }));
  const evaluationRuns = (evaluationPayload.evaluationRuns ?? []).map((run) => ({
    id: run.id ?? "",
    status: run.status ?? "pending",
    failedChecks: run.failedChecks ?? [],
  }));
  const shotReviews = (reviewPayload.shotReviews ?? []).map((review) => ({
    id: review.id ?? "",
    conclusion: review.conclusion ?? "pending",
  }));

  return {
    budgetSnapshot: {
      projectId: budgetPayload.budgetSnapshot.projectId,
      limitCents: toCents(budgetPayload.budgetSnapshot.limitCents),
      reservedCents: toCents(budgetPayload.budgetSnapshot.reservedCents),
      remainingBudgetCents: toCents(budgetPayload.budgetSnapshot.remainingBudgetCents),
    },
    usageRecords: (usagePayload.usageRecords ?? []).map((record) => ({
      id: record.id ?? "",
      meter: record.meter ?? "unknown",
      amountCents: toCents(record.amountCents),
    })),
    billingEvents,
    reviewSummary: {
      shotExecutionId: summaryPayload.summary?.shotExecutionId ?? shotExecutionId,
      latestConclusion: summaryPayload.summary?.latestConclusion ?? "pending",
    },
    evaluationRuns,
    shotReviews,
    recentChanges: [
      billingEvents[0]
        ? {
            id: `billing-${billingEvents[0].id || "latest"}`,
            kind: "billing" as const,
            tone: "info" as const,
            eventType: billingEvents[0].eventType,
            amountCents: billingEvents[0].amountCents,
          }
        : {
            id: "billing-empty",
            kind: "billing" as const,
            tone: "info" as const,
            eventType: "pending",
            amountCents: 0,
          },
      evaluationRuns[0]
        ? {
            id: `evaluation-${evaluationRuns[0].id || "latest"}`,
            kind: "evaluation" as const,
            tone: evaluationRuns[0].status === "passed" ? ("success" as const) : ("warning" as const),
            status: evaluationRuns[0].status,
            failedChecksCount: evaluationRuns[0].failedChecks.length,
          }
        : {
            id: "evaluation-empty",
            kind: "evaluation" as const,
            tone: "warning" as const,
            status: "pending",
            failedChecksCount: 0,
          },
      shotReviews[0]
        ? {
            id: `review-${shotReviews[0].id || "latest"}`,
            kind: "review" as const,
            tone: shotReviews[0].conclusion === "approved" ? ("success" as const) : ("warning" as const),
            conclusion: shotReviews[0].conclusion,
          }
        : {
            id: "review-empty",
            kind: "review" as const,
            tone:
              (summaryPayload.summary?.latestConclusion ?? "pending") === "approved"
                ? ("success" as const)
                : ("warning" as const),
            conclusion: summaryPayload.summary?.latestConclusion ?? "pending",
          },
    ],
  };
}
