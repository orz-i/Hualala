import test from "node:test";
import assert from "node:assert/strict";

test("governance helpers recompute member counts and capabilities from roles", async () => {
  const { buildGovernanceBaseline, syncGovernanceState, withRecentChanges } = await import(
    "../../tests/e2e/fixtures/mock-connect/governance.ts"
  );

  const baseline = buildGovernanceBaseline();
  const updated = syncGovernanceState({
    ...baseline,
    members: [...baseline.members, { memberId: "member-2", orgId: baseline.currentSession.orgId, userId: "user-2", roleId: "role-viewer" }],
    currentSession: {
      ...baseline.currentSession,
      roleId: "role-viewer",
    },
  });

  assert.equal(updated.roles.find((role) => role.roleId === "role-admin")?.memberCount, 1);
  assert.equal(updated.roles.find((role) => role.roleId === "role-viewer")?.memberCount, 1);
  assert.deepEqual(updated.currentSession.permissionCodes, ["session.read", "user.preferences.write"]);
  assert.deepEqual(updated.capabilities, {
    canManageRoles: false,
    canManageMembers: false,
    canManageOrgSettings: false,
    canManageUserPreferences: true,
  });

  const withChanges = withRecentChanges({
    budgetSnapshot: { projectId: "project-1", limitCents: 500, reservedCents: 120, remainingBudgetCents: 380 },
    usageRecords: [],
    billingEvents: [{ id: "billing-1", eventType: "reserve", amountCents: 120 }],
    reviewSummary: { shotExecutionId: "shot-execution-1", latestConclusion: "approved" },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
    governance: updated,
  });

  assert.equal(withChanges.recentChanges[0]?.kind, "billing");
  assert.match(withChanges.recentChanges[0]?.detail ?? "", /1\.20 元/);
  assert.equal(withChanges.recentChanges[2]?.tone, "success");
});

test("workflow helpers preserve wire shape across retry and cancel transitions", async () => {
  const {
    buildInitialWorkflowRuns,
    retryWorkflowRun,
    cancelWorkflowRun,
    summarizeWorkflowRun,
  } = await import("../../tests/e2e/fixtures/mock-connect/workflow.ts");

  const initial = buildInitialWorkflowRuns({ projectId: "project-1", resourceId: "shot-execution-1" });
  assert.equal(initial[0]?.status, "failed");
  assert.equal(initial[0]?.steps[1]?.status, "failed");

  const retried = retryWorkflowRun(initial, "workflow-run-1");
  assert.equal(retried[0]?.attemptCount, 2);
  assert.equal(retried[0]?.status, "running");
  assert.equal(retried[0]?.steps[1]?.stepKey, "attempt_2.gateway");
  assert.equal(summarizeWorkflowRun(retried[0]).status, "running");

  const cancelled = cancelWorkflowRun(retried, "workflow-run-1");
  assert.equal(cancelled[0]?.status, "cancelled");
  assert.equal(cancelled[0]?.currentStep, "attempt_2.cancel");
  assert.equal(cancelled[0]?.steps.at(-1)?.stepKey, "attempt_2.cancel");
});

