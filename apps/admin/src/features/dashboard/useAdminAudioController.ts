import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminAudioWorkbenchViewModel } from "./adminAudio";
import { loadAdminAudioWorkbench } from "./loadAdminAudioWorkbench";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";

export function useAdminAudioController({
  sessionState,
  enabled,
  projectId,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  enabled: boolean;
  projectId: string;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [audioWorkbench, setAudioWorkbench] = useState<AdminAudioWorkbenchViewModel | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [assetProvenancePending, setAssetProvenancePending] = useState(false);
  const [assetProvenanceErrorMessage, setAssetProvenanceErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setAudioWorkbench(null);
        setAssetProvenanceDetail(null);
        setAssetProvenancePending(false);
        setAssetProvenanceErrorMessage("");
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;

    loadAdminAudioWorkbench({
      projectId,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
    })
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAudioWorkbench(nextWorkbench);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown audio workbench error";
        startTransition(() => {
          setAudioWorkbench(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveOrgId, effectiveUserId, enabled, projectId, sessionState, t]);

  const handleOpenAssetProvenance = useCallback(
    async (assetId: string) => {
      if (!assetId) {
        return;
      }

      startTransition(() => {
        setAssetProvenanceDetail(null);
        setAssetProvenancePending(true);
        setAssetProvenanceErrorMessage("");
      });

      try {
        const nextDetail = await loadAssetProvenanceDetails({
          assetId,
          orgId: effectiveOrgId,
          userId: effectiveUserId,
        });
        startTransition(() => {
          setAssetProvenanceDetail(nextDetail);
          setAssetProvenancePending(false);
          setAssetProvenanceErrorMessage("");
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset provenance error";
        startTransition(() => {
          setAssetProvenanceDetail(null);
          setAssetProvenancePending(false);
          setAssetProvenanceErrorMessage(message);
        });
      }
    },
    [effectiveOrgId, effectiveUserId],
  );

  const handleCloseAssetProvenance = useCallback(() => {
    startTransition(() => {
      setAssetProvenanceDetail(null);
      setAssetProvenancePending(false);
      setAssetProvenanceErrorMessage("");
    });
  }, []);

  return {
    audioWorkbench,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    errorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
