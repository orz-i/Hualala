import { render, screen } from "@testing-library/react";
import { ShotWorkbenchPage } from "./ShotWorkbenchPage";

describe("ShotWorkbenchPage", () => {
  it("renders shot execution summary, candidate count, review conclusion, and evaluation status", () => {
    render(
      <ShotWorkbenchPage
        workbench={{
          shotExecution: {
            id: "shot-exec-1",
            shotId: "shot-1",
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
        }}
      />,
    );

    expect(screen.getByText("shot-exec-1")).toBeInTheDocument();
    expect(screen.getByText("submitted_for_review")).toBeInTheDocument();
    expect(screen.getByText("1 个候选素材")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.getByText("asset-1")).toBeInTheDocument();
  });
});
