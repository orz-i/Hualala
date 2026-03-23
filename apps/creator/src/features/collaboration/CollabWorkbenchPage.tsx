import type { CSSProperties, ReactNode } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { isLeaseStale, type CollaborationSessionViewModel } from "./collaboration";

type CollabWorkbenchPageProps = {
  collaborationSession: CollaborationSessionViewModel;
  t: CreatorTranslator;
  shellHeader?: ReactNode;
  feedback?: ActionFeedbackModel;
  claimDraftVersionInput: string;
  conflictSummaryInput: string;
  onClaimDraftVersionInputChange: (value: string) => void;
  onConflictSummaryInputChange: (value: string) => void;
  onClaimLease: () => void;
  onReleaseLease: () => void;
};

const panelStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "#ffffff",
  padding: "20px",
  display: "grid",
  gap: "14px",
  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)",
};

function formatTimestamp(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function CollabWorkbenchPage({
  collaborationSession,
  t,
  shellHeader,
  claimDraftVersionInput,
  conflictSummaryInput,
  onClaimDraftVersionInputChange,
  onConflictSummaryInputChange,
  onClaimLease,
  onReleaseLease,
}: CollabWorkbenchPageProps) {
  const { session, presences } = collaborationSession;

  return (
    <main style={{ display: "grid", gap: "24px", padding: "0 24px 40px" }}>
      {shellHeader}

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("collab.section.lock")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collab.lock.holder", {
              userId: session.lockHolderUserId || t("collab.lock.holder.empty"),
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collab.lock.draftVersion", { draftVersion: session.draftVersion })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collab.lock.expiresAt", {
              leaseExpiresAt: formatTimestamp(
                session.leaseExpiresAt,
                t("collab.lock.expiresAt.empty"),
              ),
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collab.lock.conflictSummary", {
              conflictSummary:
                session.conflictSummary || t("collab.lock.conflictSummary.empty"),
            })}
          </p>
          {isLeaseStale(session.leaseExpiresAt) ? (
            <p style={{ margin: 0, color: "#b45309" }}>{t("collab.alert.stale")}</p>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span>{t("collab.inputs.draftVersion")}</span>
            <input
              value={claimDraftVersionInput}
              onChange={(event) => {
                onClaimDraftVersionInputChange(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "10px 12px",
                font: "inherit",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span>{t("collab.inputs.conflictSummary")}</span>
            <input
              value={conflictSummaryInput}
              onChange={(event) => {
                onConflictSummaryInputChange(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "10px 12px",
                font: "inherit",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onClaimLease}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "10px 18px",
              background: "#0f766e",
              color: "#f0fdfa",
              cursor: "pointer",
            }}
          >
            {t("collab.actions.claimLease")}
          </button>
          <button
            type="button"
            onClick={onReleaseLease}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.45)",
              borderRadius: "999px",
              padding: "10px 18px",
              background: "#ffffff",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            {t("collab.actions.releaseLease")}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("collab.section.presence")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collab.presence.count", { count: presences.length })}
          </p>
        </div>
        {presences.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("collab.presence.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {presences.map((presence) => (
              <article
                key={presence.presenceId || `${presence.userId}-${presence.status}`}
                style={{
                  borderRadius: "14px",
                  background: "rgba(241, 245, 249, 0.9)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: "4px",
                }}
              >
                <strong>{presence.userId}</strong>
                <span style={{ color: "#475569" }}>
                  {t("collab.presence.item", {
                    status: presence.status,
                    leaseExpiresAt: formatTimestamp(
                      presence.leaseExpiresAt,
                      t("collab.lock.expiresAt.empty"),
                    ),
                  })}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
