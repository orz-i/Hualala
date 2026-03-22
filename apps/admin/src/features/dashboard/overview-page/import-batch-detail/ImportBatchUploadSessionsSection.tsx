import type { AdminTranslator } from "../../../../i18n";
import type { ImportBatchDetailViewModel } from "../../assetMonitor";
import { formatFileSize, metricStyle } from "../shared";

export function ImportBatchUploadSessionsSection({
  importBatchDetail,
  t,
}: {
  importBatchDetail: ImportBatchDetailViewModel;
  t: AdminTranslator;
}) {
  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <h3 style={{ margin: 0 }}>{t("asset.detail.uploadSessions")}</h3>
      {importBatchDetail.uploadSessions.map((session) => (
        <article
          key={session.id}
          style={{
            display: "grid",
            gap: "6px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "#ffffff",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <strong>{session.fileName || session.id}</strong>
          <p style={metricStyle}>
            {t("asset.uploadSession.summary", {
              status: session.status,
              size: formatFileSize(session.sizeBytes),
              retryCount: session.retryCount,
            })}
          </p>
          <p style={metricStyle}>
            {t("asset.uploadSession.checksum", { checksum: session.checksum || "none" })}
          </p>
        </article>
      ))}
    </section>
  );
}
