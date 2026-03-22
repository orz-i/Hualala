import { startTransition, useCallback, useState } from "react";
import type { AdminTranslator } from "../../../i18n";
import {
  confirmImportBatchItem,
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../mutateAssetMonitor";
import { waitForFeedbackPaint } from "../waitForFeedbackPaint";

export type AssetActionFeedback = {
  tone: "pending" | "success" | "error";
  message: string;
} | null;

export function useAssetActions({
  effectiveOrgId,
  effectiveUserId,
  refreshAssetSilently,
  clearSelectedImportItemIds,
  t,
}: {
  effectiveOrgId: string;
  effectiveUserId: string;
  refreshAssetSilently: () => Promise<void>;
  clearSelectedImportItemIds: () => void;
  t: AdminTranslator;
}) {
  const [assetActionFeedback, setAssetActionFeedback] = useState<AssetActionFeedback>(null);
  const [assetActionPending, setAssetActionPending] = useState(false);

  const runAssetAction = useCallback(
    async ({
      pendingMessage,
      successMessage,
      execute,
      clearSelectionsOnSuccess = false,
    }: {
      pendingMessage: string;
      successMessage: string;
      execute: (input: { orgId: string; userId: string }) => Promise<void>;
      clearSelectionsOnSuccess?: boolean;
    }) => {
      if (assetActionPending) {
        return;
      }

      startTransition(() => {
        setAssetActionPending(true);
        setAssetActionFeedback({
          tone: "pending",
          message: pendingMessage,
        });
      });

      try {
        await waitForFeedbackPaint();
        await execute({
          orgId: effectiveOrgId,
          userId: effectiveUserId,
        });
        await refreshAssetSilently();
        startTransition(() => {
          setAssetActionPending(false);
          setAssetActionFeedback({
            tone: "success",
            message: successMessage,
          });
          if (clearSelectionsOnSuccess) {
            clearSelectedImportItemIds();
          }
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset action error";
        startTransition(() => {
          setAssetActionPending(false);
          setAssetActionFeedback({
            tone: "error",
            message: t("asset.action.error", { message }),
          });
        });
      }
    },
    [
      assetActionPending,
      clearSelectedImportItemIds,
      effectiveOrgId,
      effectiveUserId,
      refreshAssetSilently,
      t,
    ],
  );

  return {
    assetActionFeedback,
    assetActionPending,
    resetAssetActionState: () => {
      startTransition(() => {
        setAssetActionPending(false);
        setAssetActionFeedback(null);
      });
    },
    onConfirmImportBatchItem: (input: { importBatchId: string; itemId: string }) => {
      void runAssetAction({
        pendingMessage: t("asset.action.confirm.pending"),
        successMessage: t("asset.action.confirm.success"),
        clearSelectionsOnSuccess: true,
        execute: (options) =>
          confirmImportBatchItem({
            importBatchId: input.importBatchId,
            itemId: input.itemId,
            ...options,
          }),
      });
    },
    onConfirmSelectedImportBatchItems: (input: {
      importBatchId: string;
      itemIds: string[];
    }) => {
      void runAssetAction({
        pendingMessage: t("asset.action.confirmSelected.pending"),
        successMessage: t("asset.action.confirmSelected.success"),
        clearSelectionsOnSuccess: true,
        execute: (options) =>
          confirmImportBatchItems({
            importBatchId: input.importBatchId,
            itemIds: input.itemIds,
            ...options,
          }),
      });
    },
    onConfirmAllImportBatchItems: (input: {
      importBatchId: string;
      itemIds: string[];
    }) => {
      if (input.itemIds.length === 0) {
        return;
      }

      void runAssetAction({
        pendingMessage: t("asset.action.confirmAll.pending"),
        successMessage: t("asset.action.confirmAll.success"),
        clearSelectionsOnSuccess: true,
        execute: (options) =>
          confirmImportBatchItems({
            importBatchId: input.importBatchId,
            itemIds: input.itemIds,
            ...options,
          }),
      });
    },
    onSelectPrimaryAsset: (input: { shotExecutionId: string; assetId: string }) => {
      void runAssetAction({
        pendingMessage: t("asset.action.selectPrimary.pending"),
        successMessage: t("asset.action.selectPrimary.success"),
        execute: (options) =>
          selectPrimaryAssetForImportBatch({
            shotExecutionId: input.shotExecutionId,
            assetId: input.assetId,
            ...options,
          }),
      });
    },
  };
}
