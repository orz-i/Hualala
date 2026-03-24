import type { Page, Route } from "@playwright/test";

import {
  buildAudioAssetProvenancePayload,
  buildAudioImportBatchSummary,
  buildAudioImportBatchWorkbenchPayload,
  buildAudioWorkbenchPayload,
  createAudioTimelineState,
  upsertAudioTimelineState,
} from "./mock-connect/audio.ts";
import {
  buildAssetProvenancePayload,
  buildImportBatchSummary,
  buildImportBatchWorkbenchPayload,
} from "./mock-connect/assets.ts";
import {
  buildAdminPayload,
  buildDefaultDevSession,
  syncGovernanceState,
  withRecentChanges,
} from "./mock-connect/governance.ts";
import {
  buildPreviewAssetProvenancePayload,
  buildPreviewWorkbenchPayload,
  createPreviewAssemblyState,
  upsertPreviewAssemblyState,
} from "./mock-connect/preview.ts";
import {
  applyReusePrimaryAsset,
  buildReuseAssetProvenancePayload,
  buildReuseImportBatchSummaries,
  buildReuseImportBatchWorkbenchPayload,
  buildReuseShotWorkbenchPayload,
  buildReuseShotExecutionPayload,
  canApplyReuseAsset,
  createAssetReuseState,
} from "./mock-connect/reuse.ts";
import { clone, initializeMockConnectState, loadPhase1DemoScenarios } from "./mock-connect/scenario.ts";
import type { AdminState, MockConnectScenario } from "./mock-connect/types.ts";
import {
  cancelWorkflowRun,
  retryWorkflowRun,
  startWorkflowRun,
  summarizeWorkflowRun,
} from "./mock-connect/workflow.ts";

