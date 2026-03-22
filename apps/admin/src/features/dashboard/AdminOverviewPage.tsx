import type { AdminTranslator, LocaleCode } from "../../i18n";
import type {
  AssetMonitorViewModel,
  AssetProvenanceDetailViewModel,
  ImportBatchDetailViewModel,
} from "./assetMonitor";
import type { AdminGovernanceViewModel } from "./governance";
import type { AdminOverviewViewModel } from "./overview";
import { AdminOverviewHeader } from "./overview-page/AdminOverviewHeader";
import { AdminOverviewSummaryPanels } from "./overview-page/AdminOverviewSummaryPanels";
import { AssetMonitorPanel } from "./overview-page/AssetMonitorPanel";
import { AssetProvenanceDialog } from "./overview-page/AssetProvenanceDialog";
import { GovernanceSessionPanel } from "./overview-page/GovernanceSessionPanel";
import { ImportBatchDetailDialog } from "./overview-page/ImportBatchDetailDialog";
import { type FeedbackMessage } from "./overview-page/shared";
import { WorkflowMonitorPanel } from "./overview-page/WorkflowMonitorPanel";
import { WorkflowRunDetailDialog } from "./overview-page/WorkflowRunDetailDialog";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "./workflow";

type AdminOverviewPageProps = {
  overview: AdminOverviewViewModel;
  governance: AdminGovernanceViewModel;
  workflowMonitor: WorkflowMonitorViewModel;
  assetMonitor: AssetMonitorViewModel;
  workflowRunDetail?: WorkflowRunDetailViewModel | null;
  importBatchDetail?: ImportBatchDetailViewModel | null;
  assetProvenanceDetail?: AssetProvenanceDetailViewModel | null;
  locale: LocaleCode;
  t: AdminTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  onUpdateBudgetLimit?: (input: { projectId: string; limitCents: number }) => void;
  onUpdateUserPreferences?: (input: {
    userId: string;
    displayLocale: string;
    timezone: string;
  }) => void;
  onUpdateMemberRole?: (input: { memberId: string; roleId: string }) => void;
  onUpdateOrgLocaleSettings?: (input: { defaultLocale: string }) => void;
  onWorkflowStatusFilterChange?: (status: string) => void;
  onWorkflowTypeFilterChange?: (workflowType: string) => void;
  onAssetStatusFilterChange?: (status: string) => void;
  onAssetSourceTypeFilterChange?: (sourceType: string) => void;
  onSelectWorkflowRun?: (workflowRunId: string) => void;
  onSelectImportBatch?: (importBatchId: string) => void;
  onSelectAssetProvenance?: (assetId: string) => void;
  onCloseWorkflowDetail?: () => void;
  onCloseImportBatchDetail?: () => void;
  onCloseAssetProvenance?: () => void;
  budgetFeedback?: FeedbackMessage;
  governanceActionFeedback?: FeedbackMessage;
  governanceActionPending?: boolean;
  workflowActionFeedback?: FeedbackMessage;
  workflowActionPending?: boolean;
  assetActionFeedback?: FeedbackMessage;
  assetActionPending?: boolean;
  onCreateRole?: (input: {
    code: string;
    displayName: string;
    permissionCodes: string[];
  }) => void;
  onUpdateRole?: (input: {
    roleId: string;
    displayName: string;
    permissionCodes: string[];
  }) => void;
  onDeleteRole?: (input: { roleId: string }) => void;
  onRetryWorkflowRun?: (workflowRunId: string) => void;
  onCancelWorkflowRun?: (workflowRunId: string) => void;
  selectedImportItemIds?: string[];
  onToggleImportBatchItemSelection?: (input: {
    itemId: string;
    checked: boolean;
  }) => void;
  onConfirmImportBatchItem?: (input: { importBatchId: string; itemId: string }) => void;
  onConfirmSelectedImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onConfirmAllImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onSelectPrimaryAsset?: (input: { shotExecutionId: string; assetId: string }) => void;
};

