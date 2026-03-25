import { createSSEClient, type HualalaFetch } from "@hualala/sdk";
import { matchesPreviewRuntimeScope } from "../../../../shared/preview/previewRuntimeSubscription";

type SubscribeAdminPreviewRuntimeOptions = {
  organizationId: string;
  projectId: string;
  episodeId?: string;
  orgId?: string;
  userId?: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
  onRefreshNeeded: () => void;
  onError?: (error: Error) => void;
};

export function subscribeAdminPreviewRuntime({
  organizationId,
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
  onRefreshNeeded,
  onError,
}: SubscribeAdminPreviewRuntimeOptions) {
  const client = createSSEClient({
    baseUrl,
    fetchFn,
    identity: {
      orgId,
      userId,
    },
  });

  const subscription = client.subscribeEvents({
    organizationId,
    projectId,
    onEvent: (event) => {
      if (matchesPreviewRuntimeScope(event, episodeId)) {
        onRefreshNeeded();
      }
    },
    onError,
  });

  return () => {
    subscription.close();
  };
}
