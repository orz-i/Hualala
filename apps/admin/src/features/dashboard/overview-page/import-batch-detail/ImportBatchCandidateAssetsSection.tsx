import type { AdminTranslator } from "../../../../i18n";
import type { ImportBatchCandidateAssetViewModel } from "../../assetMonitor";
import { actionButtonBaseStyle, actionButtonToneStyles, metricStyle } from "../shared";

export function ImportBatchCandidateAssetsSection({
  candidateAssets,
  assetActionPending,
  onSelectPrimaryAsset,
  onSelectAssetProvenance,
  t,
}: {
  candidateAssets: ImportBatchCandidateAssetViewModel[];
  assetActionPending?: boolean;
  onSelectPrimaryAsset?: (input: { shotExecutionId: string; assetId: string }) => void;
  onSelectAssetProvenance?: (assetId: string) => void;
  t: AdminTranslator;
}) {
  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <h3 style={{ margin: 0 }}>{t("asset.detail.candidateAssets")}</h3>
      {candidateAssets.map((candidate) => (
        <article
          key={candidate.id}
          style={{
            display: "grid",
            gap: "10px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "#ffffff",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <strong>{candidate.id}</strong>
          <p style={metricStyle}>
            {t("asset.candidate.summary", {
              shotExecutionId: candidate.shotExecutionId || "none",
              sourceRunId: candidate.sourceRunId || "none",
            })}
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={metricStyle}>
              {t("asset.candidate.assetId", { assetId: candidate.assetId || "none" })}
            </span>
            {candidate.assetId ? (
              <>
                <button
                  type="button"
                  aria-label={t("asset.provenance.button", { assetId: candidate.assetId })}
                  onClick={() => {
                    onSelectAssetProvenance?.(candidate.assetId);
                  }}
                  style={{
                    border: 0,
                    borderRadius: "999px",
                    padding: "8px 14px",
                    background: "#0f766e",
                    color: "#ecfeff",
                    cursor: "pointer",
                  }}
                >
                  {t("asset.provenance.open")}
                </button>
                {candidate.shotExecutionId ? (
                  <button
                    type="button"
                    disabled={Boolean(assetActionPending)}
                    aria-label={t("asset.action.selectPrimary.buttonLabel", {
                      candidateId: candidate.id,
                    })}
                    onClick={() => {
                      onSelectPrimaryAsset?.({
                        shotExecutionId: candidate.shotExecutionId,
                        assetId: candidate.assetId,
                      });
                    }}
                    style={{
                      ...actionButtonBaseStyle,
                      ...(assetActionPending
                        ? actionButtonToneStyles.pending
                        : actionButtonToneStyles.primary),
                    }}
                  >
                    {t("asset.action.selectPrimary.button")}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
