import type { AdminTranslator } from "../../../../i18n";
import type { ImportBatchDetailViewModel } from "../../assetMonitor";
import { actionButtonBaseStyle, actionButtonToneStyles, metricStyle } from "../shared";
import type { ImportBatchSelections } from "./helpers";

export function ImportBatchItemsSection({
  importBatchDetail,
  selectedImportItemIds = [],
  derivedSelections,
  assetActionPending,
  onToggleImportBatchItemSelection,
  onConfirmImportBatchItem,
  onConfirmSelectedImportBatchItems,
  onConfirmAllImportBatchItems,
  t,
}: {
  importBatchDetail: ImportBatchDetailViewModel;
  selectedImportItemIds?: string[];
  derivedSelections: ImportBatchSelections;
  assetActionPending?: boolean;
  onToggleImportBatchItemSelection?: (input: { itemId: string; checked: boolean }) => void;
  onConfirmImportBatchItem?: (input: { importBatchId: string; itemId: string }) => void;
  onConfirmSelectedImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  onConfirmAllImportBatchItems?: (input: {
    importBatchId: string;
    itemIds: string[];
  }) => void;
  t: AdminTranslator;
}) {
  const { actionableImportItemIds, selectedActionableImportItemIds } = derivedSelections;

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <h3 style={{ margin: 0 }}>{t("asset.detail.items")}</h3>
          <p style={metricStyle}>
            {t("asset.action.selection.summary", {
              selectedCount: selectedActionableImportItemIds.length,
              actionableCount: actionableImportItemIds.length,
            })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={Boolean(assetActionPending) || selectedActionableImportItemIds.length === 0}
            onClick={() => {
              onConfirmSelectedImportBatchItems?.({
                importBatchId: importBatchDetail.batch.id,
                itemIds: selectedActionableImportItemIds,
              });
            }}
            style={{
              ...actionButtonBaseStyle,
              ...(assetActionPending || selectedActionableImportItemIds.length === 0
                ? actionButtonToneStyles.pending
                : actionButtonToneStyles.confirm),
            }}
          >
            {t("asset.action.confirmSelected.button")}
          </button>
          <button
            type="button"
            disabled={Boolean(assetActionPending) || actionableImportItemIds.length === 0}
            onClick={() => {
              onConfirmAllImportBatchItems?.({
                importBatchId: importBatchDetail.batch.id,
                itemIds: actionableImportItemIds,
              });
            }}
            style={{
              ...actionButtonBaseStyle,
              ...(assetActionPending || actionableImportItemIds.length === 0
                ? actionButtonToneStyles.pending
                : actionButtonToneStyles.confirm),
            }}
          >
            {t("asset.action.confirmAll.button")}
          </button>
        </div>
      </div>
      {importBatchDetail.items.map((item) => (
        <article
          key={item.id}
          style={{
            display: "grid",
            gap: "6px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "#ffffff",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <strong>{item.id}</strong>
          <p style={metricStyle}>
            {t("asset.item.summary", { status: item.status, assetId: item.assetId || "none" })}
          </p>
          {item.status !== "confirmed" && item.assetId ? (
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#334155",
                  fontSize: "0.95rem",
                }}
              >
                <input
                  type="checkbox"
                  aria-label={t("asset.action.selection.item", { itemId: item.id })}
                  checked={selectedImportItemIds.includes(item.id)}
                  disabled={Boolean(assetActionPending)}
                  onChange={(event) => {
                    onToggleImportBatchItemSelection?.({
                      itemId: item.id,
                      checked: event.currentTarget.checked,
                    });
                  }}
                />
                {t("asset.action.selection.label")}
              </label>
              <button
                type="button"
                disabled={Boolean(assetActionPending)}
                aria-label={t("asset.action.confirm.buttonLabel", { itemId: item.id })}
                onClick={() => {
                  onConfirmImportBatchItem?.({
                    importBatchId: importBatchDetail.batch.id,
                    itemId: item.id,
                  });
                }}
                style={{
                  ...actionButtonBaseStyle,
                  ...(assetActionPending
                    ? actionButtonToneStyles.pending
                    : actionButtonToneStyles.confirm),
                }}
              >
                {t("asset.action.confirm.button")}
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
