import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const scriptPath = join(process.cwd(), "tooling", "scripts", "backend_seed.mjs");

test("seedPhase1Backend returns generated ids and urls from public APIs", async () => {
  const requests = [];
  let counter = 0;
  const server = createServer(async (req, res) => {
    const body = [];
    for await (const chunk of req) {
      body.push(chunk);
    }
    const payload = Buffer.concat(body).toString("utf8");
    requests.push({ url: req.url, payload });
    counter += 1;

    const respond = (value) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };

    switch (req.url) {
      case "/hualala.project.v1.ProjectService/CreateProject":
        respond({ project: { projectId: `project-${counter}`, orgId: "org-1", title: "P" } });
        break;
      case "/hualala.project.v1.ProjectService/CreateEpisode":
        respond({ episode: { episodeId: `episode-${counter}`, projectId: "project-1", title: "E", episodeNumber: 1 } });
        break;
      case "/hualala.content.v1.ContentService/CreateScene":
        respond({ scene: { id: `scene-${counter}`, episodeId: "episode-1", code: "SCENE-001", title: "S" } });
        break;
      case "/hualala.content.v1.ContentService/CreateShot":
        respond({ shot: { id: `shot-${counter}`, sceneId: "scene-1", code: "SCENE-001-SHOT-001", title: "SH" } });
        break;
      case "/hualala.content.v1.ContentService/CreateContentSnapshot":
        respond({ snapshot: { id: `snapshot-${counter}` } });
        break;
      case "/hualala.billing.v1.BillingService/UpdateBudgetPolicy":
        respond({ budgetPolicy: { id: `budget-${counter}`, projectId: "project-1", orgId: "org-1", limitCents: 120000 } });
        break;
      case "/hualala.execution.v1.ExecutionService/StartShotExecutionRun":
        respond({ run: { id: `run-${counter}`, shotExecutionId: `shot-exec-${counter}` } });
        break;
      case "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks":
        respond({ passedChecks: ["candidate_assets_present"], failedChecks: [] });
        break;
      case "/hualala.asset.v1.AssetService/CreateImportBatch":
        respond({ importBatch: { id: `import-batch-${counter}`, projectId: "project-1", orgId: "org-1", sourceType: "upload_session", status: "pending" } });
        break;
      case "/hualala.review.v1.ReviewService/CreateEvaluationRun":
        respond({ evaluationRun: { id: `evaluation-${counter}`, shotExecutionId: "shot-exec-1", status: "passed" } });
        break;
      case "/hualala.review.v1.ReviewService/CreateShotReview":
        respond({ shotReview: { id: `review-${counter}`, shotExecutionId: "shot-exec-1", conclusion: "approved", commentLocale: "zh-CN" } });
        break;
      case "/upload/sessions":
        respond({ session_id: `upload-session-${counter}` });
        break;
      case "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset":
        respond({ shotExecution: { id: "shot-exec-1", status: "primary_selected", primaryAssetId: "media-asset-1" } });
        break;
      default:
        if (req.url?.startsWith("/upload/sessions/") && req.url.endsWith("/complete")) {
          respond({ asset_id: `media-asset-${counter}` });
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ error: req.url }));
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const module = await import(pathToFileURL(scriptPath).href);
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const result = await module.seedPhase1Backend({ baseUrl, fetchFn: fetch });

    assert.ok(result.admin.projectId.startsWith("project-"));
    assert.ok(result.admin.shotExecutionId.startsWith("shot-exec-"));
    assert.ok(result.creatorShot.shotId.startsWith("shot-"));
    assert.ok(result.creatorImport.importBatchId.startsWith("import-batch-"));
    assert.match(result.urls.admin, /\?projectId=.*&shotExecutionId=.*/);
    assert.ok(requests.some((entry) => entry.url === "/hualala.project.v1.ProjectService/CreateEpisode"));
    assert.ok(requests.some((entry) => entry.url === "/hualala.content.v1.ContentService/CreateScene"));
    assert.ok(requests.some((entry) => entry.url === "/hualala.content.v1.ContentService/CreateShot"));
  } finally {
    server.close();
  }
});

