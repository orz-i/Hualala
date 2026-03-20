import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ADMIN_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";
import { App } from "./App";

vi.mock("../features/dashboard/loadAdminOverview", () => ({
  loadAdminOverview: vi.fn(),
}));
vi.mock("../features/dashboard/mutateBudgetPolicy", () => ({
  updateBudgetPolicy: vi.fn(),
}));

const loadAdminOverviewMock = vi.mocked(loadAdminOverview);
const updateBudgetPolicyMock = vi.mocked(updateBudgetPolicy);

function createOverview(projectId: string, shotExecutionId: string, limitCents = 120000) {
  return {
    budgetSnapshot: {
      projectId,
      limitCents,
      reservedCents: 18000,
      remainingBudgetCents: limitCents - 18000,
    },
    usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
    billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
    reviewSummary: {
      shotExecutionId,
      latestConclusion: "approved",
    },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
    recentChanges: [
      {
        id: "billing-event-1",
        kind: "billing" as const,
        tone: "info" as const,
        eventType: "budget_reserved",
        amountCents: 18000,
      },
      {
        id: "evaluation-eval-1",
        kind: "evaluation" as const,
        tone: "success" as const,
        status: "passed",
        failedChecksCount: 0,
      },
      {
        id: "review-review-1",
        kind: "review" as const,
        tone: "success" as const,
        conclusion: "approved",
      },
    ],
  };
}

describe("Admin App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(ADMIN_UI_LOCALE_STORAGE_KEY, "zh-CN");
  });

  it("reads projectId and shotExecutionId from search params, then renders the live overview", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-1", "shot-exec-live-1"));

    render(<App />);

    expect(screen.getByText("正在加载管理概览")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadAdminOverviewMock).toHaveBeenCalledWith({
        projectId: "project-live-1",
        shotExecutionId: "shot-exec-live-1",
      });
    });

    expect(await screen.findByText("project-live-1")).toBeInTheDocument();
    expect(screen.getAllByText("approved").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();
    expect(screen.getByText("1 条计费事件")).toBeInTheDocument();
  });

  it("updates the budget policy and refreshes the overview", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1",
    );
    loadAdminOverviewMock.mockResolvedValueOnce(createOverview("project-live-1", "shot-exec-live-1"));
    loadAdminOverviewMock.mockResolvedValueOnce(
      createOverview("project-live-1", "shot-exec-live-1", 150000),
    );
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

  it("keeps the current overview visible and surfaces an error when budget updates fail", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-2&shotExecutionId=shot-exec-live-2&orgId=org-live-2",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-2", "shot-exec-live-2"));
    updateBudgetPolicyMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("project-live-2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("预算上限（元）"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新预算" }));

    expect(await screen.findByText("预算策略更新失败：network down")).toBeInTheDocument();
    expect(screen.getByText("project-live-2")).toBeInTheDocument();
    expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);
  });

  it("switches locale, persists it, and renders budget feedback in English", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-3&shotExecutionId=shot-exec-live-3&orgId=org-live-3",
    );
    loadAdminOverviewMock.mockResolvedValueOnce(createOverview("project-live-3", "shot-exec-live-3"));
    loadAdminOverviewMock.mockResolvedValueOnce(
      createOverview("project-live-3", "shot-exec-live-3", 150000),
    );
    updateBudgetPolicyMock.mockResolvedValue({
      id: "budget-1",
      orgId: "org-live-3",
      projectId: "project-live-3",
      limitCents: 150000,
      reservedCents: 18000,
    });

    render(<App />);

    expect(await screen.findByText("project-live-3")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ui-locale-select"), {
      target: { value: "en-US" },
    });

    expect(window.localStorage.getItem(ADMIN_UI_LOCALE_STORAGE_KEY)).toBe("en-US");
    expect(await screen.findByText("Recent Changes")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Budget limit (yuan)"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update budget" }));

    expect(await screen.findByText("Budget policy updated")).toBeInTheDocument();
    expect(screen.getByText("Budget limit: 1500.00 元")).toBeInTheDocument();
  });
});