test("asset helpers keep import batch and provenance scope aligned", async () => {
  const {
    buildImportBatchSummary,
    buildImportBatchWorkbenchPayload,
    buildAssetProvenancePayload,
  } = await import("../../tests/e2e/fixtures/mock-connect/assets.ts");
  const { withGovernance } = await import("../../tests/e2e/fixtures/mock-connect/governance.ts");
  const { buildInitialWorkflowRuns } = await import("../../tests/e2e/fixtures/mock-connect/workflow.ts");

  const adminState = withGovernance({
    budgetSnapshot: { projectId: "project-1", limitCents: 500, reservedCents: 120, remainingBudgetCents: 380 },
    usageRecords: [],
    billingEvents: [],
    reviewSummary: { shotExecutionId: "shot-execution-1", latestConclusion: "approved" },
    evaluationRuns: [],
    shotReviews: [],
  });
  const creatorShotState = {
    workbench: {
      shotExecution: {
        id: "shot-execution-1",
        shotId: "shot-1",
        projectId: "project-1",
        orgId: adminState.governance.currentSession.orgId,
        status: "candidate_ready",
        primaryAssetId: "asset-1",
      },
      candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
      reviewSummary: { latestConclusion: "approved" },
      latestEvaluationRun: { id: "eval-1", status: "passed" },
    },
  };
  const creatorImportState = {
    importBatch: { id: "import-batch-1", status: "matched_pending_confirm", sourceType: "manual_upload" },
    uploadSessions: [{ id: "upload-session-1", status: "completed" }],
    items: [{ id: "item-1", status: "confirmed", assetId: "asset-1" }],
    candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
    shotExecutions: [{ id: "shot-execution-1", status: "candidate_ready", primaryAssetId: "asset-1" }],
  };
  const workflowRuns = buildInitialWorkflowRuns({ projectId: "project-1", resourceId: "shot-execution-1" });

  const summary = buildImportBatchSummary({ adminState, creatorImportState });
  assert.equal(summary.orgId, adminState.governance.currentSession.orgId);
  assert.equal(summary.projectId, adminState.budgetSnapshot.projectId);
  assert.equal(summary.confirmedItemCount, 1);

  const workbench = buildImportBatchWorkbenchPayload({
    adminState,
    creatorShotState,
    creatorImportState,
    workflowRuns,
  });
  assert.equal(workbench.importBatch.id, creatorImportState.importBatch.id);
  assert.equal(workbench.candidateAssets[0]?.sourceRunId, workflowRuns[0]?.id);
  assert.equal(workbench.shotExecutions[0]?.shotId, creatorShotState.workbench.shotExecution.shotId);

  const provenance = buildAssetProvenancePayload({
    adminState,
    creatorShotState,
    creatorImportState,
    workflowRuns,
    assetId: "asset-1",
  });
  assert.equal(provenance.asset.projectId, adminState.budgetSnapshot.projectId);
  assert.equal(provenance.importBatchId, creatorImportState.importBatch.id);
  assert.equal(provenance.shotExecutionId, creatorShotState.workbench.shotExecution.id);
  assert.equal(provenance.candidateAssetId, "candidate-1");
});

test("scenario initializer keeps admin workflow scope and mock session defaults stable", async () => {
  const { initializeMockConnectState } = await import("../../tests/e2e/fixtures/mock-connect/scenario.ts");

  const adminState = {
    budgetSnapshot: { projectId: "project-88", limitCents: 500, reservedCents: 120, remainingBudgetCents: 380 },
    usageRecords: [],
    billingEvents: [{ id: "billing-1", eventType: "reserve", amountCents: 120 }],
    reviewSummary: { shotExecutionId: "shot-execution-1", latestConclusion: "approved" },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
  };
  const creatorShotState = {
    workbench: {
      shotExecution: {
        id: "shot-execution-1",
        shotId: "shot-1",
        projectId: "project-from-shot",
        status: "candidate_ready",
        primaryAssetId: "asset-1",
      },
      candidateAssets: [],
      reviewSummary: { latestConclusion: "pending" },
    },
  };
  const creatorImportState = {
    importBatch: { id: "import-batch-1", status: "pending_review", sourceType: "manual_upload" },
    uploadSessions: [],
    items: [],
    candidateAssets: [],
    shotExecutions: [],
  };

  const initialized = initializeMockConnectState({
    scenario: { admin: "success" },
    phase1DemoScenarios: {
      admin: { success: adminState, failure: adminState },
      creatorShot: { success: creatorShotState, failure: creatorShotState },
      creatorImport: { success: creatorImportState, failure: creatorImportState },
    },
  });

  assert.equal(initialized.devSessionActive, false);
  assert.equal(initialized.adminState.governance.currentSession.orgId, "org-live-1");
  assert.equal(initialized.creatorShotWorkflowRuns[0]?.projectId, "project-from-shot");
  assert.equal(initialized.creatorShotWorkflowRuns[0]?.resourceId, "shot-execution-1");
});