test("backend_seed cli writes the generated backend seed artifact", async () => {
  const server = createServer(async (req, res) => {
    const body = [];
    for await (const chunk of req) {
      body.push(chunk);
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    const url = req.url ?? "";
    if (url === "/hualala.project.v1.ProjectService/CreateProject") {
      res.end(JSON.stringify({ project: { projectId: "project-10", orgId: "org-1", title: "P" } }));
      return;
    }
    if (url === "/hualala.project.v1.ProjectService/CreateEpisode") {
      res.end(JSON.stringify({ episode: { episodeId: "episode-10", projectId: "project-10", title: "E", episodeNumber: 1 } }));
      return;
    }
    if (url === "/hualala.content.v1.ContentService/CreateScene") {
      res.end(JSON.stringify({ scene: { id: "scene-10", episodeId: "episode-10", code: "SCENE-010", title: "S" } }));
      return;
    }
    if (url === "/hualala.content.v1.ContentService/CreateShot") {
      res.end(JSON.stringify({ shot: { id: "shot-10", sceneId: "scene-10", code: "SCENE-010-SHOT-010", title: "SH" } }));
      return;
    }
    if (url === "/hualala.content.v1.ContentService/CreateContentSnapshot") {
      res.end(JSON.stringify({ snapshot: { id: "snapshot-10" } }));
      return;
    }
    if (url === "/hualala.billing.v1.BillingService/UpdateBudgetPolicy") {
      res.end(JSON.stringify({ budgetPolicy: { id: "budget-10", projectId: "project-10", orgId: "org-1", limitCents: 120000 } }));
      return;
    }
    if (url === "/hualala.execution.v1.ExecutionService/StartShotExecutionRun") {
      const count = (globalThis.__seedRunCount__ = (globalThis.__seedRunCount__ ?? 0) + 1);
      res.end(JSON.stringify({ run: { id: `run-${count}`, shotExecutionId: `shot-exec-${count}` } }));
      return;
    }
    if (url === "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks") {
      res.end(JSON.stringify({ passedChecks: ["candidate_assets_present"], failedChecks: [] }));
      return;
    }
    if (url === "/hualala.asset.v1.AssetService/CreateImportBatch") {
      const count = (globalThis.__seedBatchCount__ = (globalThis.__seedBatchCount__ ?? 0) + 1);
      res.end(JSON.stringify({ importBatch: { id: `import-batch-${count}`, projectId: "project-10", orgId: "org-1", sourceType: "upload_session", status: "pending" } }));
      return;
    }
    if (url === "/hualala.review.v1.ReviewService/CreateEvaluationRun") {
      res.end(JSON.stringify({ evaluationRun: { id: "evaluation-10", shotExecutionId: "shot-exec-1", status: "passed" } }));
      return;
    }
    if (url === "/hualala.review.v1.ReviewService/CreateShotReview") {
      res.end(JSON.stringify({ shotReview: { id: "review-10", shotExecutionId: "shot-exec-1", conclusion: "approved", commentLocale: "zh-CN" } }));
      return;
    }
    if (url === "/upload/sessions") {
      const count = (globalThis.__seedUploadCount__ = (globalThis.__seedUploadCount__ ?? 0) + 1);
      res.end(JSON.stringify({ session_id: `upload-session-${count}` }));
      return;
    }
    if (url.startsWith("/upload/sessions/") && url.endsWith("/complete")) {
      const count = globalThis.__seedUploadCount__ ?? 1;
      res.end(JSON.stringify({ asset_id: `media-asset-${count}` }));
      return;
    }
    if (url === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
      res.end(JSON.stringify({ shotExecution: { id: "shot-exec-1", status: "primary_selected", primaryAssetId: "media-asset-1" } }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: url }));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const outputDir = mkdtempSync(join(tmpdir(), "hualala-backend-seed-"));

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, [scriptPath, "--base-url", baseUrl, "--output-dir", outputDir], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const [code] = await once(child, "close");
    assert.equal(code, 0, stderr || stdout);

    const written = JSON.parse(readFileSync(join(outputDir, "phase1-backend-seed.json"), "utf8"));
    assert.equal(written.admin.projectId, "project-10");
    assert.equal(written.creatorShot.shotId, "shot-10");
    assert.equal(written.creatorImport.importBatchId, "import-batch-2");
    assert.match(written.urls.creatorImport, /\?importBatchId=import-batch-2$/);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
    server.close();
    delete globalThis.__seedRunCount__;
    delete globalThis.__seedBatchCount__;
    delete globalThis.__seedUploadCount__;
  }
});

test("seedPhase1Backend surfaces backend request failures", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/hualala.project.v1.ProjectService/CreateProject") {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "unavailable" }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const module = await import(pathToFileURL(scriptPath).href);
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await assert.rejects(
      () => module.seedPhase1Backend({ baseUrl, fetchFn: fetch }),
      /backend-seed: request failed/,
    );
  } finally {
    server.close();
  }
});
