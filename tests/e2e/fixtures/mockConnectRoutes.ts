import type { Page, Route } from "@playwright/test";

type AdminMode = "success" | "failure";
type CreatorShotMode = "success" | "failure";
type CreatorImportMode = "success" | "failure";

type MockConnectScenario = {
  admin?: AdminMode;
  creatorShot?: CreatorShotMode;
  creatorImport?: CreatorImportMode;
};

type AdminState = {
  budgetSnapshot: {
    projectId: string;
    limitCents: number;
    reservedCents: number;
    remainingBudgetCents: number;
  };
  usageRecords: Array<{ id: string; meter: string; amountCents: number }>;
  billingEvents: Array<{ id: string; eventType: string; amountCents: number }>;
  reviewSummary: { shotExecutionId: string; latestConclusion: string };
  evaluationRuns: Array<{ id: string; status: string; failedChecks: string[] }>;
  shotReviews: Array<{ id: string; conclusion: string }>;
};

type CreatorShotState = {
  workbench: {
    shotExecution: {
      id: string;
      shotId: string;
      status: string;
      primaryAssetId: string;
    };
    candidateAssets: Array<{ id: string; assetId: string }>;
    reviewSummary: { latestConclusion: string };
    latestEvaluationRun?: { id: string; status: string };
  };
};

type CreatorImportState = {
  importBatch: {
    id: string;
    status: string;
    sourceType: string;
  };
  uploadSessions: Array<{ id: string; status: string }>;
  items: Array<{ id: string; status: string; assetId: string }>;
  candidateAssets: Array<{ id: string; assetId: string }>;
  shotExecutions: Array<{ id: string; status: string; primaryAssetId: string }>;
};

