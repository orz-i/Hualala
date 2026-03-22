import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import type {
  AssetProvenanceDetailViewModel,
  AssetProvenanceStatus,
} from "./assetProvenance";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";

function formatAssetProvenanceError(error: unknown) {
  return error instanceof Error ? error.message : "creator: unknown asset provenance error";
}

export function useAssetProvenanceState({
  t,
  orgId,
  userId,
}: {
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [assetProvenanceStatus, setAssetProvenanceStatus] =
    useState<AssetProvenanceStatus>("idle");
  const [assetProvenanceErrorMessage, setAssetProvenanceErrorMessage] = useState("");
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const resetAssetProvenance = useCallback(() => {
    requestIdRef.current += 1;
    startTransition(() => {
      setSelectedAssetId(null);
      setAssetProvenanceDetail(null);
      setAssetProvenanceStatus("idle");
      setAssetProvenanceErrorMessage("");
    });
  }, []);

  const handleOpenAssetProvenance = useCallback(
    async (assetId: string) => {
      if (!assetId) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      startTransition(() => {
        setSelectedAssetId(assetId);
        setAssetProvenanceDetail(null);
        setAssetProvenanceStatus("loading");
        setAssetProvenanceErrorMessage("");
      });

      try {
        const nextDetail = await loadAssetProvenanceDetails({
          assetId,
          orgId,
          userId,
        });
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        startTransition(() => {
          setSelectedAssetId(assetId);
          setAssetProvenanceDetail(nextDetail);
          setAssetProvenanceStatus("ready");
          setAssetProvenanceErrorMessage("");
        });
      } catch (error: unknown) {
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        startTransition(() => {
          setSelectedAssetId(assetId);
          setAssetProvenanceDetail(null);
          setAssetProvenanceStatus("error");
          setAssetProvenanceErrorMessage(
            t("asset.provenance.error", {
              message: formatAssetProvenanceError(error),
            }),
          );
        });
      }
    },
    [orgId, t, userId],
  );

  return {
    selectedAssetId,
    assetProvenanceDetail,
    assetProvenanceStatus,
    assetProvenancePending: assetProvenanceStatus === "loading",
    assetProvenanceErrorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance: resetAssetProvenance,
    resetAssetProvenance,
  };
}
