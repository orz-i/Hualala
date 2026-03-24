import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
import { AdminAudioPage } from "../features/dashboard/AdminAudioPage";
import { AdminAssetsPage } from "../features/dashboard/AdminAssetsPage";
import { AdminCollaborationPage } from "../features/dashboard/AdminCollaborationPage";
import { AdminGovernancePage } from "../features/dashboard/AdminGovernancePage";
import { AdminOverviewPage } from "../features/dashboard/AdminOverviewPage";
import { AdminPreviewPage } from "../features/dashboard/AdminPreviewPage";
import { AdminWorkflowPage } from "../features/dashboard/AdminWorkflowPage";
import { AdminAssetReusePage } from "../features/dashboard/reuse/AdminAssetReusePage";
import { useAdminAssetReuseController } from "../features/dashboard/reuse/useAdminAssetReuseController";
import { useAdminAudioController } from "../features/dashboard/useAdminAudioController";
import { useAdminAssetController } from "../features/dashboard/useAdminAssetController";
import { useAdminCollaborationController } from "../features/dashboard/useAdminCollaborationController";
import { useAdminGovernanceController } from "../features/dashboard/useAdminGovernanceController";
import { useAdminOverviewController } from "../features/dashboard/useAdminOverviewController";
import { useAdminPreviewController } from "../features/dashboard/useAdminPreviewController";
import { useAdminRecentChangesSubscription } from "../features/dashboard/useAdminRecentChangesSubscription";
import { useAdminWorkflowController } from "../features/dashboard/useAdminWorkflowController";
import { useAdminSessionGate } from "../features/session/useAdminSessionGate";
import { AdminWorkspaceShell } from "./AdminWorkspaceShell";
import {
  type AdminRouteState,
  buildAdminRouteUrl,
  parseAdminRouteState,
  selectAdminRoute,
} from "./adminRoutes";

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [routeState, setRouteState] = useState<AdminRouteState>(() =>
    parseAdminRouteState(window.location),
  );

  const applyRouteState = useCallback(
    (nextRouteState: AdminRouteState, mode: "push" | "replace" = "push") => {
      const nextUrl = buildAdminRouteUrl(nextRouteState);
      if (mode === "replace") {
        window.history.replaceState({}, "", nextUrl);
      } else {
        window.history.pushState({}, "", nextUrl);
      }
      setRouteState(nextRouteState);
    },
    [],
  );

  useEffect(() => {
    const initialRouteState = parseAdminRouteState(window.location);
    const normalizedUrl = buildAdminRouteUrl(initialRouteState);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (normalizedUrl !== currentUrl) {
      window.history.replaceState({}, "", normalizedUrl);
    }
    setRouteState(initialRouteState);

    const handlePopState = () => {
      setRouteState(parseAdminRouteState(window.location));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const projectId = routeState.projectId;
  const shotExecutionId = routeState.shotExecutionId;
  const overrideOrgId = routeState.orgId;
  const overrideUserId = routeState.userId;
  const identityOverride =
    overrideOrgId && overrideUserId
      ? {
          orgId: overrideOrgId,
          userId: overrideUserId,
        }
      : undefined;

  const sessionGate = useAdminSessionGate({
    identityOverride,
  });

  const overview = useAdminOverviewController({
    sessionState: sessionGate.sessionState,
    operationsEnabled: routeState.route === "overview",
    projectId,
    shotExecutionId,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const governance = useAdminGovernanceController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "governance",
    identityOverride,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const workflow = useAdminWorkflowController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "workflow",
    projectId,
    identityOverride,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const asset = useAdminAssetController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "assets",
    projectId,
    identityOverride,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const collaboration = useAdminCollaborationController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "collaboration",
    projectId,
    shotId: routeState.shotId,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const audio = useAdminAudioController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "audio",
    projectId,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const preview = useAdminPreviewController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "preview",
    projectId,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const reuse = useAdminAssetReuseController({
    sessionState: sessionGate.sessionState,
    enabled: routeState.route === "reuse",
    projectId,
    shotExecutionId,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  useEffect(() => {
    if (routeState.route !== "workflow") {
      if (workflow.selectedWorkflowRunId) {
        workflow.onCloseWorkflowDetail();
      }
      return;
    }

    if (routeState.workflowRunId) {
      if (workflow.selectedWorkflowRunId !== routeState.workflowRunId) {
        workflow.onSelectWorkflowRun(routeState.workflowRunId);
      }
      return;
    }

    if (workflow.selectedWorkflowRunId) {
      workflow.onCloseWorkflowDetail();
    }
  }, [
    routeState.route,
    routeState.workflowRunId,
    workflow.onCloseWorkflowDetail,
    workflow.onSelectWorkflowRun,
    workflow.selectedWorkflowRunId,
  ]);

  useEffect(() => {
    if (routeState.route !== "assets") {
      if (asset.selectedAssetProvenanceId) {
        asset.onCloseAssetProvenance();
      }
      if (asset.selectedImportBatchId) {
        asset.onCloseImportBatchDetail();
      }
      return;
    }

    if (!routeState.importBatchId && routeState.assetId) {
      applyRouteState(
        {
          ...routeState,
          assetId: undefined,
        },
        "replace",
      );
      return;
    }

    if (routeState.importBatchId) {
      if (asset.selectedImportBatchId !== routeState.importBatchId) {
        asset.onSelectImportBatch(routeState.importBatchId);
      }
    } else if (asset.selectedImportBatchId) {
      asset.onCloseImportBatchDetail();
      return;
    }

    if (routeState.assetId) {
      if (asset.selectedAssetProvenanceId !== routeState.assetId) {
        asset.onSelectAssetProvenance(routeState.assetId);
      }
      return;
    }

    if (asset.selectedAssetProvenanceId) {
      asset.onCloseAssetProvenance();
    }
  }, [
    applyRouteState,
    asset.onCloseAssetProvenance,
    asset.onCloseImportBatchDetail,
    asset.onSelectAssetProvenance,
    asset.onSelectImportBatch,
    asset.selectedAssetProvenanceId,
    asset.selectedImportBatchId,
    routeState.assetId,
    routeState.importBatchId,
    routeState.route,
  ]);

  useAdminRecentChangesSubscription({
    sessionState: sessionGate.sessionState,
    hasOverview: Boolean(overview.overview),
    subscriptionOrgId: sessionGate.subscriptionOrgId,
    projectId,
    onRecentChange: overview.applyRecentChange,
    onWorkflowUpdated: () => {
      if (routeState.route === "overview") {
        void overview.refreshOperationsOverview();
        return;
      }
      if (routeState.route === "workflow") {
        void workflow.refreshWorkflowSilently();
      }
    },
    onAssetImportBatchUpdated: () => {
      if (routeState.route === "overview") {
        void overview.refreshOperationsOverview();
        return;
      }
      if (routeState.route === "assets") {
        void asset.refreshAssetSilently();
      }
    },
    onError: (error) => {
      console.warn(error.message);
    },
  });

  const routeErrorMessages: Partial<Record<AdminRouteState["route"], string>> = {
    overview: overview.errorMessage,
    governance: governance.errorMessage,
    collaboration: collaboration.errorMessage,
    audio: audio.errorMessage,
    preview: preview.errorMessage,
    reuse: reuse.errorMessage,
  };
  const routeErrorMessage = routeErrorMessages[routeState.route] ?? "";
  const errorMessage = sessionGate.errorMessage || routeErrorMessage;

  if (errorMessage) {
    return (
      <main style={{ padding: "32px" }}>
        {t("app.error.load", { message: errorMessage })}
      </main>
    );
  }

  if (sessionGate.sessionState === "loading") {
    return <main style={{ padding: "32px" }}>{t("session.loading")}</main>;
  }

  if (sessionGate.sessionState === "unauthenticated") {
    return (
      <main style={{ padding: "32px", display: "grid", gap: "16px", maxWidth: "480px" }}>
        <h1 style={{ margin: 0 }}>{t("session.gate.title")}</h1>
        <p style={{ margin: 0 }}>{t("session.gate.description")}</p>
        <button
          type="button"
          onClick={() => {
            void sessionGate.handleStartDevSession();
          }}
          style={{
            width: "fit-content",
            border: 0,
            borderRadius: "999px",
            padding: "10px 18px",
            background: "#0f766e",
            color: "#f0fdfa",
            cursor: "pointer",
          }}
        >
          {t("session.gate.enter")}
        </button>
      </main>
    );
  }

  if (routeState.route === "overview" && !overview.overview) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  if (routeState.route === "governance" && !governance.governance) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  if (routeState.route === "collaboration" && !collaboration.collaborationSession) {
    return <main style={{ padding: "32px" }}>{t("app.loading.collaboration")}</main>;
  }

  if (routeState.route === "preview" && !preview.previewWorkbench) {
    return <main style={{ padding: "32px" }}>{t("app.loading.preview")}</main>;
  }

  if (routeState.route === "audio" && !audio.audioWorkbench) {
    return <main style={{ padding: "32px" }}>{t("app.loading.audio")}</main>;
  }

  if (routeState.route === "reuse" && !reuse.audit) {
    return <main style={{ padding: "32px" }}>{t("app.loading.reuse")}</main>;
  }

  const sessionLabel = identityOverride
    ? t("session.override.active", {
        orgId: identityOverride.orgId,
        userId: identityOverride.userId,
      })
    : t("session.active", { userId: sessionGate.session?.userId ?? "" });

  let routeContent: ReactNode = null;

  if (routeState.route === "workflow") {
    routeContent = (
      <AdminWorkflowPage
        workflowMonitor={workflow.workflowMonitor}
        workflowRunDetail={workflow.workflowRunDetail}
        workflowActionFeedback={workflow.workflowActionFeedback ?? undefined}
        workflowActionPending={workflow.workflowActionPending}
        t={t}
        onWorkflowStatusFilterChange={workflow.onWorkflowStatusFilterChange}
        onWorkflowTypeFilterChange={workflow.onWorkflowTypeFilterChange}
        onSelectWorkflowRun={(workflowRunId) => {
          applyRouteState({
            ...routeState,
            workflowRunId,
          });
        }}
        onCloseWorkflowDetail={() => {
          applyRouteState({
            ...routeState,
            workflowRunId: undefined,
          });
        }}
        onRetryWorkflowRun={workflow.onRetryWorkflowRun}
        onCancelWorkflowRun={workflow.onCancelWorkflowRun}
      />
    );
  } else if (routeState.route === "assets") {
    routeContent = (
      <AdminAssetsPage
        assetMonitor={asset.assetMonitor}
        importBatchDetail={asset.importBatchDetail}
        assetProvenanceDetail={asset.assetProvenanceDetail}
        selectedImportItemIds={asset.selectedImportItemIds}
        assetActionFeedback={asset.assetActionFeedback ?? undefined}
        assetActionPending={asset.assetActionPending}
        t={t}
        onAssetStatusFilterChange={asset.onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={asset.onAssetSourceTypeFilterChange}
        onSelectImportBatch={(importBatchId) => {
          applyRouteState({
            ...routeState,
            importBatchId,
            assetId: undefined,
          });
        }}
        onCloseImportBatchDetail={() => {
          applyRouteState({
            ...routeState,
            importBatchId: undefined,
            assetId: undefined,
          });
        }}
        onToggleImportBatchItemSelection={asset.onToggleImportBatchItemSelection}
        onConfirmImportBatchItem={asset.onConfirmImportBatchItem}
        onConfirmSelectedImportBatchItems={asset.onConfirmSelectedImportBatchItems}
        onConfirmAllImportBatchItems={asset.onConfirmAllImportBatchItems}
        onSelectPrimaryAsset={asset.onSelectPrimaryAsset}
        onSelectAssetProvenance={(assetId) => {
          applyRouteState({
            ...routeState,
            assetId,
          });
        }}
        onCloseAssetProvenance={() => {
          applyRouteState({
            ...routeState,
            assetId: undefined,
          });
        }}
      />
    );
  } else if (routeState.route === "governance" && governance.governance) {
    routeContent = (
      <AdminGovernancePage
        governance={governance.governance}
        governanceActionFeedback={governance.governanceActionFeedback ?? undefined}
        governanceActionPending={governance.governanceActionPending}
        t={t}
        onUpdateUserPreferences={governance.onUpdateUserPreferences}
        onUpdateMemberRole={governance.onUpdateMemberRole}
        onUpdateOrgLocaleSettings={governance.onUpdateOrgLocaleSettings}
        onCreateRole={governance.onCreateRole}
        onUpdateRole={governance.onUpdateRole}
        onDeleteRole={governance.onDeleteRole}
      />
    );
  } else if (routeState.route === "collaboration" && collaboration.collaborationSession) {
    routeContent = (
      <AdminCollaborationPage
        collaborationSession={collaboration.collaborationSession}
        t={t}
      />
    );
  } else if (routeState.route === "preview" && preview.previewWorkbench) {
    routeContent = (
      <AdminPreviewPage
        previewWorkbench={preview.previewWorkbench}
        assetProvenanceDetail={preview.assetProvenanceDetail}
        assetProvenancePending={preview.assetProvenancePending}
        assetProvenanceErrorMessage={preview.assetProvenanceErrorMessage}
        t={t}
        onOpenAssetProvenance={(assetId) => {
          void preview.handleOpenAssetProvenance(assetId);
        }}
        onCloseAssetProvenance={preview.handleCloseAssetProvenance}
      />
    );
  } else if (routeState.route === "audio" && audio.audioWorkbench) {
    routeContent = (
      <AdminAudioPage
        audioWorkbench={audio.audioWorkbench}
        assetProvenanceDetail={audio.assetProvenanceDetail}
        assetProvenancePending={audio.assetProvenancePending}
        assetProvenanceErrorMessage={audio.assetProvenanceErrorMessage}
        t={t}
        onOpenAssetProvenance={(assetId) => {
          void audio.handleOpenAssetProvenance(assetId);
        }}
        onCloseAssetProvenance={audio.handleCloseAssetProvenance}
      />
    );
  } else if (routeState.route === "reuse" && reuse.audit) {
    routeContent = (
      <AdminAssetReusePage
        audit={reuse.audit}
        assetProvenanceDetail={reuse.assetProvenanceDetail}
        assetProvenancePending={reuse.assetProvenancePending}
        assetProvenanceErrorMessage={reuse.assetProvenanceErrorMessage}
        t={t}
        onOpenAssetProvenance={(assetId) => {
          void reuse.handleOpenAssetProvenance(assetId);
        }}
        onCloseAssetProvenance={reuse.handleCloseAssetProvenance}
      />
    );
  } else if (overview.overview) {
    routeContent = (
      <AdminOverviewPage
        overview={overview.overview}
        operationsOverview={overview.operationsOverview}
        locale={locale}
        t={t}
        budgetFeedback={overview.budgetFeedback ?? undefined}
        onUpdateBudgetLimit={overview.onUpdateBudgetLimit}
        onNavigateOperationsTarget={(target) => {
          if (target.route === "workflow") {
            applyRouteState({
              ...selectAdminRoute(routeState, "workflow"),
              workflowRunId: target.workflowRunId,
            });
            return;
          }

          applyRouteState({
            ...selectAdminRoute(routeState, "assets"),
            importBatchId: target.importBatchId,
          });
        }}
      />
    );
  }

  return (
    <AdminWorkspaceShell
      route={routeState.route}
      projectId={projectId}
      locale={locale}
      sessionLabel={sessionLabel}
      showClearSession={!identityOverride}
      t={t}
      onLocaleChange={setLocale}
      onNavigateRoute={(route) => {
        applyRouteState(selectAdminRoute(routeState, route));
      }}
      onClearSession={() => {
        void sessionGate.handleClearCurrentSession();
      }}
    >
      {routeContent}
    </AdminWorkspaceShell>
  );
}
