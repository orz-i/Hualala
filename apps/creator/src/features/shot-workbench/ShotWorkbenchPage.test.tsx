import { fireEvent, render, screen } from "@testing-library/react";
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

  it("triggers gate check and submit review actions for the current shot execution", () => {
    const onRunSubmissionGateChecks = vi.fn();
    const onSubmitShotForReview = vi.fn();

    render(
      <ShotWorkbenchPage
        workbench={{
          shotExecution: {
            id: "shot-exec-1",
            shotId: "shot-1",
            status: "candidate_ready",
            primaryAssetId: "asset-1",
          },
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          reviewSummary: {
            latestConclusion: "pending",
          },
          latestEvaluationRun: {
            id: "eval-1",
            status: "passed",
          },
        }}
        onRunSubmissionGateChecks={onRunSubmissionGateChecks}
        onSubmitShotForReview={onSubmitShotForReview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));
    fireEvent.click(screen.getByRole("button", { name: "提交评审" }));

    expect(onRunSubmissionGateChecks).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
    expect(onSubmitShotForReview).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
  });

  it("renders a success or error feedback message when provided", () => {
    const { rerender } = render(
      <ShotWorkbenchPage
        workbench={{
          shotExecution: {
            id: "shot-exec-1",
            shotId: "shot-1",
            status: "candidate_ready",
            primaryAssetId: "asset-1",
          },
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          reviewSummary: {
            latestConclusion: "pending",
          },
          latestEvaluationRun: {
            id: "eval-1",
            status: "pending",
          },
        }}
        feedback={{
          tone: "success",
          message: "Gate 检查已完成",
          passedChecks: ["asset_selected"],
          failedChecks: ["copyright_missing"],
        }}
      />,
    );

    expect(screen.getByText("Gate 检查已完成")).toBeInTheDocument();
    expect(screen.getByText("通过检查")).toBeInTheDocument();
    expect(screen.getByText("asset_selected")).toBeInTheDocument();
    expect(screen.getByText("未通过检查")).toBeInTheDocument();
    expect(screen.getByText("copyright_missing")).toBeInTheDocument();

    rerender(
      <ShotWorkbenchPage
        workbench={{
          shotExecution: {
            id: "shot-exec-1",
            shotId: "shot-1",
            status: "candidate_ready",
            primaryAssetId: "asset-1",
          },
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          reviewSummary: {
            latestConclusion: "pending",
          },
          latestEvaluationRun: {
            id: "eval-1",
            status: "pending",
          },
        }}
        feedback={{
          tone: "error",
          message: "Gate 检查失败：network down",
        }}
      />,
    );

    expect(screen.getByText("Gate 检查失败：network down")).toBeInTheDocument();
  });
});