test("model governance helpers preserve profile and prompt lifecycle transitions", async () => {
  const {
    buildModelGovernanceBaseline,
    createModelProfileState,
    updateModelProfileState,
    setModelProfileStatusState,
    createPromptTemplateVersionState,
    updatePromptTemplateDraftState,
    setPromptTemplateStatusState,
    listContextBundlesState,
    getContextBundleState,
  } = await import("../../tests/e2e/fixtures/mock-connect/model-governance.ts");

  const baseline = buildModelGovernanceBaseline();
  assert.equal(baseline.modelProfiles[0]?.status, "active");
  assert.equal(baseline.promptTemplates[0]?.status, "active");

  const withProfile = createModelProfileState(baseline, {
    provider: "openai",
    modelName: "gpt-4.1",
    capabilityType: "text",
    region: "global",
    supportedInputLocales: ["zh-CN"],
    supportedOutputLocales: ["en-US"],
    pricingSnapshotJson: `{"input":"0.002"}`,
    rateLimitPolicyJson: `{"rpm":80}`,
  });
  assert.equal(withProfile.modelProfiles.at(-1)?.modelName, "gpt-4.1");

  const updatedProfile = updateModelProfileState(withProfile, {
    modelProfileId: withProfile.modelProfiles.at(-1)?.id ?? "",
    supportedInputLocales: ["zh-CN", "en-US"],
    supportedOutputLocales: ["en-US"],
    pricingSnapshotJson: `{"input":"0.003"}`,
    rateLimitPolicyJson: `{"rpm":40}`,
  });
  assert.deepEqual(updatedProfile.modelProfiles.at(-1)?.supportedInputLocales, ["zh-CN", "en-US"]);

  const pausedProfile = setModelProfileStatusState(updatedProfile, {
    modelProfileId: updatedProfile.modelProfiles.at(-1)?.id ?? "",
    status: "paused",
  });
  assert.equal(pausedProfile.modelProfiles.at(-1)?.status, "paused");

  const withDraft = createPromptTemplateVersionState(pausedProfile, {
    templateFamily: "shot.generate",
    templateKey: "shot.generate.default",
    locale: "zh-CN",
    content: "新的草稿版本",
    inputSchemaJson: `{"type":"object"}`,
    outputSchemaJson: `{"type":"object"}`,
  });
  assert.equal(withDraft.promptTemplates.at(-1)?.status, "draft");

  const revisedDraft = updatePromptTemplateDraftState(withDraft, {
    promptTemplateId: withDraft.promptTemplates.at(-1)?.id ?? "",
    content: "修订后的草稿版本",
    inputSchemaJson: `{"type":"object","required":["goal"]}`,
    outputSchemaJson: `{"type":"object"}`,
  });
  assert.equal(revisedDraft.promptTemplates.at(-1)?.content, "修订后的草稿版本");

  const activatedDraft = setPromptTemplateStatusState(revisedDraft, {
    promptTemplateId: revisedDraft.promptTemplates.at(-1)?.id ?? "",
    status: "active",
  });
  assert.equal(activatedDraft.promptTemplates.at(-1)?.status, "active");

  assert.throws(
    () =>
      setPromptTemplateStatusState(activatedDraft, {
        promptTemplateId: activatedDraft.promptTemplates.at(-1)?.id ?? "",
        status: "draft",
      }),
    /cannot reopen published prompt template as draft/,
  );

  const archivedDraft = setPromptTemplateStatusState(activatedDraft, {
    promptTemplateId: activatedDraft.promptTemplates.at(-1)?.id ?? "",
    status: "archived",
  });
  assert.equal(archivedDraft.promptTemplates.at(-1)?.status, "archived");

  assert.throws(
    () =>
      setPromptTemplateStatusState(archivedDraft, {
        promptTemplateId: archivedDraft.promptTemplates.at(-1)?.id ?? "",
        status: "draft",
      }),
    /cannot reopen published prompt template as draft/,
  );

  const projectBundles = listContextBundlesState(archivedDraft, {
    projectId: "project-live-1",
  });
  assert.ok(projectBundles.length >= 1);
  assert.equal(projectBundles[0]?.projectId, "project-live-1");

  const bundle = getContextBundleState(activatedDraft, projectBundles[0]?.id ?? "");
  assert.equal(bundle?.payloadJson.includes("temperature"), true);
});

