import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
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

function splitSetCookieHeader(value) {
  if (!value) {
    return [];
  }

  const cookies = [];
  let start = 0;
  let inExpires = false;
  for (let index = 0; index < value.length; index += 1) {
    const slice = value.slice(index, index + 8).toLowerCase();
    if (slice === "expires=") {
      inExpires = true;
      continue;
    }
    if (inExpires && value[index] === ";") {
      inExpires = false;
      continue;
    }
    if (!inExpires && value[index] === ",") {
      cookies.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  cookies.push(value.slice(start).trim());
  return cookies.filter(Boolean);
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  return splitSetCookieHeader(response.headers.get("set-cookie"));
}

function buildCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((entry) => entry.split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookieHeaders(existingCookieHeader, sessionCookieHeader) {
  const existing = existingCookieHeader?.trim();
  if (!existing) {
    return sessionCookieHeader;
  }
  if (!sessionCookieHeader) {
    return existing;
  }
  return `${existing}; ${sessionCookieHeader}`;
}

function withCookieHeader(fetchFn, cookieHeader) {
  return (url, init = {}) => {
    const mergedHeaders = {
      ...(init.headers ?? {}),
      Cookie: mergeCookieHeaders(init.headers?.Cookie ?? init.headers?.cookie, cookieHeader),
    };
    return fetchFn(url, {
      ...init,
      headers: mergedHeaders,
    });
  };
}

async function startDevSession(fetchFn, baseUrl) {
  const response = await fetchFn(`${baseUrl}/hualala.auth.v1.AuthService/StartDevSession`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Connect-Protocol-Version": "1",
    },
    body: JSON.stringify({}),
  });
  await assertOk(response, "backend-seed: failed to start dev session");
  const cookieHeader = buildCookieHeader(getSetCookieHeaders(response));
  if (!cookieHeader) {
    throw new Error("backend-seed: start dev session did not return session cookies");
  }
  return cookieHeader;
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

async function verifyShotWorkbenchReachable(fetchFn, baseUrl, { shotId, shotExecutionId }) {
  const path = "/hualala.execution.v1.ExecutionService/GetShotWorkbench";
  let payload;

  try {
    payload = await postConnect(fetchFn, baseUrl, path, {
      shotId,
      displayLocale: "zh-CN",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `backend-seed: GetShotWorkbench verification failed for shotId=${shotId} expectedShotExecutionId=${shotExecutionId} via ${path}; 可能连接到旧 backend 或错误数据库。原始错误: ${detail}`,
    );
  }

  const verifiedExecution = payload?.workbench?.shotExecution;
  if (!verifiedExecution?.id) {
    throw new Error(
      `backend-seed: GetShotWorkbench verification failed for shotId=${shotId} expectedShotExecutionId=${shotExecutionId} via ${path}; workbench.shotExecution.id is missing，可能连接到旧 backend 或错误数据库。`,
    );
  }
  if (verifiedExecution.shotId !== shotId) {
    throw new Error(
      `backend-seed: GetShotWorkbench verification failed for shotId=${shotId} expectedShotExecutionId=${shotExecutionId} via ${path}; returned shotId=${verifiedExecution.shotId ?? ""}，可能连接到旧 backend 或错误数据库。`,
    );
  }
  if (shotExecutionId && verifiedExecution.id !== shotExecutionId) {
    throw new Error(
      `backend-seed: GetShotWorkbench verification failed for shotId=${shotId} expectedShotExecutionId=${shotExecutionId} via ${path}; returned shotExecutionId=${verifiedExecution.id}，可能连接到旧 backend 或错误数据库。`,
    );
  }
}

async function runDevBootstrap({
  spawnFn = spawn,
  cwd = repoRoot,
  env = process.env,
} = {}) {
  if (env.DB_DRIVER === "memory" || !env.DATABASE_URL) {
    return {
      organization_id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      role_id: "33333333-3333-3333-3333-333333333333",
      membership_id: "44444444-4444-4444-4444-444444444444",
    };
  }

  if (env.CODEX_BACKEND_BOOTSTRAP_TEST_STUB === "1") {
    return {
      organization_id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      role_id: "33333333-3333-3333-3333-333333333333",
      membership_id: "44444444-4444-4444-4444-444444444444",
    };
  }

  const child = spawnFn("go", ["run", "./apps/backend/cmd/bootstrapdev"], {
    cwd,
    env,
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

  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", resolveExit);
  });

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `backend bootstrap failed with code ${exitCode}`);
  }

  return JSON.parse(stdout);
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

  await verifyShotWorkbenchReachable(fetchFn, baseUrl, {
    shotId,
    shotExecutionId,
  });

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
  bootstrapFn = runDevBootstrap,
  outputDir,
  adminOrigin = "http://127.0.0.1:4173",
  creatorOrigin = "http://127.0.0.1:4174",
} = {}) {
  const resolvedBaseUrl = trimTrailingSlash(baseUrl);
  const bootstrap = await bootstrapFn();
  const orgId = bootstrap.organization_id;
  const operatorId = bootstrap.user_id;
  const sessionCookieHeader = await startDevSession(fetchFn, resolvedBaseUrl);
  const sessionFetchFn = withCookieHeader(fetchFn, sessionCookieHeader);

  const adminDataset = await createShotDataset({
    fetchFn: sessionFetchFn,
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
    fetchFn: sessionFetchFn,
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
      operatorId,
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
