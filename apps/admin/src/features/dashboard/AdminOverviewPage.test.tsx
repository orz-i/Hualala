import { fireEvent, render, screen } from "@testing-library/react";
import { AdminOverviewPage } from "./AdminOverviewPage";

describe("AdminOverviewPage", () => {
  it("renders budget, billing, and review overview cards", () => {
    render(
      <AdminOverviewPage
        overview={{
          budgetSnapshot: {
            projectId: "project-live-1",
            limitCents: 120000,
            reservedCents: 18000,
            remainingBudgetCents: 102000,
          },
          usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
          billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
          reviewSummary: {
            shotExecutionId: "shot-exec-live-1",
            latestConclusion: "approved",
          },
          evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
          shotReviews: [{ id: "review-1", conclusion: "approved" }],
          recentChanges: [
            {
              id: "billing-event-1",
              kind: "billing",
              title: "最近计费事件",
              detail: "budget_reserved · 180.00 元",
              tone: "info",
            },
            {
              id: "evaluation-eval-1",
              kind: "evaluation",
              title: "最近评估结果",
              detail: "passed · 0 个失败检查",
              tone: "success",
            },
            {
              id: "review-review-1",
              kind: "review",
              title: "最近评审结论",
              detail: "approved",
              tone: "success",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByText("预算上限：1200.00 元")).toBeInTheDocument();
    expect(screen.getByText("1 条用量记录")).toBeInTheDocument();
    expect(screen.getByText("1 条计费事件")).toBeInTheDocument();
    expect(screen.getAllByText("approved").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();
    expect(screen.getByText("最近变更")).toBeInTheDocument();
    expect(screen.getByText("最近计费事件")).toBeInTheDocument();
    expect(screen.getByText("budget_reserved · 180.00 元")).toBeInTheDocument();
    expect(screen.getByText("最近评估结果")).toBeInTheDocument();
    expect(screen.getByText("passed · 0 个失败检查")).toBeInTheDocument();
    expect(screen.getByText("最近评审结论")).toBeInTheDocument();
  });

  it("allows submitting a new budget limit", () => {
    const onUpdateBudgetLimit = vi.fn();

    const { rerender } = render(
      <AdminOverviewPage
        overview={{
          budgetSnapshot: {
            projectId: "project-live-1",
            limitCents: 120000,
            reservedCents: 18000,
            remainingBudgetCents: 102000,
          },
          usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
          billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
          reviewSummary: {
            shotExecutionId: "shot-exec-live-1",
            latestConclusion: "approved",
          },
          evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
          shotReviews: [{ id: "review-1", conclusion: "approved" }],
          recentChanges: [
            {
              id: "billing-event-1",
              kind: "billing",
              title: "最近计费事件",
              detail: "budget_reserved · 180.00 元",
              tone: "info",
            },
            {
              id: "evaluation-eval-1",
              kind: "evaluation",
              title: "最近评估结果",
              detail: "passed · 0 个失败检查",
              tone: "success",
            },
            {
              id: "review-review-1",
              kind: "review",
              title: "最近评审结论",
              detail: "approved",
              tone: "success",
            },
          ],
        }}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        budgetFeedback={{
          tone: "success",
          message: "预算策略已更新",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("预算上限（元）"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新预算" }));

    expect(onUpdateBudgetLimit).toHaveBeenCalledWith({
      limitCents: 150000,
      projectId: "project-live-1",
    });
    expect(screen.getByText("预算策略已更新")).toHaveStyle({ color: "#115e59" });

    rerender(
      <AdminOverviewPage
        overview={{
          budgetSnapshot: {
            projectId: "project-live-1",
            limitCents: 120000,
            reservedCents: 18000,
            remainingBudgetCents: 102000,
          },
          usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
          billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
          reviewSummary: {
            shotExecutionId: "shot-exec-live-1",
            latestConclusion: "approved",
          },
          evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
          shotReviews: [{ id: "review-1", conclusion: "approved" }],
          recentChanges: [
            {
              id: "billing-event-1",
              kind: "billing",
              title: "最近计费事件",
              detail: "budget_reserved · 180.00 元",
              tone: "info",
            },
            {
              id: "evaluation-eval-1",
              kind: "evaluation",
              title: "最近评估结果",
              detail: "passed · 0 个失败检查",
              tone: "success",
            },
            {
              id: "review-review-1",
              kind: "review",
              title: "最近评审结论",
              detail: "approved",
              tone: "success",
            },
          ],
        }}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        budgetFeedback={{
          tone: "error",
          message: "预算策略更新失败：network down",
        }}
      />,
    );

    expect(screen.getByText("预算策略更新失败：network down")).toHaveStyle({
      color: "#991b1b",
    });
  });
});
