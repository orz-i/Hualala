import type { ReactNode } from "react";
import type { AdminTranslator, LocaleCode } from "../i18n";
import type { AdminRoute } from "./adminRoutes";

type AdminWorkspaceShellProps = {
  route: AdminRoute;
  projectId: string;
  locale: LocaleCode;
  sessionLabel: string;
  showClearSession: boolean;
  t: AdminTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  onNavigateRoute: (route: AdminRoute) => void;
  onClearSession?: () => void;
  children: ReactNode;
};

const navItems: Array<{
  route: AdminRoute;
  key:
    | "nav.overview"
    | "nav.workflow"
    | "nav.assets"
    | "nav.audio"
    | "nav.preview"
    | "nav.collaboration"
    | "nav.governance";
}> = [
  { route: "overview", key: "nav.overview" },
  { route: "workflow", key: "nav.workflow" },
  { route: "assets", key: "nav.assets" },
  { route: "audio", key: "nav.audio" },
  { route: "preview", key: "nav.preview" },
  { route: "collaboration", key: "nav.collaboration" },
  { route: "governance", key: "nav.governance" },
];

export function AdminWorkspaceShell({
  route,
  projectId,
  locale,
  sessionLabel,
  showClearSession,
  t,
  onLocaleChange,
  onNavigateRoute,
  onClearSession,
  children,
}: AdminWorkspaceShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr)",
        background:
          "radial-gradient(circle at top left, rgba(240, 249, 255, 0.96), rgba(226, 232, 240, 0.94) 58%, rgba(226, 232, 240, 1))",
        color: "#0f172a",
      }}
    >
      <aside
        style={{
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          gap: "24px",
          padding: "28px 20px",
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))",
          color: "#e2e8f0",
        }}
      >
        <div style={{ display: "grid", gap: "8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#67e8f9",
            }}
          >
            {t("app.badge")}
          </p>
          <h1 style={{ margin: 0, fontSize: "1.45rem", lineHeight: 1.2 }}>{projectId}</h1>
        </div>

        <nav style={{ display: "grid", gap: "10px" }} aria-label={t("nav.primary")}>
          {navItems.map((item) => {
            const isActive = item.route === route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => {
                  onNavigateRoute(item.route);
                }}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  borderRadius: "18px",
                  padding: "12px 14px",
                  textAlign: "left",
                  font: "inherit",
                  background: isActive ? "rgba(56, 189, 248, 0.18)" : "rgba(15, 23, 42, 0.32)",
                  color: isActive ? "#ecfeff" : "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                {t(item.key)}
              </button>
            );
          })}
        </nav>

        <div />

        <div style={{ display: "grid", gap: "12px" }}>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.9rem", lineHeight: 1.5 }}>
            {sessionLabel}
          </p>
          {showClearSession ? (
            <button
              type="button"
              onClick={onClearSession}
              style={{
                border: 0,
                borderRadius: "999px",
                padding: "10px 16px",
                background: "#cbd5e1",
                color: "#0f172a",
                cursor: "pointer",
                justifySelf: "start",
              }}
            >
              {t("session.clear")}
            </button>
          ) : null}
        </div>
      </aside>

      <div style={{ display: "grid", gap: "24px", padding: "28px 24px 40px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <label style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}>
            <span>{t("locale.label")}</span>
            <select
              data-testid="ui-locale-select"
              value={locale}
              onChange={(event) => {
                onLocaleChange(event.target.value as LocaleCode);
              }}
              style={{
                minWidth: "164px",
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
        {children}
      </div>
    </main>
  );
}
