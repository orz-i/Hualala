import { useLocaleState } from "../i18n";
import { AdminOverviewPage } from "../features/dashboard/AdminOverviewPage";
import { useAdminAssetController } from "../features/dashboard/useAdminAssetController";
import { useAdminOverviewGovernance } from "../features/dashboard/useAdminOverviewGovernance";
import { useAdminRecentChangesSubscription } from "../features/dashboard/useAdminRecentChangesSubscription";
import { useAdminWorkflowController } from "../features/dashboard/useAdminWorkflowController";
import { useAdminSessionGate } from "../features/session/useAdminSessionGate";

export function App() {
  const { locale, setLocale, t } = useLocaleState();

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get("projectId") ?? "project-demo-001";
  const shotExecutionId = searchParams.get("shotExecutionId") ?? "shot-exec-demo-001";
  const overrideOrgId = searchParams.get("orgId") ?? undefined;
  const overrideUserId = searchParams.get("userId") ?? undefined;
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

  const overviewGovernance = useAdminOverviewGovernance({
    sessionState: sessionGate.sessionState,
    projectId,
    shotExecutionId,
    identityOverride,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const workflow = useAdminWorkflowController({
    sessionState: sessionGate.sessionState,
    projectId,
    identityOverride,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  const asset = useAdminAssetController({
    sessionState: sessionGate.sessionState,
    projectId,
    identityOverride,
    effectiveOrgId: sessionGate.effectiveOrgId,
    effectiveUserId: sessionGate.effectiveUserId,
    t,
  });

  useAdminRecentChangesSubscription({
    sessionState: sessionGate.sessionState,
    hasOverview: Boolean(overviewGovernance.overview),
    subscriptionOrgId: sessionGate.subscriptionOrgId,
    projectId,
    onRecentChange: overviewGovernance.applyRecentChange,
    onWorkflowUpdated: () => {
      void workflow.refreshWorkflowSilently();
    },
    onAssetImportBatchUpdated: () => {
      void asset.refreshAssetSilently();
    },
    onError: (error) => {
      console.warn(error.message);
    },
  });

  const errorMessage = sessionGate.errorMessage || overviewGovernance.errorMessage;

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

  if (!overviewGovernance.overview || !overviewGovernance.governance) {
    return <main style={{ padding: "32px" }}>{t("app.loading")}</main>;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          padding: "16px 24px 0",
        }}
      >
        <p style={{ margin: 0, color: "#334155" }}>
          {identityOverride
            ? t("session.override.active", {
                orgId: identityOverride.orgId,
                userId: identityOverride.userId,
              })
            : t("session.active", { userId: sessionGate.session?.userId ?? "" })}
        </p>
        {!identityOverride ? (
          <button
            type="button"
            onClick={() => {
              void sessionGate.handleClearCurrentSession();
            }}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "8px 14px",
              background: "#cbd5e1",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            {t("session.clear")}
          </button>
        ) : null}
      </div>
      <AdminOverviewPage
        overview={overviewGovernance.overview}
        governance={overviewGovernance.governance}
        workflowMonitor={workflow.workflowMonitor}
        assetMonitor={asset.assetMonitor}
        workflowRunDetail={workflow.workflowRunDetail}
        importBatchDetail={asset.importBatchDetail}
        assetProvenanceDetail={asset.assetProvenanceDetail}
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        budgetFeedback={overviewGovernance.budgetFeedback ?? undefined}
        governanceActionFeedback={overviewGovernance.governanceActionFeedback ?? undefined}
        governanceActionPending={overviewGovernance.governanceActionPending}
        workflowActionFeedback={workflow.workflowActionFeedback ?? undefined}
        workflowActionPending={workflow.workflowActionPending}
        assetActionFeedback={asset.assetActionFeedback ?? undefined}
        assetActionPending={asset.assetActionPending}
        onUpdateBudgetLimit={overviewGovernance.onUpdateBudgetLimit}
        onUpdateUserPreferences={overviewGovernance.onUpdateUserPreferences}
        onUpdateMemberRole={overviewGovernance.onUpdateMemberRole}
        onUpdateOrgLocaleSettings={overviewGovernance.onUpdateOrgLocaleSettings}
        onCreateRole={overviewGovernance.onCreateRole}
        onUpdateRole={overviewGovernance.onUpdateRole}
        onDeleteRole={overviewGovernance.onDeleteRole}
        onWorkflowStatusFilterChange={workflow.onWorkflowStatusFilterChange}
        onWorkflowTypeFilterChange={workflow.onWorkflowTypeFilterChange}
        onSelectWorkflowRun={workflow.onSelectWorkflowRun}
        onCloseWorkflowDetail={workflow.onCloseWorkflowDetail}
        onRetryWorkflowRun={workflow.onRetryWorkflowRun}
        onCancelWorkflowRun={workflow.onCancelWorkflowRun}
        onAssetStatusFilterChange={asset.onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={asset.onAssetSourceTypeFilterChange}
        onSelectImportBatch={asset.onSelectImportBatch}
        onCloseImportBatchDetail={asset.onCloseImportBatchDetail}
        selectedImportItemIds={asset.selectedImportItemIds}
        onToggleImportBatchItemSelection={asset.onToggleImportBatchItemSelection}
        onConfirmImportBatchItem={asset.onConfirmImportBatchItem}
        onConfirmSelectedImportBatchItems={asset.onConfirmSelectedImportBatchItems}
        onConfirmAllImportBatchItems={asset.onConfirmAllImportBatchItems}
        onSelectPrimaryAsset={asset.onSelectPrimaryAsset}
        onSelectAssetProvenance={asset.onSelectAssetProvenance}
        onCloseAssetProvenance={asset.onCloseAssetProvenance}
      />
    </>
  );
}
