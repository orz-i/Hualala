import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";

vi.mock("../features/shot-workbench/loadShotWorkbench", () => ({
  loadShotWorkbench: vi.fn(),
}));

const loadShotWorkbenchMock = vi.mocked(loadShotWorkbench);

describe("App", () => {
  it("reads shotId from search params, loads the workbench, and renders the live data", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-1");
    loadShotWorkbenchMock.mockResolvedValue({
      shotExecution: {
        id: "shot-exec-live-1",
        shotId: "shot-live-1",
        status: "submitted_for_review",
        primaryAssetId: "asset-live-1",
      },
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      reviewSummary: {
        latestConclusion: "approved",
      },
      latestEvaluationRun: {
        id: "eval-live-1",
        status: "passed",
      },
    });

    render(<App />);

    expect(screen.getByText("正在加载镜头工作台")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          shotId: "shot-live-1",
        }),
      );
    });

    expect(await screen.findByText("shot-exec-live-1")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });
});
