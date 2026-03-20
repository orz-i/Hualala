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
        }}
      />,
    );

    expect(screen.getByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByText("预算上限：1200.00 元")).toBeInTheDocument();
    expect(screen.getByText("1 条用量记录")).toBeInTheDocument();
    expect(screen.getByText("1 条计费事件")).toBeInTheDocument();
    expect(screen.getAllByText("approved")).toHaveLength(2);
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();
  });

  it("allows submitting a new budget limit", () => {
    const onUpdateBudgetLimit = vi.fn();

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
        }}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
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
  });
});
