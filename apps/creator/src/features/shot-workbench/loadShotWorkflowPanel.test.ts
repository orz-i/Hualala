import { createWorkflowClient } from "@hualala/sdk";
import { loadShotWorkflowPanel } from "./loadShotWorkflowPanel";

vi.mock("@hualala/sdk", () => ({
  createWorkflowClient: vi.fn(),
}));

describe("loadShotWorkflowPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads workflow runs and returns the latest run for the current shot execution", async () => {
    const listWorkflowRunsMock = vi.fn().mockResolvedValue({
      workflowRuns: [
        {
          id: "workflow-run-3",
          workflowType: "shot_pipeline",
          status: "running",
          resourceId: "shot-exec-1",
          projectId: "project-1",
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
    vi.mocked(createWorkflowClient).mockReturnValue({
      listWorkflowRuns: listWorkflowRunsMock,
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
    });
    expect(result.latestWorkflowRun).toEqual({
      id: "workflow-run-3",
      workflowType: "shot_pipeline",
      status: "running",
      resourceId: "shot-exec-1",
      projectId: "project-1",
    });
  });
});
