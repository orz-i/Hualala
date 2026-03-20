import { startTransition, useEffect, useState } from "react";
import {
  ImportBatchWorkbenchPage,
  type ImportBatchWorkbenchViewModel,
} from "../features/import-batches/ImportBatchWorkbenchPage";
import { loadImportBatchWorkbench } from "../features/import-batches/loadImportBatchWorkbench";
import {
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../features/import-batches/mutateImportBatchWorkbench";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";
import { ShotWorkbenchPage, type ShotWorkbenchViewModel } from "../features/shot-workbench/ShotWorkbenchPage";

export function App() {
  const [shotWorkbench, setShotWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [importWorkbench, setImportWorkbench] = useState<ImportBatchWorkbenchViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadCurrentWorkbench = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const importBatchId = searchParams.get("importBatchId");
      const shotId = searchParams.get("shotId") ?? "shot-demo-001";
      return {
        importBatchId,
        load: importBatchId
          ? loadImportBatchWorkbench({ importBatchId })
          : loadShotWorkbench({ shotId }),
      };
    };

    const { importBatchId, load } = loadCurrentWorkbench();

    load
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          if (importBatchId) {
            setImportWorkbench(nextWorkbench as ImportBatchWorkbenchViewModel);
            setShotWorkbench(null);
          } else {
            setShotWorkbench(nextWorkbench as ShotWorkbenchViewModel);
            setImportWorkbench(null);
          }
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "creator: unknown workbench error";
        startTransition(() => {
          setErrorMessage(message);
          setShotWorkbench(null);
          setImportWorkbench(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshImportWorkbench = async () => {
    const importBatchId = new URLSearchParams(window.location.search).get("importBatchId");
    if (!importBatchId) {
      return;
    }
    const nextWorkbench = await loadImportBatchWorkbench({ importBatchId });
    startTransition(() => {
      setImportWorkbench(nextWorkbench);
      setErrorMessage("");
    });
  };

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>工作台加载失败：{errorMessage}</main>;
  }

  if (importWorkbench) {
    return (
      <ImportBatchWorkbenchPage
        workbench={importWorkbench}
        onConfirmMatches={async (input) => {
          await confirmImportBatchItems(input);
          await refreshImportWorkbench();
        }}
        onSelectPrimaryAsset={async (input) => {
          await selectPrimaryAssetForImportBatch(input);
          await refreshImportWorkbench();
        }}
      />
    );
  }

  if (shotWorkbench) {
    return <ShotWorkbenchPage workbench={shotWorkbench} />;
  }

  if (new URLSearchParams(window.location.search).get("importBatchId")) {
    return <main style={{ padding: "32px" }}>正在加载导入工作台</main>;
  }

  if (!shotWorkbench) {
    return <main style={{ padding: "32px" }}>正在加载镜头工作台</main>;
  }

  return <ShotWorkbenchPage workbench={shotWorkbench} />;
}
