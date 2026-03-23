import {
  createSSEClient,
  type SSEEventEnvelope,
} from "@hualala/sdk";

type SubscribeAdminCollaborationOptions = {
  organizationId: string;
  projectId: string;
  ownerType: "project" | "shot";
  ownerId: string;
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

function matchesCollaboration(
  event: SSEEventEnvelope,
  ownerType: "project" | "shot",
  ownerId: string,
) {
  if (event.eventType !== "content.collaboration.updated") {
    return false;
  }
  return (
    readPayloadString(event.data, "owner_type", "ownerType") === ownerType &&
    readPayloadString(event.data, "owner_id", "ownerId") === ownerId
  );
}

export function subscribeAdminCollaboration({
  organizationId,
  projectId,
  ownerType,
  ownerId,
  onRefreshNeeded,
  onError,
}: SubscribeAdminCollaborationOptions) {
  const client = createSSEClient();
  const subscription = client.subscribeEvents({
    organizationId,
    projectId,
    onEvent: (event) => {
      if (matchesCollaboration(event, ownerType, ownerId)) {
        onRefreshNeeded();
      }
    },
    onError,
  });

  return () => {
    subscription.close();
  };
}
