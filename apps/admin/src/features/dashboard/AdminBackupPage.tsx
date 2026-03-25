import type { AdminTranslator } from "../../i18n";
import type {
  AdminBackupViewModel,
  BackupPackageViewModel,
  BackupPreflightViewModel,
} from "./backup";
import {
  actionButtonBaseStyle,
  actionButtonToneStyles,
  formatDateTime,
  formatFileSize,
  getFeedbackPalette,
  metricStyle,
  panelStyle,
  type FeedbackMessage,
} from "./overview-page/shared";

export function AdminBackupPage({
  backup,
  selectedPackageId,
  restorePreflight,
  backupActionFeedback,
  backupActionPending,
  t,
  onSelectBackupPackage,
  onCreateBackupPackage,
  onDownloadBackupPackage,
  onPreflightRestoreBackupPackage,
  onApplyBackupPackage,
}: {
  backup: AdminBackupViewModel;
  selectedPackageId: string;
  restorePreflight?: BackupPreflightViewModel | null;
  backupActionFeedback?: FeedbackMessage | null;
  backupActionPending?: boolean;
  t: AdminTranslator;
  onSelectBackupPackage?: (packageId: string) => void;
  onCreateBackupPackage?: () => void;
  onDownloadBackupPackage?: () => void;
  onPreflightRestoreBackupPackage?: () => void;
  onApplyBackupPackage?: () => void;
}) {
  const selectedPackage =
    backup.backupPackages.find((item) => item.packageId === selectedPackageId) ?? null;
  const canManageBackup = backup.capabilities.canManageBackup;
  const isRuntimeAvailable = backup.capabilities.isRuntimeAvailable;
  const canRunBackupActions = canManageBackup && isRuntimeAvailable;
  const canApplySelectedPackage =
    Boolean(selectedPackage) &&
    Boolean(restorePreflight) &&
    restorePreflight?.packageId === selectedPackageId &&
    !backupActionPending &&
    canRunBackupActions;

  return (
    <>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.5rem" }}>
          {t("backup.title")}
        </h2>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{t("backup.description")}</p>
      </section>

      <section style={{ ...panelStyle, display: "grid", gap: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <strong>{t("backup.packages.title")}</strong>
            <p style={{ margin: 0, color: "#475569" }}>
              {t("backup.packages.subtitle", {
                count: backup.backupPackages.length,
              })}
            </p>
          </div>
          <button
            type="button"
            disabled={!canRunBackupActions || backupActionPending}
            onClick={onCreateBackupPackage}
            style={{
              ...actionButtonBaseStyle,
              ...(backupActionPending
                ? actionButtonToneStyles.pending
                : actionButtonToneStyles.primary),
            }}
          >
            {t("backup.action.create.label")}
          </button>
        </div>

        {!canManageBackup ? (
          <p style={{ ...metricStyle, color: "#991b1b" }}>{t("backup.capability.missing")}</p>
        ) : !isRuntimeAvailable ? (
          <div style={{ display: "grid", gap: "8px" }}>
            <p style={{ ...metricStyle, margin: 0, color: "#991b1b" }}>
              {t("backup.runtime.unavailable")}
            </p>
            {backup.capabilities.unavailableReason ? (
              <p style={{ ...metricStyle, margin: 0, color: "#9a3412" }}>
                {t("backup.runtime.unavailable.detail", {
                  message: backup.capabilities.unavailableReason,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {backupActionFeedback ? (
          <p style={{ margin: 0, ...getFeedbackPalette(backupActionFeedback) }}>
            {backupActionFeedback.message}
          </p>
        ) : null}

        {backup.backupPackages.length === 0 && canRunBackupActions ? (
          <p style={{ ...metricStyle, margin: 0 }}>{t("backup.empty")}</p>
        ) : backup.backupPackages.length > 0 ? (
          <div style={{ display: "grid", gap: "12px" }}>
            {backup.backupPackages.map((item) => {
              const isSelected = item.packageId === selectedPackageId;
              return (
                <button
                  key={item.packageId}
                  type="button"
                  onClick={() => {
                    onSelectBackupPackage?.(item.packageId);
                  }}
                  style={{
                    borderRadius: "18px",
                    border: isSelected
                      ? "1px solid rgba(14, 116, 144, 0.45)"
                      : "1px solid rgba(148, 163, 184, 0.35)",
                    padding: "16px",
                    background: isSelected
                      ? "rgba(236, 254, 255, 0.95)"
                      : "rgba(255, 255, 255, 0.72)",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                    <strong>{item.packageId}</strong>
                    <span style={{ color: "#475569" }}>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <span style={metricStyle}>
                      {t("backup.metric.projects", { count: item.projectIds.length })}
                    </span>
                    <span style={metricStyle}>
                      {t("backup.metric.workflowRuns", {
                        count: item.counts.workflow_runs ?? 0,
                      })}
                    </span>
                    <span style={metricStyle}>
                      {t("backup.metric.payloadBytes", {
                        size: formatFileSize(item.payloadBytes),
                      })}
                    </span>
                  </div>
                  <span style={{ color: "#475569" }}>
                    {t("backup.metric.createdBy", {
                      userId: item.createdByUserId || "-",
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {selectedPackage ? (
        <section style={{ ...panelStyle, display: "grid", gap: "18px" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <strong>{t("backup.selected.title", { packageId: selectedPackage.packageId })}</strong>
            <p style={{ margin: 0, color: "#475569" }}>
              {t("backup.selected.scope", {
                orgCount: selectedPackage.orgIds.length,
                projectCount: selectedPackage.projectIds.length,
              })}
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!canRunBackupActions || backupActionPending}
              onClick={onDownloadBackupPackage}
              style={{
                ...actionButtonBaseStyle,
                ...(backupActionPending
                  ? actionButtonToneStyles.pending
                  : actionButtonToneStyles.close),
              }}
            >
              {t("backup.action.download.label")}
            </button>
            <button
              type="button"
              disabled={!canRunBackupActions || backupActionPending}
              onClick={onPreflightRestoreBackupPackage}
              style={{
                ...actionButtonBaseStyle,
                ...(backupActionPending
                  ? actionButtonToneStyles.pending
                  : actionButtonToneStyles.confirm),
              }}
            >
              {t("backup.action.preflight.label")}
            </button>
            <button
              type="button"
              disabled={!canApplySelectedPackage}
              onClick={onApplyBackupPackage}
              style={{
                ...actionButtonBaseStyle,
                ...(canApplySelectedPackage
                  ? actionButtonToneStyles.cancel
                  : actionButtonToneStyles.pending),
              }}
            >
              {t("backup.action.apply.label")}
            </button>
          </div>

          {restorePreflight?.packageId === selectedPackage.packageId ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <span style={metricStyle}>
                  {t("backup.metric.currentProjects", {
                    count: restorePreflight.currentSummary.projectIds.length,
                  })}
                </span>
                <span style={metricStyle}>
                  {t("backup.metric.restoreProjects", {
                    count: restorePreflight.packageSummary.projectIds.length,
                  })}
                </span>
                <span style={metricStyle}>
                  {t("backup.metric.destructive", {
                    destructive: restorePreflight.destructive
                      ? t("backup.destructive.yes")
                      : t("backup.destructive.no"),
                  })}
                </span>
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {restorePreflight.warnings.map((warning) => (
                  <p key={warning} style={{ margin: 0, color: "#9a3412" }}>
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ ...metricStyle, margin: 0 }}>{t("backup.preflight.hint")}</p>
          )}
        </section>
      ) : null}
    </>
  );
}
