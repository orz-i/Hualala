import { useEffect, useRef } from "react";
import type { RecentChangeSummary } from "./AdminOverviewPage";
import { subscribeAdminRecentChanges } from "./subscribeRecentChanges";

export function useAdminRecentChangesSubscription({
  sessionState,
  hasOverview,
  subscriptionOrgId,
  projectId,
  onRecentChange,
  onWorkflowUpdated,
  onAssetImportBatchUpdated,
  onError,
}: {
  sessionState: "loading" | "ready" | "unauthenticated";
  hasOverview: boolean;
  subscriptionOrgId?: string;
  projectId: string;
  onRecentChange: (change: RecentChangeSummary) => void;
  onWorkflowUpdated: () => void;
  onAssetImportBatchUpdated: () => void;
  onError?: (error: Error) => void;
}) {
  const onRecentChangeRef = useRef(onRecentChange);
  const onWorkflowUpdatedRef = useRef(onWorkflowUpdated);
  const onAssetImportBatchUpdatedRef = useRef(onAssetImportBatchUpdated);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onRecentChangeRef.current = onRecentChange;
  }, [onRecentChange]);

  useEffect(() => {
    onWorkflowUpdatedRef.current = onWorkflowUpdated;
  }, [onWorkflowUpdated]);

  useEffect(() => {
    onAssetImportBatchUpdatedRef.current = onAssetImportBatchUpdated;
  }, [onAssetImportBatchUpdated]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (sessionState !== "ready" || !hasOverview || !subscriptionOrgId) {
      return;
    }

    return subscribeAdminRecentChanges({
      organizationId: subscriptionOrgId,
      projectId,
      onChange: (change) => {
        onRecentChangeRef.current(change);
      },
      onWorkflowUpdated: () => {
        onWorkflowUpdatedRef.current();
      },
      onAssetImportBatchUpdated: () => {
        onAssetImportBatchUpdatedRef.current();
      },
      onError: (error) => {
        onErrorRef.current?.(error);
      },
    });
  }, [hasOverview, projectId, sessionState, subscriptionOrgId]);
}
