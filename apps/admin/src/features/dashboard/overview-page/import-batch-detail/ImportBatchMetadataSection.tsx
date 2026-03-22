import type { AdminTranslator } from "../../../../i18n";
import type { ImportBatchDetailViewModel } from "../../assetMonitor";
import { metricStyle } from "../shared";

export function ImportBatchMetadataSection({
  importBatchDetail,
  t,
}: {
  importBatchDetail: ImportBatchDetailViewModel;
  t: AdminTranslator;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px",
      }}
    >
      <p style={metricStyle}>
        {t("asset.detail.project", { projectId: importBatchDetail.batch.projectId })}
      </p>
      <p style={metricStyle}>
        {t("asset.detail.org", { orgId: importBatchDetail.batch.orgId })}
      </p>
      <p style={metricStyle}>
        {t("asset.detail.operator", { operatorId: importBatchDetail.batch.operatorId })}
      </p>
      <p style={metricStyle}>
        {t("asset.detail.sourceType", { sourceType: importBatchDetail.batch.sourceType })}
      </p>
      <p style={metricStyle}>
        {t("asset.detail.status", { status: importBatchDetail.batch.status })}
      </p>
      <p style={metricStyle}>
        {t("asset.detail.section.summary", {
          uploadSessionCount: importBatchDetail.uploadSessions.length,
          itemCount: importBatchDetail.items.length,
          candidateAssetCount: importBatchDetail.candidateAssets.length,
          mediaAssetCount: importBatchDetail.mediaAssets.length,
        })}
      </p>
    </div>
  );
}
