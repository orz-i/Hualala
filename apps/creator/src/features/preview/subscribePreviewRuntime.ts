import {
  createSSEClient,
  type HualalaFetch,
  type SSEEventEnvelope,
} from "@hualala/sdk";

type SubscribePreviewRuntimeOptions = {
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

function readPayloadString(payload: unknown, ...keys: string[]) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return "";
}

function matchesPreviewRuntimeScope(
  event: SSEEventEnvelope,
  episodeId: string | undefined,
) {
  if (event.eventType !== "project.preview.runtime.updated") {
    return false;
  }

  const expectedEpisodeId = (episodeId ?? "").trim();
  const actualEpisodeId = readPayloadString(event.data, "episode_id", "episodeId");

  if (!expectedEpisodeId) {
    return actualEpisodeId === "";
  }
  return actualEpisodeId === expectedEpisodeId;
}

export function subscribePreviewRuntime({
  organizationId,
  projectId,
  episodeId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
  onRefreshNeeded,
  onError,
}: SubscribePreviewRuntimeOptions) {
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
