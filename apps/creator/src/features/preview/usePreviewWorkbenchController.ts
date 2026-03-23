import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { CreatorTranslator } from "../../i18n";
import type { ActionFeedbackModel } from "../shared/ActionFeedback";
import { useAssetProvenanceState } from "../shared/useAssetProvenanceState";
import { waitForFeedbackPaint } from "../shared/waitForFeedbackPaint";
import { loadPreviewWorkbench } from "./loadPreviewWorkbench";
import { savePreviewWorkbench } from "./mutatePreviewWorkbench";
import type { PreviewItemViewModel, PreviewWorkbenchViewModel } from "./previewWorkbench";

type UsePreviewWorkbenchControllerOptions = {
  enabled: boolean;
  projectId: string;
  t: CreatorTranslator;
  orgId?: string;
  userId?: string;
};

type DraftField = "shotId" | "primaryAssetId" | "sourceRunId";

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
  const [newShotIdInput, setNewShotIdInput] = useState("");
  const [newPrimaryAssetIdInput, setNewPrimaryAssetIdInput] = useState("");
  const [newSourceRunIdInput, setNewSourceRunIdInput] = useState("");
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
        setNewShotIdInput("");
        setNewPrimaryAssetIdInput("");
        setNewSourceRunIdInput("");
      });
      return;
    }

    let cancelled = false;
    resetAssetProvenance();

    loadPreviewWorkbench({
      projectId,
      orgId,
      userId,
    })
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setPreviewWorkbench(nextWorkbench);
          setDraftItems(buildOrderedDraftItems(nextWorkbench.items));
          setFeedback(null);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "creator: unknown preview workbench error";
        startTransition(() => {
          setPreviewWorkbench(null);
          setDraftItems([]);
          setFeedback(null);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orgId, projectId, resetAssetProvenance, t, userId]);

  const handleDraftItemFieldChange = useCallback((itemId: string, field: DraftField, value: string) => {
    setDraftItems((currentItems) =>
      currentItems.map((item) => (item.itemId === itemId ? { ...item, [field]: value } : item)),
    );
  }, []);

  const handleAddItem = useCallback(() => {
    const nextShotId = newShotIdInput.trim();
    if (!nextShotId || !previewWorkbench) {
      return;
    }

    const nextItem: PreviewItemViewModel = {
      itemId: `draft-${draftIdRef.current}`,
      assemblyId: previewWorkbench.assembly.assemblyId,
      shotId: nextShotId,
      primaryAssetId: newPrimaryAssetIdInput.trim(),
      sourceRunId: newSourceRunIdInput.trim(),
      sequence: draftItems.length + 1,
    };
    draftIdRef.current += 1;

    startTransition(() => {
      setDraftItems((currentItems) => buildOrderedDraftItems([...currentItems, nextItem]));
      setNewShotIdInput("");
      setNewPrimaryAssetIdInput("");
      setNewSourceRunIdInput("");
    });
  }, [
    draftItems.length,
    newPrimaryAssetIdInput,
    newShotIdInput,
    newSourceRunIdInput,
    previewWorkbench,
  ]);

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
    newShotIdInput,
    newPrimaryAssetIdInput,
    newSourceRunIdInput,
    setNewShotIdInput,
    setNewPrimaryAssetIdInput,
    setNewSourceRunIdInput,
    handleDraftItemFieldChange,
    handleAddItem,
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