function jsonResponse(status: number, payload: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatCurrency(cents: number) {
  return `${(cents / 100).toFixed(2)} 元`;
}

function withRecentChanges(state: AdminState) {
  const latestBillingEvent = state.billingEvents[0];
  const latestEvaluation = state.evaluationRuns[0];
  const latestReview = state.shotReviews[0];

  return {
    ...state,
    recentChanges: [
      {
        id: `billing-${latestBillingEvent?.id ?? "latest"}`,
        kind: "billing",
        title: "最近计费事件",
        detail: `${latestBillingEvent?.eventType ?? "pending"} · ${formatCurrency(latestBillingEvent?.amountCents ?? 0)}`,
        tone: "info",
      },
      {
        id: `evaluation-${latestEvaluation?.id ?? "latest"}`,
        kind: "evaluation",
        title: "最近评估结果",
        detail: `${latestEvaluation?.status ?? "pending"} · ${latestEvaluation?.failedChecks.length ?? 0} 个失败检查`,
        tone: latestEvaluation?.status === "passed" ? "success" : "warning",
      },
      {
        id: `review-${latestReview?.id ?? "latest"}`,
        kind: "review",
        title: "最近评审结论",
        detail: latestReview?.conclusion ?? state.reviewSummary.latestConclusion,
        tone:
          (latestReview?.conclusion ?? state.reviewSummary.latestConclusion) === "approved"
            ? "success"
            : "warning",
      },
    ],
  };
}

const adminInitialState: AdminState = {
  budgetSnapshot: {
    projectId: "project-live-1",
    limitCents: 120000,
    reservedCents: 18000,
    remainingBudgetCents: 102000,
  },
  usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
  billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
  reviewSummary: {
    shotExecutionId: "shot-exec-live-1",
    latestConclusion: "approved",
  },
  evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
  shotReviews: [{ id: "review-1", conclusion: "approved" }],
};

const adminUpdatedState: AdminState = {
  ...adminInitialState,
  budgetSnapshot: {
    ...adminInitialState.budgetSnapshot,
    limitCents: 150000,
    remainingBudgetCents: 132000,
  },
};

const creatorShotInitialState: CreatorShotState = {
  workbench: {
    shotExecution: {
      id: "shot-exec-live-1",
      shotId: "shot-live-1",
      status: "candidate_ready",
      primaryAssetId: "asset-live-1",
    },
    candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
    reviewSummary: {
      latestConclusion: "pending",
    },
    latestEvaluationRun: {
      id: "eval-live-1",
      status: "pending",
    },
  },
};

const creatorShotAfterGateState: CreatorShotState = {
  workbench: {
    ...creatorShotInitialState.workbench,
    reviewSummary: {
      latestConclusion: "passed",
    },
    latestEvaluationRun: {
      id: "eval-live-1",
      status: "passed",
    },
  },
};

const creatorShotAfterSubmitState: CreatorShotState = {
  workbench: {
    ...creatorShotAfterGateState.workbench,
    shotExecution: {
      ...creatorShotAfterGateState.workbench.shotExecution,
      status: "submitted_for_review",
    },
    reviewSummary: {
      latestConclusion: "approved",
    },
  },
};

const creatorImportInitialState: CreatorImportState = {
  importBatch: {
    id: "batch-live-1",
    status: "matched_pending_confirm",
    sourceType: "upload_session",
  },
  uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
  items: [{ id: "item-live-1", status: "matched_pending_confirm", assetId: "asset-live-1" }],
  candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
  shotExecutions: [{ id: "shot-exec-live-1", status: "candidate_ready", primaryAssetId: "" }],
};

const creatorImportAfterConfirmState: CreatorImportState = {
  ...creatorImportInitialState,
  importBatch: {
    ...creatorImportInitialState.importBatch,
    status: "confirmed",
  },
  items: [{ id: "item-live-1", status: "confirmed", assetId: "asset-live-1" }],
  shotExecutions: [
    { id: "shot-exec-live-1", status: "primary_selected", primaryAssetId: "asset-live-1" },
  ],
};

const creatorImportAfterSelectState = clone(creatorImportAfterConfirmState);

function buildAdminPayload(pathname: string, state: AdminState) {
  switch (pathname) {
    case "/hualala.billing.v1.BillingService/GetBudgetSnapshot":
      return { budgetSnapshot: state.budgetSnapshot };
    case "/hualala.billing.v1.BillingService/ListUsageRecords":
      return { usageRecords: state.usageRecords };
    case "/hualala.billing.v1.BillingService/ListBillingEvents":
      return { billingEvents: state.billingEvents };
    case "/hualala.review.v1.ReviewService/GetShotReviewSummary":
      return { summary: state.reviewSummary };
    case "/hualala.review.v1.ReviewService/ListEvaluationRuns":
      return { evaluationRuns: state.evaluationRuns };
    case "/hualala.review.v1.ReviewService/ListShotReviews":
      return { shotReviews: state.shotReviews };
    default:
      return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockConnectRoutes(page: Page, scenario: MockConnectScenario) {
  let adminState = withRecentChanges(clone(adminInitialState));
  let creatorShotState = clone(creatorShotInitialState);
  let creatorImportState = clone(creatorImportInitialState);

  await page.route(/\/hualala\..+/, async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (scenario.admin) {
      if (pathname === "/hualala.billing.v1.BillingService/UpdateBudgetPolicy") {
        await delay(120);
        if (scenario.admin === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }

        adminState = withRecentChanges(clone(adminUpdatedState));
        await route.fulfill(
          jsonResponse(200, {
            budgetPolicy: {
              id: "budget-1",
              orgId: "org-live-1",
              projectId: adminUpdatedState.budgetSnapshot.projectId,
              limitCents: adminUpdatedState.budgetSnapshot.limitCents,
              reservedCents: adminUpdatedState.budgetSnapshot.reservedCents,
            },
          }),
        );
        return;
      }

      const adminPayload = buildAdminPayload(pathname, adminState);
      if (adminPayload) {
        await route.fulfill(jsonResponse(200, adminPayload));
        return;
      }
    }

    if (scenario.creatorShot) {
      if (pathname === "/hualala.execution.v1.ExecutionService/GetShotWorkbench") {
        await route.fulfill(jsonResponse(200, creatorShotState));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks") {
        await delay(120);
        if (scenario.creatorShot === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorShotState = clone(creatorShotAfterGateState);
        await route.fulfill(
          jsonResponse(200, {
            passedChecks: ["asset_selected", "review_ready"],
            failedChecks: ["copyright_missing"],
          }),
        );
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SubmitShotForReview") {
        await delay(120);
        creatorShotState = clone(creatorShotAfterSubmitState);
        await route.fulfill(jsonResponse(200, {}));
        return;
      }
    }

    if (scenario.creatorImport) {
      if (pathname === "/hualala.asset.v1.AssetService/GetImportBatchWorkbench") {
        await route.fulfill(jsonResponse(200, creatorImportState));
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems") {
        await delay(120);
        if (scenario.creatorImport === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorImportState = clone(creatorImportAfterConfirmState);
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
        await delay(120);
        if (scenario.creatorImport === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorImportState = clone(creatorImportAfterSelectState);
        await route.fulfill(jsonResponse(200, {}));
        return;
      }
    }

    await route.continue();
  });
}
