import { fireEvent, render, screen } from "@testing-library/react";
import type { AdminOverviewViewModel } from "../features/dashboard/overview";
import { ADMIN_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { useAdminAssetController } from "../features/dashboard/useAdminAssetController";
import { useAdminOverviewGovernance } from "../features/dashboard/useAdminOverviewGovernance";
import { useAdminRecentChangesSubscription } from "../features/dashboard/useAdminRecentChangesSubscription";
import { useAdminWorkflowController } from "../features/dashboard/useAdminWorkflowController";
import { useAdminSessionGate } from "../features/session/useAdminSessionGate";
import { App } from "./App";

let lastAdminOverviewPageProps: Record<string, unknown> | null = null;

vi.mock("../features/dashboard/AdminOverviewPage", () => ({
  AdminOverviewPage: (props: Record<string, unknown>) => {
    lastAdminOverviewPageProps = props;
    const overview = props.overview as AdminOverviewViewModel;
    return <div data-testid="admin-overview-page">{overview.budgetSnapshot.projectId}</div>;
  },
}));
vi.mock("../features/session/useAdminSessionGate", () => ({
  useAdminSessionGate: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminOverviewGovernance", () => ({
  useAdminOverviewGovernance: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminWorkflowController", () => ({
  useAdminWorkflowController: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminAssetController", () => ({
  useAdminAssetController: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminRecentChangesSubscription", () => ({
  useAdminRecentChangesSubscription: vi.fn(),
}));

const useAdminSessionGateMock = vi.mocked(useAdminSessionGate);
const useAdminOverviewGovernanceMock = vi.mocked(useAdminOverviewGovernance);
const useAdminWorkflowControllerMock = vi.mocked(useAdminWorkflowController);
const useAdminAssetControllerMock = vi.mocked(useAdminAssetController);
const useAdminRecentChangesSubscriptionMock = vi.mocked(useAdminRecentChangesSubscription);

function createOverview(projectId: string, shotExecutionId: string): AdminOverviewViewModel {
  return {
    budgetSnapshot: {
      projectId,
      limitCents: 120000,
      reservedCents: 18000,
      remainingBudgetCents: 102000,
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
        kind: "billing",
        tone: "info",
        eventType: "budget_reserved",
        amountCents: 18000,
      },
      {
        id: "evaluation-eval-1",
        kind: "evaluation",
        tone: "success",
        status: "passed",
        failedChecksCount: 0,
      },
      {
        id: "review-review-1",
        kind: "review",
        tone: "success",
        conclusion: "approved",
      },
    ],
  };
}

function createGovernance(orgId: string, userId: string) {
  return {
    currentSession: {
      sessionId: `dev:${orgId}:${userId}`,
      orgId,
      userId,
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read", "org.roles.read", "org.roles.write"],
      timezone: "Asia/Shanghai",
    },
    userPreferences: {
      userId,
      displayLocale: "zh-CN",
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId, userId, roleId: "role-admin" }],
    roles: [
      {
        roleId: "role-admin",
        orgId,
        code: "admin",
        displayName: "Administrator",
        permissionCodes: ["session.read", "org.roles.read", "org.roles.write"],
        memberCount: 1,
      },
    ],
    availablePermissions: [
      {
        code: "org.roles.write",
        displayName: "Manage roles",
        group: "governance",
      },
    ],
    orgLocaleSettings: {
      orgId,
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN", "en-US"],
    },
    capabilities: {
      canManageRoles: true,
      canManageMembers: true,
      canManageOrgSettings: true,
      canManageUserPreferences: true,
    },
  };
}

function buildSessionGate(overrides: Record<string, unknown> = {}) {
  return {
    sessionState: "ready" as const,
    session: {
      sessionId: "dev:org-demo-001:user-demo-001",
      orgId: "org-demo-001",
      userId: "user-demo-001",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read"],
      timezone: "Asia/Shanghai",
    },
    errorMessage: "",
    effectiveOrgId: "org-demo-001",
    effectiveUserId: "user-demo-001",
    subscriptionOrgId: "org-demo-001",
    handleStartDevSession: vi.fn(),
    handleClearCurrentSession: vi.fn(),
    ...overrides,
  };
}

