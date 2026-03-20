import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const scriptPath = join(process.cwd(), "tooling", "scripts", "demo_seed.mjs");

test("buildPhase1DemoScenarios returns the fixed phase1 scenario matrix", async () => {
  const module = await import(pathToFileURL(scriptPath).href);
  const scenarios = module.buildPhase1DemoScenarios();

  assert.deepEqual(Object.keys(scenarios).sort(), [
    "admin",
    "creatorImport",
    "creatorShot",
  ]);
  assert.deepEqual(Object.keys(scenarios.admin).sort(), ["failure", "success"]);
  assert.deepEqual(Object.keys(scenarios.creatorShot).sort(), ["failure", "success"]);
  assert.deepEqual(Object.keys(scenarios.creatorImport).sort(), ["failure", "success"]);

  assert.equal(scenarios.admin.success.budgetSnapshot.projectId, "project-live-1");
  assert.equal(scenarios.admin.success.reviewSummary.shotExecutionId, "shot-exec-live-1");
  assert.equal(scenarios.creatorShot.success.workbench.shotExecution.shotId, "shot-live-1");
  assert.equal(scenarios.creatorImport.success.importBatch.id, "batch-live-1");
  assert.equal(scenarios.creatorImport.success.items[0].assetId, "asset-live-1");
});

test("demo_seed cli writes the deterministic json artifact", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "hualala-demo-seed-"));

  try {
    const result = spawnSync(process.execPath, [scriptPath, outputDir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);

    const written = JSON.parse(readFileSync(join(outputDir, "phase1-demo.json"), "utf8"));
    assert.equal(written.admin.success.budgetSnapshot.projectId, "project-live-1");
    assert.equal(
      written.creatorShot.failure.workbench.shotExecution.id,
      "shot-exec-live-1",
    );
    assert.equal(
      written.creatorImport.success.afterSelect.shotExecutions[0].primaryAssetId,
      "asset-live-1",
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
