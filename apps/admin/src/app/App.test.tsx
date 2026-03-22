import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ADMIN_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { loadAdminOverview } from "../features/dashboard/loadAdminOverview";
import { loadGovernancePanel } from "../features/dashboard/loadGovernancePanel";
import { updateBudgetPolicy } from "../features/dashboard/mutateBudgetPolicy";
import {
  createRole,
  deleteRole,
  updateRole,
  updateMemberRole,
  updateOrgLocaleSettings,
  updateUserPreferences,
} from "../features/dashboard/mutateGovernance";
import { loadWorkflowMonitorPanel } from "../features/dashboard/loadWorkflowMonitorPanel";
import { loadWorkflowRunDetails } from "../features/dashboard/loadWorkflowRunDetails";
import { loadAssetMonitorPanel } from "../features/dashboard/loadAssetMonitorPanel";
import { loadImportBatchDetails } from "../features/dashboard/loadImportBatchDetails";
import { loadAssetProvenanceDetails } from "../features/dashboard/loadAssetProvenanceDetails";
import {
  confirmImportBatchItem,
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../features/dashboard/mutateAssetMonitor";
import {
  clearCurrentSession,
  ensureDevSession,
  loadCurrentSession,
} from "../features/session/sessionBootstrap";
import {
  cancelWorkflowRun,
  retryWorkflowRun,
} from "../features/dashboard/mutateWorkflowRun";
import { subscribeAdminRecentChanges } from "../features/dashboard/subscribeRecentChanges";
import {
  createAssetBatchDetail,
  createAssetMonitor,
  createAssetProvenanceDetail,
} from "../features/dashboard/assetMonitor.test-data";
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
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));
vi.mock("../features/dashboard/loadWorkflowMonitorPanel", () => ({
  loadWorkflowMonitorPanel: vi.fn(),
}));
vi.mock("../features/dashboard/loadWorkflowRunDetails", () => ({
  loadWorkflowRunDetails: vi.fn(),
}));
vi.mock("../features/dashboard/loadAssetMonitorPanel", () => ({
  loadAssetMonitorPanel: vi.fn(),
}));
vi.mock("../features/dashboard/loadImportBatchDetails", () => ({
  loadImportBatchDetails: vi.fn(),
}));
vi.mock("../features/dashboard/loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));
vi.mock("../features/dashboard/mutateAssetMonitor", () => ({
  confirmImportBatchItem: vi.fn(),
  confirmImportBatchItems: vi.fn(),
  selectPrimaryAssetForImportBatch: vi.fn(),
}));
vi.mock("../features/session/sessionBootstrap", () => ({
  loadCurrentSession: vi.fn(),
  ensureDevSession: vi.fn(),
  clearCurrentSession: vi.fn(),
  isUnauthenticatedSessionError: (error: unknown) =>
    error instanceof Error && (error.message.includes("(401)") || error.message.includes("unauthenticated")),
}));
vi.mock("../features/dashboard/mutateWorkflowRun", () => ({
  retryWorkflowRun: vi.fn(),
  cancelWorkflowRun: vi.fn(),
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
const createRoleMock = vi.mocked(createRole);
const updateRoleMock = vi.mocked(updateRole);
const deleteRoleMock = vi.mocked(deleteRole);
const loadWorkflowMonitorPanelMock = vi.mocked(loadWorkflowMonitorPanel);
const loadWorkflowRunDetailsMock = vi.mocked(loadWorkflowRunDetails);
const loadAssetMonitorPanelMock = vi.mocked(loadAssetMonitorPanel);
const loadImportBatchDetailsMock = vi.mocked(loadImportBatchDetails);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);
const confirmImportBatchItemMock = vi.mocked(confirmImportBatchItem);
const confirmImportBatchItemsMock = vi.mocked(confirmImportBatchItems);
const selectPrimaryAssetForImportBatchMock = vi.mocked(selectPrimaryAssetForImportBatch);
const loadCurrentSessionMock = vi.mocked(loadCurrentSession);
const ensureDevSessionMock = vi.mocked(ensureDevSession);
const clearCurrentSessionMock = vi.mocked(clearCurrentSession);
const retryWorkflowRunMock = vi.mocked(retryWorkflowRun);
const cancelWorkflowRunMock = vi.mocked(cancelWorkflowRun);
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
  const availablePermissions = [
    {
      code: "session.read",
      displayName: "Read session",
      group: "session",
    },
    {
      code: "user.preferences.write",
      displayName: "Update user preferences",
      group: "session",
    },
    {
      code: "org.members.read",
      displayName: "Read members",
      group: "governance",
    },
    {
      code: "org.roles.read",
      displayName: "Read roles",
      group: "governance",
    },
    {
      code: "org.members.write",
      displayName: "Update members",
      group: "governance",
    },
    {
      code: "org.settings.write",
      displayName: "Update org settings",
      group: "governance",
    },
    {
      code: "org.roles.write",
      displayName: "Manage roles",
      group: "governance",
    },
  ];
  const adminPermissionCodes = availablePermissions.map((permission) => permission.code);
  return {
    currentSession: {
      sessionId: `dev:${orgId}:${userId}`,
      orgId,
      userId,
      locale,
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: adminPermissionCodes,
      timezone: "Asia/Shanghai",
    },
    userPreferences: {
      userId,
      displayLocale: locale,
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
    roles: [
      {
        roleId: "role-admin",
        orgId,
        code: "admin",
        displayName: "Administrator",
        permissionCodes: adminPermissionCodes,
        memberCount: 1,
      },
      {
        roleId: "role-viewer",
        orgId,
        code: "viewer",
        displayName: "Viewer",
        permissionCodes: ["session.read", "user.preferences.write"],
        memberCount: 0,
      },
    ],
    availablePermissions,
    orgLocaleSettings: {
      orgId,
      defaultLocale: locale,
      supportedLocales: [locale, "en-US"],
    },
    capabilities: {
      canManageRoles: true,
      canManageMembers: true,
      canManageOrgSettings: true,
      canManageUserPreferences: true,
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

function createRunningWorkflowDetail(projectId: string) {
  return {
    ...createWorkflowDetail(projectId),
    run: {
      ...createWorkflowDetail(projectId).run,
      status: "running",
      lastError: "",
    },
    steps: [
      {
        id: "step-running-1",
        workflowRunId: "workflow-run-1",
        stepKey: "attempt_1.gateway",
        stepOrder: 2,
        status: "running",
        errorCode: "",
        errorMessage: "",
        startedAt: "2024-03-09T16:00:10.000Z",
        completedAt: "",
        failedAt: "",
      },
    ],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

describe("Admin App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(ADMIN_UI_LOCALE_STORAGE_KEY, "zh-CN");
    loadCurrentSessionMock.mockResolvedValue({
      sessionId: "dev:org-demo-001:user-demo-001",
      orgId: "org-demo-001",
      userId: "user-demo-001",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: [
        "session.read",
        "user.preferences.write",
        "org.members.read",
        "org.roles.read",
        "org.members.write",
        "org.settings.write",
        "org.roles.write",
      ],
      timezone: "Asia/Shanghai",
    });
    ensureDevSessionMock.mockResolvedValue({
      sessionId: "dev:org-demo-001:user-demo-001",
      orgId: "org-demo-001",
      userId: "user-demo-001",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: [
        "session.read",
        "user.preferences.write",
        "org.members.read",
        "org.roles.read",
        "org.members.write",
        "org.settings.write",
        "org.roles.write",
      ],
      timezone: "Asia/Shanghai",
    });
    clearCurrentSessionMock.mockResolvedValue();
    subscribeAdminRecentChangesMock.mockReturnValue(() => {});
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-demo-001"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-demo-001"));
    loadAssetMonitorPanelMock.mockResolvedValue(createAssetMonitor("project-demo-001"));
    loadImportBatchDetailsMock.mockResolvedValue(createAssetBatchDetail("project-demo-001"));
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("project-demo-001"),
    );
    confirmImportBatchItemMock.mockResolvedValue(undefined);
    confirmImportBatchItemsMock.mockResolvedValue(undefined);
    selectPrimaryAssetForImportBatchMock.mockResolvedValue(undefined);
    createRoleMock.mockResolvedValue({
      roleId: "role-editor",
      orgId: "org-demo-001",
      code: "editor",
      displayName: "Editor",
      permissionCodes: ["session.read", "org.roles.read"],
      memberCount: 0,
    });
    updateRoleMock.mockResolvedValue({
      roleId: "role-viewer",
      orgId: "org-demo-001",
      code: "viewer",
      displayName: "Content Viewer",
      permissionCodes: ["session.read"],
      memberCount: 0,
    });
    deleteRoleMock.mockResolvedValue(undefined);
    retryWorkflowRunMock.mockResolvedValue(undefined);
    cancelWorkflowRunMock.mockResolvedValue(undefined);
  });

  it("shows the dev session gate when no active session exists, then starts a dev session", async () => {
    window.history.pushState({}, "", "/?projectId=project-session-1&shotExecutionId=shot-exec-session-1");
    loadCurrentSessionMock
      .mockRejectedValueOnce(new Error("sdk: failed to get current session (401)"))
      .mockResolvedValueOnce({
        sessionId: "dev:org-demo-001:user-demo-001",
        orgId: "org-demo-001",
        userId: "user-demo-001",
        locale: "zh-CN",
        roleId: "role-admin",
        roleCode: "admin",
        permissionCodes: [
          "session.read",
          "user.preferences.write",
          "org.members.read",
          "org.roles.read",
          "org.members.write",
          "org.settings.write",
          "org.roles.write",
        ],
        timezone: "Asia/Shanghai",
      });
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-session-1", "shot-exec-session-1"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-demo-001", "user-demo-001"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-session-1"));

    render(<App />);

    expect(await screen.findByText("尚未进入开发会话")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入开发会话" }));

    await waitFor(() => {
      expect(ensureDevSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("project-session-1")).toBeInTheDocument();
  });

  it("clears the active dev session and returns to the session gate", async () => {
    window.history.pushState({}, "", "/?projectId=project-session-2&shotExecutionId=shot-exec-session-2");
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-session-2", "shot-exec-session-2"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-demo-001", "user-demo-001"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-session-2"));

    render(<App />);

    expect(await screen.findByText("project-session-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空开发会话" }));

    await waitFor(() => {
      expect(clearCurrentSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("尚未进入开发会话")).toBeInTheDocument();
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

    expect(screen.getByText("正在建立开发会话")).toBeInTheDocument();

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
    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledWith({
        projectId: "project-live-1",
        status: "",
        sourceType: "",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(await screen.findByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByText("工作流监控")).toBeInTheDocument();
    expect(screen.getByText("资产监控")).toBeInTheDocument();
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
    let onAssetImportBatchUpdated: (() => void) | null = null;
    subscribeAdminRecentChangesMock.mockImplementation((options) => {
      onChange = options.onChange;
      onWorkflowUpdated = options.onWorkflowUpdated ?? null;
      onAssetImportBatchUpdated = options.onAssetImportBatchUpdated ?? null;
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

    act(() => {
      onAssetImportBatchUpdated?.();
    });

    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(2);
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

  it("runs role create, update, and delete through governance orchestration", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-roles-1&shotExecutionId=shot-exec-live-roles-1&orgId=org-live-roles-1&userId=user-live-roles-1",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-roles-1", "shot-exec-live-roles-1"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-roles-1", "user-live-roles-1"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-roles-1"));

    render(<App />);

    expect(await screen.findByText("project-live-roles-1")).toBeInTheDocument();

    const createRoleSection = screen.getByText("新建角色").closest("div");
    expect(createRoleSection).not.toBeNull();
    if (!createRoleSection) {
      throw new Error("create role section should exist");
    }

    fireEvent.change(within(createRoleSection).getByLabelText("角色代码"), {
      target: { value: "producer" },
    });
    fireEvent.change(within(createRoleSection).getByLabelText("角色名称"), {
      target: { value: "Producer" },
    });
    fireEvent.click(
      within(createRoleSection).getByLabelText("Manage roles (org.roles.write)"),
    );
    fireEvent.click(within(createRoleSection).getByRole("button", { name: "创建角色" }));

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-live-roles-1",
        userId: "user-live-roles-1",
        code: "producer",
        displayName: "Producer",
        permissionCodes: ["org.roles.write"],
      });
    });
    expect(await screen.findByText("角色已创建")).toBeInTheDocument();

    const viewerCard = screen.getByText("viewer").closest("article");
    expect(viewerCard).not.toBeNull();
    if (!viewerCard) {
      throw new Error("viewer role card should exist");
    }

    fireEvent.change(
      within(viewerCard).getByLabelText("编辑角色 viewer 的名称"),
      {
        target: { value: "Content Viewer" },
      },
    );
    fireEvent.click(
      within(viewerCard).getByLabelText("Read roles (org.roles.read)"),
    );
    fireEvent.click(within(viewerCard).getByRole("button", { name: "保存角色" }));

    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith({
        orgId: "org-live-roles-1",
        userId: "user-live-roles-1",
        roleId: "role-viewer",
        displayName: "Content Viewer",
        permissionCodes: ["session.read", "user.preferences.write", "org.roles.read"],
      });
    });
    expect(await screen.findByText("角色已更新")).toBeInTheDocument();

    fireEvent.click(within(viewerCard).getByRole("button", { name: "删除角色" }));

    await waitFor(() => {
      expect(deleteRoleMock).toHaveBeenCalledWith({
        orgId: "org-live-roles-1",
        userId: "user-live-roles-1",
        roleId: "role-viewer",
      });
    });
    expect(await screen.findByText("角色已删除")).toBeInTheDocument();
    expect(loadAdminOverviewMock).toHaveBeenCalledTimes(1);
    expect(loadGovernancePanelMock).toHaveBeenCalledTimes(4);
  });

  it("keeps governance data visible when role creation fails and shows pending state while running", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-roles-2&shotExecutionId=shot-exec-live-roles-2&orgId=org-live-roles-2&userId=user-live-roles-2",
    );
    const createRoleDeferred = createDeferred<{
      roleId: string;
      orgId: string;
      code: string;
      displayName: string;
      permissionCodes: string[];
      memberCount: number;
    }>();
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-roles-2", "shot-exec-live-roles-2"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-roles-2", "user-live-roles-2"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-roles-2"));
    createRoleMock.mockImplementation(() => createRoleDeferred.promise);

    render(<App />);

    expect(await screen.findByText("project-live-roles-2")).toBeInTheDocument();

    const createRoleSection = screen.getByText("新建角色").closest("div");
    expect(createRoleSection).not.toBeNull();
    if (!createRoleSection) {
      throw new Error("create role section should exist");
    }

    fireEvent.change(within(createRoleSection).getByLabelText("角色代码"), {
      target: { value: "producer" },
    });
    fireEvent.change(within(createRoleSection).getByLabelText("角色名称"), {
      target: { value: "Producer" },
    });
    fireEvent.click(
      within(createRoleSection).getByLabelText("Manage roles (org.roles.write)"),
    );
    fireEvent.click(within(createRoleSection).getByRole("button", { name: "创建角色" }));

    expect(await screen.findByText("正在创建角色")).toBeInTheDocument();
    expect(screen.getByText("project-live-roles-2")).toBeInTheDocument();

    createRoleDeferred.reject(new Error("role backend down"));

    expect(await screen.findByText("治理操作失败：role backend down")).toBeInTheDocument();
    expect(screen.getByText("project-live-roles-2")).toBeInTheDocument();
    expect(loadGovernancePanelMock).toHaveBeenCalledTimes(1);
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

  it("opens asset monitor details, provenance, and refreshes them on asset SSE updates", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-asset-1&shotExecutionId=shot-exec-live-asset-1&orgId=org-live-asset-1&userId=user-live-asset-1",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-asset-1", "shot-exec-live-asset-1"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-asset-1", "user-live-asset-1"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-asset-1"));
    loadAssetMonitorPanelMock.mockResolvedValue(createAssetMonitor("project-live-asset-1"));
    loadImportBatchDetailsMock.mockResolvedValue(createAssetBatchDetail("project-live-asset-1"));
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("project-live-asset-1"),
    );

    let onAssetImportBatchUpdated: (() => void) | null = null;
    subscribeAdminRecentChangesMock.mockImplementation((options) => {
      onAssetImportBatchUpdated = options.onAssetImportBatchUpdated ?? null;
      return () => {};
    });

    render(<App />);

    expect(await screen.findByText("资产监控")).toBeInTheDocument();
    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledWith({
        projectId: "project-live-asset-1",
        status: "",
        sourceType: "",
        orgId: "org-live-asset-1",
        userId: "user-live-asset-1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));

    await waitFor(() => {
      expect(loadImportBatchDetailsMock).toHaveBeenCalledWith({
        importBatchId: "import-batch-1",
        orgId: "org-live-asset-1",
        userId: "user-live-asset-1",
      });
    });
    expect(await screen.findByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "查看资源来源 media-asset-1" })[0]!);

    await waitFor(() => {
      expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
        assetId: "media-asset-1",
        orgId: "org-live-asset-1",
        userId: "user-live-asset-1",
      });
    });
    expect(await screen.findByRole("dialog", { name: "资源来源详情" })).toBeInTheDocument();

    act(() => {
      onAssetImportBatchUpdated?.();
    });

    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(2);
      expect(loadImportBatchDetailsMock).toHaveBeenCalledTimes(2);
      expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps the page visible when asset silent refresh fails", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-asset-2&shotExecutionId=shot-exec-live-asset-2&orgId=org-live-asset-2&userId=user-live-asset-2",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-asset-2", "shot-exec-live-asset-2"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-asset-2", "user-live-asset-2"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-asset-2"));
    loadAssetMonitorPanelMock
      .mockResolvedValueOnce(createAssetMonitor("project-live-asset-2"))
      .mockRejectedValueOnce(new Error("asset monitor refresh down"));

    let onAssetImportBatchUpdated: (() => void) | null = null;
    subscribeAdminRecentChangesMock.mockImplementation((options) => {
      onAssetImportBatchUpdated = options.onAssetImportBatchUpdated ?? null;
      return () => {};
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<App />);

    expect(await screen.findByText("project-live-asset-2")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeAdminRecentChangesMock).toHaveBeenCalledTimes(1);
    });
    expect(onAssetImportBatchUpdated).not.toBeNull();
    act(() => {
      onAssetImportBatchUpdated?.();
    });

    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("project-live-asset-2")).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith("asset monitor refresh down");

    warnSpy.mockRestore();
  });

  it("confirms selected import batch items, then refreshes the asset monitor and detail", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-asset-3&shotExecutionId=shot-exec-live-asset-3&orgId=org-live-asset-3&userId=user-live-asset-3",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-asset-3", "shot-exec-live-asset-3"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-asset-3", "user-live-asset-3"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-asset-3"));
    loadAssetMonitorPanelMock.mockResolvedValue(createAssetMonitor("project-live-asset-3"));
    loadImportBatchDetailsMock.mockResolvedValue({
      ...createAssetBatchDetail("project-live-asset-3"),
      items: [
        {
          id: "import-item-1",
          status: "matched_pending_confirm",
          assetId: "media-asset-1",
        },
        {
          id: "import-item-2",
          status: "matched_pending_confirm",
          assetId: "media-asset-2",
        },
      ],
      candidateAssets: [
        {
          id: "candidate-1",
          shotExecutionId: "shot-exec-1",
          assetId: "media-asset-1",
          sourceRunId: "workflow-run-1",
        },
      ],
      mediaAssets: [
        {
          id: "media-asset-1",
          projectId: "project-live-asset-3",
          sourceType: "upload_session",
          rightsStatus: "clear",
          importBatchId: "import-batch-1",
          locale: "zh-CN",
          aiAnnotated: true,
        },
      ],
    });
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("project-live-asset-3"),
    );

    render(<App />);

    expect(await screen.findByText("资产监控")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));
    expect(await screen.findByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();

    const candidateAssetsSection = screen
      .getByRole("heading", { name: "候选资源" })
      .closest("section");
    expect(candidateAssetsSection).not.toBeNull();
    fireEvent.click(
      within(candidateAssetsSection as HTMLElement).getByRole("button", {
        name: "查看资源来源 media-asset-1",
      }),
    );
    expect(await screen.findByRole("dialog", { name: "资源来源详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭资源来源详情" }));
    expect(await screen.findByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "选择导入条目 import-item-1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" }));
    fireEvent.click(screen.getByRole("button", { name: "确认已选项" }));

    expect(await screen.findByText("正在确认已选匹配")).toBeInTheDocument();
    await waitFor(() => {
      expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
        importBatchId: "import-batch-1",
        itemIds: ["import-item-1", "import-item-2"],
        orgId: "org-live-asset-3",
        userId: "user-live-asset-3",
      });
    });
    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(2);
      expect(loadImportBatchDetailsMock).toHaveBeenCalledTimes(2);
      expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("已确认所选匹配")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "资源来源详情" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "确认已选项" }),
    ).toBeDisabled();
  });

  it("confirms all actionable import batch items from the open detail drawer", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-asset-4&shotExecutionId=shot-exec-live-asset-4&orgId=org-live-asset-4&userId=user-live-asset-4",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-asset-4", "shot-exec-live-asset-4"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-asset-4", "user-live-asset-4"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-asset-4"));
    loadAssetMonitorPanelMock.mockResolvedValue(createAssetMonitor("project-live-asset-4"));
    loadImportBatchDetailsMock.mockResolvedValue({
      ...createAssetBatchDetail("project-live-asset-4"),
      items: [
        {
          id: "import-item-1",
          status: "confirmed",
          assetId: "media-asset-1",
        },
        {
          id: "import-item-2",
          status: "matched_pending_confirm",
          assetId: "media-asset-2",
        },
        {
          id: "import-item-3",
          status: "pending_review",
          assetId: "",
        },
        {
          id: "import-item-4",
          status: "matched_pending_confirm",
          assetId: "media-asset-4",
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText("资产监控")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));
    expect(await screen.findByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认全部可确认项" }));

    expect(await screen.findByText("正在确认全部可确认项")).toBeInTheDocument();
    await waitFor(() => {
      expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
        importBatchId: "import-batch-1",
        itemIds: ["import-item-2", "import-item-4"],
        orgId: "org-live-asset-4",
        userId: "user-live-asset-4",
      });
    });
    expect(await screen.findByText("已确认全部可确认项")).toBeInTheDocument();
  });

  it("selects a primary asset and keeps the import batch detail open", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-asset-5&shotExecutionId=shot-exec-live-asset-5&orgId=org-live-asset-5&userId=user-live-asset-5",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-asset-5", "shot-exec-live-asset-5"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-asset-5", "user-live-asset-5"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-asset-5"));
    loadAssetMonitorPanelMock.mockResolvedValue(createAssetMonitor("project-live-asset-5"));
    loadImportBatchDetailsMock.mockResolvedValue(createAssetBatchDetail("project-live-asset-5"));

    render(<App />);

    expect(await screen.findByText("资产监控")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));
    expect(await screen.findByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "设置候选资源 candidate-1 为主素材" }));

    expect(await screen.findByText("正在设置主素材")).toBeInTheDocument();
    await waitFor(() => {
      expect(selectPrimaryAssetForImportBatchMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-1",
        assetId: "media-asset-1",
        orgId: "org-live-asset-5",
        userId: "user-live-asset-5",
      });
    });
    await waitFor(() => {
      expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(2);
      expect(loadImportBatchDetailsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("主素材已更新")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
  });

  it("keeps the asset detail open and preserves selections when asset actions fail", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-asset-6&shotExecutionId=shot-exec-live-asset-6&orgId=org-live-asset-6&userId=user-live-asset-6",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-asset-6", "shot-exec-live-asset-6"),
    );
    loadGovernancePanelMock.mockResolvedValue(
      createGovernance("org-live-asset-6", "user-live-asset-6"),
    );
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-asset-6"));
    loadAssetMonitorPanelMock.mockResolvedValue(createAssetMonitor("project-live-asset-6"));
    loadImportBatchDetailsMock.mockResolvedValue({
      ...createAssetBatchDetail("project-live-asset-6"),
      items: [
        {
          id: "import-item-2",
          status: "matched_pending_confirm",
          assetId: "media-asset-2",
        },
      ],
    });
    confirmImportBatchItemsMock.mockRejectedValue(new Error("asset backend down"));

    render(<App />);

    expect(await screen.findByText("资产监控")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));
    expect(await screen.findByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" }));
    fireEvent.click(screen.getByRole("button", { name: "确认已选项" }));

    expect(await screen.findByText("资产操作失败：asset backend down")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" })).toBeChecked();
    expect(loadAssetMonitorPanelMock).toHaveBeenCalledTimes(1);
    expect(loadImportBatchDetailsMock).toHaveBeenCalledTimes(1);
  });

  it("retries a failed workflow run, then refreshes the monitor and open details", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-8&shotExecutionId=shot-exec-live-8&orgId=org-live-8&userId=user-live-8",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-8", "shot-exec-live-8"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-8", "user-live-8"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-8"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-live-8"));

    render(<App />);

    expect(await screen.findByText("project-live-8")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看工作流详情 workflow-run-1" }));
    expect(await screen.findByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));

    expect(await screen.findByText("正在重试工作流")).toBeInTheDocument();
    await waitFor(() => {
      expect(retryWorkflowRunMock).toHaveBeenCalledWith({
        workflowRunId: "workflow-run-1",
        orgId: "org-live-8",
        userId: "user-live-8",
      });
    });
    await waitFor(() => {
      expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledTimes(2);
      expect(loadWorkflowRunDetailsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("工作流已重试")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();
  });

  it("cancels a running workflow run and disables duplicate submissions while pending", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-9&shotExecutionId=shot-exec-live-9&orgId=org-live-9&userId=user-live-9",
    );
    loadAdminOverviewMock.mockResolvedValue(createOverview("project-live-9", "shot-exec-live-9"));
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-9", "user-live-9"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-9"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createRunningWorkflowDetail("project-live-9"));

    let resolveCancel: (() => void) | null = null;
    cancelWorkflowRunMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCancel = resolve;
        }),
    );

    render(<App />);

    expect(await screen.findByText("project-live-9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看工作流详情 workflow-run-1" }));
    expect(await screen.findByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();

    const cancelButton = await screen.findByRole("button", { name: "取消工作流" });
    fireEvent.click(cancelButton);
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(cancelWorkflowRunMock).toHaveBeenCalledTimes(1);
    });
    expect(cancelButton).toBeDisabled();
    expect(screen.getByText("正在取消工作流")).toBeInTheDocument();

    await act(async () => {
      resolveCancel?.();
    });

    expect(await screen.findByText("工作流已取消")).toBeInTheDocument();
  });

  it("keeps the workflow detail open and surfaces workflow action errors", async () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-live-10&shotExecutionId=shot-exec-live-10&orgId=org-live-10&userId=user-live-10",
    );
    loadAdminOverviewMock.mockResolvedValue(
      createOverview("project-live-10", "shot-exec-live-10"),
    );
    loadGovernancePanelMock.mockResolvedValue(createGovernance("org-live-10", "user-live-10"));
    loadWorkflowMonitorPanelMock.mockResolvedValue(createWorkflowMonitor("project-live-10"));
    loadWorkflowRunDetailsMock.mockResolvedValue(createWorkflowDetail("project-live-10"));
    retryWorkflowRunMock.mockRejectedValue(new Error("workflow backend down"));

    render(<App />);

    expect(await screen.findByText("project-live-10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看工作流详情 workflow-run-1" }));
    expect(await screen.findByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));

    expect(
      await screen.findByText("工作流操作失败：workflow backend down"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();
    expect(loadWorkflowMonitorPanelMock).toHaveBeenCalledTimes(1);
    expect(loadWorkflowRunDetailsMock).toHaveBeenCalledTimes(1);
  });
});
