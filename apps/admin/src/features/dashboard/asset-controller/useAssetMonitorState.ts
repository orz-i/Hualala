import { startTransition, useCallback, useEffect, useState } from "react";
import type { AssetMonitorViewModel } from "../assetMonitor";
import { loadAssetMonitorPanel } from "../loadAssetMonitorPanel";

type IdentityOverride =
  | {
      orgId: string;
      userId: string;
    }
  | undefined;

function createEmptyAssetMonitor(filters: AssetMonitorViewModel["filters"]): AssetMonitorViewModel {
  return {
    filters,
    importBatches: [],
  };
}

export function useAssetMonitorState({
  sessionState,
  projectId,
  identityOverride,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  projectId: string;
  identityOverride: IdentityOverride;
}) {
  const [assetMonitorState, setAssetMonitorState] = useState<AssetMonitorViewModel | null>(null);
  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [assetSourceTypeFilter, setAssetSourceTypeFilter] = useState("");

  const refreshAssetMonitor = useCallback(async () => {
    try {
      const nextAssetMonitor = await loadAssetMonitorPanel({
        projectId,
        status: assetStatusFilter,
        sourceType: assetSourceTypeFilter,
        orgId: identityOverride?.orgId,
        userId: identityOverride?.userId,
      });
      startTransition(() => {
        setAssetMonitorState(nextAssetMonitor);
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "admin: unknown asset monitor error";
      console.warn(message);
    }
  }, [
    assetSourceTypeFilter,
    assetStatusFilter,
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
  ]);

  useEffect(() => {
    if (sessionState !== "ready") {
      startTransition(() => {
        setAssetMonitorState(null);
      });
      return;
    }

    let cancelled = false;

    loadAssetMonitorPanel({
      projectId,
      status: assetStatusFilter,
      sourceType: assetSourceTypeFilter,
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextAssetMonitor) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetMonitorState(nextAssetMonitor);
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "admin: unknown asset monitor error";
        console.warn(message);
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setAssetMonitorState(
            createEmptyAssetMonitor({
              status: assetStatusFilter,
              sourceType: assetSourceTypeFilter,
            }),
          );
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    assetSourceTypeFilter,
    assetStatusFilter,
    identityOverride?.orgId,
    identityOverride?.userId,
    projectId,
    sessionState,
  ]);

  return {
    assetMonitor:
      assetMonitorState ??
      createEmptyAssetMonitor({
        status: assetStatusFilter,
        sourceType: assetSourceTypeFilter,
      }),
    refreshAssetMonitor,
    onAssetStatusFilterChange: (status: string) => {
      startTransition(() => {
        setAssetStatusFilter(status);
      });
    },
    onAssetSourceTypeFilterChange: (sourceType: string) => {
      startTransition(() => {
        setAssetSourceTypeFilter(sourceType);
      });
    },
  };
}
