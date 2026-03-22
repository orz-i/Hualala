import type { AdminTranslator, LocaleCode } from "../../../i18n";
import type { AdminOverviewViewModel } from "../overview";
import { panelStyle } from "./shared";

export function AdminOverviewHeader({
  overview,
  locale,
  t,
  onLocaleChange,
}: {
  overview: AdminOverviewViewModel;
  locale: LocaleCode;
  t: AdminTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
}) {
  return (
    <header style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#0f766e",
          }}
        >
          {t("app.badge")}
        </p>
        <label
          style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}
        >
          <span>{t("locale.label")}</span>
          <select
            data-testid="ui-locale-select"
            value={locale}
            onChange={(event) => {
              onLocaleChange(event.target.value as LocaleCode);
            }}
            style={{
              borderRadius: "12px",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              padding: "8px 10px",
              font: "inherit",
              background: "#ffffff",
            }}
          >
            <option value="zh-CN">{t("locale.option.zh-CN")}</option>
            <option value="en-US">{t("locale.option.en-US")}</option>
          </select>
        </label>
      </div>
      <h1 style={{ margin: "12px 0 8px", fontSize: "2rem" }}>
        {overview.budgetSnapshot.projectId}
      </h1>
      <p style={{ margin: 0, color: "#334155" }}>
        {t("app.summary", {
          shotExecutionId: overview.reviewSummary.shotExecutionId,
          latestConclusion: overview.reviewSummary.latestConclusion,
        })}
      </p>
    </header>
  );
}
