import { renderHook } from "@testing-library/react";
import type { RecentChangeSummary } from "./overview";
import { subscribeAdminRecentChanges } from "./subscribeRecentChanges";
import { useAdminRecentChangesSubscription } from "./useAdminRecentChangesSubscription";

vi.mock("./subscribeRecentChanges", () => ({
  subscribeAdminRecentChanges: vi.fn(),
}));

const subscribeAdminRecentChangesMock = vi.mocked(subscribeAdminRecentChanges);

describe("useAdminRecentChangesSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes only when the session is ready, the overview exists, and an org id is available", () => {
    const unsubscribe = vi.fn();
    subscribeAdminRecentChangesMock.mockReturnValue(unsubscribe);

    const onRecentChange = vi.fn();
    const onWorkflowUpdated = vi.fn();
    const onAssetImportBatchUpdated = vi.fn();

    const { rerender, unmount } = renderHook(
      (props: {
        sessionState: "loading" | "ready" | "unauthenticated";
        hasOverview: boolean;
        subscriptionOrgId?: string;
      }) =>
        useAdminRecentChangesSubscription({
          ...props,
          projectId: "project-live-001",
          onRecentChange,
          onWorkflowUpdated,
          onAssetImportBatchUpdated,
        }),
      {
        initialProps: {
          sessionState: "loading",
          hasOverview: false,
          subscriptionOrgId: undefined,
        },
      },
    );

    expect(subscribeAdminRecentChangesMock).not.toHaveBeenCalled();

    rerender({
      sessionState: "ready",
      hasOverview: true,
      subscriptionOrgId: "org-demo-001",
    });

    expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
    expect(subscribeAdminRecentChangesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-demo-001",
        projectId: "project-live-001",
      }),
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("forwards recent changes and refresh callbacks through a stable subscription", () => {
    let capturedOptions:
      | Parameters<typeof subscribeAdminRecentChangesMock>[0]
      | undefined;
    const unsubscribe = vi.fn();
    subscribeAdminRecentChangesMock.mockImplementation((options) => {
      capturedOptions = options;
      return unsubscribe;
    });

    const onRecentChange = vi.fn();
    const onWorkflowUpdated = vi.fn();
    const onAssetImportBatchUpdated = vi.fn();
    const onError = vi.fn();

    renderHook(() =>
      useAdminRecentChangesSubscription({
        sessionState: "ready",
        hasOverview: true,
        subscriptionOrgId: "org-demo-001",
        projectId: "project-live-001",
        onRecentChange,
        onWorkflowUpdated,
        onAssetImportBatchUpdated,
        onError,
      }),
    );

    const change: RecentChangeSummary = {
      id: "billing-event-2",
      kind: "billing",
      tone: "info",
      eventType: "budget_updated",
      amountCents: 22000,
    };

    capturedOptions?.onChange(change);
    capturedOptions?.onWorkflowUpdated?.();
    capturedOptions?.onAssetImportBatchUpdated?.();
    capturedOptions?.onError?.(new Error("sse exploded"));

    expect(onRecentChange).toHaveBeenCalledWith(change);
    expect(onWorkflowUpdated).toHaveBeenCalledTimes(1);
    expect(onAssetImportBatchUpdated).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error("sse exploded"));
    expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
  });
});
