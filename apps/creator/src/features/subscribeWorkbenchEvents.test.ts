import { createSSEClient } from "@hualala/sdk";
import {
  subscribeWorkbenchEvents,
  type CreatorWorkbenchKind,
} from "./subscribeWorkbenchEvents";

vi.mock("@hualala/sdk", () => ({
  createSSEClient: vi.fn(),
}));

const createSSEClientMock = vi.mocked(createSSEClient);

type SubscriptionContext = {
  close: ReturnType<typeof vi.fn>;
  onEvent: ((event: { id: string; eventType: string; data: unknown; rawData: string }) => void) | null;
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
  data: Record<string, unknown> = {},
) {
  context.onEvent?.({
    id: `event-${eventType}`,
    eventType,
    data,
    rawData: JSON.stringify(data),
  });
}

describe("subscribeWorkbenchEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    ["shot" as CreatorWorkbenchKind, "shot.execution.updated", true],
    ["shot" as CreatorWorkbenchKind, "shot.evaluation.created", true],
    ["shot" as CreatorWorkbenchKind, "shot.review.created", true],
    ["shot" as CreatorWorkbenchKind, "asset.upload_session.updated", false],
    ["shot" as CreatorWorkbenchKind, "workflow.updated", false],
    ["import" as CreatorWorkbenchKind, "asset.upload_session.updated", true],
    ["import" as CreatorWorkbenchKind, "shot.execution.updated", true],
    ["import" as CreatorWorkbenchKind, "shot.review.created", false],
    ["import" as CreatorWorkbenchKind, "budget.updated", false],
  ])(
    "workbenchKind=%s only refreshes for supported event %s",
    (workbenchKind, eventType, shouldRefresh) => {
      const context = createSubscriptionContext();
      const onRefreshNeeded = vi.fn();

      const unsubscribe = subscribeWorkbenchEvents({
        organizationId: "org-1",
        projectId: "project-1",
        workbenchKind,
        onRefreshNeeded,
      });

      emitEvent(context, eventType, {
        organization_id: "org-1",
        project_id: "project-1",
      });

      if (shouldRefresh) {
        expect(onRefreshNeeded).toHaveBeenCalledTimes(1);
      } else {
        expect(onRefreshNeeded).not.toHaveBeenCalled();
      }

      unsubscribe();
      expect(context.close).toHaveBeenCalledTimes(1);
    },
  );

  it("passes subscription identity and forwards errors", () => {
    const context = createSubscriptionContext();
    const onRefreshNeeded = vi.fn();
    const onError = vi.fn();

    subscribeWorkbenchEvents({
      organizationId: "org-1",
      projectId: "project-9",
      workbenchKind: "shot",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
      onRefreshNeeded,
      onError,
    });

    expect(createSSEClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
      }),
    );

    context.onError?.(new Error("stream down"));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onRefreshNeeded).not.toHaveBeenCalled();
  });
});
