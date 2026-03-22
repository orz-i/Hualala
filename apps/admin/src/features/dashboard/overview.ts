type BudgetSnapshot = {
  projectId: string;
  limitCents: number;
  reservedCents: number;
  remainingBudgetCents: number;
};

type UsageRecordSummary = {
  id: string;
  meter: string;
  amountCents: number;
};

type BillingEventSummary = {
  id: string;
  eventType: string;
  amountCents: number;
};

type ReviewSummary = {
  shotExecutionId: string;
  latestConclusion: string;
};

type EvaluationRunSummary = {
  id: string;
  status: string;
  failedChecks: string[];
};

type ShotReviewSummary = {
  id: string;
  conclusion: string;
};

export type RecentChangeSummary = {
  id: string;
  kind: "billing" | "evaluation" | "review";
  tone: "info" | "success" | "warning";
  eventType?: string;
  amountCents?: number;
  status?: string;
  failedChecksCount?: number;
  conclusion?: string;
};

export type AdminOverviewViewModel = {
  budgetSnapshot: BudgetSnapshot;
  usageRecords: UsageRecordSummary[];
  billingEvents: BillingEventSummary[];
  reviewSummary: ReviewSummary;
  evaluationRuns: EvaluationRunSummary[];
  shotReviews: ShotReviewSummary[];
  recentChanges: RecentChangeSummary[];
};
