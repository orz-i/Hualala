import type { AdminOverviewViewModel } from "./AdminOverviewPage";

type LoadAdminOverviewOptions = {
  projectId: string;
  shotExecutionId: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type BudgetSnapshotResponse = {
  budgetSnapshot?: {
    projectId?: string;
    limitCents?: number;
    reservedCents?: number;
    remainingBudgetCents?: number;
  };
};

type UsageRecordsResponse = {
  usageRecords?: Array<{
    id?: string;
    meter?: string;
    amountCents?: number;
  }>;
};

type BillingEventsResponse = {
  billingEvents?: Array<{
    id?: string;
    eventType?: string;
    amountCents?: number;
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

async function postJson<TResponse>(
  path: string,
  body: Record<string, string>,
  fetchFn: typeof fetch,
  baseUrl?: string,
): Promise<TResponse> {
  const response = await fetchFn(`${resolveBaseUrl(baseUrl)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Connect-Protocol-Version": "1",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`admin: failed to load ${path} (${response.status})`);
  }

  return (await response.json()) as TResponse;
}

export async function loadAdminOverview({
  projectId,
  shotExecutionId,
  baseUrl,
  fetchFn = fetch,
}: LoadAdminOverviewOptions): Promise<AdminOverviewViewModel> {
  const [
    budgetPayload,
    usagePayload,
    billingPayload,
    summaryPayload,
    evaluationPayload,
    reviewPayload,
  ] = await Promise.all([
    postJson<BudgetSnapshotResponse>(
      "/hualala.billing.v1.BillingService/GetBudgetSnapshot",
      { projectId },
      fetchFn,
      baseUrl,
    ),
    postJson<UsageRecordsResponse>(
      "/hualala.billing.v1.BillingService/ListUsageRecords",
      { projectId },
      fetchFn,
      baseUrl,
    ),
    postJson<BillingEventsResponse>(
      "/hualala.billing.v1.BillingService/ListBillingEvents",
      { projectId },
      fetchFn,
      baseUrl,
    ),
    postJson<ReviewSummaryResponse>(
      "/hualala.review.v1.ReviewService/GetShotReviewSummary",
      { shotExecutionId },
      fetchFn,
      baseUrl,
    ),
    postJson<EvaluationRunsResponse>(
      "/hualala.review.v1.ReviewService/ListEvaluationRuns",
      { shotExecutionId },
      fetchFn,
      baseUrl,
    ),
    postJson<ShotReviewsResponse>(
      "/hualala.review.v1.ReviewService/ListShotReviews",
      { shotExecutionId },
      fetchFn,
      baseUrl,
    ),
  ]);

  if (!budgetPayload.budgetSnapshot?.projectId) {
    throw new Error("admin: budget snapshot payload is incomplete");
  }

  const billingEvents = (billingPayload.billingEvents ?? []).map((event) => ({
    id: event.id ?? "",
    eventType: event.eventType ?? "unknown",
    amountCents: event.amountCents ?? 0,
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
      limitCents: budgetPayload.budgetSnapshot.limitCents ?? 0,
      reservedCents: budgetPayload.budgetSnapshot.reservedCents ?? 0,
      remainingBudgetCents: budgetPayload.budgetSnapshot.remainingBudgetCents ?? 0,
    },
    usageRecords: (usagePayload.usageRecords ?? []).map((record) => ({
      id: record.id ?? "",
      meter: record.meter ?? "unknown",
      amountCents: record.amountCents ?? 0,
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
