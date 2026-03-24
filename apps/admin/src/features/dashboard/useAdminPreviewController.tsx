import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator, LocaleCode } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminPreviewWorkbenchViewModel } from "./adminPreview";
import { loadAdminPreviewWorkbench } from "./loadAdminPreviewWorkbench";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";

export function useAdminPreviewController({
  sessionState,
  enabled,
  projectId,
  locale,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  enabled: boolean;
  projectId: string;
  locale: LocaleCode;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [previewWorkbench, setPreviewWorkbench] =
    useState<AdminPreviewWorkbenchViewModel | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [assetProvenancePending, setAssetProvenancePending] = useState(false);
  const [assetProvenanceErrorMessage, setAssetProvenanceErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setPreviewWorkbench(null);
        setAssetProvenanceDetail(null);
        setAssetProvenancePending(false);
        setAssetProvenanceErrorMessage("");
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;

    loadAdminPreviewWorkbench({
      projectId,
      displayLocale: locale,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
    })
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setPreviewWorkbench(nextWorkbench);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown preview workbench error";
        startTransition(() => {
          setPreviewWorkbench(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveOrgId, effectiveUserId, enabled, locale, projectId, sessionState, t]);

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
    previewWorkbench,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    errorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