function buildOverviewGovernance(overrides: Record<string, unknown> = {}) {
  return {
    overview: createOverview("project-live-001", "shot-exec-live-001"),
    governance: createGovernance("org-demo-001", "user-demo-001"),
    errorMessage: "",
    budgetFeedback: null,
    governanceActionFeedback: null,
    governanceActionPending: false,
    refreshOverview: vi.fn(),
    refreshGovernance: vi.fn(),
    applyRecentChange: vi.fn(),
    onUpdateBudgetLimit: vi.fn(),
    onUpdateUserPreferences: vi.fn(),
    onUpdateMemberRole: vi.fn(),
    onUpdateOrgLocaleSettings: vi.fn(),
    onCreateRole: vi.fn(),
    onUpdateRole: vi.fn(),
    onDeleteRole: vi.fn(),
    ...overrides,
  };
}

function buildWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    workflowMonitor: {
      filters: {
        status: "",
        workflowType: "",
      },
      runs: [],
    },
    workflowRunDetail: null,
    selectedWorkflowRunId: null,
    workflowActionFeedback: null,
    workflowActionPending: false,
    refreshWorkflowSilently: vi.fn(),
    onWorkflowStatusFilterChange: vi.fn(),
    onWorkflowTypeFilterChange: vi.fn(),
    onSelectWorkflowRun: vi.fn(),
    onCloseWorkflowDetail: vi.fn(),
    onRetryWorkflowRun: vi.fn(),
    onCancelWorkflowRun: vi.fn(),
    ...overrides,
  };
}

