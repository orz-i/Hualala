import {
  createSSEClient,
  type HualalaFetch,
  type SSEEventEnvelope,
} from "@hualala/sdk";
import type { CollaborationOwnerType } from "./collaboration";

type SubscribeCollaborationEventsOptions = {
  organizationId: string;
  projectId: string;
  ownerType: CollaborationOwnerType;
  ownerId: string;
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

function isMatchingCollaborationEvent(
  event: SSEEventEnvelope,
  ownerType: CollaborationOwnerType,
  ownerId: string,
) {
  if (event.eventType !== "content.collaboration.updated") {
    return false;
  }

  const eventOwnerType = readPayloadString(event.data, "owner_type", "ownerType");
  const eventOwnerId = readPayloadString(event.data, "owner_id", "ownerId");
  return eventOwnerType === ownerType && eventOwnerId === ownerId;
}

export function subscribeCollaborationEvents({
  organizationId,
  projectId,
  ownerType,
  ownerId,
  orgId,
  userId,
  baseUrl,
  fetchFn,
  onRefreshNeeded,
  onError,
}: SubscribeCollaborationEventsOptions) {
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
      if (isMatchingCollaborationEvent(event, ownerType, ownerId)) {
        onRefreshNeeded();
      }
    },
    onError,
  });

  return () => {
    subscription.close();
  };
}