test("preview helpers preserve assembly order and provenance scope", async () => {
  const {
    createPreviewAssemblyState,
    createPreviewRuntimeState,
    upsertPreviewAssemblyState,
    buildPreviewWorkbenchPayload,
    buildPreviewRuntimePayload,
    buildPreviewShotOptionsPayload,
    buildPreviewAssetProvenancePayload,
    requestPreviewRenderState,
  } = await import("../../tests/e2e/fixtures/mock-connect/preview.ts");

  const initial = createPreviewAssemblyState("project-1");
  assert.equal(initial.items[0]?.shotId, "shot-preview-1");

  const updated = upsertPreviewAssemblyState(initial, {
    projectId: "project-1",
    status: "draft",
    items: [
      {
        itemId: "draft-1",
        shotId: "shot-preview-2",
        primaryAssetId: "asset-preview-2",
        sourceRunId: "run-preview-2",
        sequence: 1,
      },
      {
        itemId: "item-1",
        shotId: "shot-preview-1",
        primaryAssetId: "",
        sourceRunId: "",
        sequence: 2,
      },
    ],
  });

  const payload = buildPreviewWorkbenchPayload(updated);
  assert.equal(payload.assembly.items[0]?.shotId, "shot-preview-2");
  assert.equal(payload.assembly.items[0]?.sequence, 1);
  assert.equal(payload.assembly.items[0]?.shot?.shotCode, "SHOT-002");
  assert.equal(payload.assembly.items[0]?.primaryAsset?.assetId, "asset-preview-2");
  assert.equal(payload.assembly.items[0]?.sourceRun?.runId, "run-preview-2");
  assert.equal(payload.assembly.items[1]?.shotId, "shot-preview-1");

  const optionsPayload = buildPreviewShotOptionsPayload(updated);
  assert.equal(optionsPayload.options[0]?.shot?.shotCode, "SHOT-001");
  assert.equal(optionsPayload.options[1]?.currentPrimaryAsset?.assetId, "asset-preview-2");

  const initialRuntime = createPreviewRuntimeState(updated);
  assert.equal(initialRuntime.renderStatus, "idle");

  const { queuedRuntime, settledRuntime, eventPayload } = requestPreviewRenderState(
    initialRuntime,
    updated,
    { requestedLocale: "en-US" },
    1,
  );
  const runtimePayload = buildPreviewRuntimePayload(queuedRuntime);
  assert.equal(runtimePayload.runtime?.renderStatus, "queued");
  assert.equal(runtimePayload.runtime?.resolvedLocale, "en-US");
  assert.equal(settledRuntime.renderStatus, "completed");
  assert.equal(settledRuntime.playbackAssetId, "asset-preview-playback-project-1");
  assert.equal(settledRuntime.playback?.timeline?.segments?.length, 2);
  assert.equal(settledRuntime.playback?.timeline?.totalDurationMs, 31000);
  assert.equal(settledRuntime.playback?.timeline?.segments?.[0]?.sequence, 1);
  assert.equal(settledRuntime.playback?.timeline?.segments?.[0]?.transitionToNext?.transitionType, "crossfade");
  assert.equal(eventPayload.render_status, "completed");
  assert.equal(eventPayload.resolved_locale, "en-US");

  const provenance = buildPreviewAssetProvenancePayload(updated, "asset-preview-2");
  assert.equal(provenance?.asset.projectId, "project-1");
  assert.equal(provenance?.sourceRunId, "run-preview-2");
  assert.match(provenance?.provenanceSummary ?? "", /preview_assembly=assembly-project-1/);
});

