import { startTransition, useEffect, useState } from "react";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";
import { ShotWorkbenchPage, type ShotWorkbenchViewModel } from "../features/shot-workbench/ShotWorkbenchPage";

export function App() {
  const [workbench, setWorkbench] = useState<ShotWorkbenchViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const shotId = new URLSearchParams(window.location.search).get("shotId") ?? "shot-demo-001";
    let cancelled = false;

    loadShotWorkbench({ shotId })
      .then((nextWorkbench) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setWorkbench(nextWorkbench);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "creator: unknown workbench error";
        startTransition(() => {
          setErrorMessage(message);
          setWorkbench(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>镜头工作台加载失败：{errorMessage}</main>;
  }

  if (!workbench) {
    return <main style={{ padding: "32px" }}>正在加载镜头工作台</main>;
  }

  return <ShotWorkbenchPage workbench={workbench} />;
}
