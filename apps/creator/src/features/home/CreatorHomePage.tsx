import type { CSSProperties, FormEvent } from "react";
import type { CreatorTranslator, LocaleCode } from "../../i18n";
import type { ImportBatchSummaryViewModel } from "./loadImportBatchSummaries";

type CreatorHomePageProps = {
  locale: LocaleCode;
  t: CreatorTranslator;
  onLocaleChange: (locale: LocaleCode) => void;
  projectIdInput: string;
  activeProjectId: string | null;
  shotIdInput: string;
  importBatches: ImportBatchSummaryViewModel[];
  importBatchesPending: boolean;
  errorMessage?: string;
  onProjectIdInputChange: (projectId: string) => void;
  onSubmitProjectId: () => void;
  onShotIdInputChange: (shotId: string) => void;
  onSubmitShotId: () => void;
  onOpenImportBatch: (importBatchId: string) => void;
};

const panelStyle: CSSProperties = {
  borderRadius: "20px",
  padding: "24px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,249,255,0.92))",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
};

const inputStyle: CSSProperties = {
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.45)",
  padding: "12px 14px",
  font: "inherit",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#0f172a",
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "10px 18px",
  background: "#0f766e",
  color: "#f0fdfa",
  cursor: "pointer",
  font: "inherit",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: "999px",
  padding: "10px 18px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  font: "inherit",
};

function handleSubmit(event: FormEvent<HTMLFormElement>, callback: () => void) {
  event.preventDefault();
  callback();
}

export function CreatorHomePage({
  locale,
  t,
  onLocaleChange,
  projectIdInput,
  activeProjectId,
  shotIdInput,
  importBatches,
  importBatchesPending,
  errorMessage,
  onProjectIdInputChange,
  onSubmitProjectId,
  onShotIdInputChange,
  onSubmitShotId,
  onOpenImportBatch,
}: CreatorHomePageProps) {
  const hasProjectId = Boolean(activeProjectId);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 30%), linear-gradient(135deg, #f8fafc, #ecfeff 55%, #e0f2fe)",
        color: "#0f172a",
        fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          display: "grid",
          gap: "20px",
        }}
      >
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
            <div style={{ display: "grid", gap: "12px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#0f766e",
                }}
              >
                {t("home.badge")}
              </p>
              <div style={{ display: "grid", gap: "8px" }}>
                <h1 style={{ margin: 0, fontSize: "2rem" }}>{t("home.title")}</h1>
                <p style={{ margin: 0, color: "#334155", maxWidth: "680px" }}>
                  {t("home.description")}
                </p>
              </div>
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
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 0.9fr)",
            gap: "20px",
          }}
        >
          <article style={{ ...panelStyle, display: "grid", gap: "18px" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{t("home.projectId.title")}</h2>
              <p style={{ margin: 0, color: "#475569" }}>{t("home.projectId.description")}</p>
            </div>
            <form
              onSubmit={(event) => {
                handleSubmit(event, onSubmitProjectId);
              }}
              style={{ display: "grid", gap: "12px" }}
            >
              <label style={{ display: "grid", gap: "8px", color: "#334155" }}>
                <span>{t("home.projectId.label")}</span>
                <input
                  aria-label={t("home.projectId.label")}
                  value={projectIdInput}
                  onChange={(event) => {
                    onProjectIdInputChange(event.target.value);
                  }}
                  placeholder={t("home.projectId.placeholder")}
                  style={inputStyle}
                />
              </label>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="submit"
                  disabled={!projectIdInput.trim()}
                  style={{
                    ...primaryButtonStyle,
                    opacity: projectIdInput.trim() ? 1 : 0.55,
                    cursor: projectIdInput.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {t("home.projectId.submit")}
                </button>
                <span style={{ color: "#475569", fontSize: "0.92rem" }}>
                  {hasProjectId
                    ? t("home.projectId.current", { projectId: activeProjectId ?? "" })
                    : t("home.projectId.empty")}
                </span>
              </div>
            </form>
            {importBatchesPending ? (
              <p style={{ margin: 0, color: "#0f766e" }}>{t("home.projectId.loading")}</p>
            ) : errorMessage ? (
              <p style={{ margin: 0, color: "#b91c1c" }}>
                {t("home.projectId.error", { message: errorMessage })}
              </p>
            ) : hasProjectId ? (
              importBatches.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {importBatches.map((batch) => (
                    <article
                      key={batch.id}
                      style={{
                        borderRadius: "18px",
                        padding: "18px",
                        background: "rgba(255, 255, 255, 0.86)",
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "grid", gap: "6px" }}>
                        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{batch.id}</h3>
                        <p style={{ margin: 0, color: "#475569" }}>
                          {t("home.batch.status", { status: batch.status })}
                        </p>
                        <p style={{ margin: 0, color: "#475569" }}>
                          {t("home.batch.sourceType", { sourceType: batch.sourceType })}
                        </p>
                      </div>
                      <div style={{ display: "grid", gap: "6px", color: "#475569", fontSize: "0.92rem" }}>
                        <p style={{ margin: 0 }}>
                          {t("home.batch.uploadSessions", {
                            count: batch.uploadSessionCount,
                          })}
                        </p>
                        <p style={{ margin: 0 }}>
                          {t("home.batch.items", { count: batch.itemCount })}
                        </p>
                        <p style={{ margin: 0 }}>
                          {t("home.batch.confirmedItems", {
                            count: batch.confirmedItemCount,
                          })}
                        </p>
                        <p style={{ margin: 0 }}>
                          {t("home.batch.candidateAssets", {
                            count: batch.candidateAssetCount,
                          })}
                        </p>
                        <p style={{ margin: 0 }}>
                          {t("home.batch.mediaAssets", {
                            count: batch.mediaAssetCount,
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenImportBatch(batch.id);
                        }}
                        style={secondaryButtonStyle}
                      >
                        {t("home.batch.openImport")}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#475569" }}>{t("home.projectId.emptyResults")}</p>
              )
            ) : null}
          </article>

          <article style={{ ...panelStyle, display: "grid", gap: "18px" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{t("home.shotId.title")}</h2>
              <p style={{ margin: 0, color: "#475569" }}>{t("home.shotId.description")}</p>
            </div>
            <form
              onSubmit={(event) => {
                handleSubmit(event, onSubmitShotId);
              }}
              style={{ display: "grid", gap: "12px" }}
            >
              <label style={{ display: "grid", gap: "8px", color: "#334155" }}>
                <span>{t("home.shotId.label")}</span>
                <input
                  aria-label={t("home.shotId.label")}
                  value={shotIdInput}
                  onChange={(event) => {
                    onShotIdInputChange(event.target.value);
                  }}
                  placeholder={t("home.shotId.placeholder")}
                  style={inputStyle}
                />
              </label>
              <button
                type="submit"
                disabled={!shotIdInput.trim()}
                style={{
                  ...secondaryButtonStyle,
                  opacity: shotIdInput.trim() ? 1 : 0.55,
                  cursor: shotIdInput.trim() ? "pointer" : "not-allowed",
                }}
              >
                {t("home.shotId.submit")}
              </button>
            </form>
          </article>
        </section>
      </section>
    </main>
  );
}