function buildAsset(overrides: Record<string, unknown> = {}) {
  return {
    assetMonitor: {
      filters: {
        status: "",
        sourceType: "",
      },
      importBatches: [],
    },
    importBatchDetail: null,
    assetProvenanceDetail: null,
    selectedImportItemIds: [],
    assetActionFeedback: null,
    assetActionPending: false,
    refreshAssetSilently: vi.fn(),
    onAssetStatusFilterChange: vi.fn(),
    onAssetSourceTypeFilterChange: vi.fn(),
    onSelectImportBatch: vi.fn(),
    onCloseImportBatchDetail: vi.fn(),
    onToggleImportBatchItemSelection: vi.fn(),
    onConfirmImportBatchItem: vi.fn(),
    onConfirmSelectedImportBatchItems: vi.fn(),
    onConfirmAllImportBatchItems: vi.fn(),
    onSelectPrimaryAsset: vi.fn(),
    onSelectAssetProvenance: vi.fn(),
    onCloseAssetProvenance: vi.fn(),
    ...overrides,
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastAdminOverviewPageProps = null;
    window.localStorage.clear();
    window.localStorage.setItem(ADMIN_UI_LOCALE_STORAGE_KEY, "zh-CN");
    window.history.pushState({}, "", "/");

    useAdminSessionGateMock.mockReturnValue(buildSessionGate() as never);
    useAdminOverviewGovernanceMock.mockReturnValue(buildOverviewGovernance() as never);
    useAdminWorkflowControllerMock.mockReturnValue(buildWorkflow() as never);
    useAdminAssetControllerMock.mockReturnValue(buildAsset() as never);
    useAdminRecentChangesSubscriptionMock.mockImplementation(() => undefined);
  });

  it("reads query params and wires them into the hook layer", () => {
    window.history.pushState(
      {},
      "",
      "/?projectId=project-query-1&shotExecutionId=shot-query-1&orgId=org-override-001&userId=user-override-001",
    );
    useAdminSessionGateMock.mockReturnValue(
      buildSessionGate({
        effectiveOrgId: "org-override-001",
        effectiveUserId: "user-override-001",
        subscriptionOrgId: "org-override-001",
      }) as never,
    );
    useAdminOverviewGovernanceMock.mockReturnValue(
      buildOverviewGovernance({
        overview: createOverview("project-query-1", "shot-query-1"),
      }) as never,
    );

    render(<App />);

    expect(useAdminSessionGateMock).toHaveBeenCalledWith({
      identityOverride: {
        orgId: "org-override-001",
        userId: "user-override-001",
      },
    });
    expect(useAdminOverviewGovernanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-query-1",
        shotExecutionId: "shot-query-1",
        identityOverride: {
          orgId: "org-override-001",
          userId: "user-override-001",
        },
        effectiveOrgId: "org-override-001",
        effectiveUserId: "user-override-001",
      }),
    );
    expect(useAdminWorkflowControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-query-1",
        identityOverride: {
          orgId: "org-override-001",
          userId: "user-override-001",
        },
      }),
    );
    expect(useAdminAssetControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-query-1",
        identityOverride: {
          orgId: "org-override-001",
          userId: "user-override-001",
        },
      }),
    );
    expect(useAdminRecentChangesSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionState: "ready",
        hasOverview: true,
        subscriptionOrgId: "org-override-001",
        projectId: "project-query-1",
      }),
    );
    expect(screen.getByTestId("admin-overview-page")).toHaveTextContent("project-query-1");
  });

  it("renders the loading gate while the session is bootstrapping", () => {
    useAdminSessionGateMock.mockReturnValue(
      buildSessionGate({
        sessionState: "loading",
        session: null,
      }) as never,
    );

    render(<App />);

    expect(screen.getByText("正在建立开发会话")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("renders the unauthenticated gate and starts a dev session when requested", () => {
    const handleStartDevSession = vi.fn();
    useAdminSessionGateMock.mockReturnValue(
      buildSessionGate({
        sessionState: "unauthenticated",
        session: null,
        handleStartDevSession,
      }) as never,
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "进入开发会话" }));

    expect(screen.getByText("尚未进入开发会话")).toBeInTheDocument();
    expect(handleStartDevSession).toHaveBeenCalledTimes(1);
  });

  it("surfaces top-level errors before rendering the overview page", () => {
    useAdminOverviewGovernanceMock.mockReturnValue(
      buildOverviewGovernance({
        errorMessage: "governance exploded",
      }) as never,
    );

    render(<App />);

    expect(screen.getByText("管理概览加载失败：governance exploded")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("renders the active session banner, clear action, and forwards controller props to the page", () => {
    const handleClearCurrentSession = vi.fn();
    const workflow = buildWorkflow({
      workflowActionPending: true,
    });
    const asset = buildAsset({
      selectedImportItemIds: ["import-item-1"],
    });
    useAdminSessionGateMock.mockReturnValue(
      buildSessionGate({
        handleClearCurrentSession,
      }) as never,
    );
    useAdminWorkflowControllerMock.mockReturnValue(workflow as never);
    useAdminAssetControllerMock.mockReturnValue(asset as never);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "清空开发会话" }));

    expect(screen.getByText("当前开发会话用户：user-demo-001")).toBeInTheDocument();
    expect(handleClearCurrentSession).toHaveBeenCalledTimes(1);
    expect(lastAdminOverviewPageProps?.workflowActionPending).toBe(true);
    expect(lastAdminOverviewPageProps?.selectedImportItemIds).toEqual(["import-item-1"]);
  });

  it("shows the override banner and hides the clear button when identity override is active", () => {
    window.history.pushState({}, "", "/?orgId=org-override-001&userId=user-override-001");
    useAdminSessionGateMock.mockReturnValue(
      buildSessionGate({
        effectiveOrgId: "org-override-001",
        effectiveUserId: "user-override-001",
        subscriptionOrgId: "org-override-001",
      }) as never,
    );

    render(<App />);

    expect(
      screen.getByText("调试身份覆盖已启用：org-override-001 / user-override-001"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "清空开发会话" })).not.toBeInTheDocument();
  });
});
