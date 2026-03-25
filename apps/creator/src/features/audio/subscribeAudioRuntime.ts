import { createSSEClient, type HualalaFetch } from "@hualala/sdk";
import { matchesAudioRuntimeScope } from "../../../../shared/audio/audioRuntimeSubscription";

type SubscribeAudioRuntimeOptions = {
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

export function subscribeAudioRuntime({
  organizationId,
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
  onRefreshNeeded,
  onError,
}: SubscribeAudioRuntimeOptions) {
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
      if (matchesAudioRuntimeScope(event, episodeId)) {
        onRefreshNeeded();
      }
    },
    onError,
  });

  return () => {
    subscription.close();
  };
}
