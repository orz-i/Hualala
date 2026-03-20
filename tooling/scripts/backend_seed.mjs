import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function assertOk(response, label) {
  if (response.ok) {
    return response;
  }
  const body = await response.text();
  throw new Error(`${label} (${response.status}): ${body}`);
}

async function postConnect(fetchFn, baseUrl, path, body) {
  const response = await fetchFn(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Connect-Protocol-Version": "1",
    },
    body: JSON.stringify(body),
  });
  await assertOk(response, `backend-seed: request failed for ${path}`);
  return response.json();
}

async function postJson(fetchFn, baseUrl, path, body) {
  const response = await fetchFn(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  await assertOk(response, `backend-seed: request failed for ${path}`);
  return response.json();
}

async function createShotDataset({ fetchFn, baseUrl, orgId, operatorId, projectTitle, episodeTitle, sceneTitle, shotTitle, snapshotBody, budgetLimitCents, estimatedCostCents, shouldSelectPrimary, shouldCreateReview }) {
  const projectPayload = await postConnect(
    fetchFn,
    baseUrl,
    "/hualala.project.v1.ProjectService/CreateProject",
    {
      orgId,
      ownerUserId: operatorId,
      title: projectTitle,
    },
  );
  const projectId = projectPayload.project?.projectId;

  const episodePayload = await postConnect(
    fetchFn,
    baseUrl,
    "/hualala.project.v1.ProjectService/CreateEpisode",
    {
      projectId,
      episodeNumber: 1,
      title: episodeTitle,
    },
  );
  const episodeId = episodePayload.episode?.episodeId;

  const scenePayload = await postConnect(
    fetchFn,
    baseUrl,
    "/hualala.content.v1.ContentService/CreateScene",
    {
      projectId,
      episodeId,
      sceneNumber: 1,
      title: sceneTitle,
    },
  );
  const sceneId = scenePayload.scene?.id;

  const shotPayload = await postConnect(
    fetchFn,
    baseUrl,
    "/hualala.content.v1.ContentService/CreateShot",
    {
      sceneId,
      shotNumber: 1,
      title: shotTitle,
    },
  );
  const shotId = shotPayload.shot?.id;

  await postConnect(fetchFn, baseUrl, "/hualala.content.v1.ContentService/CreateContentSnapshot", {
    ownerType: "shot",
    ownerId: shotId,
    contentLocale: "zh-CN",
    body: snapshotBody,
  });

  await postConnect(fetchFn, baseUrl, "/hualala.billing.v1.BillingService/UpdateBudgetPolicy", {
    orgId,
    projectId,
    limitCents: budgetLimitCents,
  });

  const runPayload = await postConnect(
    fetchFn,
    baseUrl,
    "/hualala.execution.v1.ExecutionService/StartShotExecutionRun",
    {
      shotId,
      operatorId,
      projectId,
      orgId,
      triggerType: "manual_seed",
      estimatedCostCents,
    },
  );
  const shotExecutionId = runPayload.run?.shotExecutionId;

  const importBatchPayload = await postConnect(
    fetchFn,
    baseUrl,
    "/hualala.asset.v1.AssetService/CreateImportBatch",
    {
      projectId,
      orgId,
      operatorId,
      sourceType: "upload_session",
    },
  );
  const importBatchId = importBatchPayload.importBatch?.id;

  const uploadSessionPayload = await postJson(fetchFn, baseUrl, "/upload/sessions", {
    organization_id: orgId,
    project_id: projectId,
    import_batch_id: importBatchId,
    file_name: `${shotTitle}.png`,
    checksum: `sha256:${shotTitle}`,
    size_bytes: 2048,
    expires_in_seconds: 600,
  });
  const uploadSessionId = uploadSessionPayload.session_id;

  const completePayload = await postJson(
    fetchFn,
    baseUrl,
    `/upload/sessions/${uploadSessionId}/complete`,
    {
      shot_execution_id: shotExecutionId,
      variant_type: "original",
      mime_type: "image/png",
      locale: "zh-CN",
      rights_status: "clear",
      ai_annotated: true,
      width: 1920,
      height: 1080,
    },
  );
  const assetId = completePayload.asset_id;

  if (shouldSelectPrimary) {
    await postConnect(fetchFn, baseUrl, "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset", {
      shotExecutionId,
      assetId,
    });
  }

  if (shouldCreateReview) {
    const gatePayload = await postConnect(
      fetchFn,
      baseUrl,
      "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks",
      {
        shotExecutionId,
      },
    );
    await postConnect(fetchFn, baseUrl, "/hualala.review.v1.ReviewService/CreateEvaluationRun", {
      shotExecutionId,
      passedChecks: gatePayload.passedChecks ?? [],
      failedChecks: gatePayload.failedChecks ?? [],
    });
    await postConnect(fetchFn, baseUrl, "/hualala.review.v1.ReviewService/CreateShotReview", {
      shotExecutionId,
      conclusion: "approved",
      commentLocale: "zh-CN",
      comment: "seeded review",
    });
  }

  return {
    projectId,
    episodeId,
    sceneId,
    shotId,
    shotExecutionId,
    importBatchId,
    uploadSessionId,
    assetId,
  };
}

export async function seedPhase1Backend({
  baseUrl = "http://127.0.0.1:8080",
  fetchFn = fetch,
  outputDir,
  adminOrigin = "http://127.0.0.1:4173",
  creatorOrigin = "http://127.0.0.1:4174",
} = {}) {
  const resolvedBaseUrl = trimTrailingSlash(baseUrl);
  const orgId = "org-local-1";
  const operatorId = "user-local-1";

  const adminDataset = await createShotDataset({
    fetchFn,
    baseUrl: resolvedBaseUrl,
    orgId,
    operatorId,
    projectTitle: "Phase1 Admin Project",
    episodeTitle: "第一集",
    sceneTitle: "开场场景",
    shotTitle: "主角入场",
    snapshotBody: "主角推门进入客厅，镜头平移跟随。",
    budgetLimitCents: 120000,
    estimatedCostCents: 1800,
    shouldSelectPrimary: true,
    shouldCreateReview: true,
  });

  const importDataset = await createShotDataset({
    fetchFn,
    baseUrl: resolvedBaseUrl,
    orgId,
    operatorId,
    projectTitle: "Phase1 Import Project",
    episodeTitle: "第二集",
    sceneTitle: "导入场景",
    shotTitle: "候选素材镜头",
    snapshotBody: "镜头等待候选素材匹配。",
    budgetLimitCents: 80000,
    estimatedCostCents: 1200,
    shouldSelectPrimary: false,
    shouldCreateReview: false,
  });

  const result = {
    admin: {
      orgId,
      projectId: adminDataset.projectId,
      shotExecutionId: adminDataset.shotExecutionId,
    },
    creatorShot: {
      projectId: adminDataset.projectId,
      shotId: adminDataset.shotId,
      shotExecutionId: adminDataset.shotExecutionId,
    },
    creatorImport: {
      projectId: importDataset.projectId,
      shotId: importDataset.shotId,
      shotExecutionId: importDataset.shotExecutionId,
      importBatchId: importDataset.importBatchId,
    },
    urls: {
      admin: `${trimTrailingSlash(adminOrigin)}?projectId=${encodeURIComponent(adminDataset.projectId)}&shotExecutionId=${encodeURIComponent(adminDataset.shotExecutionId)}&orgId=${encodeURIComponent(orgId)}`,
      creatorShot: `${trimTrailingSlash(creatorOrigin)}?shotId=${encodeURIComponent(adminDataset.shotId)}`,
      creatorImport: `${trimTrailingSlash(creatorOrigin)}?importBatchId=${encodeURIComponent(importDataset.importBatchId)}`,
    },
  };

  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, "phase1-backend-seed.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
  }

  return result;
}

function parseCliArgs(argv) {
  const args = {
    baseUrl: "http://127.0.0.1:8080",
    outputDir: join(repoRoot, "_tmp_demo_seed"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--base-url") {
      args.baseUrl = argv[index + 1] ?? args.baseUrl;
      index += 1;
      continue;
    }
    if (current === "--output-dir") {
      args.outputDir = argv[index + 1] ?? args.outputDir;
      index += 1;
    }
  }

  return args;
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  const result = await seedPhase1Backend({
    baseUrl: args.baseUrl,
    outputDir: args.outputDir,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
