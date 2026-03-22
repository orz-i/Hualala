import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { WorkflowMonitorPanel } from "./WorkflowMonitorPanel";
import { createWorkflowMonitor } from "./testData";

describe("WorkflowMonitorPanel", () => {
  it("filters workflow runs and opens the detail CTA", () => {
    const onWorkflowStatusFilterChange = vi.fn();
    const onWorkflowTypeFilterChange = vi.fn();
    const onSelectWorkflowRun = vi.fn();

    render(
      <WorkflowMonitorPanel
        workflowMonitor={createWorkflowMonitor()}
        t={createTranslator("zh-CN")}
        onWorkflowStatusFilterChange={onWorkflowStatusFilterChange}
        onWorkflowTypeFilterChange={onWorkflowTypeFilterChange}
        onSelectWorkflowRun={onSelectWorkflowRun}
      />,
    );

    fireEvent.change(screen.getByLabelText("工作流状态过滤"), {
      target: { value: "failed" },
    });
    fireEvent.change(screen.getByLabelText("工作流类型过滤"), {
      target: { value: "shot_pipeline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查看工作流详情 workflow-run-2" }));

    expect(onWorkflowStatusFilterChange).toHaveBeenCalledWith("failed");
    expect(onWorkflowTypeFilterChange).toHaveBeenCalledWith("shot_pipeline");
    expect(onSelectWorkflowRun).toHaveBeenCalledWith("workflow-run-2");
  });
});
