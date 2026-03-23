import type { CSSProperties, ReactNode } from "react";
import type { CreatorTranslator, LocaleCode } from "../i18n";

type CreatorWorkspaceShellTone = "home" | "shots" | "imports" | "collab" | "preview";

type CreatorWorkspaceShellProps = {
  tone: CreatorWorkspaceShellTone;
  badge: string;
  title: string;
  description: string;
  sessionLabel: string;
  locale: LocaleCode;
  t: CreatorTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  onClearSession?: () => void;
  onBackHome?: () => void;
  feedback?: ReactNode;
};

const toneStyles: Record<
  CreatorWorkspaceShellTone,
  { badgeColor: string; accentBackground: string }
> = {
  home: {
    badgeColor: "#0f766e",
    accentBackground:
      "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,249,255,0.92))",
  },
  shots: {
    badgeColor: "#92400e",
    accentBackground:
      "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,243,235,0.92))",
  },
  imports: {
    badgeColor: "#1d4ed8",
    accentBackground:
      "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(237,244,255,0.9))",
  },
  collab: {
    badgeColor: "#be123c",
    accentBackground:
      "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,241,242,0.92))",
  },
  preview: {
    badgeColor: "#4338ca",
    accentBackground:
      "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(238,242,255,0.92))",
  },
};

const sectionStyle: CSSProperties = {
  borderRadius: "20px",
  padding: "24px",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "20px",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: "999px",
  padding: "10px 16px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  font: "inherit",
};

const quietButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "8px 14px",
  background: "#cbd5e1",
  color: "#0f172a",
  cursor: "pointer",
  font: "inherit",
};

export function CreatorWorkspaceShell({
  tone,
  badge,
  title,
  description,
  sessionLabel,
  locale,
  t,
  onLocaleChange,
  onClearSession,
  onBackHome,
  feedback,
}: CreatorWorkspaceShellProps) {
  const palette = toneStyles[tone];

  return (
    <section
      style={{
        ...sectionStyle,
        background: palette.accentBackground,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, color: "#334155" }}>{sessionLabel}</p>
        {onClearSession ? (
          <button type="button" onClick={onClearSession} style={quietButtonStyle}>
            {t("session.clear")}
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {onBackHome ? (
              <button type="button" onClick={onBackHome} style={secondaryButtonStyle}>
                {t("shell.backHome")}
              </button>
            ) : null}
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: palette.badgeColor,
                alignSelf: "center",
              }}
            >
              {badge}
            </p>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "2rem" }}>{title}</h1>
            <p style={{ margin: 0, color: "#334155", maxWidth: "680px" }}>{description}</p>
          </div>
          {feedback}
        </div>
        <label style={{ display: "grid", gap: "6px", fontSize: "0.9rem", color: "#334155" }}>
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
    </section>
  );
}
