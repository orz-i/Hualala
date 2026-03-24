import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { CreatorTranslator, LocaleCode } from "../../i18n";
import { buildPreviewAudioSummary, type PreviewAudioSummaryViewModel } from "../audio/audioWorkbench";
import { loadAudioWorkbench } from "../audio/loadAudioWorkbench";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { useQueuedSilentRefresh } from "../shared/useQueuedSilentRefresh";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import { loadPreviewShotOptions } from "./loadPreviewShotOptions";
import { loadPreviewRuntime } from "./loadPreviewRuntime";
import { loadPreviewWorkbench } from "./loadPreviewWorkbench";
import { savePreviewWorkbench } from "./mutatePreviewWorkbench";
import type {
  PreviewItemViewModel,
  PreviewShotOptionViewModel,
  PreviewWorkbenchViewModel,
} from "./previewWorkbench";
import { hydratePreviewDraftItemsFromLocale } from "./previewWorkbench";
import type { PreviewRuntimeViewModel } from "./previewRuntime";
import { requestPreviewRender } from "./requestPreviewRender";
import { subscribePreviewRuntime } from "./subscribePreviewRuntime";

type UsePreviewWorkbenchControllerOptions = {
  enabled: boolean;
  projectId: string;
  locale: LocaleCode;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
};

function buildOrderedDraftItems(items: PreviewItemViewModel[]) {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
  }));
}

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

