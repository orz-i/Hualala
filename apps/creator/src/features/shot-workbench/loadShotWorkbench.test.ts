import { createExecutionClient } from "@hualala/sdk";
import { loadShotWorkbench } from "./loadShotWorkbench";

vi.mock("@hualala/sdk", () => ({
  createExecutionClient: vi.fn(),
}));

describe("loadShotWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the shot workbench via the sdk execution client", async () => {
    const getShotWorkbenchMock = vi.fn().mockResolvedValue({
      workbench: {
        shotExecution: {
          id: "shot-exec-1",
          shotId: "shot-1",
          orgId: "org-1",
          projectId: "project-1",
          status: "submitted_for_review",
          primaryAssetId: "asset-1",
        },
        candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
        reviewSummary: {
          latestConclusion: "approved",
        },
        latestEvaluationRun: {
          id: "eval-1",
          status: "passed",
        },
      },
    });
    vi.mocked(createExecutionClient).mockReturnValue({
      getShotWorkbench: getShotWorkbenchMock,
    } as never);

    const result = await loadShotWorkbench({
      shotId: "shot-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createExecutionClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8080",
      }),
    );
    expect(getShotWorkbenchMock).toHaveBeenCalledWith({
      shotId: "shot-1",
      displayLocale: "zh-CN",
    });
    expect(result.shotExecution.id).toBe("shot-exec-1");
    expect(result.shotExecution.orgId).toBe("org-1");
    expect(result.shotExecution.projectId).toBe("project-1");
    expect(result.candidateAssets).toHaveLength(1);
    expect(result.reviewSummary.latestConclusion).toBe("approved");
    expect(result.latestEvaluationRun?.status).toBe("passed");
  });
});
