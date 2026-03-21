import { withIdentityHeaders } from "../connect/identity";
import {
  resolveConnectBaseUrl,
  type HualalaClientOptions,
  type HualalaFetch,
} from "../connect/transport";
import { parseEventStreamChunk } from "./parser";
import type {
  SSEClient,
  SSEEventEnvelope,
  SSESubscribeOptions,
  SSESubscription,
} from "./types";

const DEFAULT_RECONNECT_DELAY_MS = 1000;

function buildLastEventStorageKey(organizationId: string, projectId: string) {
  return `hualala:sse:last-event:${organizationId}:${projectId}`;
}

function readStoredLastEventId(organizationId: string, projectId: string) {
  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }
  return window.localStorage.getItem(buildLastEventStorageKey(organizationId, projectId)) ?? undefined;
}

function writeStoredLastEventId(organizationId: string, projectId: string, eventId: string) {
  if (!eventId || typeof window === "undefined" || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(buildLastEventStorageKey(organizationId, projectId), eventId);
}

function buildSSEUrl(baseUrl: string, organizationId: string, projectId: string) {
  const url = new URL(`${baseUrl || window.location.origin}/sse/events`);
  url.searchParams.set("organization_id", organizationId);
  url.searchParams.set("project_id", projectId);
  return url.toString();
}

function toError(error: unknown, message: string) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(message);
}

async function consumeEventStream(
  response: Response,
  onEvent: (event: SSEEventEnvelope) => void,
  organizationId: string,
  projectId: string,
) {
  if (!response.body) {
    throw new Error("sdk: sse response body is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const parsed = parseEventStreamChunk(buffer);
      buffer = parsed.remaining;
      if (!parsed.event) {
        break;
      }

      if (parsed.event.id) {
        writeStoredLastEventId(organizationId, projectId, parsed.event.id);
      }
      onEvent(parsed.event);
    }
  }
}

export function createSSEClient(options: HualalaClientOptions = {}): SSEClient {
  const baseUrl = resolveConnectBaseUrl(options.baseUrl);
  const fetchFn: HualalaFetch = options.fetchFn ?? fetch;
  const identity = options.identity ?? {};

  return {
    baseUrl,
    subscribeEvents({
      organizationId,
      projectId,
      lastEventId,
      onEvent,
      onError,
    }: SSESubscribeOptions): SSESubscription {
      let closed = false;
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      let activeAbortController: AbortController | undefined;

      const scheduleReconnect = () => {
        if (closed) {
          return;
        }
        reconnectTimer = setTimeout(() => {
          void connect();
        }, DEFAULT_RECONNECT_DELAY_MS);
      };

      const connect = async () => {
        if (closed) {
          return;
        }

        const effectiveLastEventId =
          lastEventId ?? readStoredLastEventId(organizationId, projectId);
        activeAbortController = new AbortController();

        try {
          const headers = withIdentityHeaders({}, identity);
          if (effectiveLastEventId) {
            headers["Last-Event-ID"] = effectiveLastEventId;
          }

          const response = await fetchFn(
            buildSSEUrl(baseUrl, organizationId, projectId),
            {
              method: "GET",
              credentials: "include",
              headers,
              signal: activeAbortController.signal,
            },
          );

          if (!response.ok) {
            throw new Error(`sdk: failed to subscribe /sse/events (${response.status})`);
          }

          await consumeEventStream(response, onEvent, organizationId, projectId);
          scheduleReconnect();
        } catch (error) {
          if (closed || activeAbortController.signal.aborted) {
            return;
          }
          onError?.(toError(error, "sdk: sse subscription failed"));
          scheduleReconnect();
        }
      };

      void connect();

      return {
        close() {
          closed = true;
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
          }
          activeAbortController?.abort();
        },
      };
    },
  };
}
