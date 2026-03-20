import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildPhase1DemoScenarios() {
  const adminSuccess = {
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
    updatedBudgetSnapshot: {
      projectId: "project-live-1",
      limitCents: 150000,
      reservedCents: 18000,
      remainingBudgetCents: 132000,
    },
  };

  const creatorShotSuccess = {
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
    afterGate: {
      workbench: {
        shotExecution: {
          id: "shot-exec-live-1",
          shotId: "shot-live-1",
          status: "candidate_ready",
          primaryAssetId: "asset-live-1",
        },
        candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
        reviewSummary: {
          latestConclusion: "passed",
        },
        latestEvaluationRun: {
          id: "eval-live-1",
          status: "passed",
        },
      },
      gateResult: {
        passedChecks: ["asset_selected", "review_ready"],
        failedChecks: ["copyright_missing"],
      },
    },
    afterSubmit: {
      workbench: {
        shotExecution: {
          id: "shot-exec-live-1",
          shotId: "shot-live-1",
          status: "submitted_for_review",
          primaryAssetId: "asset-live-1",
        },
        candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
        reviewSummary: {
          latestConclusion: "approved",
        },
        latestEvaluationRun: {
          id: "eval-live-1",
          status: "passed",
        },
      },
    },
  };

  const creatorImportSuccess = {
    importBatch: {
      id: "batch-live-1",
      status: "matched_pending_confirm",
      sourceType: "upload_session",
    },
    uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
    items: [{ id: "item-live-1", status: "matched_pending_confirm", assetId: "asset-live-1" }],
    candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
    shotExecutions: [{ id: "shot-exec-live-1", status: "candidate_ready", primaryAssetId: "" }],
    afterConfirm: {
      importBatch: {
        id: "batch-live-1",
        status: "confirmed",
        sourceType: "upload_session",
      },
      uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
      items: [{ id: "item-live-1", status: "confirmed", assetId: "asset-live-1" }],
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      shotExecutions: [
        { id: "shot-exec-live-1", status: "primary_selected", primaryAssetId: "asset-live-1" },
      ],
    },
    afterSelect: {
      importBatch: {
        id: "batch-live-1",
        status: "confirmed",
        sourceType: "upload_session",
      },
      uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
      items: [{ id: "item-live-1", status: "confirmed", assetId: "asset-live-1" }],
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      shotExecutions: [
        { id: "shot-exec-live-1", status: "primary_selected", primaryAssetId: "asset-live-1" },
      ],
    },
  };

  return {
    admin: {
      success: adminSuccess,
      failure: clone(adminSuccess),
    },
    creatorShot: {
      success: creatorShotSuccess,
      failure: clone(creatorShotSuccess),
    },
    creatorImport: {
      success: creatorImportSuccess,
      failure: clone(creatorImportSuccess),
    },
  };
}

function main() {
  const outputDir = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(repoRoot, "_tmp_demo_seed");

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, "phase1-demo.json");
  writeFileSync(outputPath, JSON.stringify(buildPhase1DemoScenarios(), null, 2));
  process.stdout.write(`${outputPath}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

function pathToFileURL(path) {
  return new URL(`file://${path.replaceAll("\\", "/")}`);
}
