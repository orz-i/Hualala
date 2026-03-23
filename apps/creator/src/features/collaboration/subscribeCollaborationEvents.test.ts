import { createSSEClient } from "@hualala/sdk";
import { subscribeCollaborationEvents } from "./subscribeCollaborationEvents";

vi.mock("@hualala/sdk", () => ({
  createSSEClient: vi.fn(),
}));

const createSSEClientMock = vi.mocked(createSSEClient);

type SubscriptionContext = {
  close: ReturnType<typeof vi.fn>;
  onEvent:
    | ((event: { id: string; eventType: string; data: unknown; rawData: string }) => void)
    | null;
  onError: ((error: Error) => void) | undefined;
};

function createSubscriptionContext() {
  const context: SubscriptionContext = {
    close: vi.fn(),
    onEvent: null,
    onError: undefined,
  };
  createSSEClientMock.mockReturnValue({
    baseUrl: "http://127.0.0.1:8080",
    subscribeEvents: vi.fn((options) => {
      context.onEvent = options.onEvent;
      context.onError = options.onError;
      return {
        close: context.close,
      };
    }),
  } as never);
  return context;
}

function emitEvent(
  context: SubscriptionContext,
  eventType: string,
  data: Record<string, unknown>,
) {
  context.onEvent?.({
    id: `event-${eventType}`,
    eventType,
    data,
    rawData: JSON.stringify(data),
  });
}

describe("subscribeCollaborationEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("refreshes only for matching collaboration events", () => {
    const context = createSubscriptionContext();
    const onRefreshNeeded = vi.fn();

    const unsubscribe = subscribeCollaborationEvents({
      organizationId: "org-1",
      projectId: "project-1",
      ownerType: "shot",
      ownerId: "shot-1",
      orgId: "org-1",
      userId: "user-1",
      onRefreshNeeded,
    });

    emitEvent(context, "workflow.updated", {
      owner_type: "shot",
      owner_id: "shot-1",
    });
    emitEvent(context, "content.collaboration.updated", {
      owner_type: "project",
      owner_id: "project-1",
    });
    emitEvent(context, "content.collaboration.updated", {
      owner_type: "shot",
      owner_id: "shot-1",
    });

    expect(onRefreshNeeded).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("passes identity headers into the sse client and forwards subscription errors", () => {
    const context = createSubscriptionContext();
    const onError = vi.fn();

    subscribeCollaborationEvents({
      organizationId: "org-2",
      projectId: "project-2",
      ownerType: "project",
      ownerId: "project-2",
      orgId: "org-override-1",
      userId: "user-override-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
      onRefreshNeeded: vi.fn(),
      onError,
    });

    expect(createSSEClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
        identity: {
          orgId: "org-override-1",
          userId: "user-override-1",
        },
      }),
    );

    context.onError?.(new Error("stream down"));

    expect(onError).toHaveBeenCalledWith(new Error("stream down"));
  });
});
