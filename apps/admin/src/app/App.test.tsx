import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ADMIN_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { loadGovernancePanel } from "../features/dashboard/loadGovernancePanel";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";
import {
  updateMemberRole,
  updateOrgLocaleSettings,
  updateUserPreferences,
} from "../features/dashboard/mutateGovernance";
import { loadWorkflowMonitorPanel } from "../features/dashboard/loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "../features/dashboard/loadWorkflowRunDetails";
import { subscribeAdminRecentChanges } from "../features/dashboard/subscribeRecentChanges";
import { App } from "./App";

vi.mock("../features/dashboard/loadAdminOverview", () => ({
  loadAdminOverview: vi.fn(),
}));
vi.mock("../features/dashboard/loadGovernancePanel", () => ({
  loadGovernancePanel: vi.fn(),
}));
vi.mock("../features/dashboard/mutateBudgetPolicy", () => ({
  updateBudgetPolicy: vi.fn(),
}));
vi.mock("../features/dashboard/mutateGovernance", () => ({
  updateUserPreferences: vi.fn(),
  updateMemberRole: vi.fn(),
  updateOrgLocaleSettings: vi.fn(),
}));
vi.mock("../features/dashboard/loadWorkflowMonitorPanel", () => ({
  loadWorkflowMonitorPanel: vi.fn(),
}));
vi.mock("../features/dashboard/loadWorkflowRunDetails", () => ({
  loadWorkflowRunDetails: vi.fn(),
}));
vi.mock("../features/dashboard/subscribeRecentChanges", () => ({
  subscribeAdminRecentChanges: vi.fn(),
}));

const loadAdminOverviewMock = vi.mocked(loadAdminOverview);
const loadGovernancePanelMock = vi.mocked(loadGovernancePanel);
const updateBudgetPolicyMock = vi.mocked(updateBudgetPolicy);
const updateUserPreferencesMock = vi.mocked(updateUserPreferences);
const updateMemberRoleMock = vi.mocked(updateMemberRole);
const updateOrgLocaleSettingsMock = vi.mocked(updateOrgLocaleSettings);
const loadWorkflowMonitorPanelMock = vi.mocked(loadWorkflowMonitorPanel);
const loadWorkflowRunDetailsMock = vi.mocked(loadWorkflowRunDetails);
const subscribeAdminRecentChangesMock = vi.mocked(subscribeAdminRecentChanges);

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

