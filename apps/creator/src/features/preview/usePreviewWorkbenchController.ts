import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import { buildPreviewAudioSummary, type PreviewAudioSummaryViewModel } from "../audio/audioWorkbench";
import { loadAudioWorkbench } from "../audio/loadAudioWorkbench";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import { loadPreviewShotOptions } from "./loadPreviewShotOptions";
import { loadPreviewWorkbench } from "./loadPreviewWorkbench";
import { savePreviewWorkbench } from "./mutatePreviewWorkbench";
import type {
  PreviewItemViewModel,
  PreviewShotOptionViewModel,
  PreviewWorkbenchViewModel,
} from "./previewWorkbench";

type UsePreviewWorkbenchControllerOptions = {
  enabled: boolean;
  projectId: string;
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
  const [selectedShotOptionId, setSelectedShotOptionId] = useState("");
  const [manualShotIdInput, setManualShotIdInput] = useState("");
  const draftIdRef = useRef(1);
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
        setPreviewWorkbench(null);
        setDraftItems([]);
        setFeedback(null);
        setErrorMessage("");
        setAudioSummary(null);
        setAudioSummaryErrorMessage("");
        setShotOptions([]);
        setShotOptionsErrorMessage("");
        setSelectedShotOptionId("");
        setManualShotIdInput("");
      });
      return;
    }

    let cancelled = false;
    resetAssetProvenance();

    Promise.allSettled([
      loadPreviewWorkbench({
        projectId,
        orgId,
        userId,
      }),
      loadPreviewShotOptions({
        projectId,
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

      if (previewResult.status === "rejected") {
        const message =
          previewResult.reason instanceof Error
            ? previewResult.reason.message
            : "creator: unknown preview workbench error";
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
        setDraftItems(buildOrderedDraftItems(previewResult.value.items));
        setFeedback(null);
        setErrorMessage("");

        if (shotOptionsResult.status === "fulfilled") {
          setShotOptions(shotOptionsResult.value);
          setShotOptionsErrorMessage("");
          setSelectedShotOptionId((currentValue) => {
            if (shotOptionsResult.value.some((option) => option.shotId === currentValue)) {
              return currentValue;
            }
            return shotOptionsResult.value[0]?.shotId ?? "";
          });
        } else {
          const message =
            shotOptionsResult.reason instanceof Error
              ? shotOptionsResult.reason.message
              : "creator: unknown preview shot options error";
          setShotOptions([]);
          setShotOptionsErrorMessage(message);
          setSelectedShotOptionId("");
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
  }, [enabled, orgId, projectId, resetAssetProvenance, t, userId]);

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
      startTransition(() => {
        setPreviewWorkbench(nextWorkbench);
        setDraftItems(buildOrderedDraftItems(nextWorkbench.items));
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

  return {
    previewWorkbench,
    draftItems,
    feedback,
    errorMessage,
    audioSummary,
    audioSummaryErrorMessage,
    shotOptions,
    shotOptionsErrorMessage,
    selectedShotOptionId,
    setSelectedShotOptionId,
    manualShotIdInput,
    setManualShotIdInput,
    handleAddItemFromChooser,
    handleAddManualItem,
    handleRemoveItem,
    handleMoveItem,
    handleSaveAssembly,
    assetProvenanceDetail,
    assetProvenancePending,
    assetProvenanceErrorMessage,
    handleOpenAssetProvenance,
    handleCloseAssetProvenance,
  };
}
