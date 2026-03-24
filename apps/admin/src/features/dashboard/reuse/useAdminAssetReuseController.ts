import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { AssetProvenanceDetailViewModel } from "../assetMonitor";
import { loadAssetProvenanceDetails } from "../loadAssetProvenanceDetails";
import type { AdminAssetReuseAuditViewModel } from "./adminAssetReuse";
import { loadAdminAssetReuseAudit } from "./loadAdminAssetReuseAudit";

export function useAdminAssetReuseController({
  sessionState,
  enabled,
  projectId,
  shotExecutionId,
  effectiveOrgId,
  effectiveUserId,
  t,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  enabled: boolean;
  projectId: string;
  shotExecutionId: string;
  effectiveOrgId: string;
  effectiveUserId: string;
  t: AdminTranslator;
}) {
  const [audit, setAudit] = useState<AdminAssetReuseAuditViewModel | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [assetProvenancePending, setAssetProvenancePending] = useState(false);
  const [assetProvenanceErrorMessage, setAssetProvenanceErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setAudit(null);
        setAssetProvenanceDetail(null);
        setAssetProvenancePending(false);
        setAssetProvenanceErrorMessage("");
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;

    loadAdminAssetReuseAudit({
      projectId,
      shotExecutionId,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
    })
      .then((nextAudit) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAudit(nextAudit);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown asset reuse audit error";
        startTransition(() => {
          setAudit(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveOrgId, effectiveUserId, enabled, projectId, sessionState, shotExecutionId, t]);

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
    audit,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    errorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
