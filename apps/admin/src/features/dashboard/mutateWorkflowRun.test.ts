import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelWorkflowRun, retryWorkflowRun } from "./mutateWorkflowRun";

const { retryWorkflowRunMock, cancelWorkflowRunMock, createWorkflowClientMock } = vi.hoisted(() => {
  const retryWorkflowRunMock = vi.fn();
  const cancelWorkflowRunMock = vi.fn();
  const createWorkflowClientMock = vi.fn(() => ({
    retryWorkflowRun: retryWorkflowRunMock,
    cancelWorkflowRun: cancelWorkflowRunMock,
  }));
  return {
    retryWorkflowRunMock,
    cancelWorkflowRunMock,
    createWorkflowClientMock,
  };
});

vi.mock("@hualala/sdk", () => ({
  createWorkflowClient: createWorkflowClientMock,
}));

describe("mutateWorkflowRun", () => {
  beforeEach(() => {
    createWorkflowClientMock.mockClear();
    retryWorkflowRunMock.mockReset();
    cancelWorkflowRunMock.mockReset();
    retryWorkflowRunMock.mockResolvedValue({});
    cancelWorkflowRunMock.mockResolvedValue({});
  });

  it("retries workflow runs without drifting identity or transport options", async () => {
    const fetchFn = vi.fn();

    await retryWorkflowRun({
      workflowRunId: "workflow-run-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(createWorkflowClientMock).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: {
        orgId: "org-1",
        userId: "user-1",
      },
    });
    expect(retryWorkflowRunMock).toHaveBeenCalledWith({
      workflowRunId: "workflow-run-1",
    });
    expect(cancelWorkflowRunMock).not.toHaveBeenCalled();
  });

  it("cancels workflow runs without drifting identity or transport options", async () => {
    const fetchFn = vi.fn();

    await cancelWorkflowRun({
      workflowRunId: "workflow-run-2",
      orgId: "org-2",
      userId: "user-2",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(createWorkflowClientMock).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: {
        orgId: "org-2",
        userId: "user-2",
      },
    });
    expect(cancelWorkflowRunMock).toHaveBeenCalledWith({
      workflowRunId: "workflow-run-2",
    });
    expect(retryWorkflowRunMock).not.toHaveBeenCalled();
  });
});