function createGovernance(orgId: string, userId: string, locale = "zh-CN") {
  return {
    currentSession: {
      sessionId: `dev:${orgId}:${userId}`,
      orgId,
      userId,
      locale,
    },
    userPreferences: {
      userId,
      displayLocale: locale,
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
    roles: [{ roleId: "role-admin", orgId, code: "admin", displayName: "Administrator" }],
    orgLocaleSettings: {
      orgId,
      defaultLocale: locale,
      supportedLocales: [locale],
    },
  };
}

function createWorkflowMonitor(projectId: string) {
  return {
    filters: {
      status: "",
      workflowType: "",
    },
    runs: [
      {
        id: "workflow-run-1",
        projectId,
        resourceId: "shot-exec-live-1",
        workflowType: "shot_pipeline",
        status: "running",
        provider: "seedance",
        currentStep: "attempt_1.gateway",
        attemptCount: 1,
        lastError: "",
        externalRequestId: "request-1",
        createdAt: "2024-03-09T16:00:00.000Z",
        updatedAt: "2024-03-09T16:05:00.000Z",
      },
    ],
  };
}

function createWorkflowDetail(projectId: string) {
  return {
    run: {
      id: "workflow-run-1",
      projectId,
      resourceId: "shot-exec-live-1",
      workflowType: "shot_pipeline",
      status: "failed",
      provider: "seedance",
      currentStep: "attempt_1.gateway",
      attemptCount: 1,
      lastError: "provider rejected request",
      externalRequestId: "request-1",
      createdAt: "2024-03-09T16:00:00.000Z",
      updatedAt: "2024-03-09T16:05:00.000Z",
    },
    steps: [
      {
        id: "step-1",
        workflowRunId: "workflow-run-1",
        stepKey: "attempt_1.gateway",
        stepOrder: 2,
        status: "failed",
        errorCode: "provider_error",
        errorMessage: "provider rejected request",
        startedAt: "2024-03-09T16:00:10.000Z",
        completedAt: "",
        failedAt: "2024-03-09T16:05:00.000Z",
      },
    ],
  };
}

describe("Admin App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(ADMIN_UI_LOCALE_STORAGE_KEY, "zh-CN");
    subscribeAdminRecentChangesMock.mockReturnValue(() => {});
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-demo-001"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-demo-001"));
  });

  it("reads projectId and shotExecutionId from search params, then renders the live overview", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-1&shotExecutionId=shot-exec-live-1",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-1", "shot-exec-live-1"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-demo-001", "22222222-2222-2222-2222-222222222222"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-1"));

    render(<App />);

    expect(screen.getByText("正在加载管理概览")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadAdminOverviewMock).toHaveBeenCalledWith({
        projectId: "project-live-1",
        shotExecutionId: "shot-exec-live-1",
      });
    });
    await waitFor(() => {
      expect(loadGovernancePanelMock).toHaveBeenCalledWith({
        orgId: undefined,
        userId: undefined,
      });
    });
    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledWith({
        projectId: "project-live-1",
        status: "",
        workflowType: "",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(await screen.findByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByText("工作流监控")).toBeInTheDocument();
    expect(screen.getByText("当前会话")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeAdminRecentChangesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-demo-001",
          projectId: "project-live-1",
          onChange: expect.any(Function),
        }),
      );
    });
    expect(screen.getAllByText("approved").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();
    expect(screen.getByText("1 条计费事件")).toBeInTheDocument();
  });

  it("applies live recent change updates without reloading the whole overview", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-5&shotExecutionId=shot-exec-live-5&orgId=org-live-5",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-5", "shot-exec-live-5"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-5", "user-live-5"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-5"));

    let onChange: ((change: {
      id: string;
      kind: "billing" | "evaluation" | "review";
      tone: "info" | "success" | "warning";
      eventType?: string;
      amountCents?: number;
      status?: string;
      failedChecksCount?: number;
      conclusion?: string;
    }) => void) | null = null;
    let onWorkflowUpdated: (() => void) | null = null;
    subscribeAdminRecentChangesMock.mockImplementation((options) => {
      onChange = options.onChange;
      onWorkflowUpdated = options.onWorkflowUpdated ?? null;
      return () => {};
    });

    render(<App />);

    expect(await screen.findByText("project-live-5")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      onChange?.({
        id: "billing-live-1",
        kind: "billing",
        tone: "info",
        eventType: "budget.updated",
        amountCents: 25000,
      });
    });

    expect(await screen.findByText("budget.updated · 250.00 元")).toBeInTheDocument();
    expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);

    act(() => {
      onWorkflowUpdated?.();
    });

    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledTimes(2);
    });
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
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-1", "user-live-1"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-1"));
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
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-2", "user-live-2"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-2"));
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
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-3", "user-live-3"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-3"));
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

  it("loads governance data from orgId and userId query params, then updates preferences and org locale", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-4&shotExecutionId=shot-exec-live-4&orgId=org-live-4&userId=user-live-4",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-4", "shot-exec-live-4"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-4", "user-live-4"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-4"));
    updateUserPreferencesMock.mockResolvedValue({
      userId: "user-live-4",
      displayLocale: "en-US",
      timezone: "America/Los_Angeles",
    });
    updateOrgLocaleSettingsMock.mockResolvedValue({
      orgId: "org-live-4",
      defaultLocale: "en-US",
      supportedLocales: ["en-US"],
    });
    updateMemberRoleMock.mockResolvedValue({
      memberId: "member-1",
      orgId: "org-live-4",
      userId: "user-live-4",
      roleId: "role-admin",
    });

    render(<App />);

    expect(await screen.findByText("project-live-4")).toBeInTheDocument();
    await waitFor(() => {
      expect(loadGovernancePanelMock).toHaveBeenCalledWith({
        orgId: "org-live-4",
        userId: "user-live-4",
      });
    });

    fireEvent.change(screen.getByLabelText("显示语言"), {
      target: { value: "en-US" },
    });
    fireEvent.change(screen.getByLabelText("时区"), {
      target: { value: "America/Los_Angeles" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新偏好" }));

    await waitFor(() => {
      expect(updateUserPreferencesMock).toHaveBeenCalledWith({
        orgId: "org-live-4",
        userId: "user-live-4",
        displayLocale: "en-US",
        timezone: "America/Los_Angeles",
      });
    });

    fireEvent.change(screen.getByLabelText("组织默认语言"), {
      target: { value: "en-US" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新组织语言" }));

    await waitFor(() => {
      expect(updateOrgLocaleSettingsMock).toHaveBeenCalledWith({
        orgId: "org-live-4",
        userId: "user-live-4",
        defaultLocale: "en-US",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "更新成员角色" }));
    await waitFor(() => {
      expect(updateMemberRoleMock).toHaveBeenCalledWith({
        orgId: "org-live-4",
        userId: "user-live-4",
        memberId: "member-1",
        roleId: "role-admin",
      });
    });
  });

  it("opens workflow details and updates filters without breaking the page", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-6&shotExecutionId=shot-exec-live-6&orgId=org-live-6&userId=user-live-6",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-6", "shot-exec-live-6"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-6", "user-live-6"));
    loadWorkflowMonitorPanelMock
      .mockResolvedValueOnce(createWorkflowMonitor("project-live-6"))
      .mockResolvedValueOnce({
        ...createWorkflowMonitor("project-live-6"),
        filters: {
          status: "failed",
          workflowType: "shot_pipeline",
        },
      });
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-live-6"));

    render(<App />);

    expect(await screen.findByText("workflow-run-1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("工作流状态过滤"), {
      target: { value: "failed" },
    });
    fireEvent.change(screen.getByLabelText("工作流类型过滤"), {
      target: { value: "shot_pipeline" },
    });

    await waitFor(() => {
      expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenLastCalledWith({
        projectId: "project-live-6",
        status: "failed",
        workflowType: "shot_pipeline",
        orgId: "org-live-6",
        userId: "user-live-6",
      });
    });
    expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
    expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);
    expect(loadGovernancePanelMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "查看工作流详情 workflow-run-1" }));

    await waitFor(() => {
      expect(loadWorkflowRunDetailsMock).toHaveBeenCalledWith({
        workflowRunId: "workflow-run-1",
        orgId: "org-live-6",
        userId: "user-live-6",
      });
    });

    expect(await screen.findByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();
    expect(screen.getByText(/provider_error/)).toBeInTheDocument();
  });

  it("keeps the SSE subscription stable across workflow filter changes and refreshes with the latest filters", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-7&shotExecutionId=shot-exec-live-7&orgId=org-live-7&userId=user-live-7",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-7", "shot-exec-live-7"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-7", "user-live-7"));
    loadWorkflowMonitorPanelMock
      .mockResolvedValueOnce(createWorkflowMonitor("project-live-7"))
      .mockResolvedValue({
        ...createWorkflowMonitor("project-live-7"),
        filters: {
          status: "failed",
          workflowType: "shot_pipeline",
        },
      });

    let onWorkflowUpdated: (() => void) | null = null;
    subscribeAdminRecentChangesMock.mockImplementation((options) => {
      onWorkflowUpdated = options.onWorkflowUpdated ?? null;
      return () => {};
    });

    render(<App />);

    expect(await screen.findByText("project-live-7")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("工作流状态过滤"), {
      target: { value: "failed" },
    });
    fireEvent.change(screen.getByLabelText("工作流类型过滤"), {
      target: { value: "shot_pipeline" },
    });

    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenLastCalledWith({
        projectId: "project-live-7",
        status: "failed",
        workflowType: "shot_pipeline",
        orgId: "org-live-7",
        userId: "user-live-7",
      });
    });
    expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);

    act(() => {
      onWorkflowUpdated?.();
    });

    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenLastCalledWith({
        projectId: "project-live-7",
        status: "failed",
        workflowType: "shot_pipeline",
        orgId: "org-live-7",
        userId: "user-live-7",
      });
    });
    expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
  });
});
