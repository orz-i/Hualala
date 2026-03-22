import { startTransition, useCallback, useEffect, useState } from "react";
import type {
  AssetProvenanceDetailViewModel,
  ImportBatchDetailViewModel,
} from "../assetMonitor";
import { loadAssetProvenanceDetails } from "../loadAssetProvenanceDetails";
import { loadImportBatchDetails } from "../loadImportBatchDetails";

type IdentityOverride =
  | {
      orgId: string;
      userId: string;
    }
  | undefined;

export function useAssetDetailState({
  sessionState,
  identityOverride,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  identityOverride: IdentityOverride;
}) {
  const [importBatchDetail, setImportBatchDetail] = useState<ImportBatchDetailViewModel | null>(
    null,
  );
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [selectedImportBatchId, setSelectedImportBatchId] = useState<string | null>(null);
  const [selectedAssetProvenanceId, setSelectedAssetProvenanceId] = useState<string | null>(null);
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<string[]>([]);

  const refreshImportBatchDetail = useCallback(
    async (importBatchId: string) => {
      try {
        const nextImportBatchDetail = await loadImportBatchDetails({
          importBatchId,
          orgId: identityOverride?.orgId,
          userId: identityOverride?.userId,
        });
        startTransition(() => {
          setImportBatchDetail(nextImportBatchDetail);
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown import batch detail error";
        console.warn(message);
      }
    },
    [identityOverride?.orgId, identityOverride?.userId],
  );

  const refreshAssetProvenanceDetail = useCallback(
    async (assetId: string) => {
      try {
        const nextAssetProvenanceDetail = await loadAssetProvenanceDetails({
          assetId,
          orgId: identityOverride?.orgId,
          userId: identityOverride?.userId,
        });
        startTransition(() => {
          setAssetProvenanceDetail(nextAssetProvenanceDetail);
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset provenance error";
        console.warn(message);
      }
    },
    [identityOverride?.orgId, identityOverride?.userId],
  );

  useEffect(() => {
    if (sessionState !== "ready") {
      startTransition(() => {
        setImportBatchDetail(null);
        setAssetProvenanceDetail(null);
        setSelectedImportBatchId(null);
        setSelectedAssetProvenanceId(null);
        setSelectedImportItemIds([]);
      });
    }
  }, [sessionState]);

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
  }, [identityOverride?.orgId, identityOverride?.userId, selectedImportBatchId, sessionState]);

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

  return {
    importBatchDetail,
    assetProvenanceDetail,
    selectedImportBatchId,
    selectedAssetProvenanceId,
    selectedImportItemIds,
    refreshImportBatchDetail,
    refreshAssetProvenanceDetail,
    clearSelectedImportItemIds: () => {
      startTransition(() => {
        setSelectedImportItemIds([]);
      });
    },
    onSelectImportBatch: (importBatchId: string) => {
      startTransition(() => {
        setSelectedImportBatchId(importBatchId);
        setSelectedAssetProvenanceId(null);
        setAssetProvenanceDetail(null);
        setSelectedImportItemIds([]);
      });
    },
    onCloseImportBatchDetail: () => {
      startTransition(() => {
        setSelectedImportBatchId(null);
        setImportBatchDetail(null);
        setSelectedAssetProvenanceId(null);
        setAssetProvenanceDetail(null);
        setSelectedImportItemIds([]);
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
