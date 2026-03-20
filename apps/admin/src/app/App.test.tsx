import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";

vi.mock("../features/dashboard/loadAdminOverview", () => ({
  loadAdminOverview: vi.fn(),
}));
vi.mock("../features/dashboard/mutateBudgetPolicy", () => ({
  updateBudgetPolicy: vi.fn(),
}));

const loadAdminOverviewMock = vi.mocked(loadAdminOverview);
const updateBudgetPolicyMock = vi.mocked(updateBudgetPolicy);

describe("Admin App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads projectId and shotExecutionId from search params, then renders the live overview", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
    );
    loadAdminOverviewMock.mockResolvedValue({
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
    });

    render(<App />);

    expect(screen.getByText("正在加载管理概览")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadAdminOverviewMock).toHaveBeenCalledWith({
        projectId: "project-live-1",
        shotExecutionId: "shot-exec-live-1",
      });
    });

    expect(await screen.findByText("project-live-1")).toBeInTheDocument();
    expect(screen.getAllByText("approved")).toHaveLength(2);
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();
    expect(screen.getByText("1 条计费事件")).toBeInTheDocument();
  });

  it("updates the budget policy and refreshes the overview", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1",
    );
    loadAdminOverviewMock.mockResolvedValueOnce({
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
    });
    loadAdminOverviewMock.mockResolvedValueOnce({
      budgetSnapshot: {
        projectId: "project-live-1",
        limitCents: 150000,
        reservedCents: 18000,
        remainingBudgetCents: 132000,
      },
      usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
      billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
      reviewSummary: {
        shotExecutionId: "shot-exec-live-1",
        latestConclusion: "approved",
      },
      evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
      shotReviews: [{ id: "review-1", conclusion: "approved" }],
    });
    updateBudgetPolicyMock.mockResolvedValue({
      id: "budget-1",
      orgId: "org-live-1",
      projectId: "project-live-1",
      limitCents: 150000,
      reservedCents: 18000,
    });

    render(<App />);

    expect(await screen.findByText("project-live-1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("预算上限（元）"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新预算" }));

    await waitFor(() => {
      expect(updateBudgetPolicyMock).toHaveBeenCalledWith({
        orgId: "org-live-1",
        projectId: "project-live-1",
        limitCents: 150000,
      });
    });

    expect(await screen.findByText("预算策略已更新")).toBeInTheDocument();
    expect(screen.getByText("预算上限：1500.00 元")).toBeInTheDocument();
  });
});
