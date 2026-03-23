import type { AdminTranslator } from "../../i18n";
import type {
  WorkflowMonitorViewModel,
  WorkflowRunDetailViewModel,
} from "./workflow";
import { WorkflowMonitorPanel } from "./overview-page/WorkflowMonitorPanel";
import { WorkflowRunDetailDialog } from "./overview-page/WorkflowRunDetailDialog";
import { panelStyle, type FeedbackMessage } from "./overview-page/shared";

export function AdminWorkflowPage({
  workflowMonitor,
  workflowRunDetail,
  workflowActionFeedback,
  workflowActionPending,
  t,
  onWorkflowStatusFilterChange,
  onWorkflowTypeFilterChange,
  onSelectWorkflowRun,
  onCloseWorkflowDetail,
  onRetryWorkflowRun,
  onCancelWorkflowRun,
}: {
  workflowMonitor: WorkflowMonitorViewModel;
  workflowRunDetail?: WorkflowRunDetailViewModel | null;
  workflowActionFeedback?: FeedbackMessage;
  workflowActionPending?: boolean;
  t: AdminTranslator;
  onWorkflowStatusFilterChange?: (status: string) => void;
  onWorkflowTypeFilterChange?: (workflowType: string) => void;
  onSelectWorkflowRun?: (workflowRunId: string) => void;
  onCloseWorkflowDetail?: () => void;
  onRetryWorkflowRun?: (workflowRunId: string) => void;
  onCancelWorkflowRun?: (workflowRunId: string) => void;
}) {
  return (
    <>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.5rem" }}>
          {t("workflow.panel.title")}
        </h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("workflow.panel.summary", { count: workflowMonitor.runs.length })}
        </p>
      </section>

      <WorkflowMonitorPanel
        workflowMonitor={workflowMonitor}
        t={t}
        onWorkflowStatusFilterChange={onWorkflowStatusFilterChange}
        onWorkflowTypeFilterChange={onWorkflowTypeFilterChange}
        onSelectWorkflowRun={onSelectWorkflowRun}
      />

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
    </>
  );
}
