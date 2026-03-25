import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AssetProvenanceDetailViewModel } from "./assetMonitor";
import type { AdminAudioWorkbenchViewModel } from "./adminAudio";
import type { AdminAudioRuntimeViewModel } from "./adminAudioRuntime";
import { loadAdminAudioRuntime } from "./loadAdminAudioRuntime";
import { loadAdminAudioWorkbench } from "./loadAdminAudioWorkbench";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { subscribeAdminAudioRuntime } from "./subscribeAdminAudioRuntime";

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

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
  const [audioRuntime, setAudioRuntime] = useState<AdminAudioRuntimeViewModel | null>(null);
  const [assetProvenanceDetail, setAssetProvenanceDetail] =
    useState<AssetProvenanceDetailViewModel | null>(null);
  const [assetProvenancePending, setAssetProvenancePending] = useState(false);
  const [assetProvenanceErrorMessage, setAssetProvenanceErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState("");
  const audioRuntimeRef = useRef<AdminAudioRuntimeViewModel | null>(null);
  const audioEpisodeId = audioWorkbench?.timeline.episodeId ?? "";
  const audioRuntimeScopeReady =
    Boolean(audioWorkbench) && audioWorkbench?.timeline.projectId === projectId;

  useEffect(() => {
    audioRuntimeRef.current = audioRuntime;
  }, [audioRuntime]);

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setAudioWorkbench(null);
        setAudioRuntime(null);
        setAssetProvenanceDetail(null);
        setAssetProvenancePending(false);
        setAssetProvenanceErrorMessage("");
        setErrorMessage("");
        setRuntimeErrorMessage("");
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
        const message = formatActionError(error, "admin: unknown audio workbench error");
        startTransition(() => {
          setAudioWorkbench(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveOrgId, effectiveUserId, enabled, projectId, sessionState, t]);

  const refreshAudioRuntime = useCallback(async () => {
    if (!audioWorkbench || audioWorkbench.timeline.projectId !== projectId) {
      return null;
    }

    try {
      const nextRuntime = await loadAdminAudioRuntime({
        projectId,
        episodeId: audioWorkbench.timeline.episodeId || undefined,
        orgId: effectiveOrgId,
        userId: effectiveUserId,
      });
      startTransition(() => {
        setAudioRuntime(nextRuntime);
        setRuntimeErrorMessage("");
      });
      return nextRuntime;
    } catch (error: unknown) {
      const message = formatActionError(error, "admin: unknown audio runtime error");
      startTransition(() => {
        setRuntimeErrorMessage(message);
        if (!audioRuntimeRef.current) {
          setAudioRuntime(null);
        }
      });
      throw error;
    }
  }, [audioWorkbench, effectiveOrgId, effectiveUserId, projectId]);

  useEffect(() => {
    if (!enabled || sessionState !== "ready") {
      startTransition(() => {
        setAudioRuntime(null);
        setRuntimeErrorMessage("");
      });
      return;
    }

    if (!audioRuntimeScopeReady) {
      return;
    }

    let cancelled = false;

    refreshAudioRuntime().catch((error: unknown) => {
      if (cancelled) {
        return;
      }
      const message = formatActionError(error, "admin: unknown audio runtime error");
      startTransition(() => {
        setRuntimeErrorMessage(message);
        if (!audioRuntimeRef.current) {
          setAudioRuntime(null);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [audioRuntimeScopeReady, enabled, refreshAudioRuntime, sessionState]);

  useEffect(() => {
    if (
      !enabled ||
      sessionState !== "ready" ||
      !effectiveOrgId ||
      !projectId ||
      !audioRuntimeScopeReady
    ) {
      return;
    }

    return subscribeAdminAudioRuntime({
      organizationId: effectiveOrgId,
      projectId,
      episodeId: audioEpisodeId,
      orgId: effectiveOrgId,
      userId: effectiveUserId,
      onRefreshNeeded: () => {
        void refreshAudioRuntime().catch(() => {
          // refreshAudioRuntime 已负责设置错误消息，这里只负责吞掉未处理的 Promise rejection。
        });
      },
      onError: (error) => {
        startTransition(() => {
          setRuntimeErrorMessage(error.message);
        });
      },
    });
  }, [
    audioEpisodeId,
    audioRuntimeScopeReady,
    effectiveOrgId,
    effectiveUserId,
    enabled,
    projectId,
    refreshAudioRuntime,
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
        const message = formatActionError(error, "admin: unknown asset provenance error");
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
    audioRuntime,
    runtimeErrorMessage,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    errorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
