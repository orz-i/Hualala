import {
  createSSEClient,
  type HualalaFetch,
  type SSEEventEnvelope,
} from "@hualala/sdk";

export type CreatorWorkbenchKind = "shot" | "import";

type SubscribeWorkbenchEventsOptions = {
  organizationId: string;
  projectId: string;
  workbenchKind: CreatorWorkbenchKind;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
  onRefreshNeeded: () => void;
  onError?: (error: Error) => void;
};

const shotWorkbenchEvents = new Set([
  "shot.execution.updated",
  "shot.evaluation.created",
  "shot.review.created",
]);

const importWorkbenchEvents = new Set([
  "asset.upload_session.updated",
  "shot.execution.updated",
]);

function shouldRefreshWorkbench(workbenchKind: CreatorWorkbenchKind, event: SSEEventEnvelope) {
  if (workbenchKind === "shot") {
    return shotWorkbenchEvents.has(event.eventType);
  }
  return importWorkbenchEvents.has(event.eventType);
}

export function subscribeWorkbenchEvents({
  organizationId,
  projectId,
  workbenchKind,
  baseUrl,
  fetchFn,
  onRefreshNeeded,
  onError,
}: SubscribeWorkbenchEventsOptions) {
  const client = createSSEClient({
    baseUrl,
    fetchFn,
  });

  const subscription = client.subscribeEvents({
    organizationId,
    projectId,
    onEvent: (event) => {
      if (shouldRefreshWorkbench(workbenchKind, event)) {
        onRefreshNeeded();
      }
    },
    onError,
  });

  return () => {
    subscription.close();
  };
}