export function usePreviewWorkbenchController({
  enabled,
  projectId,
  locale,
  t,
  orgId,
  userId,
}: UsePreviewWorkbenchControllerOptions) {
  const [previewWorkbench, setPreviewWorkbench] = useState<PreviewWorkbenchViewModel | null>(null);
  const [draftItems, setDraftItems] = useState<PreviewItemViewModel[]>([]);
  const [feedback, setFeedback] = useState<ActionFeedbackModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [audioSummary, setAudioSummary] = useState<PreviewAudioSummaryViewModel | null>(null);
  const [audioSummaryErrorMessage, setAudioSummaryErrorMessage] = useState("");
  const [shotOptions, setShotOptions] = useState<PreviewShotOptionViewModel[]>([]);
  const [shotOptionsErrorMessage, setShotOptionsErrorMessage] = useState("");
  const [previewRuntime, setPreviewRuntime] = useState<PreviewRuntimeViewModel | null>(null);
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState("");
  const [requestRenderPending, setRequestRenderPending] = useState(false);
  const [selectedShotOptionId, setSelectedShotOptionId] = useState("");
  const [manualShotIdInput, setManualShotIdInput] = useState("");
  const draftIdRef = useRef(1);
  const draftItemsRef = useRef<PreviewItemViewModel[]>([]);
  const previewWorkbenchRef = useRef<PreviewWorkbenchViewModel | null>(null);
  const shotOptionsRef = useRef<PreviewShotOptionViewModel[]>([]);
  const previewRuntimeRef = useRef<PreviewRuntimeViewModel | null>(null);
  const hydratedScopeKeyRef = useRef<string | null>(null);
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
    draftItemsRef.current = draftItems;
  }, [draftItems]);

  useEffect(() => {
    previewWorkbenchRef.current = previewWorkbench;
  }, [previewWorkbench]);

  useEffect(() => {
    shotOptionsRef.current = shotOptions;
  }, [shotOptions]);

  useEffect(() => {
    previewRuntimeRef.current = previewRuntime;
  }, [previewRuntime]);

  const previewEpisodeId = previewWorkbench?.assembly.episodeId ?? "";

  useEffect(() => {
    if (!enabled) {
      resetAssetProvenance();
      hydratedScopeKeyRef.current = null;
      startTransition(() => {
        setPreviewWorkbench(null);
        setDraftItems([]);
        setFeedback(null);
        setErrorMessage("");
        setAudioSummary(null);
        setAudioSummaryErrorMessage("");
        setShotOptions([]);
        setShotOptionsErrorMessage("");
        setPreviewRuntime(null);
        setRuntimeErrorMessage("");
        setRequestRenderPending(false);
        setSelectedShotOptionId("");
        setManualShotIdInput("");
      });
      return;
    }

    let cancelled = false;
    resetAssetProvenance();
    const scopeKey = [projectId, orgId ?? "", userId ?? ""].join(":");

    Promise.allSettled([
      loadPreviewWorkbench({
        projectId,
        displayLocale: locale,
        orgId,
        userId,
      }),
      loadPreviewShotOptions({
        projectId,
        displayLocale: locale,
        orgId,
        userId,
      }),
      loadAudioWorkbench({
        projectId,
        orgId,
        userId,
      }),
    ]).then(([previewResult, shotOptionsResult, audioResult]) => {
      if (cancelled) {
        return;
      }

      const isHydratingExistingScope = hydratedScopeKeyRef.current === scopeKey;
      const hasExistingPreviewWorkbench = previewWorkbenchRef.current !== null;
      const hasExistingShotOptions = shotOptionsRef.current.length > 0;

      if (previewResult.status === "rejected") {
        const message =
          previewResult.reason instanceof Error
            ? previewResult.reason.message
            : "creator: unknown preview workbench error";
        if (isHydratingExistingScope && hasExistingPreviewWorkbench) {
          startTransition(() => {
            setFeedback(null);
            setErrorMessage("");
          });
          return;
        }
        startTransition(() => {
          setPreviewWorkbench(null);
          setDraftItems([]);
          setFeedback(null);
          setErrorMessage(message);
          setAudioSummary(null);
          setAudioSummaryErrorMessage("");
          setShotOptions([]);
          setShotOptionsErrorMessage("");
          setSelectedShotOptionId("");
        });
        return;
      }

      startTransition(() => {
        setPreviewWorkbench(previewResult.value);
        const nextShotOptions =
          shotOptionsResult.status === "fulfilled" ? shotOptionsResult.value : [];
        if (isHydratingExistingScope) {
          setDraftItems(
            hydratePreviewDraftItemsFromLocale({
              draftItems: draftItemsRef.current,
              localizedItems: previewResult.value.items,
              shotOptions: nextShotOptions,
            }),
          );
        } else {
          setDraftItems(buildOrderedDraftItems(previewResult.value.items));
        }
        setFeedback(null);
        setErrorMessage("");
        hydratedScopeKeyRef.current = scopeKey;

        if (shotOptionsResult.status === "fulfilled") {
          setShotOptions(nextShotOptions);
          setShotOptionsErrorMessage("");
          setSelectedShotOptionId((currentValue) => {
            if (nextShotOptions.some((option) => option.shotId === currentValue)) {
              return currentValue;
            }
            return nextShotOptions[0]?.shotId ?? "";
          });
        } else {
          const message =
            shotOptionsResult.reason instanceof Error
              ? shotOptionsResult.reason.message
              : "creator: unknown preview shot options error";
          setShotOptionsErrorMessage(message);
          if (!isHydratingExistingScope || !hasExistingShotOptions) {
            setShotOptions([]);
            setSelectedShotOptionId("");
          }
        }

        if (audioResult.status === "fulfilled") {
          setAudioSummary(buildPreviewAudioSummary(audioResult.value));
          setAudioSummaryErrorMessage("");
        } else {
          const message =
            audioResult.reason instanceof Error
              ? audioResult.reason.message
              : "creator: unknown preview audio summary error";
          setAudioSummary(null);
          setAudioSummaryErrorMessage(message);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, locale, orgId, projectId, resetAssetProvenance, t, userId]);

  const refreshPreviewRuntime = useCallback(async () => {
    try {
      const nextRuntime = await loadPreviewRuntime({
        projectId,
        episodeId: previewWorkbenchRef.current?.assembly.episodeId || undefined,
        orgId,
        userId,
      });
      startTransition(() => {
        setPreviewRuntime(nextRuntime);
        setRuntimeErrorMessage("");
      });
      return nextRuntime;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "creator: unknown preview runtime error";
      startTransition(() => {
        setRuntimeErrorMessage(message);
        if (!previewRuntimeRef.current) {
          setPreviewRuntime(null);
        }
      });
      throw error;
    }
  }, [orgId, projectId, userId]);

  const scheduleSilentPreviewRuntimeRefresh = useQueuedSilentRefresh(
    "preview-runtime",
    refreshPreviewRuntime,
  );

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setPreviewRuntime(null);
        setRuntimeErrorMessage("");
        setRequestRenderPending(false);
      });
      return;
    }

    let cancelled = false;

    loadPreviewRuntime({
      projectId,
      episodeId: previewEpisodeId || undefined,
      orgId,
      userId,
    })
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
          error instanceof Error ? error.message : "creator: unknown preview runtime error";
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
  }, [enabled, orgId, previewEpisodeId, projectId, userId]);

  useEffect(() => {
    if (!enabled || !orgId || !projectId) {
      return;
    }

    return subscribePreviewRuntime({
      organizationId: orgId,
      projectId,
      episodeId: previewEpisodeId,
      orgId,
      userId,
      onRefreshNeeded: scheduleSilentPreviewRuntimeRefresh,
      onError: (error) => {
        startTransition(() => {
          setRuntimeErrorMessage(error.message);
        });
      },
    });
  }, [
    enabled,
    orgId,
    previewEpisodeId,
    projectId,
    scheduleSilentPreviewRuntimeRefresh,
    userId,
  ]);

  const requestRenderDisabledReason = !draftItems.length
    ? t("preview.runtime.disabled.emptyAssembly")
    : requestRenderPending
      ? t("preview.runtime.disabled.pending")
      : previewRuntime?.renderStatus === "queued" || previewRuntime?.renderStatus === "running"
        ? t("preview.runtime.disabled.active")
        : "";

  const handleAddItemFromChooser = useCallback(() => {
    if (!previewWorkbench || !selectedShotOptionId) {
      return;
    }

    const selectedShotOption = shotOptions.find((option) => option.shotId === selectedShotOptionId);
    if (!selectedShotOption) {
      return;
    }

    const nextItem: PreviewItemViewModel = {
      itemId: `draft-${draftIdRef.current}`,
      assemblyId: previewWorkbench.assembly.assemblyId,
      shotId: selectedShotOption.shotId,
      primaryAssetId: selectedShotOption.currentPrimaryAssetSummary?.assetId ?? "",
      sourceRunId: selectedShotOption.latestRunSummary?.runId ?? "",
      sequence: draftItems.length + 1,
      shotSummary: selectedShotOption.shotSummary,
      primaryAssetSummary: selectedShotOption.currentPrimaryAssetSummary,
      sourceRunSummary: selectedShotOption.latestRunSummary,
    };
    draftIdRef.current += 1;

    startTransition(() => {
      setDraftItems((currentItems) => buildOrderedDraftItems([...currentItems, nextItem]));
    });
  }, [draftItems.length, previewWorkbench, selectedShotOptionId, shotOptions]);

  const handleAddManualItem = useCallback(() => {
    const nextShotId = manualShotIdInput.trim();
    if (!nextShotId || !previewWorkbench) {
      return;
    }

    const nextItem: PreviewItemViewModel = {
      itemId: `draft-${draftIdRef.current}`,
      assemblyId: previewWorkbench.assembly.assemblyId,
      shotId: nextShotId,
      primaryAssetId: "",
      sourceRunId: "",
      sequence: draftItems.length + 1,
      shotSummary: null,
      primaryAssetSummary: null,
      sourceRunSummary: null,
    };
    draftIdRef.current += 1;

    startTransition(() => {
      setDraftItems((currentItems) => buildOrderedDraftItems([...currentItems, nextItem]));
      setManualShotIdInput("");
    });
  }, [draftItems.length, manualShotIdInput, previewWorkbench]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setDraftItems((currentItems) =>
      buildOrderedDraftItems(currentItems.filter((item) => item.itemId !== itemId)),
    );
  }, []);

  const handleMoveItem = useCallback((itemId: string, direction: "up" | "down") => {
    setDraftItems((currentItems) => {
      const itemIndex = currentItems.findIndex((item) => item.itemId === itemId);
      if (itemIndex < 0) {
        return currentItems;
      }

      const nextIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
      if (nextIndex < 0 || nextIndex >= currentItems.length) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [movedItem] = nextItems.splice(itemIndex, 1);
      nextItems.splice(nextIndex, 0, movedItem);
      return buildOrderedDraftItems(nextItems);
    });
  }, []);

  const handleSaveAssembly = useCallback(async () => {
    if (!previewWorkbench) {
      return;
    }

    startTransition(() => {
      setFeedback({
        tone: "pending",
        message: t("feedback.pending.savePreview"),
      });
    });

    try {
      await waitForFeedbackPaint();
      const nextWorkbench = await savePreviewWorkbench({
        projectId,
        status: previewWorkbench.assembly.status,
        items: draftItems,
        orgId,
        userId,
      });
      const hydratedSavedItems = hydratePreviewDraftItemsFromLocale({
        draftItems: buildOrderedDraftItems(nextWorkbench.items),
        localizedItems: draftItems,
        shotOptions,
      });
      startTransition(() => {
        setPreviewWorkbench({
          ...nextWorkbench,
          items: hydratedSavedItems,
        });
        setDraftItems(hydratedSavedItems);
        setFeedback({
          tone: "success",
          message: t("feedback.success.savePreview"),
        });
        setErrorMessage("");
      });
    } catch (error: unknown) {
      const message = formatActionError(error, "creator: unknown preview save error");
      startTransition(() => {
        setFeedback({
          tone: "error",
          message: t("feedback.error.savePreview", { message }),
        });
      });
    }
  }, [draftItems, orgId, previewWorkbench, projectId, t, userId]);

  const handleRequestPreviewRender = useCallback(async () => {
    if (!previewWorkbench || requestRenderDisabledReason) {
      return;
    }

    startTransition(() => {
      setRequestRenderPending(true);
      setRuntimeErrorMessage("");
    });

    try {
      const nextRuntime = await requestPreviewRender({
        projectId,
        episodeId: previewEpisodeId || undefined,
        requestedLocale: locale,
        orgId,
        userId,
      });
      startTransition(() => {
        setPreviewRuntime(nextRuntime);
        setRuntimeErrorMessage("");
        setRequestRenderPending(false);
      });
    } catch (error: unknown) {
      const message = formatActionError(error, "creator: unknown preview render error");
      startTransition(() => {
        setRuntimeErrorMessage(message);
        setRequestRenderPending(false);
      });
    }
  }, [
    locale,
    orgId,
    previewWorkbench,
    previewEpisodeId,
    projectId,
    requestRenderDisabledReason,
    userId,
  ]);

  return {
    previewWorkbench,
    draftItems,
    feedback,
    errorMessage,
    audioSummary,
    audioSummaryErrorMessage,
    shotOptions,
    shotOptionsErrorMessage,
    previewRuntime,
    runtimeErrorMessage,
    requestRenderDisabledReason,
    requestRenderPending,
    selectedShotOptionId,
    setSelectedShotOptionId,
    manualShotIdInput,
    setManualShotIdInput,
    handleAddItemFromChooser,
    handleAddManualItem,
    handleRemoveItem,
    handleMoveItem,
    handleSaveAssembly,
    handleRequestPreviewRender,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
