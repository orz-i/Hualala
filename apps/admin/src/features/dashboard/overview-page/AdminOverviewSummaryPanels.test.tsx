import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { createOverview } from "./testData";
import { AdminOverviewSummaryPanels } from "./AdminOverviewSummaryPanels";

describe("AdminOverviewSummaryPanels", () => {
  it("renders overview cards and submits a new budget limit", () => {
    const onUpdateBudgetLimit = vi.fn();

    render(
      <AdminOverviewSummaryPanels
        overview={createOverview()}
        operationsOverview={null}
        t={createTranslator("zh-CN")}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        budgetFeedback={{
          tone: "success",
          message: "预算策略已更新",
        }}
      />,
    );

    expect(screen.getByText("预算上限：1200.00 元")).toBeInTheDocument();
    expect(screen.getByText("1 条用量记录")).toBeInTheDocument();
    expect(screen.getByText("最近评审结论")).toBeInTheDocument();
    expect(screen.getByText("budget_reserved · 180.00 元")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("预算上限（元）"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新预算" }));

    expect(onUpdateBudgetLimit).toHaveBeenCalledWith({
      projectId: "project-live-1",
      limitCents: 150000,
    });
    expect(screen.getByText("预算策略已更新")).toBeInTheDocument();
  });
});
