import { useId } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { WorkflowMonitorViewModel } from "../workflow";
import { formatDateTime, metricStyle, panelStyle } from "./shared";

export function WorkflowMonitorPanel({
  workflowMonitor,
  t,
  onWorkflowStatusFilterChange,
  onWorkflowTypeFilterChange,
  onSelectWorkflowRun,
}: {
  workflowMonitor: WorkflowMonitorViewModel;
  t: AdminTranslator;
  onWorkflowStatusFilterChange?: (status: string) => void;
  onWorkflowTypeFilterChange?: (workflowType: string) => void;
  onSelectWorkflowRun?: (workflowRunId: string) => void;
}) {
  const statusFilterId = useId();
  const workflowTypeFilterId = useId();

  return (
    <article style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.05rem" }}>
            {t("workflow.panel.title")}
          </h2>
          <p style={{ ...metricStyle, fontSize: "0.9rem" }}>
            {t("workflow.panel.summary", { count: workflowMonitor.runs.length })}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
            flex: "1 1 360px",
          }}
        >
          <label
            htmlFor={statusFilterId}
            style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
          >
            <span>{t("workflow.filter.status")}</span>
            <select
              id={statusFilterId}
              aria-label={t("workflow.filter.status")}
              value={workflowMonitor.filters.status}
              onChange={(event) => {
                onWorkflowStatusFilterChange?.(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "8px 10px",
                font: "inherit",
                background: "#ffffff",
              }}
            >
              <option value="">{t("workflow.filter.option.all")}</option>
              <option value="running">{t("workflow.filter.option.running")}</option>
              <option value="failed">{t("workflow.filter.option.failed")}</option>
              <option value="succeeded">{t("workflow.filter.option.succeeded")}</option>
              <option value="cancelled">{t("workflow.filter.option.cancelled")}</option>
            </select>
          </label>
          <label
            htmlFor={workflowTypeFilterId}
            style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
          >
            <span>{t("workflow.filter.type")}</span>
            <select
              id={workflowTypeFilterId}
              aria-label={t("workflow.filter.type")}
              value={workflowMonitor.filters.workflowType}
              onChange={(event) => {
                onWorkflowTypeFilterChange?.(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "8px 10px",
                font: "inherit",
                background: "#ffffff",
              }}
            >
              <option value="">{t("workflow.filter.option.all")}</option>
              <option value="shot_pipeline">shot_pipeline</option>
            </select>
          </label>
        </div>
      </div>
      <div style={{ display: "grid", gap: "12px" }}>
        {workflowMonitor.runs.map((run) => (
          <article
            key={run.id}
            style={{
              display: "grid",
              gap: "10px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(255, 255, 255, 0.82)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <strong>{run.id}</strong>
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "8px 14px",
                  background: "#0f766e",
                  color: "#ecfeff",
                  cursor: "pointer",
                }}
                aria-label={t("workflow.detail.button", { id: run.id })}
                onClick={() => {
                  onSelectWorkflowRun?.(run.id);
                }}
              >
                {t("workflow.detail.open")}
              </button>
            </div>
            <p style={metricStyle}>
              {t("workflow.run.summary", {
                workflowType: run.workflowType,
                status: run.status,
                provider: run.provider,
              })}
            </p>
            <p style={metricStyle}>
              {t("workflow.run.step", {
                currentStep: run.currentStep,
                attemptCount: run.attemptCount,
              })}
            </p>
            <p style={metricStyle}>
              {t("workflow.run.updatedAt", {
                updatedAt: formatDateTime(run.updatedAt),
              })}
            </p>
          </article>
        ))}
      </div>
    </article>
  );
}
