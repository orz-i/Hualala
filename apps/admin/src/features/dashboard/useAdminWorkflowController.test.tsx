import { act, renderHook, waitFor } from "@testing-library/react";
import type { WorkflowMonitorViewModel, WorkflowRunDetailViewModel } from "./workflow";
import { createTranslator } from "../../i18n";
import { loadWorkflowMonitorPanel } from "./loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "./loadWorkflowRunDetails";
import { cancelWorkflowRun, retryWorkflowRun } from "./mutateWorkflowRun";
import { useAdminWorkflowController } from "./useAdminWorkflowController";

vi.mock("./loadWorkflowMonitorPanel", () => ({
  loadWorkflowMonitorPanel: vi.fn(),
}));
vi.mock("./loadWorkflowRunDetails", () => ({
  loadWorkflowRunDetails: vi.fn(),
}));
vi.mock("./mutateWorkflowRun", () => ({
  retryWorkflowRun: vi.fn(),
  cancelWorkflowRun: vi.fn(),
}));
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadWorkflowMonitorPanelMock = vi.mocked(loadWorkflowMonitorPanel);
const loadWorkflowRunDetailsMock = vi.mocked(loadWorkflowRunDetails);
const retryWorkflowRunMock = vi.mocked(retryWorkflowRun);
const cancelWorkflowRunMock = vi.mocked(cancelWorkflowRun);

function createWorkflowMonitor(projectId: string, status = "", workflowType = ""): WorkflowMonitorViewModel {
  return {
    filters: {
      status,
      workflowType,
    },
    runs: [
      {
        id: "workflow-run-1",
        projectId,
        resourceId: "shot-exec-live-1",
        workflowType: workflowType || "shot_pipeline",
        status: status || "running",
        provider: "seedance",
        currentStep: "attempt_1.gateway",
        attemptCount: 1,
        lastError: "",
        externalRequestId: "request-1",
        createdAt: "2024-03-09T16:00:00.000Z",
        updatedAt: "2024-03-09T16:05:00.000Z",
      },
      {
        id: "workflow-run-2",
        projectId,
        resourceId: "shot-exec-live-2",
        workflowType: "shot_pipeline",
        status: "failed",
        provider: "seedance",
        currentStep: "attempt_2.gateway",
        attemptCount: 2,
        lastError: "provider rejected request",
        externalRequestId: "request-2",
        createdAt: "2024-03-09T17:00:00.000Z",
        updatedAt: "2024-03-09T17:05:00.000Z",
      },
    ],
  };
}