export function AdminOverviewPage({
  overview,
  governance,
  workflowMonitor,
  assetMonitor,
  workflowRunDetail,
  importBatchDetail,
  assetProvenanceDetail,
  locale,
  t,
  onLocaleChange,
  onUpdateBudgetLimit,
  onUpdateUserPreferences,
  onUpdateMemberRole,
  onUpdateOrgLocaleSettings,
  onWorkflowStatusFilterChange,
  onWorkflowTypeFilterChange,
  onAssetStatusFilterChange,
  onAssetSourceTypeFilterChange,
  onSelectWorkflowRun,
  onSelectImportBatch,
  onSelectAssetProvenance,
  onCloseWorkflowDetail,
  onCloseImportBatchDetail,
  onCloseAssetProvenance,
  budgetFeedback,
  governanceActionFeedback,
  governanceActionPending,
  workflowActionFeedback,
  workflowActionPending,
  assetActionFeedback,
  assetActionPending,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onRetryWorkflowRun,
  onCancelWorkflowRun,
  selectedImportItemIds = [],
  onToggleImportBatchItemSelection,
  onConfirmImportBatchItem,
  onConfirmSelectedImportBatchItems,
  onConfirmAllImportBatchItems,
  onSelectPrimaryAsset,
}: AdminOverviewPageProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 24px 56px",
        background:
          "radial-gradient(circle at top, rgba(240, 249, 255, 0.92), rgba(226, 232, 240, 0.94) 58%, rgba(226, 232, 240, 1))",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "min(1280px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: "24px",
        }}
      >
        <AdminOverviewHeader
          overview={overview}
          locale={locale}
          t={t}
          onLocaleChange={onLocaleChange}
        />

        <AdminOverviewSummaryPanels
          overview={overview}
          t={t}
          onUpdateBudgetLimit={onUpdateBudgetLimit}
          budgetFeedback={budgetFeedback}
        />

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <WorkflowMonitorPanel
            workflowMonitor={workflowMonitor}
            t={t}
            onWorkflowStatusFilterChange={onWorkflowStatusFilterChange}
            onWorkflowTypeFilterChange={onWorkflowTypeFilterChange}
            onSelectWorkflowRun={onSelectWorkflowRun}
          />
          <AssetMonitorPanel
            assetMonitor={assetMonitor}
            t={t}
            onAssetStatusFilterChange={onAssetStatusFilterChange}
            onAssetSourceTypeFilterChange={onAssetSourceTypeFilterChange}
            onSelectImportBatch={onSelectImportBatch}
          />
        </section>

        <section
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <GovernanceSessionPanel
            governance={governance}
            governanceActionFeedback={governanceActionFeedback}
            governanceActionPending={governanceActionPending}
            onUpdateUserPreferences={onUpdateUserPreferences}
            onUpdateMemberRole={onUpdateMemberRole}
            onUpdateOrgLocaleSettings={onUpdateOrgLocaleSettings}
            onCreateRole={onCreateRole}
            onUpdateRole={onUpdateRole}
            onDeleteRole={onDeleteRole}
            t={t}
          />
        </section>
      </div>

      {importBatchDetail && !assetProvenanceDetail ? (
        <ImportBatchDetailDialog
          importBatchDetail={importBatchDetail}
          selectedImportItemIds={selectedImportItemIds}
          assetActionFeedback={assetActionFeedback}
          assetActionPending={assetActionPending}
          onToggleImportBatchItemSelection={onToggleImportBatchItemSelection}
          onConfirmImportBatchItem={onConfirmImportBatchItem}
          onConfirmSelectedImportBatchItems={onConfirmSelectedImportBatchItems}
          onConfirmAllImportBatchItems={onConfirmAllImportBatchItems}
          onSelectPrimaryAsset={onSelectPrimaryAsset}
          onSelectAssetProvenance={onSelectAssetProvenance}
          onCloseImportBatchDetail={onCloseImportBatchDetail}
          t={t}
        />
      ) : null}

      {assetProvenanceDetail ? (
        <AssetProvenanceDialog
          assetProvenanceDetail={assetProvenanceDetail}
          onCloseAssetProvenance={onCloseAssetProvenance}
          t={t}
        />
      ) : null}

      {workflowRunDetail ? (
        <WorkflowRunDetailDialog
          workflowRunDetail={workflowRunDetail}
          workflowActionFeedback={workflowActionFeedback}
          workflowActionPending={workflowActionPending}
          onRetryWorkflowRun={onRetryWorkflowRun}
          onCancelWorkflowRun={onCancelWorkflowRun}
          onCloseWorkflowDetail={onCloseWorkflowDetail}
          t={t}
        />
      ) : null}
    </main>
  );
}
