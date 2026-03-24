import { fireEvent, render, screen } from "@testing-library/react";
import type { AdminOverviewViewModel } from "../features/dashboard/overview";
import type { AdminOperationsOverviewViewModel } from "../features/dashboard/operationsOverview";
import { ADMIN_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { useAdminAssetController } from "../features/dashboard/useAdminAssetController";
import { useAdminGovernanceController } from "../features/dashboard/useAdminGovernanceController";
import { useAdminOverviewController } from "../features/dashboard/useAdminOverviewController";
import { useAdminAudioController } from "../features/dashboard/useAdminAudioController";
import { useAdminPreviewController } from "../features/dashboard/useAdminPreviewController";
import { useAdminRecentChangesSubscription } from "../features/dashboard/useAdminRecentChangesSubscription";
import { useAdminWorkflowController } from "../features/dashboard/useAdminWorkflowController";
import { useAdminSessionGate } from "../features/session/useAdminSessionGate";
import { App } from "./App";

const {
  mockUseAdminAudioController,
  mockUseAdminCollaborationController,
  mockUseAdminPreviewController,
} = vi.hoisted(() => ({
  mockUseAdminAudioController: vi.fn(),
  mockUseAdminCollaborationController: vi.fn(),
  mockUseAdminPreviewController: vi.fn(),
}));

let lastAdminOverviewPageProps: Record<string, unknown> | null = null;
let lastAdminWorkflowPageProps: Record<string, unknown> | null = null;
let lastAdminAssetsPageProps: Record<string, unknown> | null = null;
let lastAdminGovernancePageProps: Record<string, unknown> | null = null;
let lastAdminCollaborationPageProps: Record<string, unknown> | null = null;
let lastAdminAudioPageProps: Record<string, unknown> | null = null;
let lastAdminPreviewPageProps: Record<string, unknown> | null = null;

vi.mock("../features/dashboard/AdminOverviewPage", () => ({
  AdminOverviewPage: (props: Record<string, unknown>) => {
    lastAdminOverviewPageProps = props;
    const overview = props.overview as AdminOverviewViewModel;
    return (
      <div data-testid="admin-overview-page">
        {overview.budgetSnapshot.projectId}
        <button
          type="button"
          onClick={() =>
            (
              props.onNavigateOperationsTarget as
                | ((target: { route: "workflow"; workflowRunId: string }) => void)
                | undefined
            )?.({
              route: "workflow",
              workflowRunId: "workflow-run-1",
            })
          }
        >
          overview-open-workflow
        </button>
        <button
          type="button"
          onClick={() =>
            (
              props.onNavigateOperationsTarget as
                | ((target: { route: "assets"; importBatchId: string }) => void)
                | undefined
            )?.({
              route: "assets",
              importBatchId: "batch-live-1",
            })
          }
        >
          overview-open-asset
        </button>
      </div>
    );
  },
}));
vi.mock("../features/dashboard/AdminWorkflowPage", () => ({
  AdminWorkflowPage: (props: Record<string, unknown>) => {
    lastAdminWorkflowPageProps = props;
    const workflowMonitor = props.workflowMonitor as { runs: Array<{ id: string }> };
    return (
      <div data-testid="admin-workflow-page">
        {workflowMonitor.runs.map((run) => run.id).join(",")}
        <button type="button" onClick={() => (props.onSelectWorkflowRun as ((id: string) => void) | undefined)?.("workflow-run-1")}>
          open-workflow-detail
        </button>
        <button type="button" onClick={() => (props.onCloseWorkflowDetail as (() => void) | undefined)?.()}>
          close-workflow-detail
        </button>
      </div>
    );
  },
}));
vi.mock("../features/dashboard/AdminAssetsPage", () => ({
  AdminAssetsPage: (props: Record<string, unknown>) => {
    lastAdminAssetsPageProps = props;
    const assetMonitor = props.assetMonitor as { importBatches: Array<{ id: string }> };
    return (
      <div data-testid="admin-assets-page">
        {assetMonitor.importBatches.map((batch) => batch.id).join(",")}
        <button type="button" onClick={() => (props.onSelectImportBatch as ((id: string) => void) | undefined)?.("batch-live-1")}>
          open-import-batch
        </button>
        <button type="button" onClick={() => (props.onSelectAssetProvenance as ((id: string) => void) | undefined)?.("asset-live-1")}>
          open-asset-provenance
        </button>
        <button type="button" onClick={() => (props.onCloseAssetProvenance as (() => void) | undefined)?.()}>
          close-asset-provenance
        </button>
        <button type="button" onClick={() => (props.onCloseImportBatchDetail as (() => void) | undefined)?.()}>
          close-import-batch
        </button>
      </div>
    );
  },
}));
vi.mock("../features/dashboard/AdminGovernancePage", () => ({
  AdminGovernancePage: (props: Record<string, unknown>) => {
    lastAdminGovernancePageProps = props;
    const governance = props.governance as { currentSession: { orgId: string } };
    return <div data-testid="admin-governance-page">{governance.currentSession.orgId}</div>;
  },
}));
vi.mock("../features/dashboard/AdminCollaborationPage", () => ({
  AdminCollaborationPage: (props: Record<string, unknown>) => {
    lastAdminCollaborationPageProps = props;
    return <div data-testid="admin-collaboration-page">admin-collaboration-page</div>;
  },
}));
vi.mock("../features/dashboard/AdminAudioPage", () => ({
  AdminAudioPage: (props: Record<string, unknown>) => {
    lastAdminAudioPageProps = props;
    return <div data-testid="admin-audio-page">admin-audio-page</div>;
  },
}));
vi.mock("../features/dashboard/AdminPreviewPage", () => ({
  AdminPreviewPage: (props: Record<string, unknown>) => {
    lastAdminPreviewPageProps = props;
    return <div data-testid="admin-preview-page">admin-preview-page</div>;
  },
}));
vi.mock("../features/session/useAdminSessionGate", () => ({
  useAdminSessionGate: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminOverviewController", () => ({
  useAdminOverviewController: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminGovernanceController", () => ({
  useAdminGovernanceController: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminWorkflowController", () => ({
  useAdminWorkflowController: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminAssetController", () => ({
  useAdminAssetController: vi.fn(),
}));
vi.mock("../features/dashboard/useAdminAudioController", () => ({
  useAdminAudioController: mockUseAdminAudioController,
}));
vi.mock("../features/dashboard/useAdminCollaborationController", () => ({
  useAdminCollaborationController: mockUseAdminCollaborationController,
}));
vi.mock("../features/dashboard/useAdminPreviewController", () => ({
  useAdminPreviewController: mockUseAdminPreviewController,
}));
vi.mock("../features/dashboard/useAdminRecentChangesSubscription", () => ({
  useAdminRecentChangesSubscription: vi.fn(),
}));

const useAdminSessionGateMock = vi.mocked(useAdminSessionGate);
const useAdminOverviewControllerMock = vi.mocked(useAdminOverviewController);
const useAdminGovernanceControllerMock = vi.mocked(useAdminGovernanceController);
const useAdminWorkflowControllerMock = vi.mocked(useAdminWorkflowController);
const useAdminAssetControllerMock = vi.mocked(useAdminAssetController);
const useAdminAudioControllerMock = vi.mocked(useAdminAudioController);
const useAdminPreviewControllerMock = vi.mocked(useAdminPreviewController);
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

function createOperationsOverview(): AdminOperationsOverviewViewModel {
  return {
    blockerCount: 2,
    blockers: [
      {
        id: "workflow",
        kind: "workflow",
        status: "blocked",
        failedWorkflowCount: 1,
        workflowRunId: "workflow-run-1",
        workflowType: "shot_pipeline",
        lastError: "provider rejected request",
        target: {
          route: "workflow",
          workflowRunId: "workflow-run-1",
        },
      },
      {
        id: "asset",
        kind: "asset",
        status: "blocked",
        pendingConfirmationCount: 1,
        blockedImportBatchCount: 1,
        importBatchId: "batch-live-1",
        batchStatus: "pending_review",
        missingMediaAssetCount: 1,
        target: {
          route: "assets",
          importBatchId: "batch-live-1",
        },
      },
    ],
    runtimeHealth: {
      runningWorkflowCount: 0,
      failedWorkflowCount: 1,
      pendingImportBatchCount: 1,
      blockedImportBatchCount: 1,
      alerts: [
        {
          id: "workflow-failed",
          kind: "workflow_failed",
          count: 1,
          workflowRunId: "workflow-run-1",
          workflowType: "shot_pipeline",
          lastError: "provider rejected request",
          target: {
            route: "workflow",
            workflowRunId: "workflow-run-1",
          },
        },
      ],
    },
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

function buildOverviewController(overrides: Record<string, unknown> = {}) {
  return {
    overview: createOverview("project-live-001", "shot-exec-live-001"),
    operationsOverview: createOperationsOverview(),
    errorMessage: "",
    budgetFeedback: null,
    refreshOverview: vi.fn(),
    refreshOperationsOverview: vi.fn(),
    applyRecentChange: vi.fn(),
    onUpdateBudgetLimit: vi.fn(),
    ...overrides,
  };
}

function buildGovernanceController(overrides: Record<string, unknown> = {}) {
  return {
    governance: createGovernance("org-demo-001", "user-demo-001"),
    errorMessage: "",
    governanceActionFeedback: null,
    governanceActionPending: false,
    refreshGovernance: vi.fn(),
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
      runs: [
        {
          id: "workflow-run-1",
          projectId: "project-live-001",
          resourceId: "shot-exec-live-001",
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
      importBatches: [
        {
          id: "batch-live-1",
          orgId: "org-demo-001",
          projectId: "project-live-001",
          operatorId: "user-demo-001",
          sourceType: "upload_session",
          status: "pending_review",
          uploadSessionCount: 1,
          itemCount: 2,
          confirmedItemCount: 1,
          candidateAssetCount: 2,
          mediaAssetCount: 2,
          updatedAt: "2024-03-09T16:05:00.000Z",
        },
      ],
    },
    importBatchDetail: null,
    assetProvenanceDetail: null,
    selectedImportBatchId: null,
    selectedAssetProvenanceId: null,
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

function buildCollaboration(overrides: Record<string, unknown> = {}) {
  return {
    collaborationSession: {
      session: {
        sessionId: "session-shot-collab-1",
        ownerType: "shot",
        ownerId: "shot-collab-1",
        draftVersion: 4,
        lockHolderUserId: "user-demo-001",
      },
      presences: [],
      alerts: [],
    },
    errorMessage: "",
    refreshCollaborationSilently: vi.fn(),
    ...overrides,
  };
}

function buildPreview(overrides: Record<string, unknown> = {}) {
  return {
    previewWorkbench: {
      assembly: {
        assemblyId: "assembly-project-1",
        projectId: "project-live-001",
        episodeId: "",
        status: "draft",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:05:00.000Z",
      },
      items: [
        {
          itemId: "item-1",
          assemblyId: "assembly-project-1",
          shotId: "shot-preview-1",
          primaryAssetId: "asset-preview-1",
          sourceRunId: "run-preview-1",
          sequence: 1,
        },
      ],
      summary: {
        itemCount: 1,
        missingPrimaryAssetCount: 0,
      },
    },
    assetProvenanceDetail: null,
    assetProvenanceErrorMessage: "",
    errorMessage: "",
    assetProvenancePending: false,
    handleOpenAssetProvenance: vi.fn(),
    handleCloseAssetProvenance: vi.fn(),
    ...overrides,
  };
}

function buildAudio(overrides: Record<string, unknown> = {}) {
  return {
    audioWorkbench: {
      timeline: {
        audioTimelineId: "timeline-project-live-001",
        projectId: "project-live-001",
        episodeId: "",
        status: "draft",
        renderWorkflowRunId: "workflow-audio-1",
        renderStatus: "queued",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:05:00.000Z",
      },
      tracks: [],
      summary: {
        trackCount: 0,
        clipCount: 0,
        missingAssetCount: 0,
        invalidTimingClipCount: 0,
        tracksByType: [],
      },
    },
    assetProvenanceDetail: null,
    assetProvenancePending: false,
    assetProvenanceErrorMessage: "",
    errorMessage: "",
    handleOpenAssetProvenance: vi.fn(),
    handleCloseAssetProvenance: vi.fn(),
    ...overrides,
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastAdminOverviewPageProps = null;
    lastAdminWorkflowPageProps = null;
    lastAdminAssetsPageProps = null;
    lastAdminGovernancePageProps = null;
    lastAdminCollaborationPageProps = null;
    lastAdminAudioPageProps = null;
    lastAdminPreviewPageProps = null;
    window.localStorage.clear();
    window.localStorage.setItem(ADMIN_UI_LOCALE_STORAGE_KEY, "zh-CN");
    window.history.pushState({}, "", "/");

    useAdminSessionGateMock.mockReturnValue(buildSessionGate() as never);
    useAdminOverviewControllerMock.mockReturnValue(buildOverviewController() as never);
    useAdminGovernanceControllerMock.mockReturnValue(buildGovernanceController() as never);
    useAdminWorkflowControllerMock.mockReturnValue(buildWorkflow() as never);
    useAdminAssetControllerMock.mockReturnValue(buildAsset() as never);
    useAdminAudioControllerMock.mockReturnValue(buildAudio() as never);
    mockUseAdminCollaborationController.mockReturnValue(buildCollaboration());
    useAdminPreviewControllerMock.mockReturnValue(buildPreview() as never);
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
    useAdminOverviewControllerMock.mockReturnValue(
      buildOverviewController({
        overview: createOverview("project-query-1", "shot-query-1"),
      }) as never,
    );

    render(<App />);

    expect(window.location.pathname).toBe("/overview");
    expect(window.location.search).toContain("projectId=project-query-1");
    expect(window.location.search).toContain("shotExecutionId=shot-query-1");
    expect(window.location.search).toContain("orgId=org-override-001");
    expect(window.location.search).toContain("userId=user-override-001");

    expect(useAdminSessionGateMock).toHaveBeenCalledWith({
      identityOverride: {
        orgId: "org-override-001",
        userId: "user-override-001",
      },
    });
    expect(useAdminOverviewControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationsEnabled: true,
        projectId: "project-query-1",
        shotExecutionId: "shot-query-1",
        effectiveOrgId: "org-override-001",
      }),
    );
    expect(useAdminGovernanceControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identityOverride: {
          orgId: "org-override-001",
          userId: "user-override-001",
        },
        effectiveOrgId: "org-override-001",
        effectiveUserId: "user-override-001",
        enabled: false,
      }),
    );
    expect(useAdminWorkflowControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        projectId: "project-query-1",
        identityOverride: {
          orgId: "org-override-001",
          userId: "user-override-001",
        },
      }),
    );
    expect(useAdminAssetControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
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

  it("renders the workflow route when pathname is /workflow", () => {
    window.history.pushState({}, "", "/workflow?projectId=project-live-001");

    render(<App />);

    expect(useAdminOverviewControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationsEnabled: false,
      }),
    );
    expect(useAdminWorkflowControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
    expect(screen.getByTestId("admin-workflow-page")).toHaveTextContent("workflow-run-1");
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("renders the assets route when pathname is /assets", () => {
    window.history.pushState({}, "", "/assets?projectId=project-live-001");

    render(<App />);

    expect(screen.getByTestId("admin-assets-page")).toHaveTextContent("batch-live-1");
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("renders the governance route when pathname is /governance", () => {
    window.history.pushState({}, "", "/governance?projectId=project-live-001");

    render(<App />);

    expect(screen.getByTestId("admin-governance-page")).toHaveTextContent("org-demo-001");
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("renders the collaboration route when pathname is /collaboration", () => {
    window.history.pushState(
      {},
      "",
      "/collaboration?projectId=project-live-001&shotExecutionId=shot-exec-live-001&shotId=shot-collab-1",
    );

    render(<App />);

    expect(mockUseAdminCollaborationController).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        projectId: "project-live-001",
        shotId: "shot-collab-1",
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
      }),
    );
    expect(screen.getByTestId("admin-collaboration-page")).toHaveTextContent(
      "admin-collaboration-page",
    );
    expect(lastAdminCollaborationPageProps).toEqual(
      expect.objectContaining({
        collaborationSession: expect.objectContaining({
          session: expect.objectContaining({
            ownerId: "shot-collab-1",
          }),
        }),
      }),
    );
  });

  it("renders the preview route when pathname is /preview", () => {
    window.history.pushState(
      {},
      "",
      "/preview?projectId=project-live-001&shotExecutionId=shot-exec-live-001",
    );

    render(<App />);

    expect(useAdminPreviewControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        projectId: "project-live-001",
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
      }),
    );
    expect(screen.getByTestId("admin-preview-page")).toHaveTextContent("admin-preview-page");
    expect(lastAdminPreviewPageProps).toEqual(
      expect.objectContaining({
        previewWorkbench: expect.objectContaining({
          assembly: expect.objectContaining({
            projectId: "project-live-001",
          }),
        }),
      }),
    );
  });

  it("renders the audio route when pathname is /audio", () => {
    window.history.pushState(
      {},
      "",
      "/audio?projectId=project-live-001&shotExecutionId=shot-exec-live-001",
    );

    render(<App />);

    expect(useAdminAudioControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        projectId: "project-live-001",
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
      }),
    );
    expect(screen.getByTestId("admin-audio-page")).toHaveTextContent("admin-audio-page");
    expect(lastAdminAudioPageProps).toEqual(
      expect.objectContaining({
        audioWorkbench: expect.objectContaining({
          timeline: expect.objectContaining({
            projectId: "project-live-001",
          }),
        }),
      }),
    );
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
    useAdminOverviewControllerMock.mockReturnValue(
      buildOverviewController({
        errorMessage: "overview exploded",
      }) as never,
    );

    render(<App />);

    expect(screen.getByText("管理概览加载失败：overview exploded")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("does not let governance errors block the overview route", () => {
    useAdminGovernanceControllerMock.mockReturnValue(
      buildGovernanceController({
        errorMessage: "governance exploded",
      }) as never,
    );

    render(<App />);

    expect(screen.getByTestId("admin-overview-page")).toHaveTextContent("project-live-001");
    expect(screen.queryByText("管理概览加载失败：governance exploded")).not.toBeInTheDocument();
  });

  it("does not let overview errors block the workflow route", () => {
    window.history.pushState({}, "", "/workflow?projectId=project-live-001");
    useAdminOverviewControllerMock.mockReturnValue(
      buildOverviewController({
        errorMessage: "overview exploded",
      }) as never,
    );

    render(<App />);

    expect(screen.getByTestId("admin-workflow-page")).toHaveTextContent("workflow-run-1");
    expect(screen.queryByText("管理概览加载失败：overview exploded")).not.toBeInTheDocument();
  });

  it("renders the active session banner, shell actions, and overview route content", () => {
    const handleClearCurrentSession = vi.fn();
    useAdminSessionGateMock.mockReturnValue(
      buildSessionGate({
        handleClearCurrentSession,
      }) as never,
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "清空开发会话" }));

    expect(screen.getByText("当前开发会话用户：user-demo-001")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "管理端主导航" })).toBeInTheDocument();
    expect(screen.getByTestId("ui-locale-select")).toHaveValue("zh-CN");
    expect(handleClearCurrentSession).toHaveBeenCalledTimes(1);
    expect(lastAdminOverviewPageProps?.overview).toEqual(
      expect.objectContaining({
        budgetSnapshot: expect.objectContaining({
          projectId: "project-live-001",
        }),
      }),
    );
  });

  it("navigates between routes from the shell and preserves common query params", () => {
    window.history.pushState(
      {},
      "",
      "/overview?projectId=project-live-001&shotExecutionId=shot-exec-live-001&workflowRunId=workflow-run-1",
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "工作流" }));

    expect(window.location.pathname).toBe("/workflow");
    expect(window.location.search).toContain("projectId=project-live-001");
    expect(window.location.search).toContain("shotExecutionId=shot-exec-live-001");
    expect(window.location.search).not.toContain("workflowRunId=");
    expect(screen.getByTestId("admin-workflow-page")).toHaveTextContent("workflow-run-1");
  });

  it("navigates from the overview workflow summary cta and preserves route params", () => {
    window.history.pushState(
      {},
      "",
      "/overview?projectId=project-live-001&shotExecutionId=shot-exec-live-001&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "overview-open-workflow" }));

    expect(window.location.pathname).toBe("/workflow");
    expect(window.location.search).toContain("projectId=project-live-001");
    expect(window.location.search).toContain("shotExecutionId=shot-exec-live-001");
    expect(window.location.search).toContain("orgId=org-override-001");
    expect(window.location.search).toContain("userId=user-override-001");
    expect(window.location.search).toContain("workflowRunId=workflow-run-1");
  });

  it("navigates from the overview asset summary cta and preserves route params", () => {
    window.history.pushState(
      {},
      "",
      "/overview?projectId=project-live-001&shotExecutionId=shot-exec-live-001&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "overview-open-asset" }));

    expect(window.location.pathname).toBe("/assets");
    expect(window.location.search).toContain("projectId=project-live-001");
    expect(window.location.search).toContain("shotExecutionId=shot-exec-live-001");
    expect(window.location.search).toContain("orgId=org-override-001");
    expect(window.location.search).toContain("userId=user-override-001");
    expect(window.location.search).toContain("importBatchId=batch-live-1");
  });

  it("restores workflow detail selection from workflowRunId query and syncs close/open actions back to the url", () => {
    const workflow = buildWorkflow({
      onSelectWorkflowRun: vi.fn(),
      onCloseWorkflowDetail: vi.fn(),
    });
    useAdminWorkflowControllerMock.mockReturnValue(workflow as never);
    window.history.pushState(
      {},
      "",
      "/workflow?projectId=project-live-001&shotExecutionId=shot-exec-live-001&workflowRunId=workflow-run-2",
    );

    render(<App />);

    expect(workflow.onSelectWorkflowRun).toHaveBeenCalledWith("workflow-run-2");

    fireEvent.click(screen.getByRole("button", { name: "close-workflow-detail" }));
    expect(window.location.search).not.toContain("workflowRunId=");

    fireEvent.click(screen.getByRole("button", { name: "open-workflow-detail" }));
    expect(window.location.search).toContain("workflowRunId=workflow-run-1");
  });

  it("restores asset batch and provenance selection from query params and keeps them in sync", () => {
    const asset = buildAsset({
      onSelectImportBatch: vi.fn(),
      onSelectAssetProvenance: vi.fn(),
      onCloseImportBatchDetail: vi.fn(),
      onCloseAssetProvenance: vi.fn(),
    });
    useAdminAssetControllerMock.mockReturnValue(asset as never);
    window.history.pushState(
      {},
      "",
      "/assets?projectId=project-live-001&shotExecutionId=shot-exec-live-001&importBatchId=batch-live-1&assetId=asset-live-1",
    );

    render(<App />);

    expect(asset.onSelectImportBatch).toHaveBeenCalledWith("batch-live-1");
    expect(asset.onSelectAssetProvenance).toHaveBeenCalledWith("asset-live-1");

    fireEvent.click(screen.getByRole("button", { name: "close-asset-provenance" }));
    expect(window.location.search).toContain("importBatchId=batch-live-1");
    expect(window.location.search).not.toContain("assetId=");

    fireEvent.click(screen.getByRole("button", { name: "close-import-batch" }));
    expect(window.location.search).not.toContain("importBatchId=");

    fireEvent.click(screen.getByRole("button", { name: "open-import-batch" }));
    expect(window.location.search).toContain("importBatchId=batch-live-1");

    fireEvent.click(screen.getByRole("button", { name: "open-asset-provenance" }));
    expect(window.location.search).toContain("assetId=asset-live-1");
  });

  it("reacts to popstate updates and switches the rendered route", () => {
    render(<App />);

    window.history.pushState({}, "", "/assets?projectId=project-live-001");
    fireEvent.popState(window);

    expect(screen.getByTestId("admin-assets-page")).toHaveTextContent("batch-live-1");
    expect(screen.queryByTestId("admin-overview-page")).not.toBeInTheDocument();
  });

  it("refreshes overview operations summary for workflow and asset events while overview is active", () => {
    const overview = buildOverviewController({
      refreshOperationsOverview: vi.fn(),
    });
    const workflow = buildWorkflow({
      refreshWorkflowSilently: vi.fn(),
    });
    const asset = buildAsset({
      refreshAssetSilently: vi.fn(),
    });
    useAdminOverviewControllerMock.mockReturnValue(overview as never);
    useAdminWorkflowControllerMock.mockReturnValue(workflow as never);
    useAdminAssetControllerMock.mockReturnValue(asset as never);

    render(<App />);

    const subscription = useAdminRecentChangesSubscriptionMock.mock.calls.at(-1)?.[0];
    subscription?.onWorkflowUpdated();
    subscription?.onAssetImportBatchUpdated();

    expect(overview.refreshOperationsOverview).toHaveBeenCalledTimes(2);
    expect(workflow.refreshWorkflowSilently).not.toHaveBeenCalled();
    expect(asset.refreshAssetSilently).not.toHaveBeenCalled();
  });

  it("refreshes the active workflow route when workflow updates arrive", () => {
    const overview = buildOverviewController({
      refreshOperationsOverview: vi.fn(),
    });
    const workflow = buildWorkflow({
      refreshWorkflowSilently: vi.fn(),
    });
    useAdminOverviewControllerMock.mockReturnValue(overview as never);
    useAdminWorkflowControllerMock.mockReturnValue(workflow as never);
    window.history.pushState({}, "", "/workflow?projectId=project-live-001");

    render(<App />);

    const subscription = useAdminRecentChangesSubscriptionMock.mock.calls.at(-1)?.[0];
    subscription?.onWorkflowUpdated();

    expect(workflow.refreshWorkflowSilently).toHaveBeenCalledTimes(1);
    expect(overview.refreshOperationsOverview).not.toHaveBeenCalled();
  });

  it("refreshes the active asset route when asset import batch updates arrive", () => {
    const overview = buildOverviewController({
      refreshOperationsOverview: vi.fn(),
    });
    const asset = buildAsset({
      refreshAssetSilently: vi.fn(),
    });
    useAdminOverviewControllerMock.mockReturnValue(overview as never);
    useAdminAssetControllerMock.mockReturnValue(asset as never);
    window.history.pushState({}, "", "/assets?projectId=project-live-001");

    render(<App />);

    const subscription = useAdminRecentChangesSubscriptionMock.mock.calls.at(-1)?.[0];
    subscription?.onAssetImportBatchUpdated();

    expect(asset.refreshAssetSilently).toHaveBeenCalledTimes(1);
    expect(overview.refreshOperationsOverview).not.toHaveBeenCalled();
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
