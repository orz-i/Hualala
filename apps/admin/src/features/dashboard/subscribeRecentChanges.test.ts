import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAdminRecentChanges } from "./subscribeRecentChanges";

let subscribeOptions:
  | {
      onEvent: (event: {
        id: string;
        eventType: string;
        data?: Record<string, unknown>;
      }) => void;
    }
  | undefined;

type SubscribeEventsOptions = NonNullable<typeof subscribeOptions>;

const { closeMock, subscribeEventsMock, createSSEClientMock } = vi.hoisted(() => {
  const closeMock = vi.fn();
  const subscribeEventsMock = vi.fn((options: SubscribeEventsOptions) => {
    subscribeOptions = options;
    return {
      close: closeMock,
    };
  });
  const createSSEClientMock = vi.fn(() => ({
    subscribeEvents: subscribeEventsMock,
  }));
  return {
    closeMock,
    subscribeEventsMock,
    createSSEClientMock,
  };
});

vi.mock("@hualala/sdk", () => ({
  createSSEClient: createSSEClientMock,
}));

describe("subscribeRecentChanges", () => {
  beforeEach(() => {
    subscribeOptions = undefined;
    closeMock.mockClear();
    subscribeEventsMock.mockClear();
    createSSEClientMock.mockClear();
  });

  it("maps recent-change events and keeps transport options stable", () => {
    const fetchFn = vi.fn();
    const onChange = vi.fn();

    const cleanup = subscribeAdminRecentChanges({
      organizationId: "org-1",
      projectId: "project-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      onChange,
    });

    expect(createSSEClientMock).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    expect(subscribeEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        projectId: "project-1",
      }),
    );

    subscribeOptions?.onEvent({
      id: "evt-budget",
      eventType: "budget.updated",
      data: {
        amount_cents: 25000,
      },
    });
    subscribeOptions?.onEvent({
      id: "evt-evaluation",
      eventType: "shot.evaluation.created",
      data: {
        status: "passed",
        failed_checks_count: 0,
      },
    });
    subscribeOptions?.onEvent({
      id: "evt-review",
      eventType: "shot.review.created",
      data: {
        conclusion: "approved",
      },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, {
      id: "billing-evt-budget",
      kind: "billing",
      tone: "info",
      eventType: "budget.updated",
      amountCents: 25000,
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      id: "evaluation-evt-evaluation",
      kind: "evaluation",
      tone: "success",
      status: "passed",
      failedChecksCount: 0,
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      id: "review-evt-review",
      kind: "review",
      tone: "success",
      conclusion: "approved",
    });

    cleanup();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("treats workflow update events as refresh triggers only", () => {
    const onChange = vi.fn();
    const onWorkflowUpdated = vi.fn();
    const onAssetImportBatchUpdated = vi.fn();

    subscribeAdminRecentChanges({
      organizationId: "org-2",
      projectId: "project-2",
      onChange,
      onWorkflowUpdated,
      onAssetImportBatchUpdated,
    });

    subscribeOptions?.onEvent({
      id: "evt-workflow",
      eventType: "workflow.updated",
      data: {},
    });

    expect(onWorkflowUpdated).toHaveBeenCalledTimes(1);
    expect(onAssetImportBatchUpdated).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("treats asset import batch update events as refresh triggers only", () => {
    const onChange = vi.fn();
    const onWorkflowUpdated = vi.fn();
    const onAssetImportBatchUpdated = vi.fn();

    subscribeAdminRecentChanges({
      organizationId: "org-3",
      projectId: "project-3",
      onChange,
      onWorkflowUpdated,
      onAssetImportBatchUpdated,
    });

    subscribeOptions?.onEvent({
      id: "evt-asset",
      eventType: "asset.import_batch.updated",
      data: {},
    });

    expect(onWorkflowUpdated).not.toHaveBeenCalled();
    expect(onAssetImportBatchUpdated).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});
