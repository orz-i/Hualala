import {
  createSSEClient,
  type HualalaFetch,
  type SSEEventEnvelope,
} from "@hualala/sdk";
import type { RecentChangeSummary } from "./AdminOverviewPage";

type SubscribeAdminRecentChangesOptions = {
  organizationId: string;
  projectId: string;
  baseUrl?: string;
  fetchFn?: HualalaFetch;
  onChange: (change: RecentChangeSummary) => void;
  onError?: (error: Error) => void;
};

function readPayloadNumber(payload: unknown, ...keys: string[]) {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return 0;
}

function readPayloadString(payload: unknown, key: string, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function mapEventToRecentChange(event: SSEEventEnvelope): RecentChangeSummary | null {
  if (event.eventType === "budget.updated") {
    return {
      id: `billing-${event.id}`,
      kind: "billing",
      tone: "info",
      eventType: event.eventType,
      amountCents: readPayloadNumber(event.data, "amount_cents", "limit_cents", "remaining_cents"),
    };
  }

  if (event.eventType === "shot.evaluation.created") {
    const status = readPayloadString(event.data, "status", "pending");
    return {
      id: `evaluation-${event.id}`,
      kind: "evaluation",
      tone: status === "passed" ? "success" : "warning",
      status,
      failedChecksCount: readPayloadNumber(event.data, "failed_checks_count"),
    };
  }

  if (event.eventType === "shot.review.created") {
    const conclusion = readPayloadString(event.data, "conclusion", "pending");
    return {
      id: `review-${event.id}`,
      kind: "review",
      tone: conclusion === "approved" ? "success" : "warning",
      conclusion,
    };
  }

  return null;
}

export function subscribeAdminRecentChanges({
  organizationId,
  projectId,
  baseUrl,
  fetchFn,
  onChange,
  onError,
}: SubscribeAdminRecentChangesOptions) {
  const client = createSSEClient({
    baseUrl,
    fetchFn,
  });

  const subscription = client.subscribeEvents({
    organizationId,
    projectId,
    onEvent: (event) => {
      const change = mapEventToRecentChange(event);
      if (change) {
        onChange(change);
      }
    },
    onError,
  });

  return () => {
    subscription.close();
  };
}
