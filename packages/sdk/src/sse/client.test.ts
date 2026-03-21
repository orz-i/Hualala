import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSEClient } from "./client";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("sdk sse client", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const localStorage = createMemoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { origin: "http://127.0.0.1:4173" },
        localStorage,
      },
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    vi.useRealTimers();
  });

  it("uses Last-Event-ID from localStorage and parses streamed events", async () => {
    window.localStorage.setItem("hualala:sse:last-event:org-1:project-1", "evt-9");
    const fetchFn: typeof fetch = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              "id: evt-10\nevent: budget.updated\ndata: {\"limit_cents\":900}\n\n",
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    });

    const onEvent = vi.fn();
    const client = createSSEClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
    });

    const subscription = client.subscribeEvents({
      organizationId: "org-1",
      projectId: "project-1",
      onEvent,
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "evt-10",
          eventType: "budget.updated",
          data: { limit_cents: 900 },
          rawData: "{\"limit_cents\":900}",
        }),
      );
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/sse/events?organization_id=org-1&project_id=project-1",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: expect.objectContaining({
          "Last-Event-ID": "evt-9",
        }),
      }),
    );
    expect(window.localStorage.getItem("hualala:sse:last-event:org-1:project-1")).toBe("evt-10");

    subscription.close();
  });

  it("reconnects after an unexpected stream close", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    });

    const client = createSSEClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
    });

    const subscription = client.subscribeEvents({
      organizationId: "org-1",
      projectId: "project-1",
      onEvent: vi.fn(),
      onError: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(1000);

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    subscription.close();
  });

  it("still injects identity headers when explicit override is provided", async () => {
    const fetchFn: typeof fetch = vi.fn(async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    });

    const client = createSSEClient({
      baseUrl: "http://127.0.0.1:8080/",
      fetchFn,
      identity: {
        orgId: "org-1",
        userId: "user-1",
      },
    });

    const subscription = client.subscribeEvents({
      organizationId: "org-1",
      projectId: "project-1",
      onEvent: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/sse/events?organization_id=org-1&project_id=project-1",
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            "X-Hualala-Org-Id": "org-1",
            "X-Hualala-User-Id": "user-1",
          }),
        }),
      );
    });

    subscription.close();
  });
});