function createWorkflowDetail(projectId: string, workflowRunId = "workflow-run-1", status = "failed"): WorkflowRunDetailViewModel {
  return {
    run: {
      id: workflowRunId,
      projectId,
      resourceId: `shot-exec-${workflowRunId}`,
      workflowType: "shot_pipeline",
      status,
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: status === "running" ? 1 : 2,
      lastError: status === "failed" ? "provider rejected request" : "",
      externalRequestId: `request-${workflowRunId}`,
      createdAt: "2024-03-09T16:00:00.000Z",
      updatedAt: "2024-03-09T16:05:00.000Z",
    },
    steps: [
      {
        id: `step-${workflowRunId}`,
        workflowRunId,
        stepKey: "attempt_1.gateway",
        stepOrder: 2,
        status,
        errorCode: status === "failed" ? "provider_error" : "",
        errorMessage: status === "failed" ? "provider rejected request" : "",
        startedAt: "2024-03-09T16:00:10.000Z",
        completedAt: "",
        failedAt: status === "failed" ? "2024-03-09T16:05:00.000Z" : "",
      },
    ],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("useAdminWorkflowController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the current selection while filters change and reloads the monitor with the new filter", async () => {
    loadWorkflowMonitorPanelMock
      .mockResolvedValueOnce(createWorkflowMonitor("project-live-001"))
      .mockResolvedValueOnce(createWorkflowMonitor("project-live-001", "failed"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-live-001"));

    const { result } = renderHook(() =>
      useAdminWorkflowController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.workflowMonitor.runs).toHaveLength(2);
    });

    act(() => {
      result.current.onSelectWorkflowRun("workflow-run-1");
    });

    await waitFor(() => {
      expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-1");
    });

    act(() => {
      result.current.onWorkflowStatusFilterChange("failed");
    });

    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenLastCalledWith({
        projectId: "project-live-001",
        status: "failed",
        workflowType: "",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(result.current.selectedWorkflowRunId).toBe("workflow-run-1");
  });

  it("uses the latest selected run when silent refresh reloads the open detail", async () => {
    loadWorkflowMonitorPanelMock
      .mockResolvedValueOnce(createWorkflowMonitor("project-live-001"))
      .mockResolvedValue(createWorkflowMonitor("project-live-001"));
    loadWorkflowRunDetailsMock
      .mockResolvedValueOnce(createWorkflowDetail("project-live-001", "workflow-run-1"))
      .mockResolvedValueOnce(createWorkflowDetail("project-live-001", "workflow-run-2"))
      .mockResolvedValueOnce(createWorkflowDetail("project-live-001", "workflow-run-2"));

    const { result } = renderHook(() =>
      useAdminWorkflowController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.workflowMonitor.runs).toHaveLength(2);
    });

    act(() => {
      result.current.onSelectWorkflowRun("workflow-run-1");
    });

    await waitFor(() => {
      expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-1");
    });

    act(() => {
      result.current.onSelectWorkflowRun("workflow-run-2");
    });

    await waitFor(() => {
      expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-2");
    });

    await act(async () => {
      await result.current.refreshWorkflowSilently();
    });

    expect(loadWorkflowRunDetailsMock).toHaveBeenLastCalledWith({
      workflowRunId: "workflow-run-2",
      orgId: undefined,
      userId: undefined,
    });
  });

  it("retries a workflow run, then refreshes monitor and detail with success feedback", async () => {
    loadWorkflowMonitorPanelMock
      .mockResolvedValueOnce(createWorkflowMonitor("project-live-001"))
      .mockResolvedValue(createWorkflowMonitor("project-live-001"));
    loadWorkflowRunDetailsMock
      .mockResolvedValueOnce(createWorkflowDetail("project-live-001", "workflow-run-2"))
      .mockResolvedValueOnce(createWorkflowDetail("project-live-001", "workflow-run-2", "running"));
    retryWorkflowRunMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useAdminWorkflowController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.workflowMonitor.runs).toHaveLength(2);
    });

    act(() => {
      result.current.onSelectWorkflowRun("workflow-run-2");
    });

    await waitFor(() => {
      expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-2");
    });

    act(() => {
      result.current.onRetryWorkflowRun("workflow-run-2");
    });

    await waitFor(() => {
      expect(result.current.workflowActionFeedback?.tone).toBe("success");
    });

    expect(retryWorkflowRunMock).toHaveBeenCalledWith({
      workflowRunId: "workflow-run-2",
      orgId: "org-demo-001",
      userId: "user-demo-001",
    });
  });

  it("keeps the open detail and surfaces workflow action errors when cancel fails", async () => {
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-001"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-live-001", "workflow-run-1", "running"));
    cancelWorkflowRunMock.mockRejectedValueOnce(new Error("cancel exploded"));

    const { result } = renderHook(() =>
      useAdminWorkflowController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.workflowMonitor.runs).toHaveLength(2);
    });

    act(() => {
      result.current.onSelectWorkflowRun("workflow-run-1");
    });

    await waitFor(() => {
      expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-1");
    });

    act(() => {
      result.current.onCancelWorkflowRun("workflow-run-1");
    });

    await waitFor(() => {
      expect(result.current.workflowActionFeedback?.tone).toBe("error");
    });

    expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-1");
    expect(result.current.workflowActionFeedback?.message).toContain("cancel exploded");
  });

  it("queues at most one additional silent refresh while a refresh is already running", async () => {
    const monitorDeferred = createDeferred<WorkflowMonitorViewModel>();
    loadWorkflowMonitorPanelMock.mockResolvedValueOnce(createWorkflowMonitor("project-live-001"));
    loadWorkflowRunDetailsMock.mockResolvedValueOnce(createWorkflowDetail("project-live-001", "workflow-run-1"));

    const { result } = renderHook(() =>
      useAdminWorkflowController({
        sessionState: "ready",
        projectId: "project-live-001",
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.workflowMonitor.runs).toHaveLength(2);
    });

    act(() => {
      result.current.onSelectWorkflowRun("workflow-run-1");
    });

    await waitFor(() => {
      expect(result.current.workflowRunDetail?.run.id).toBe("workflow-run-1");
    });

    loadWorkflowMonitorPanelMock.mockReturnValue(monitorDeferred.promise);
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-live-001", "workflow-run-1"));

    const firstRefresh = result.current.refreshWorkflowSilently();
    const secondRefresh = result.current.refreshWorkflowSilently();
    const thirdRefresh = result.current.refreshWorkflowSilently();

    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      monitorDeferred.resolve(createWorkflowMonitor("project-live-001"));
      await Promise.all([firstRefresh, secondRefresh, thirdRefresh]);
    });

    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledTimes(3);
    });
  });
});