test("audio helpers preserve timeline order and audio asset scope", async () => {
  const {
    createAudioTimelineState,
    createAudioRuntimeState,
    buildAudioWaveformDocumentForUrl,
    buildAudioRuntimePayload,
    requestAudioRenderState,
    upsertAudioTimelineState,
    buildAudioWorkbenchPayload,
    buildAudioImportBatchSummary,
    buildAudioImportBatchWorkbenchPayload,
    buildAudioAssetProvenancePayload,
  } = await import("../../tests/e2e/fixtures/mock-connect/audio.ts");

  const initial = createAudioTimelineState("project-1");
  assert.equal(initial.projectId, "project-1");
  assert.equal(initial.tracks.length, 0);

  const updated = upsertAudioTimelineState(initial, {
    projectId: "project-1",
    status: "draft",
    tracks: [
      {
        trackId: "draft-track-dialogue",
        trackType: "dialogue",
        volumePercent: 0,
        clips: [
          {
            clipId: "draft-clip-1",
            assetId: "asset-audio-dialogue-1",
            sourceRunId: "run-audio-dialogue-1",
            sequence: 1,
            startMs: 200,
            durationMs: 12000,
            trimInMs: 0,
            trimOutMs: 240,
          },
        ],
      },
    ],
  });

  const payload = buildAudioWorkbenchPayload(updated);
  assert.equal(payload.timeline.tracks[0]?.trackId, "track-dialogue");
  assert.equal(payload.timeline.tracks[0]?.volumePercent, 0);
  assert.equal(payload.timeline.tracks[0]?.clips[0]?.startMs, 200);

  const initialRuntime = createAudioRuntimeState(updated);
  assert.equal(initialRuntime.renderStatus, "idle");

  const { queuedRuntime, settledRuntime, eventPayload } = requestAudioRenderState(
    initialRuntime,
    updated,
    { projectId: "project-1" },
    1,
  );
  const runtimePayload = buildAudioRuntimePayload(queuedRuntime);
  assert.equal(runtimePayload.runtime?.renderStatus, "queued");
  assert.equal(settledRuntime.renderStatus, "completed");
  assert.equal(settledRuntime.mixAssetId, "asset-mix-project-1");
  assert.equal(settledRuntime.mixOutput?.playbackUrl, "https://cdn.example.com/audio/project-1/mix.mp3");
  assert.equal(settledRuntime.waveforms[0]?.assetId, "asset-audio-dialogue-1");
  assert.equal(eventPayload.render_status, "completed");
  assert.equal(eventPayload.mix_asset_id, "asset-mix-project-1");
  assert.deepEqual(
    buildAudioWaveformDocumentForUrl(updated, settledRuntime.waveforms[0]?.waveformUrl ?? ""),
    {
      version: "audio_waveform_v1",
      duration_ms: 12000,
      peaks: [0.08, 0.28, 0.48, 0.68, 0.88, 0.68, 0.48, 0.28],
    },
  );
  assert.equal(
    buildAudioWaveformDocumentForUrl(
      updated,
      "https://cdn.example.com/audio/project-1/missing-waveform.json",
    ),
    null,
  );

  const summary = buildAudioImportBatchSummary("project-1");
  assert.equal(summary.projectId, "project-1");
  assert.equal(summary.mediaAssetCount, 2);

  const workbench = buildAudioImportBatchWorkbenchPayload("project-1");
  assert.equal(workbench.mediaAssets[0]?.mediaType, "audio");
  assert.equal(workbench.mediaAssetVariants[0]?.durationMs, 12000);

  const provenance = buildAudioAssetProvenancePayload("project-1", "asset-audio-dialogue-1");
  assert.equal(provenance?.asset.projectId, "project-1");
  assert.equal(provenance?.sourceRunId, "run-audio-dialogue-1");
});

test("collaboration helpers preserve lease state and presence scope", async () => {
  const {
    createCollaborationState,
    buildCollaborationSessionPayload,
    upsertCollaborationLeaseState,
    releaseCollaborationLeaseState,
  } = await import("../../tests/e2e/fixtures/mock-connect/collaboration.ts");

  const initial = createCollaborationState("project-1");
  assert.equal(initial.projectId, "project-1");
  assert.equal(initial.session.ownerId, "shot-collab-1");
  assert.equal(initial.presences.length, 2);

  const claimed = upsertCollaborationLeaseState(initial, {
    ownerType: "shot",
    ownerId: "shot-collab-1",
    actorUserId: "user-live-1",
    presenceStatus: "editing",
    draftVersion: 11,
    leaseTtlSeconds: 120,
  });
  assert.equal(claimed.session.lockHolderUserId, "user-live-1");
  assert.equal(claimed.session.draftVersion, 11);
  assert.equal(
    claimed.presences.find((presence) => presence.userId === "user-live-1")?.status,
    "editing",
  );

  const released = releaseCollaborationLeaseState(claimed, {
    ownerType: "shot",
    ownerId: "shot-collab-1",
    actorUserId: "user-live-1",
    conflictSummary: "manual release",
  });
  const payload = buildCollaborationSessionPayload(released);
  assert.equal(payload.session?.lockHolderUserId, "");
  assert.equal(payload.session?.conflictSummary, "manual release");
  assert.equal(payload.session?.ownerId, "shot-collab-1");
  assert.equal(payload.session?.presences?.length, 2);
});

