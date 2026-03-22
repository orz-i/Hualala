import { fireEvent, render, screen, within } from "@testing-library/react";
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
    candidateAssets: [
      {
        id: "candidate-1",
        assetId: "asset-1",
        shotExecutionId: "shot-exec-1",
        sourceRunId: "source-run-1",
      },
      {
        id: "candidate-2",
        assetId: "asset-2",
        shotExecutionId: "shot-exec-1",
        sourceRunId: "source-run-2",
      },
    ],
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
      provider: "seedance",
      currentStep: "attempt_2.gateway",
      attemptCount: 2,
      lastError: "provider rejected request",
      externalRequestId: "request-1",
    },
    workflowSteps: [
      {
        id: "workflow-step-1",
        workflowRunId: "workflow-run-1",
        stepKey: "attempt_2.dispatch",
        stepOrder: 1,
        status: "completed",
        errorCode: "",
        errorMessage: "",
      },
      {
        id: "workflow-step-2",
        workflowRunId: "workflow-run-1",
        stepKey: "attempt_2.gateway",
        stepOrder: 2,
        status: "failed",
        errorCode: "provider_error",
        errorMessage: "provider rejected request",
      },
    ],
    detailUnavailableMessage: undefined,
  };

  it("renders shot execution summary, review timeline, and workflow observability details", () => {
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
    expect(screen.getByText("2 个候选素材")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getAllByText("最近评估：passed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("主素材：asset-1")).toBeInTheDocument();
    expect(screen.getByText("评审时间线")).toBeInTheDocument();
    expect(screen.getByText("评估记录")).toBeInTheDocument();
    expect(screen.getByText("评审记录")).toBeInTheDocument();
    expect(screen.getByText("通过检查：asset_selected")).toBeInTheDocument();
    expect(screen.getByText("评论语言：zh-CN")).toBeInTheDocument();
    expect(screen.getByText("来源运行：source-run-1")).toBeInTheDocument();
    expect(screen.getByText("当前主素材")).toBeInTheDocument();
    expect(screen.getByText("最近一次运行：workflow-run-1")).toBeInTheDocument();
    expect(screen.getByText("工作流类型：shot_pipeline")).toBeInTheDocument();
    expect(screen.getByText("当前状态：failed")).toBeInTheDocument();
    expect(screen.getByText("工作流提供方：seedance")).toBeInTheDocument();
    expect(screen.getByText("当前步骤：attempt_2.gateway")).toBeInTheDocument();
    expect(screen.getByText("尝试次数：2")).toBeInTheDocument();
    expect(screen.getByText("最近错误：provider rejected request")).toBeInTheDocument();
    expect(screen.getByText("外部请求 ID：request-1")).toBeInTheDocument();
    expect(screen.getByText("工作流步骤")).toBeInTheDocument();
    expect(screen.getByText("步骤：attempt_2.dispatch")).toBeInTheDocument();
    expect(screen.getByText("错误码：provider_error")).toBeInTheDocument();
    expect(screen.getByText("错误信息：provider rejected request")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试工作流" })).toBeInTheDocument();
  });

  it("triggers gate check, submit review, workflow, and select primary actions for the current shot execution", () => {
    const onRunSubmissionGateChecks = vi.fn();
    const onSubmitShotForReview = vi.fn();
    const onStartWorkflow = vi.fn();
    const onRetryWorkflowRun = vi.fn();
    const onSelectPrimaryAsset = vi.fn();
    const onOpenAssetProvenance = vi.fn();

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
        onSelectPrimaryAsset={onSelectPrimaryAsset}
        onOpenAssetProvenance={onOpenAssetProvenance}
      />,
    );

    const nonPrimaryCandidateCard = screen.getByText("候选：candidate-2").closest("article");
    expect(nonPrimaryCandidateCard).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));
    fireEvent.click(screen.getByRole("button", { name: "提交评审" }));
    fireEvent.click(screen.getByRole("button", { name: "发起工作流" }));
    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));
    fireEvent.click(
      within(nonPrimaryCandidateCard as HTMLElement).getByRole("button", {
        name: "设为主素材",
      }),
    );
    fireEvent.click(
      within(nonPrimaryCandidateCard as HTMLElement).getByRole("button", {
        name: "查看来源",
      }),
    );

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
    expect(onSelectPrimaryAsset).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-2",
    });
    expect(onOpenAssetProvenance).toHaveBeenCalledWith("asset-2");
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
          workflowSteps: workflowPanel.workflowSteps,
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
    expect(screen.getByText("Source run: source-run-2")).toBeInTheDocument();
    expect(screen.getByText("Workflow running")).toBeInTheDocument();
    expect(screen.getByText("Provider: seedance")).toBeInTheDocument();
    expect(screen.getByText("Current step: attempt_2.gateway")).toBeInTheDocument();
    expect(screen.getByText("Attempt count: 2")).toBeInTheDocument();
    expect(screen.getByText("Workflow Steps")).toBeInTheDocument();

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

  it("renders workflow step empty and unavailable fallbacks independently", () => {
    const { rerender } = render(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={{
          latestWorkflowRun: workflowPanel.latestWorkflowRun,
          workflowSteps: [],
          detailUnavailableMessage: undefined,
        }}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("尚无工作流步骤")).toBeInTheDocument();

    rerender(
      <ShotWorkbenchPage
        workbench={workbench}
        workflowPanel={{
          latestWorkflowRun: workflowPanel.latestWorkflowRun,
          workflowSteps: [],
          detailUnavailableMessage: "工作流详情暂不可用",
        }}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("工作流详情暂不可用")).toBeInTheDocument();
  });

  it("renders an empty candidate list message when the shot has no candidate assets", () => {
    render(
      <ShotWorkbenchPage
        workbench={{
          ...workbench,
          candidateAssets: [],
        }}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("尚无候选素材")).toBeInTheDocument();
  });

  it("does not mark a candidate as primary when both asset ids are empty", () => {
    render(
      <ShotWorkbenchPage
        workbench={{
          ...workbench,
          shotExecution: {
            ...workbench.shotExecution,
            primaryAssetId: "",
          },
          candidateAssets: [
            {
              id: "candidate-empty",
              assetId: "",
              shotExecutionId: "shot-exec-1",
              sourceRunId: "source-run-empty",
            },
          ],
        }}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onSelectPrimaryAsset={vi.fn()}
      />,
    );

    expect(screen.queryByText("当前主素材")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设为主素材" })).toBeDisabled();
  });

  it("disables provenance when the candidate asset is missing an asset id", () => {
    const onOpenAssetProvenance = vi.fn();

    render(
      <ShotWorkbenchPage
        workbench={{
          ...workbench,
          candidateAssets: [
            ...workbench.candidateAssets,
            {
              id: "candidate-3",
              assetId: "",
              shotExecutionId: "shot-exec-1",
              sourceRunId: "source-run-3",
            },
          ],
        }}
        workflowPanel={workflowPanel}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onOpenAssetProvenance={onOpenAssetProvenance}
      />,
    );

    const disabledCard = screen.getByText("候选：candidate-3").closest("article");
    expect(disabledCard).not.toBeNull();
    const disabledButton = within(disabledCard as HTMLElement).getByRole("button", {
      name: "查看来源",
    });
    expect(disabledButton).toBeDisabled();

    fireEvent.click(disabledButton);
    expect(onOpenAssetProvenance).not.toHaveBeenCalled();
  });
});
