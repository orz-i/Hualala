import { startTransition, useEffect, useState } from "react";
import {
  loadImportBatchSummaries,
  type ImportBatchSummaryViewModel,
} from "./loadImportBatchSummaries";

type UseCreatorHomeControllerOptions = {
  enabled: boolean;
  projectId: string | null;
  orgId?: string;
  userId?: string;
};

export function useCreatorHomeController({
  enabled,
  projectId,
  orgId,
  userId,
}: UseCreatorHomeControllerOptions) {
  const [projectIdInput, setProjectIdInput] = useState(projectId ?? "");
  const [shotIdInput, setShotIdInput] = useState("");
  const [importBatches, setImportBatches] = useState<ImportBatchSummaryViewModel[]>([]);
  const [importBatchesPending, setImportBatchesPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setProjectIdInput("");
        setShotIdInput("");
        setImportBatches([]);
        setImportBatchesPending(false);
        setErrorMessage("");
      });
      return;
    }

    startTransition(() => {
      setProjectIdInput(projectId ?? "");
    });
  }, [enabled, projectId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!projectId) {
      startTransition(() => {
        setImportBatches([]);
        setImportBatchesPending(false);
        setErrorMessage("");
      });
      return;
    }

    let cancelled = false;

    startTransition(() => {
      setImportBatchesPending(true);
      setErrorMessage("");
    });

    loadImportBatchSummaries({
      projectId,
      orgId,
      userId,
    })
      .then((nextImportBatches) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setImportBatches(nextImportBatches);
          setImportBatchesPending(false);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "creator: unknown home load error";
        startTransition(() => {
          setImportBatches([]);
          setImportBatchesPending(false);
          setErrorMessage(message);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, orgId, projectId, userId]);

  return {
    projectIdInput,
    shotIdInput,
    importBatches,
    importBatchesPending,
    errorMessage,
    setProjectIdInput,
    setShotIdInput,
  };
}
