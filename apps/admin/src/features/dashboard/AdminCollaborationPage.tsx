import type { CSSProperties } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AdminCollaborationSessionViewModel } from "./adminCollaboration";
import { isAdminLeaseStale } from "./adminCollaboration";

type AdminCollaborationPageProps = {
  collaborationSession: AdminCollaborationSessionViewModel;
  t: AdminTranslator;
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

export function AdminCollaborationPage({
  collaborationSession,
  t,
}: AdminCollaborationPageProps) {
  const { session, presences } = collaborationSession;

  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("collaboration.panel.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collaboration.panel.summary", {
              ownerType: session.ownerType,
              ownerId: session.ownerId,
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collaboration.lock.holder", {
              userId: session.lockHolderUserId || t("collaboration.lock.holder.empty"),
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collaboration.lock.draftVersion", {
              draftVersion: session.draftVersion,
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collaboration.lock.expiresAt", {
              leaseExpiresAt: formatTimestamp(
                session.leaseExpiresAt,
                t("collaboration.lock.expiresAt.empty"),
              ),
            })}
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collaboration.lock.conflictSummary", {
              conflictSummary:
                session.conflictSummary || t("collaboration.lock.conflictSummary.empty"),
            })}
          </p>
          {isAdminLeaseStale(session.leaseExpiresAt) ? (
            <p style={{ margin: 0, color: "#b45309" }}>{t("collaboration.alert.stale")}</p>
          ) : null}
        </div>
      </article>

      <article style={panelStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>{t("collaboration.presence.title")}</h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {t("collaboration.presence.count", { count: presences.length })}
          </p>
        </div>
        {presences.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>{t("collaboration.presence.empty")}</p>
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
                  {t("collaboration.presence.item", {
                    status: presence.status,
                    leaseExpiresAt: formatTimestamp(
                      presence.leaseExpiresAt,
                      t("collaboration.lock.expiresAt.empty"),
                    ),
                  })}
                </span>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
