import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { WorkflowRunDetailDialog } from "./WorkflowRunDetailDialog";
import {
  createFailedWorkflowDetail,
  createRunningWorkflowDetail,
  createSucceededWorkflowDetail,
} from "./testData";

describe("WorkflowRunDetailDialog", () => {
  it("shows retry action for failed workflows and closes on escape", async () => {
    const onRetryWorkflowRun = vi.fn();
    const onCloseWorkflowDetail = vi.fn();

    render(
      <WorkflowRunDetailDialog
        workflowRunDetail={createFailedWorkflowDetail()}
        workflowActionFeedback={{
          tone: "pending",
          message: "正在重试工作流",
        }}
        workflowActionPending
        onRetryWorkflowRun={onRetryWorkflowRun}
        onCloseWorkflowDetail={onCloseWorkflowDetail}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.getByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试工作流" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "取消工作流" })).not.toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "关闭工作流详情" });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseWorkflowDetail).toHaveBeenCalled();
  });

  it("shows cancel action for running workflows and hides actions for succeeded ones", () => {
    const onCancelWorkflowRun = vi.fn();
    const { rerender } = render(
      <WorkflowRunDetailDialog
        workflowRunDetail={createRunningWorkflowDetail()}
        onCancelWorkflowRun={onCancelWorkflowRun}
        t={createTranslator("zh-CN")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "取消工作流" }));
    expect(onCancelWorkflowRun).toHaveBeenCalledWith("workflow-run-1");

    rerender(
      <WorkflowRunDetailDialog
        workflowRunDetail={createSucceededWorkflowDetail()}
        t={createTranslator("zh-CN")}
      />,
    );

    expect(screen.queryByRole("button", { name: "重试工作流" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消工作流" })).not.toBeInTheDocument();
  });
});