test("reuse helpers preserve cross-project scope, blocked eligibility, and selection state", async () => {
  const {
    createAssetReuseState,
    buildReuseImportBatchSummaries,
    buildReuseImportBatchWorkbenchPayload,
    buildReuseAssetProvenancePayload,
    buildReuseShotExecutionPayload,
    buildReuseShotWorkbenchPayload,
    applyReusePrimaryAsset,
    canApplyReuseAsset,
  } = await import("../../tests/e2e/fixtures/mock-connect/reuse.ts");

  const initial = createAssetReuseState("project-live-1");
  assert.equal(initial.shotWorkbench.shotExecution.primaryAssetId, "asset-current-1");

  const summaries = buildReuseImportBatchSummaries(initial, "project-source-9");
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.projectId, "project-source-9");
  assert.deepEqual(buildReuseImportBatchSummaries(initial, "project-live-1"), []);

  const workbench = buildReuseImportBatchWorkbenchPayload(initial, "reuse-batch-source-9");
  assert.equal(workbench?.importBatch.projectId, "project-source-9");
  assert.equal(workbench?.mediaAssets[0]?.projectId, "project-source-9");
  assert.equal(workbench?.mediaAssets[0]?.rightsStatus, "clear");
  assert.equal(workbench?.mediaAssets[1]?.aiAnnotated, true);
  assert.equal(workbench?.candidateAssets[0]?.shotExecutionId, "shot-exec-reuse-1");
  assert.equal(buildReuseImportBatchWorkbenchPayload(initial, "missing-batch"), null);

  const provenance = buildReuseAssetProvenancePayload(initial, "asset-external-1");
  assert.equal(provenance?.asset.projectId, "project-source-9");
  assert.equal(provenance?.sourceRunId, "run-source-1");
  assert.match(provenance?.provenanceSummary ?? "", /rights_status=clear/);

  assert.deepEqual(canApplyReuseAsset(initial, "asset-external-1"), {
    allowed: true,
    blockedReason: "",
    consentStatus: "not_required",
  });
  assert.deepEqual(canApplyReuseAsset(initial, "asset-external-ai-1"), {
    allowed: false,
    blockedReason: "policyapp: consent status must be granted for ai_annotated assets",
    consentStatus: "unknown",
  });
  const missingSource = {
    ...initial,
    reusableAssets: initial.reusableAssets.map((asset) =>
      asset.assetId === "asset-external-1"
        ? { ...asset, sourceProjectId: "" }
        : asset,
    ),
  };
  assert.deepEqual(canApplyReuseAsset(missingSource, "asset-external-1"), {
    allowed: false,
    blockedReason: "policyapp: source project is unavailable for cross-project reuse",
    consentStatus: "not_required",
  });

  const updated = applyReusePrimaryAsset(initial, "asset-external-1");
  const shotExecution = buildReuseShotExecutionPayload(updated);
  assert.equal(shotExecution.shotExecution.primaryAssetId, "asset-external-1");

  const shotWorkbench = buildReuseShotWorkbenchPayload(updated);
  assert.equal(shotWorkbench.workbench.shotExecution.primaryAssetId, "asset-external-1");
  assert.equal(shotWorkbench.workbench.shotExecution.projectId, "project-live-1");
});

test("mock connect routes wire all phase2 fixture modules", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../tests/e2e/fixtures/mockConnectRoutes.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /mock-connect\/collaboration\.ts/);
  assert.match(source, /scenario\.collaboration/);
  assert.match(source, /GetCollaborationSession/);
  assert.match(source, /UpsertCollaborationLease/);
  assert.match(source, /ReleaseCollaborationLease/);
  assert.match(source, /GetAudioRuntime/);
  assert.match(source, /RequestAudioRender/);
  assert.match(source, /project\.audio\.runtime\.updated/);
  assert.match(source, /mock-connect\/model-governance\.ts/);
  assert.match(source, /ModelGovernanceService\/ListModelProfiles/);
  assert.match(source, /ModelGovernanceService\/SetPromptTemplateStatus/);
  assert.match(source, /buildAudioWaveformDocumentForUrl/);
  assert.match(source, /cdn\\\.example\\\.com/);
  assert.match(source, /page\.context\(\)\.route/);
  assert.match(source, /application\/json/);
});
