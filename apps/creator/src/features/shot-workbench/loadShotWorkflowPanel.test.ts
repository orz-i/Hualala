import { createWorkflowClient } from "@hualala/sdk";
import { loadShotWorkflowPanel } from "./loadShotWorkflowPanel";

vi.mock("@hualala/sdk", () => ({
  createWorkflowClient: vi.fn(),
}));

describe("loadShotWorkflowPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the latest workflow run details and steps for the current shot execution", async () => {
    const listWorkflowRunsMock = vi.fn().mockResolvedValue({
      workflowRuns: [
        {
          id: "workflow-run-3",
          workflowType: "shot_pipeline",
          status: "running",
          resourceId: "shot-exec-1",
          projectId: "project-1",
          provider: "seedance",
          currentStep: "attempt_1.gateway",
          attemptCount: 1,
          lastError: "",
          externalRequestId: "request-3",
        },
        {
          id: "workflow-run-2",
          workflowType: "shot_pipeline",
          status: "failed",
          resourceId: "shot-exec-1",
          projectId: "project-1",
        },
        {
          id: "workflow-run-1",
          workflowType: "shot_pipeline",
          status: "completed",
          resourceId: "shot-exec-2",
          projectId: "project-1",
        },
      ],
    });
    const getWorkflowRunMock = vi.fn().mockResolvedValue({
      workflowRun: {
        id: "workflow-run-3",
        workflowType: "shot_pipeline",
        status: "running",
        resourceId: "shot-exec-1",
        projectId: "project-1",
        provider: "seedance",
        currentStep: "attempt_1.gateway",
        attemptCount: 1,
        lastError: "",
        externalRequestId: "request-3",
      },
      workflowSteps: [
        {
          id: "workflow-step-1",
          workflowRunId: "workflow-run-3",
          stepKey: "attempt_1.dispatch",
          stepOrder: 1,
          status: "completed",
          errorCode: "",
          errorMessage: "",
        },
        {
          id: "workflow-step-2",
          workflowRunId: "workflow-run-3",
          stepKey: "attempt_1.gateway",
          stepOrder: 2,
          status: "running",
          errorCode: "",
          errorMessage: "",
        },
      ],
    });
    vi.mocked(createWorkflowClient).mockReturnValue({
      listWorkflowRuns: listWorkflowRunsMock,
      getWorkflowRun: getWorkflowRunMock,
    } as never);

    const result = await loadShotWorkflowPanel({
      projectId: "project-1",
      shotExecutionId: "shot-exec-1",
      orgId: "org-1",
      userId: "user-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createWorkflowClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
        identity: {
          orgId: "org-1",
          userId: "user-1",
        },
      }),
    );
    expect(listWorkflowRunsMock).toHaveBeenCalledWith({
      projectId: "project-1",
      resourceId: "shot-exec-1",
    });
    expect(getWorkflowRunMock).toHaveBeenCalledWith({
      workflowRunId: "workflow-run-3",
    });
    expect(result.latestWorkflowRun).toEqual({
      id: "workflow-run-3",
      workflowType: "shot_pipeline",
      status: "running",
      resourceId: "shot-exec-1",
      projectId: "project-1",
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: 1,
      lastError: "",
      externalRequestId: "request-3",
    });
    expect(result.workflowSteps).toEqual([
      {
        id: "workflow-step-1",
        workflowRunId: "workflow-run-3",
        stepKey: "attempt_1.dispatch",
        stepOrder: 1,
        status: "completed",
        errorCode: "",
        errorMessage: "",
      },
      {
        id: "workflow-step-2",
        workflowRunId: "workflow-run-3",
        stepKey: "attempt_1.gateway",
        stepOrder: 2,
        status: "running",
        errorCode: "",
        errorMessage: "",
      },
    ]);
    expect(result.detailUnavailableMessage).toBeUndefined();
  });

  it("returns an empty workflow panel when no workflow run exists", async () => {
    const listWorkflowRunsMock = vi.fn().mockResolvedValue({
      workflowRuns: [],
    });
    const getWorkflowRunMock = vi.fn();
    vi.mocked(createWorkflowClient).mockReturnValue({
      listWorkflowRuns: listWorkflowRunsMock,
      getWorkflowRun: getWorkflowRunMock,
    } as never);

    const result = await loadShotWorkflowPanel({
      projectId: "project-1",
      shotExecutionId: "shot-exec-1",
    });

    expect(result).toEqual({
      latestWorkflowRun: undefined,
      workflowSteps: [],
      detailUnavailableMessage: undefined,
    });
    expect(getWorkflowRunMock).not.toHaveBeenCalled();
  });

  it("keeps the latest run summary and downgrades details when workflow detail loading fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const listWorkflowRunsMock = vi.fn().mockResolvedValue({
      workflowRuns: [
        {
          id: "workflow-run-3",
          workflowType: "shot_pipeline",
          status: "failed",
          resourceId: "shot-exec-1",
          projectId: "project-1",
          provider: "seedance",
          currentStep: "attempt_2.gateway",
          attemptCount: 2,
          lastError: "provider rejected request",
          externalRequestId: "request-3",
        },
      ],
    });
    const getWorkflowRunMock = vi
      .fn()
      .mockRejectedValue(new Error("sdk: failed to get workflow run"));
    vi.mocked(createWorkflowClient).mockReturnValue({
      listWorkflowRuns: listWorkflowRunsMock,
      getWorkflowRun: getWorkflowRunMock,
    } as never);

    const result = await loadShotWorkflowPanel({
      projectId: "project-1",
      shotExecutionId: "shot-exec-1",
      detailUnavailableMessage: "工作流详情暂不可用",
    });

    expect(result.latestWorkflowRun).toEqual({
      id: "workflow-run-3",
      workflowType: "shot_pipeline",
      status: "failed",
      resourceId: "shot-exec-1",
      projectId: "project-1",
      provider: "seedance",
      currentStep: "attempt_2.gateway",
      attemptCount: 2,
      lastError: "provider rejected request",
      externalRequestId: "request-3",
    });
    expect(result.workflowSteps).toEqual([]);
    expect(result.detailUnavailableMessage).toBe("工作流详情暂不可用");
    expect(warnSpy).toHaveBeenCalledWith("creator: failed to load workflow run details", {
      workflowRunId: "workflow-run-3",
      error: expect.any(Error),
    });
    warnSpy.mockRestore();
  });
});
