import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AdminTranslator, LocaleCode } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminPreviewWorkbenchViewModel } from "./adminPreview";
import type { AdminPreviewRuntimeViewModel } from "./adminPreviewRuntime";
import { loadAdminPreviewRuntime } from "./loadAdminPreviewRuntime";
import { loadAdminPreviewWorkbench } from "./loadAdminPreviewWorkbench";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { subscribeAdminPreviewRuntime } from "./subscribeAdminPreviewRuntime";

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
  const [previewRuntime, setPreviewRuntime] =
    useState<AdminPreviewRuntimeViewModel | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [assetProvenancePending, setAssetProvenancePending] = useState(false);
  const [assetProvenanceErrorMessage, setAssetProvenanceErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState("");
  const previewRuntimeRef = useRef<AdminPreviewRuntimeViewModel | null>(null);
  const previewEpisodeId = previewWorkbench?.assembly.episodeId ?? "";

  useEffect(() => {
    previewRuntimeRef.current = previewRuntime;
  }, [previewRuntime]);

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setPreviewWorkbench(null);
        setPreviewRuntime(null);
        setAssetProvenanceDetail(null);
        setAssetProvenancePending(false);
        setAssetProvenanceErrorMessage("");
        setErrorMessage("");
        setRuntimeErrorMessage("");
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

  const refreshPreviewRuntime = useCallback(async () => {
    try {
      const nextRuntime = await loadAdminPreviewRuntime({
        projectId,
        episodeId: previewEpisodeId || undefined,
        orgId: effectiveOrgId,
        userId: effectiveUserId,
      });
      startTransition(() => {
        setPreviewRuntime(nextRuntime);
        setRuntimeErrorMessage("");
      });
      return nextRuntime;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown preview runtime error";
      startTransition(() => {
        setRuntimeErrorMessage(message);
        if (!previewRuntimeRef.current) {
          setPreviewRuntime(null);
        }
      });
      throw error;
    }
  }, [effectiveOrgId, effectiveUserId, previewEpisodeId, projectId]);

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setPreviewRuntime(null);
        setRuntimeErrorMessage("");
      });
      return;
    }

    let cancelled = false;

    refreshPreviewRuntime()
      .then((nextRuntime) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setPreviewRuntime(nextRuntime);
          setRuntimeErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown preview runtime error";
        startTransition(() => {
          setRuntimeErrorMessage(message);
          if (!previewRuntimeRef.current) {
            setPreviewRuntime(null);
          }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    refreshPreviewRuntime,
    sessionState,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      sessionState !== "ready" ||
      !effectiveOrgId ||
      !projectId
    ) {
      return;
    }

    return subscribeAdminPreviewRuntime({
      organizationId: effectiveOrgId,
      projectId,
      episodeId: previewEpisodeId,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
      onRefreshNeeded: () => {
        void refreshPreviewRuntime()
          .then((nextRuntime) => {
            startTransition(() => {
              setPreviewRuntime(nextRuntime);
              setRuntimeErrorMessage("");
            });
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "admin: unknown preview runtime error";
            startTransition(() => {
              setRuntimeErrorMessage(message);
            });
          });
      },
      onError: (error) => {
        startTransition(() => {
          setRuntimeErrorMessage(error.message);
        });
      },
    });
  }, [
    effectiveOrgId,
    enabled,
    previewEpisodeId,
    projectId,
    refreshPreviewRuntime,
    sessionState,
  ]);

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
    previewRuntime,
    runtimeErrorMessage,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    errorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
