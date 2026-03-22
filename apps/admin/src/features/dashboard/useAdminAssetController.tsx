import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type {
  AssetMonitorViewModel,
  AssetProvenanceDetailViewModel,
  ImportBatchDetailViewModel,
} from "./assetMonitor";
import { loadAssetMonitorPanel } from "./loadAssetMonitorPanel";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { loadImportBatchDetails } from "./loadImportBatchDetails";
import {
  confirmImportBatchItem,
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "./mutateAssetMonitor";
import { waitForFeedbackPaint } from "./waitForFeedbackPaint";

type IdentityOverride =
  | {
      orgId: string;
      userId: string;
    }
  | undefined;

type ActionFeedback = {
  tone: "pending" | "success" | "error";
  message: string;
} | null;

export function useAdminAssetController({
  sessionState,
  projectId,
  identityOverride,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  projectId: string;
  identityOverride: IdentityOverride;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [assetMonitorState, setAssetMonitorState] =
    useState<AssetMonitorViewModel | null>(null);
  const [importBatchDetail, setImportBatchDetail] =
    useState<ImportBatchDetailViewModel | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [selectedImportBatchId, setSelectedImportBatchId] = useState<string | null>(null);
  const [selectedAssetProvenanceId, setSelectedAssetProvenanceId] = useState<string | null>(
    null,
  );
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<string[]>([]);
  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [assetSourceTypeFilter, setAssetSourceTypeFilter] = useState("");
  const [assetActionFeedback, setAssetActionFeedback] = useState<ActionFeedback>(null);
  const [assetActionPending, setAssetActionPending] = useState(false);
  const assetRefreshStateRef = useRef({
    running: false,
    queued: false,
  });

  const refreshAssetMonitor = useCallback(async () => {
    const nextAssetMonitor = await loadAssetMonitorPanel({
      projectId,
      status: assetStatusFilter,
      sourceType: assetSourceTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    });
    startTransition(() => {
      setAssetMonitorState(nextAssetMonitor);
    });
  }, [
    assetSourceTypeFilter,
    assetStatusFilter,
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
  ]);

  const refreshImportBatchDetail = useCallback(
    async (importBatchId: string) => {
      const nextImportBatchDetail = await loadImportBatchDetails({
        importBatchId,
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setImportBatchDetail(nextImportBatchDetail);
      });
    },
    [identityOverride?.orgId, identityOverride?.userId],
  );

  const refreshAssetProvenanceDetail = useCallback(
    async (assetId: string) => {
      const nextAssetProvenanceDetail = await loadAssetProvenanceDetails({
        assetId,
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setAssetProvenanceDetail(nextAssetProvenanceDetail);
      });
    },
    [identityOverride?.orgId, identityOverride?.userId],
  );

  const refreshAssetSilently = useCallback(async () => {
    if (assetRefreshStateRef.current.running) {
      assetRefreshStateRef.current.queued = true;
      return;
    }

    assetRefreshStateRef.current.running = true;

    try {
      await refreshAssetMonitor();
      if (selectedImportBatchId) {
        await refreshImportBatchDetail(selectedImportBatchId);
      }
      if (selectedAssetProvenanceId) {
        await refreshAssetProvenanceDetail(selectedAssetProvenanceId);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown asset refresh error";
      console.warn(message);
    } finally {
      assetRefreshStateRef.current.running = false;
      if (assetRefreshStateRef.current.queued) {
        assetRefreshStateRef.current.queued = false;
        void refreshAssetSilently();
      }
    }
  }, [
    refreshAssetMonitor,
    refreshAssetProvenanceDetail,
    refreshImportBatchDetail,
    selectedAssetProvenanceId,
    selectedImportBatchId,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
      startTransition(() => {
        setAssetMonitorState(null);
        setImportBatchDetail(null);
        setAssetProvenanceDetail(null);
        setSelectedImportBatchId(null);
        setSelectedAssetProvenanceId(null);
        setSelectedImportItemIds([]);
        setAssetActionFeedback(null);
        setAssetActionPending(false);
      });
      return;
    }

    let cancelled = false;

    loadAssetMonitorPanel({
      projectId,
      status: assetStatusFilter,
      sourceType: assetSourceTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextAssetMonitor) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetMonitorState(nextAssetMonitor);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset monitor error";
        console.warn(message);
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetMonitorState({
            filters: {
              status: assetStatusFilter,
              sourceType: assetSourceTypeFilter,
            },
            importBatches: [],
          });
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    assetSourceTypeFilter,
    assetStatusFilter,
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
    sessionState,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
      return;
    }
    if (!selectedImportBatchId) {
      startTransition(() => {
        setImportBatchDetail(null);
      });
      return;
    }

    let cancelled = false;

    loadImportBatchDetails({
      importBatchId: selectedImportBatchId,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextImportBatchDetail) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setImportBatchDetail(nextImportBatchDetail);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown import batch detail error";
        console.warn(message);
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    selectedImportBatchId,
    sessionState,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
      return;
    }
    if (!selectedAssetProvenanceId) {
      startTransition(() => {
        setAssetProvenanceDetail(null);
      });
      return;
    }

    let cancelled = false;

    loadAssetProvenanceDetails({
      assetId: selectedAssetProvenanceId,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextAssetProvenanceDetail) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetProvenanceDetail(nextAssetProvenanceDetail);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset provenance error";
        console.warn(message);
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityOverride?.orgId,
    identityOverride?.userId,
    selectedAssetProvenanceId,
    sessionState,
  ]);

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
            setSelectedImportItemIds([]);
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
    [assetActionPending, effectiveOrgId, effectiveUserId, refreshAssetSilently, t],
  );

  return {
    assetMonitor:
      assetMonitorState ??
      ({
        filters: {
          status: assetStatusFilter,
          sourceType: assetSourceTypeFilter,
        },
        importBatches: [],
      } satisfies AssetMonitorViewModel),
    importBatchDetail,
    assetProvenanceDetail,
    selectedImportItemIds,
    assetActionFeedback,
    assetActionPending,
    refreshAssetSilently,
    onAssetStatusFilterChange: (status: string) => {
      startTransition(() => {
        setAssetStatusFilter(status);
      });
    },
    onAssetSourceTypeFilterChange: (sourceType: string) => {
      startTransition(() => {
        setAssetSourceTypeFilter(sourceType);
      });
    },
    onSelectImportBatch: (importBatchId: string) => {
      startTransition(() => {
        setSelectedImportBatchId(importBatchId);
        setSelectedAssetProvenanceId(null);
        setAssetProvenanceDetail(null);
        setSelectedImportItemIds([]);
        setAssetActionFeedback(null);
        setAssetActionPending(false);
      });
    },
    onCloseImportBatchDetail: () => {
      startTransition(() => {
        setSelectedImportBatchId(null);
        setImportBatchDetail(null);
        setSelectedAssetProvenanceId(null);
        setAssetProvenanceDetail(null);
        setSelectedImportItemIds([]);
        setAssetActionFeedback(null);
        setAssetActionPending(false);
      });
    },
    onToggleImportBatchItemSelection: (input: { itemId: string; checked: boolean }) => {
      startTransition(() => {
        setSelectedImportItemIds((current) => {
          if (input.checked) {
            return current.includes(input.itemId) ? current : [...current, input.itemId];
          }
          return current.filter((candidateId) => candidateId !== input.itemId);
        });
      });
    },
    onConfirmImportBatchItem: (input: { importBatchId: string; itemId: string }) =>
      runAssetAction({
        pendingMessage: t("asset.action.confirm.pending"),
        successMessage: t("asset.action.confirm.success"),
        clearSelectionsOnSuccess: true,
        execute: (options) =>
          confirmImportBatchItem({
            importBatchId: input.importBatchId,
            itemId: input.itemId,
            ...options,
          }),
      }),
    onConfirmSelectedImportBatchItems: (input: {
      importBatchId: string;
      itemIds: string[];
    }) =>
      runAssetAction({
        pendingMessage: t("asset.action.confirmSelected.pending"),
        successMessage: t("asset.action.confirmSelected.success"),
        clearSelectionsOnSuccess: true,
        execute: (options) =>
          confirmImportBatchItems({
            importBatchId: input.importBatchId,
            itemIds: input.itemIds,
            ...options,
          }),
      }),
    onConfirmAllImportBatchItems: (input: {
      importBatchId: string;
      itemIds: string[];
    }) => {
      if (input.itemIds.length === 0) {
        return Promise.resolve();
      }

      return runAssetAction({
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
    onSelectPrimaryAsset: (input: { shotExecutionId: string; assetId: string }) =>
      runAssetAction({
        pendingMessage: t("asset.action.selectPrimary.pending"),
        successMessage: t("asset.action.selectPrimary.success"),
        execute: (options) =>
          selectPrimaryAssetForImportBatch({
            shotExecutionId: input.shotExecutionId,
            assetId: input.assetId,
            ...options,
          }),
      }),
    onSelectAssetProvenance: (assetId: string) => {
      startTransition(() => {
        setSelectedAssetProvenanceId(assetId);
      });
    },
    onCloseAssetProvenance: () => {
      startTransition(() => {
        setSelectedAssetProvenanceId(null);
        setAssetProvenanceDetail(null);
      });
    },
  };
}