function jsonResponse(status: number, payload: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockConnectRoutes(page: Page, scenario: MockConnectScenario) {
  const phase1DemoScenarios = await loadPhase1DemoScenarios();
  let {
    devSessionActive,
    adminState,
    creatorShotState,
    creatorShotWorkflowRuns,
    creatorImportState,
  } = initializeMockConnectState({ scenario, phase1DemoScenarios });
  let previewState = createPreviewAssemblyState(adminState.budgetSnapshot.projectId);
  let audioState = createAudioTimelineState(adminState.budgetSnapshot.projectId);
  let reuseState = createAssetReuseState("project-live-1");

  async function handleReuseSelectPrimaryAsset(route: Route) {
    await delay(120);
    const body = route.request().postDataJSON() as { assetId?: string };
    const assetId = body.assetId ?? "";
    if (!canApplyReuseAsset(reuseState, assetId)) {
      await route.fulfill(jsonResponse(412, { error: "asset reuse blocked" }));
      return true;
    }
    reuseState = applyReusePrimaryAsset(reuseState, assetId);
    await route.fulfill(jsonResponse(200, {}));
    return true;
  }

  await page.route(/\/sse\/events(?:\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: ": keep-alive\n\n",
    });
  });

  await page.route(/\/hualala\..+/, async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === "/hualala.auth.v1.AuthService/GetCurrentSession") {
      if (!devSessionActive) {
        await route.fulfill(jsonResponse(401, { error: "unauthenticated" }));
        return;
      }
      const session =
        scenario.admin || scenario.creatorImport || scenario.preview || scenario.audio || scenario.reuse
          ? adminState.governance.currentSession
          : buildDefaultDevSession();
      await route.fulfill(jsonResponse(200, { session }));
      return;
    }

    if (pathname === "/hualala.auth.v1.AuthService/StartDevSession") {
      devSessionActive = true;
      const session =
        scenario.admin || scenario.creatorImport || scenario.preview || scenario.audio || scenario.reuse
          ? adminState.governance.currentSession
          : buildDefaultDevSession();
      await route.fulfill(jsonResponse(200, { session }));
      return;
    }

    if (pathname === "/hualala.auth.v1.AuthService/ClearCurrentSession") {
      devSessionActive = false;
      await route.fulfill(jsonResponse(200, {}));
      return;
    }

    if ((scenario.preview || scenario.audio || scenario.admin) &&
      pathname === "/hualala.project.v1.ProjectService/GetPreviewWorkbench") {
      await route.fulfill(jsonResponse(200, buildPreviewWorkbenchPayload(previewState)));
      return;
    }

    if ((scenario.preview || scenario.audio || scenario.admin) &&
      pathname === "/hualala.project.v1.ProjectService/GetAudioWorkbench") {
      await route.fulfill(jsonResponse(200, buildAudioWorkbenchPayload(audioState)));
      return;
    }

    if ((scenario.audio || scenario.admin) &&
      pathname === "/hualala.project.v1.ProjectService/UpsertAudioTimeline") {
      await delay(120);
      const body = route.request().postDataJSON() as {
        projectId?: string;
        status?: string;
        renderWorkflowRunId?: string;
        renderStatus?: string;
        tracks?: Array<{
          trackId?: string;
          timelineId?: string;
          trackType?: string;
          displayName?: string;
          sequence?: number;
          muted?: boolean;
          solo?: boolean;
          volumePercent?: number;
          clips?: Array<{
            clipId?: string;
            trackId?: string;
            assetId?: string;
            sourceRunId?: string;
            sequence?: number;
            startMs?: number;
            durationMs?: number;
            trimInMs?: number;
            trimOutMs?: number;
          }>;
        }>;
      };
      audioState = upsertAudioTimelineState(audioState, body);
      await route.fulfill(jsonResponse(200, buildAudioWorkbenchPayload(audioState)));
      return;
    }

    if ((scenario.preview || scenario.audio || scenario.admin) &&
      pathname === "/hualala.project.v1.ProjectService/UpsertPreviewAssembly") {
      await delay(120);
      const body = route.request().postDataJSON() as {
        projectId?: string;
        status?: string;
        items?: Array<{
          itemId?: string;
          assemblyId?: string;
          shotId?: string;
          primaryAssetId?: string;
          sourceRunId?: string;
          sequence?: number;
        }>;
      };
      previewState = upsertPreviewAssemblyState(previewState, body);
      await route.fulfill(jsonResponse(200, buildPreviewWorkbenchPayload(previewState)));
      return;
    }

    if (scenario.admin) {
      if (pathname === "/hualala.workflow.v1.WorkflowService/ListWorkflowRuns") {
        await route.fulfill(
          jsonResponse(200, {
            workflowRuns: creatorShotWorkflowRuns.map((record) => summarizeWorkflowRun(record)),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/GetWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        const record = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        if (!record) {
          await route.fulfill(jsonResponse(404, { error: "workflow run not found" }));
          return;
        }
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(record),
            workflowSteps: record.steps,
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        const nextRuns = retryWorkflowRun(creatorShotWorkflowRuns, body.workflowRunId ?? "");
        if (!nextRuns) {
          await route.fulfill(jsonResponse(404, { error: "workflow run not found" }));
          return;
        }
        creatorShotWorkflowRuns = nextRuns;
        const record = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(record ?? creatorShotWorkflowRuns[0]!),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/CancelWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        const nextRuns = cancelWorkflowRun(creatorShotWorkflowRuns, body.workflowRunId ?? "");
        if (!nextRuns) {
          await route.fulfill(jsonResponse(404, { error: "workflow run not found" }));
          return;
        }
        creatorShotWorkflowRuns = nextRuns;
        const record = creatorShotWorkflowRuns.find((run) => run.id === body.workflowRunId);
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(record ?? creatorShotWorkflowRuns[0]!),
          }),
        );
        return;
      }

      if (pathname === "/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems") {
        await delay(120);
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterConfirm ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
        if (scenario.reuse) {
          await handleReuseSelectPrimaryAsset(route);
          return;
        }
        await delay(120);
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterSelect ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.billing.v1.BillingService/UpdateBudgetPolicy") {
        await delay(120);
        if (scenario.admin === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }

        adminState = withRecentChanges({
          ...clone(adminState),
          budgetSnapshot: clone(adminState.updatedBudgetSnapshot ?? adminState.budgetSnapshot),
        });
        await route.fulfill(
          jsonResponse(200, {
            budgetPolicy: {
              id: "budget-1",
              orgId: "org-live-1",
              projectId: adminState.budgetSnapshot.projectId,
              limitCents: adminState.budgetSnapshot.limitCents,
              reservedCents: adminState.budgetSnapshot.reservedCents,
            },
          }),
        );
        return;
      }

      if (pathname === "/hualala.auth.v1.AuthService/UpdateUserPreferences") {
        const body = route.request().postDataJSON() as {
          displayLocale?: string;
          timezone?: string;
          userId?: string;
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: {
            ...clone(adminState.governance),
            currentSession: {
              ...clone(adminState.governance.currentSession),
              locale: body.displayLocale ?? adminState.governance.currentSession.locale,
            },
            userPreferences: {
              userId: body.userId ?? adminState.governance.userPreferences.userId,
              displayLocale:
                body.displayLocale ?? adminState.governance.userPreferences.displayLocale,
              timezone: body.timezone ?? adminState.governance.userPreferences.timezone,
            },
            orgLocaleSettings: {
              ...clone(adminState.governance.orgLocaleSettings),
              defaultLocale:
                body.displayLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              supportedLocales: [
                body.displayLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              ],
            },
          },
        });
        await route.fulfill(
          jsonResponse(200, {
            preferences: clone(adminState.governance.userPreferences),
          }),
        );
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/UpdateMemberRole") {
        const body = route.request().postDataJSON() as {
          memberId?: string;
          roleId?: string;
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            members: adminState.governance.members.map((member) =>
              member.memberId === body.memberId
                ? { ...member, roleId: body.roleId ?? member.roleId }
                : member,
            ),
          }),
        });
        const updatedMember = adminState.governance.members.find(
          (member) => member.memberId === body.memberId,
        );
        await route.fulfill(jsonResponse(200, { member: updatedMember }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/CreateRole") {
        const body = route.request().postDataJSON() as {
          orgId?: string;
          code?: string;
          displayName?: string;
          permissionCodes?: string[];
        };
        const nextRole = {
          roleId: `role-${body.code ?? "custom"}`,
          orgId: body.orgId ?? adminState.governance.currentSession.orgId,
          code: body.code ?? "custom",
          displayName: body.displayName ?? "Custom",
          permissionCodes: [...(body.permissionCodes ?? [])],
          memberCount: 0,
        };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            roles: [...adminState.governance.roles, nextRole],
          }),
        });
        await route.fulfill(jsonResponse(200, { role: nextRole }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/UpdateRole") {
        const body = route.request().postDataJSON() as {
          roleId?: string;
          displayName?: string;
          permissionCodes?: string[];
        };
        let updatedRole: AdminState["governance"]["roles"][number] | undefined;
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            roles: adminState.governance.roles.map((role) => {
              if (role.roleId !== body.roleId) {
                return role;
              }
              updatedRole = {
                ...role,
                displayName: body.displayName ?? role.displayName,
                permissionCodes: [...(body.permissionCodes ?? role.permissionCodes)],
              };
              return updatedRole;
            }),
          }),
        });
        await route.fulfill(jsonResponse(200, { role: updatedRole }));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/DeleteRole") {
        const body = route.request().postDataJSON() as { roleId?: string };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: syncGovernanceState({
            ...clone(adminState.governance),
            roles: adminState.governance.roles.filter((role) => role.roleId !== body.roleId),
          }),
        });
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.org.v1.OrgService/UpdateOrgLocaleSettings") {
        const body = route.request().postDataJSON() as { defaultLocale?: string };
        adminState = withRecentChanges({
          ...clone(adminState),
          governance: {
            ...clone(adminState.governance),
            currentSession: {
              ...clone(adminState.governance.currentSession),
              locale: body.defaultLocale ?? adminState.governance.currentSession.locale,
            },
            orgLocaleSettings: {
              orgId: adminState.governance.orgLocaleSettings.orgId,
              defaultLocale:
                body.defaultLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              supportedLocales: [
                body.defaultLocale ?? adminState.governance.orgLocaleSettings.defaultLocale,
              ],
            },
          },
        });
        await route.fulfill(
          jsonResponse(200, {
            localeSettings: clone(adminState.governance.orgLocaleSettings),
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

    if ((scenario.admin || scenario.creatorImport || scenario.audio || scenario.reuse) &&
      pathname === "/hualala.asset.v1.AssetService/ListImportBatches") {
      const body = route.request().postDataJSON() as { projectId?: string };
      await route.fulfill(
        jsonResponse(200, {
          importBatches:
            scenario.reuse
              ? buildReuseImportBatchSummaries(reuseState, body.projectId ?? "")
              : scenario.audio && !scenario.admin
              ? [buildAudioImportBatchSummary(adminState.budgetSnapshot.projectId)]
              : [
                  buildImportBatchSummary({
                    adminState,
                    creatorImportState,
                  }),
                ],
        }),
      );
      return;
    }

    if ((scenario.admin || scenario.creatorImport || scenario.audio || scenario.reuse) &&
      pathname === "/hualala.asset.v1.AssetService/GetImportBatchWorkbench") {
      const body = route.request().postDataJSON() as { importBatchId?: string };
      const reusePayload =
        scenario.reuse && body.importBatchId
          ? buildReuseImportBatchWorkbenchPayload(reuseState, body.importBatchId)
          : null;
      await route.fulfill(
        jsonResponse(
          200,
          reusePayload
            ? reusePayload
            : scenario.audio && !scenario.admin
            ? buildAudioImportBatchWorkbenchPayload(adminState.budgetSnapshot.projectId)
            : scenario.creatorImport && !scenario.admin
              ? creatorImportState
            : buildImportBatchWorkbenchPayload({
                adminState,
                creatorShotState,
                creatorImportState,
                workflowRuns: creatorShotWorkflowRuns,
              }),
        ),
      );
      return;
    }

    if ((scenario.preview || scenario.audio || scenario.admin || scenario.creatorImport || scenario.reuse) &&
      pathname === "/hualala.asset.v1.AssetService/GetAssetProvenanceSummary") {
      const body = route.request().postDataJSON() as { assetId?: string };
      if (body.assetId !== undefined && body.assetId.trim() === "") {
        await route.fulfill(jsonResponse(404, { error: "asset not found" }));
        return;
      }
      const requestedAssetId = body.assetId ?? "";
      if (scenario.reuse && requestedAssetId) {
        const reusePayload = buildReuseAssetProvenancePayload(reuseState, requestedAssetId);
        if (reusePayload) {
          await route.fulfill(jsonResponse(200, reusePayload));
          return;
        }
      }
      const previewAssetId =
        requestedAssetId || previewState.items.find((item) => item.primaryAssetId)?.primaryAssetId;
      if (scenario.preview && previewAssetId) {
        const previewPayload = buildPreviewAssetProvenancePayload(previewState, previewAssetId);
        if (previewPayload) {
          await route.fulfill(jsonResponse(200, previewPayload));
          return;
        }
      }

      if (scenario.audio && requestedAssetId) {
        const audioPayload = buildAudioAssetProvenancePayload(
          adminState.budgetSnapshot.projectId,
          requestedAssetId,
        );
        if (audioPayload) {
          await route.fulfill(jsonResponse(200, audioPayload));
          return;
        }
      }

      const assetId =
        requestedAssetId ||
        creatorImportState.items[0]?.assetId ||
        creatorImportState.candidateAssets[0]?.assetId;
      if (!assetId) {
        await route.fulfill(jsonResponse(404, { error: "asset not found" }));
        return;
      }
      await route.fulfill(
        jsonResponse(
          200,
          buildAssetProvenancePayload({
            adminState,
            creatorShotState,
            creatorImportState,
            workflowRuns: creatorShotWorkflowRuns,
            assetId,
          }),
        ),
      );
      return;
    }

    if (scenario.creatorShot) {
      if (pathname === "/hualala.workflow.v1.WorkflowService/ListWorkflowRuns") {
        await route.fulfill(
          jsonResponse(200, {
            workflowRuns: creatorShotWorkflowRuns.map((record) => summarizeWorkflowRun(record)),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/StartWorkflow") {
        const body = route.request().postDataJSON() as {
          workflowType?: string;
          resourceId?: string;
          projectId?: string;
        };
        const nextWorkflow = startWorkflowRun(creatorShotWorkflowRuns, {
          workflowType: body.workflowType,
          resourceId: body.resourceId ?? creatorShotState.workbench.shotExecution.id,
          projectId:
            body.projectId ??
            creatorShotState.workbench.shotExecution.projectId ??
            "project-live-1",
        });
        creatorShotWorkflowRuns = nextWorkflow.workflowRuns;
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(nextWorkflow.workflowRun),
          }),
        );
        return;
      }

      if (pathname === "/hualala.workflow.v1.WorkflowService/RetryWorkflowRun") {
        const body = route.request().postDataJSON() as { workflowRunId?: string };
        const nextRuns = retryWorkflowRun(creatorShotWorkflowRuns, body.workflowRunId ?? "", {
          moveToFront: true,
        });
        if (!nextRuns) {
          await route.fulfill(jsonResponse(404, { error: "workflow run not found" }));
          return;
        }
        creatorShotWorkflowRuns = nextRuns;
        await route.fulfill(
          jsonResponse(200, {
            workflowRun: summarizeWorkflowRun(creatorShotWorkflowRuns[0]!),
          }),
        );
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/GetShotWorkbench") {
        await route.fulfill(jsonResponse(200, creatorShotState));
        return;
      }

      if (pathname === "/hualala.review.v1.ReviewService/ListEvaluationRuns") {
        await route.fulfill(jsonResponse(200, { evaluationRuns: [] }));
        return;
      }

      if (pathname === "/hualala.review.v1.ReviewService/ListShotReviews") {
        await route.fulfill(jsonResponse(200, { shotReviews: [] }));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/RunSubmissionGateChecks") {
        await delay(120);
        if (scenario.creatorShot === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorShotState = {
          ...clone(creatorShotState),
          workbench: clone(creatorShotState.afterGate?.workbench ?? creatorShotState.workbench),
        };
        await route.fulfill(
          jsonResponse(
            200,
            clone(creatorShotState.afterGate?.gateResult ?? { passedChecks: [], failedChecks: [] }),
          ),
        );
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SubmitShotForReview") {
        await delay(120);
        creatorShotState = {
          ...clone(creatorShotState),
          workbench: clone(creatorShotState.afterSubmit?.workbench ?? creatorShotState.workbench),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }
    }

    if (scenario.reuse) {
      if (pathname === "/hualala.execution.v1.ExecutionService/GetShotExecution") {
        await route.fulfill(jsonResponse(200, buildReuseShotExecutionPayload(reuseState)));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/GetShotWorkbench") {
        await route.fulfill(jsonResponse(200, buildReuseShotWorkbenchPayload(reuseState)));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
        await handleReuseSelectPrimaryAsset(route);
        return;
      }
    }

    if (scenario.creatorImport) {
      if (pathname === "/hualala.asset.v1.AssetService/BatchConfirmImportBatchItems") {
        await delay(120);
        if (scenario.creatorImport === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterConfirm ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }

      if (pathname === "/hualala.execution.v1.ExecutionService/SelectPrimaryAsset") {
        await delay(120);
        if (scenario.creatorImport === "failure") {
          await route.fulfill(jsonResponse(500, { error: "network down" }));
          return;
        }
        creatorImportState = {
          ...clone(creatorImportState),
          ...clone(creatorImportState.afterSelect ?? creatorImportState),
        };
        await route.fulfill(jsonResponse(200, {}));
        return;
      }
    }

    await route.fulfill(
      jsonResponse(501, {
        error: "mock connect route not implemented",
        pathname,
      }),
    );
  });
}
