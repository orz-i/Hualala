import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { ShotWorkbenchPage } from "./ShotWorkbenchPage";

describe("ShotWorkbenchPage", () => {
  const workbench = {
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
    reviewTimeline: {
      evaluationRuns: [
        {
          id: "eval-1",
          status: "passed",
          passedChecks: ["asset_selected"],
          failedChecks: [],
        },
      ],
      shotReviews: [
        {
          id: "review-1",
          conclusion: "approved",
          commentLocale: "zh-CN",
        },
      ],
    },
  };
  const workflowPanel = {
    latestWorkflowRun: {
      id: "workflow-run-1",
      workflowType: "shot_pipeline",
      status: "failed",
      resourceId: "shot-exec-1",
      projectId: "project-1",
    },
  };

  it("renders shot execution summary, review timeline, and workflow status", () => {
    render(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("shot-exec-1")).toBeInTheDocument();
    expect(screen.getByText(/submitted_for_review/)).toBeInTheDocument();
    expect(screen.getByText("1 个候选素材")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getAllByText("最近评估：passed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("主素材：asset-1")).toBeInTheDocument();
    expect(screen.getByText("评审时间线")).toBeInTheDocument();
    expect(screen.getByText("评估记录")).toBeInTheDocument();
    expect(screen.getByText("评审记录")).toBeInTheDocument();
    expect(screen.getByText("通过检查：asset_selected")).toBeInTheDocument();
    expect(screen.getByText("评论语言：zh-CN")).toBeInTheDocument();
    expect(screen.getByText(/workflow-run-1/)).toBeInTheDocument();
    expect(screen.getByText(/shot_pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/failed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试工作流" })).toBeInTheDocument();
  });

  it("triggers gate check and submit review actions for the current shot execution", () => {
    const onRunSubmissionGateChecks = vi.fn();
    const onSubmitShotForReview = vi.fn();
    const onStartWorkflow = vi.fn();
    const onRetryWorkflowRun = vi.fn();

    render(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onRunSubmissionGateChecks={onRunSubmissionGateChecks}
        onSubmitShotForReview={onSubmitShotForReview}
        onStartWorkflow={onStartWorkflow}
        onRetryWorkflowRun={onRetryWorkflowRun}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));
    fireEvent.click(screen.getByRole("button", { name: "提交评审" }));
    fireEvent.click(screen.getByRole("button", { name: "发起工作流" }));
    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));

    expect(onRunSubmissionGateChecks).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
    expect(onSubmitShotForReview).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
    });
    expect(onStartWorkflow).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      projectId: "project-1",
      orgId: "org-1",
    });
    expect(onRetryWorkflowRun).toHaveBeenCalledWith({
      workflowRunId: "workflow-run-1",
    });
  });

  it("renders a success or error feedback message when provided", () => {
    const { rerender } = render(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        feedback={{
          tone: "success",
          message: "Gate 检查已完成",
          sections: [
            { label: "通过检查", items: ["asset_selected"] },
            { label: "未通过检查", items: ["copyright_missing"] },
            { label: "最新评审结论", items: "approved" },
            { label: "最近评估", items: "passed" },
          ],
        }}
      />,
    );

    expect(screen.getByText("Gate 检查已完成")).toBeInTheDocument();
    expect(screen.getByText("通过检查")).toBeInTheDocument();
    expect(screen.getByText("asset_selected")).toBeInTheDocument();
    expect(screen.getByText("未通过检查")).toBeInTheDocument();
    expect(screen.getByText("copyright_missing")).toBeInTheDocument();
    expect(screen.getByText("最新评审结论：approved")).toBeInTheDocument();
    expect(screen.getAllByText("最近评估：passed").length).toBeGreaterThanOrEqual(1);

    rerender(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        feedback={{
          tone: "error",
          message: "Gate 检查失败：network down",
        }}
      />,
    );

    expect(screen.getByText("Gate 检查失败：network down")).toBeInTheDocument();
  });

  it("switches locale and renders english labels", () => {
    const onLocaleChange = vi.fn();

    render(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={{
          latestWorkflowRun: {
            ...workflowPanel.latestWorkflowRun,
            status: "running",
          },
        }}
        locale="en-US"
        t={createTranslator("en-US")}
        onLocaleChange={onLocaleChange}
      />,
    );

    expect(screen.getByText("Creator Workbench")).toBeInTheDocument();
    expect(screen.getByText("Review Outcome")).toBeInTheDocument();
    expect(screen.getByText("Review Timeline")).toBeInTheDocument();
    expect(screen.getByText("Workflow Run")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Gate Checks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Workflow" })).toBeInTheDocument();
    expect(screen.getByText("Workflow running")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ui-locale-select"), {
      target: { value: "zh-CN" },
    });

    expect(onLocaleChange).toHaveBeenCalledWith("zh-CN");
  });

  it("renders the timeline empty state or unavailable fallback when history is missing", () => {
    const { rerender } = render(
      <ShotWorkbenchPage
        workbench={{
          ...workbench,
          reviewTimeline: {
            evaluationRuns: [],
            shotReviews: [],
          },
        }}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("尚无评审历史")).toBeInTheDocument();

    rerender(
      <ShotWorkbenchPage
        workbench={{
          ...workbench,
          reviewTimeline: {
            evaluationRuns: [],
            shotReviews: [],
            unavailableMessage: "评审时间线暂不可用",
          },
        }}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("评审时间线暂不可用")).toBeInTheDocument();
  });
});
