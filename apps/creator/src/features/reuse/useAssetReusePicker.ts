import { startTransition, useCallback, useEffect, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { loadShotWorkbench } from "../shot-workbench/loadShotWorkbench";
import { selectPrimaryAssetForShotWorkbench } from "../shot-workbench/mutateShotWorkbench";
import type { ShotWorkbenchViewModel } from "../shot-workbench/ShotWorkbenchPage";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { loadReusableAssetLibrary } from "./loadReusableAssetLibrary";
import type { ReusableAssetLibraryItemViewModel } from "./reuse";

function formatReuseError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

export function useAssetReusePicker({
  enabled,
  projectId,
  shotId,
  sourceProjectId,
  t,
  orgId,
  userId,
}: {
  enabled: boolean;
  projectId: string;
  shotId: string;
  sourceProjectId: string;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
}) {
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [reusableAssets, setReusableAssets] = useState<ReusableAssetLibraryItemViewModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const {
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
    resetAssetProvenance,
  } = useAssetProvenanceState({
    t,
    orgId,
    userId,
  });

  useEffect(() => {
    if (!enabled) {
      resetAssetProvenance();
      startTransition(() => {
        setShotWorkbench(null);
        setReusableAssets([]);
        setLoading(false);
        setFeedback(null);
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;
    resetAssetProvenance();
    startTransition(() => {
      setLoading(true);
      setErrorMessage("");
    });

    Promise.allSettled([
      loadShotWorkbench({
        shotId,
        orgId,
        userId,
      }),
      loadReusableAssetLibrary({
        currentProjectId: projectId,
        sourceProjectId,
        orgId,
        userId,
      }),
    ])
      .then(([shotResult, reusableAssetsResult]) => {
        if (cancelled) {
          return;
        }

        if (shotResult.status === "rejected") {
          startTransition(() => {
            setShotWorkbench(null);
            setReusableAssets([]);
            setLoading(false);
            setFeedback(null);
            setErrorMessage(
              formatReuseError(
                shotResult.reason,
                "creator: unknown cross-project asset reuse error",
              ),
            );
          });
          return;
        }

        const nextReusableAssets =
          reusableAssetsResult.status === "fulfilled" ? reusableAssetsResult.value : [];
        const nextErrorMessage =
          reusableAssetsResult.status === "rejected"
            ? formatReuseError(
                reusableAssetsResult.reason,
                "creator: unknown cross-project asset reuse error",
              )
            : "";

        startTransition(() => {
          setShotWorkbench(shotResult.value);
          setReusableAssets(nextReusableAssets);
          setLoading(false);
          setFeedback(null);
          setErrorMessage(nextErrorMessage);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setShotWorkbench(null);
          setReusableAssets([]);
          setLoading(false);
          setFeedback(null);
          setErrorMessage(
            formatReuseError(error, "creator: unknown cross-project asset reuse error"),
          );
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orgId, projectId, resetAssetProvenance, shotId, sourceProjectId, t, userId]);

  const handleApplyReuse = useCallback(
    async (assetId: string) => {
      const reusableAsset = reusableAssets.find((item) => item.assetId === assetId);
      if (!reusableAsset || !shotWorkbench?.shotExecution.id) {
        return;
      }

      if (!reusableAsset.allowed) {
        startTransition(() => {
          setFeedback({
            tone: "error",
            message: reusableAsset.blockedReason,
          });
        });
        return;
      }

      try {
        await selectPrimaryAssetForShotWorkbench({
          shotExecutionId: shotWorkbench.shotExecution.id,
          assetId: reusableAsset.assetId,
          orgId,
          userId,
        });
        startTransition(() => {
          setShotWorkbench({
            ...shotWorkbench,
            shotExecution: {
              ...shotWorkbench.shotExecution,
              primaryAssetId: reusableAsset.assetId,
            },
          });
          setFeedback({
            tone: "success",
            message: t("feedback.success.selectShotPrimary"),
          });
          setErrorMessage("");
        });
      } catch (error: unknown) {
        const message = formatReuseError(error, "creator: unknown cross-project reuse mutation error");
        startTransition(() => {
          setFeedback({
            tone: "error",
            message: t("feedback.error.selectShotPrimary", { message }),
          });
        });
      }
    },
    [orgId, reusableAssets, shotWorkbench, t, userId],
  );

  return {
    shotWorkbench,
    reusableAssets,
    loading,
    feedback,
    errorMessage,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleApplyReuse,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
