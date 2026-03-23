import type { AdminTranslator, LocaleCode } from "../../../i18n";
import type { AdminOverviewViewModel } from "../overview";
import { panelStyle } from "./shared";

export function AdminOverviewHeader({
  overview,
  locale,
  t,
}: {
  overview: AdminOverviewViewModel;
  locale: LocaleCode;
  t: AdminTranslator;
}) {
  return (
    <header style={panelStyle}>
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#0f766e",
        }}
      >
        {t("nav.overview")}
      </p>
      <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>
        {overview.budgetSnapshot.projectId}
      </h1>
      <p style={{ margin: 0, color: "#334155" }}>
        {t("app.summary", {
          shotExecutionId: overview.reviewSummary.shotExecutionId,
          latestConclusion: overview.reviewSummary.latestConclusion,
        })}
      </p>
      <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: "0.9rem" }}>
        {t("governance.session.locale", { locale })}
      </p>
    </header>
  );
}
