import { startTransition, useEffect, useState } from "react";
import {
  AdminOverviewPage,
  type AdminOverviewViewModel,
} from "../features/dashboard/AdminOverviewPage";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";

export function App() {
  const [overview, setOverview] = useState<AdminOverviewViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get("projectId") ?? "project-demo-001";
    const shotExecutionId = searchParams.get("shotExecutionId") ?? "shot-exec-demo-001";

    loadAdminOverview({ projectId, shotExecutionId })
      .then((nextOverview) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setOverview(nextOverview);
          setErrorMessage("");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "admin: unknown overview error";
        startTransition(() => {
          setErrorMessage(message);
          setOverview(null);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (errorMessage) {
    return <main style={{ padding: "32px" }}>管理概览加载失败：{errorMessage}</main>;
  }

  if (!overview) {
    return <main style={{ padding: "32px" }}>正在加载管理概览</main>;
  }

  return <AdminOverviewPage overview={overview} />;
}
