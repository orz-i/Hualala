import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CREATOR_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { loadImportBatchWorkbench } from "../features/import-batches/loadImportBatchWorkbench";
import {
  confirmImportBatchItems,
  completeUploadSessionForImportBatch,
  createUploadSessionForImportBatch,
  deriveUploadFileMetadata,
  retryUploadSessionForImportBatch,
  selectPrimaryAssetForImportBatch,
} from "../features/import-batches/mutateImportBatchWorkbench";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";
import { loadShotReviewTimeline } from "../features/shot-workbench/loadShotReviewTimeline";
import { loadShotWorkflowPanel } from "../features/shot-workbench/loadShotWorkflowPanel";
import {
  runSubmissionGateChecks,
  selectPrimaryAssetForShotWorkbench,
  submitShotForReview,
} from "../features/shot-workbench/mutateShotWorkbench";
import {
  retryShotWorkflowRun,
  startShotWorkflow,
} from "../features/shot-workbench/mutateShotWorkflow";
import {
  clearCurrentSession,
  ensureDevSession,
  loadCurrentSession,
} from "../features/session/sessionBootstrap";
import { subscribeWorkbenchEvents } from "../features/subscribeWorkbenchEvents";
import { App } from "./App";

vi.mock("../features/shot-workbench/loadShotWorkbench", () => ({
  loadShotWorkbench: vi.fn(),
}));
vi.mock("../features/shot-workbench/loadShotReviewTimeline", () => ({
  loadShotReviewTimeline: vi.fn(),
}));
vi.mock("../features/shot-workbench/loadShotWorkflowPanel", () => ({
  loadShotWorkflowPanel: vi.fn(),
}));
vi.mock("../features/import-batches/loadImportBatchWorkbench", () => ({
  loadImportBatchWorkbench: vi.fn(),
}));
vi.mock("../features/import-batches/mutateImportBatchWorkbench", () => ({
  confirmImportBatchItems: vi.fn(),
  completeUploadSessionForImportBatch: vi.fn(),
  createUploadSessionForImportBatch: vi.fn(),
  deriveUploadFileMetadata: vi.fn(),
  retryUploadSessionForImportBatch: vi.fn(),
  selectPrimaryAssetForImportBatch: vi.fn(),
}));
vi.mock("../features/shot-workbench/mutateShotWorkbench", () => ({
  runSubmissionGateChecks: vi.fn(),
  selectPrimaryAssetForShotWorkbench: vi.fn(),
  submitShotForReview: vi.fn(),
}));
vi.mock("../features/shot-workbench/mutateShotWorkflow", () => ({
  startShotWorkflow: vi.fn(),
  retryShotWorkflowRun: vi.fn(),
}));
vi.mock("../features/session/sessionBootstrap", () => ({
  loadCurrentSession: vi.fn(),
  ensureDevSession: vi.fn(),
  clearCurrentSession: vi.fn(),
  isUnauthenticatedSessionError: (error: unknown) =>
    error instanceof Error && (error.message.includes("(401)") || error.message.includes("unauthenticated")),
}));
vi.mock("../features/subscribeWorkbenchEvents", () => ({
  subscribeWorkbenchEvents: vi.fn(),
}));

const loadShotWorkbenchMock = vi.mocked(loadShotWorkbench);
const loadShotReviewTimelineMock = vi.mocked(loadShotReviewTimeline);
const loadShotWorkflowPanelMock = vi.mocked(loadShotWorkflowPanel);
const loadImportBatchWorkbenchMock = vi.mocked(loadImportBatchWorkbench);
const confirmImportBatchItemsMock = vi.mocked(confirmImportBatchItems);
const completeUploadSessionForImportBatchMock = vi.mocked(completeUploadSessionForImportBatch);
const createUploadSessionForImportBatchMock = vi.mocked(createUploadSessionForImportBatch);
const deriveUploadFileMetadataMock = vi.mocked(deriveUploadFileMetadata);
const retryUploadSessionForImportBatchMock = vi.mocked(retryUploadSessionForImportBatch);
const selectPrimaryAssetForImportBatchMock = vi.mocked(selectPrimaryAssetForImportBatch);
const runSubmissionGateChecksMock = vi.mocked(runSubmissionGateChecks);
const selectPrimaryAssetForShotWorkbenchMock = vi.mocked(selectPrimaryAssetForShotWorkbench);
const submitShotForReviewMock = vi.mocked(submitShotForReview);
const startShotWorkflowMock = vi.mocked(startShotWorkflow);
const retryShotWorkflowRunMock = vi.mocked(retryShotWorkflowRun);
const loadCurrentSessionMock = vi.mocked(loadCurrentSession);
const ensureDevSessionMock = vi.mocked(ensureDevSession);
const clearCurrentSessionMock = vi.mocked(clearCurrentSession);
const subscribeWorkbenchEventsMock = vi.mocked(subscribeWorkbenchEvents);

let latestWorkbenchSubscription:
  | {
      organizationId: string;
      projectId: string;
      workbenchKind: "shot" | "import";
      onRefreshNeeded: () => void;
      onError?: (error: Error) => void;
    }
  | undefined;
let latestWorkbenchSubscriptionCleanup: ReturnType<typeof vi.fn>;

function createImportWorkbench(batchId: string, status = "matched_pending_confirm") {
  return {
    importBatch: {
      id: batchId,
      orgId: "org-1",
      projectId: "project-1",
      status,
      sourceType: "upload_session",
    },
    uploadSessions: [
      {
        id: `upload-session-${batchId}`,
        status: "completed",
        fileName: `${batchId}.png`,
        checksum: "sha256:seed",
        sizeBytes: 1024,
        retryCount: 0,
        resumeHint: `upload complete for ${batchId}.png`,
      },
    ],
    items: [{ id: `item-${batchId}`, status, assetId: `asset-${batchId}` }],
    candidateAssets: [
      {
        id: `candidate-${batchId}`,
        assetId: `asset-${batchId}`,
        shotExecutionId: `shot-exec-${batchId}`,
        sourceRunId: `source-run-${batchId}`,
      },
    ],
    shotExecutions: [
      {
        id: `shot-exec-${batchId}`,
        status: status === "matched_pending_confirm" ? "candidate_ready" : "primary_selected",
        primaryAssetId: status === "matched_pending_confirm" ? "" : `asset-${batchId}`,
      },
    ],
  };
}

function createImportWorkbenchWithPool(batchId: string, status = "matched_pending_confirm") {
  return {
    ...createImportWorkbench(batchId, status),
    items: [
      { id: `item-${batchId}-1`, status, assetId: `asset-${batchId}-1` },
      { id: `item-${batchId}-2`, status, assetId: `asset-${batchId}-2` },
    ],
    candidateAssets: [
      {
        id: `candidate-${batchId}-1`,
        assetId: `asset-${batchId}-1`,
        shotExecutionId: `shot-exec-${batchId}`,
        sourceRunId: `source-run-${batchId}-1`,
      },
      {
        id: `candidate-${batchId}-2`,
        assetId: `asset-${batchId}-2`,
        shotExecutionId: `shot-exec-${batchId}`,
        sourceRunId: `source-run-${batchId}-2`,
      },
    ],
  };
}

function createShotWorkbench(shotId: string, status = "candidate_ready", conclusion = "pending") {
  return {
    shotExecution: {
      id: `shot-exec-${shotId}`,
      shotId,
      orgId: "org-1",
      projectId: "project-1",
      status,
      primaryAssetId: `asset-${shotId}`,
    },
    candidateAssets: [
      {
        id: `candidate-${shotId}`,
        assetId: `asset-${shotId}`,
        shotExecutionId: `shot-exec-${shotId}`,
        sourceRunId: `source-run-${shotId}`,
      },
    ],
    reviewSummary: {
      latestConclusion: conclusion,
    },
    latestEvaluationRun: {
      id: `eval-${shotId}`,
      status: conclusion === "pending" ? "pending" : "passed",
    },
    reviewTimeline: {
      evaluationRuns: [],
      shotReviews: [],
    },
  };
}

function createShotWorkbenchWithPool(
  shotId: string,
  status = "candidate_ready",
  conclusion = "pending",
  primaryAssetId = `asset-${shotId}-1`,
) {
  return {
    ...createShotWorkbench(shotId, status, conclusion),
    shotExecution: {
      id: `shot-exec-${shotId}`,
      shotId,
      orgId: "org-1",
      projectId: "project-1",
      status,
      primaryAssetId,
    },
    candidateAssets: [
      {
        id: `candidate-${shotId}-1`,
        assetId: `asset-${shotId}-1`,
        shotExecutionId: `shot-exec-${shotId}`,
        sourceRunId: `source-run-${shotId}-1`,
      },
      {
        id: `candidate-${shotId}-2`,
        assetId: `asset-${shotId}-2`,
        shotExecutionId: `shot-exec-${shotId}`,
        sourceRunId: `source-run-${shotId}-2`,
      },
    ],
  };
}

function createShotReviewTimeline(
  shotId: string,
  evaluationStatus = "pending",
  conclusion = "pending",
  unavailableMessage?: string,
) {
  if (unavailableMessage) {
    return {
      evaluationRuns: [],
      shotReviews: [],
      unavailableMessage,
    };
  }

  return {
    evaluationRuns: [
      {
        id: `eval-${shotId}-${evaluationStatus}`,
        status: evaluationStatus,
        passedChecks: evaluationStatus === "pending" ? [] : ["asset_selected"],
        failedChecks: evaluationStatus === "failed" ? ["copyright_missing"] : [],
      },
    ],
    shotReviews: [
      {
        id: `review-${shotId}-${conclusion}`,
        conclusion,
        commentLocale: "zh-CN",
      },
    ],
  };
}

function createShotWorkflowPanel(status = "running", id = "workflow-run-1") {
  return {
    latestWorkflowRun: {
      id,
      workflowType: "shot_pipeline",
      status,
      resourceId: "shot-exec-shot-live-1",
      projectId: "project-1",
    },
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    latestWorkbenchSubscription = undefined;
    latestWorkbenchSubscriptionCleanup = vi.fn();
    window.localStorage.clear();
    window.localStorage.setItem(CREATOR_UI_LOCALE_STORAGE_KEY, "zh-CN");
    loadCurrentSessionMock.mockResolvedValue({
      sessionId: "dev:org-1:user-1",
      orgId: "org-1",
      userId: "user-1",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read", "org.members.read", "org.roles.read"],
      timezone: "Asia/Shanghai",
    });
    ensureDevSessionMock.mockResolvedValue({
      sessionId: "dev:org-1:user-1",
      orgId: "org-1",
      userId: "user-1",
      locale: "zh-CN",
      roleId: "role-admin",
      roleCode: "admin",
      permissionCodes: ["session.read", "org.members.read", "org.roles.read"],
      timezone: "Asia/Shanghai",
    });
    clearCurrentSessionMock.mockResolvedValue();
    deriveUploadFileMetadataMock.mockResolvedValue({
      fileName: "scene.png",
      sizeBytes: 1024,
      mimeType: "image/png",
      width: 1920,
      height: 1080,
      checksum: "sha256:abc",
      file: new File(["demo"], "scene.png", { type: "image/png" }),
    } as never);
    createUploadSessionForImportBatchMock.mockResolvedValue({
      session_id: "upload-session-created",
      status: "pending",
    } as never);
    completeUploadSessionForImportBatchMock.mockResolvedValue({
      session_id: "upload-session-created",
      status: "uploaded",
      asset_id: "asset-new",
    } as never);
    retryUploadSessionForImportBatchMock.mockResolvedValue({
      session_id: "upload-session-created",
      status: "pending",
      retry_count: 1,
    } as never);
    subscribeWorkbenchEventsMock.mockImplementation((options) => {
      latestWorkbenchSubscription = options;
      latestWorkbenchSubscriptionCleanup = vi.fn();
      return latestWorkbenchSubscriptionCleanup;
    });
    loadShotReviewTimelineMock.mockResolvedValue(createShotReviewTimeline("default"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());
    startShotWorkflowMock.mockResolvedValue(undefined);
    retryShotWorkflowRunMock.mockResolvedValue(undefined);
  });

  it("shows the dev session gate when no active session exists, then starts a dev session", async () => {
    window.history.pushState({}, "", "/?shotId=shot-session-1");
    loadCurrentSessionMock
      .mockRejectedValueOnce(new Error("sdk: failed to get current session (401)"))
      .mockResolvedValueOnce({
        sessionId: "dev:org-1:user-1",
        orgId: "org-1",
        userId: "user-1",
        locale: "zh-CN",
        roleId: "role-admin",
        roleCode: "admin",
        permissionCodes: ["session.read", "org.members.read", "org.roles.read"],
        timezone: "Asia/Shanghai",
      });
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-session-1"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());

    render(<App />);

    expect(await screen.findByText("尚未进入开发会话")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入开发会话" }));

    await waitFor(() => {
      expect(ensureDevSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("shot-exec-shot-session-1")).toBeInTheDocument();
  });

  it("clears the active dev session and returns creator to the session gate", async () => {
    window.history.pushState({}, "", "/?shotId=shot-session-2");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-session-2"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-session-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空开发会话" }));

    await waitFor(() => {
      expect(clearCurrentSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("尚未进入开发会话")).toBeInTheDocument();
  });

  it("prefers importBatchId from search params, requires explicit selection, and refreshes the candidate pool actions", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-1&shotId=shot-live-1");
    loadImportBatchWorkbenchMock.mockResolvedValueOnce(
      createImportWorkbenchWithPool("batch-live-1"),
    );
    loadImportBatchWorkbenchMock.mockResolvedValueOnce({
      ...createImportWorkbenchWithPool("batch-live-1", "confirmed"),
      shotExecutions: [
        {
          id: "shot-exec-batch-live-1",
          status: "primary_selected",
          primaryAssetId: "",
        },
      ],
    });
    loadImportBatchWorkbenchMock.mockResolvedValueOnce({
      ...createImportWorkbenchWithPool("batch-live-1", "confirmed"),
      shotExecutions: [
        {
          id: "shot-exec-batch-live-1",
          status: "primary_selected",
          primaryAssetId: "asset-batch-live-1-2",
        },
      ],
    });
    confirmImportBatchItemsMock.mockResolvedValue(undefined);
    selectPrimaryAssetForImportBatchMock.mockResolvedValue(undefined);

    render(<App />);

    expect(screen.getByText("正在建立开发会话")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadImportBatchWorkbenchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          importBatchId: "batch-live-1",
        }),
      );
    });

    expect(loadShotWorkbenchMock).not.toHaveBeenCalled();
    expect(await screen.findByText("batch-live-1")).toBeInTheDocument();
    expect(screen.getByText("candidate_ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认匹配" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("选择条目 item-batch-live-1-2"));
    fireEvent.click(screen.getByRole("button", { name: "确认匹配" }));

    await waitFor(() => {
      expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
        importBatchId: "batch-live-1",
        itemIds: ["item-batch-live-1-2"],
      });
    });
    expect(await screen.findByText("匹配确认已完成")).toBeInTheDocument();
    expect(screen.getByText("当前批次状态：confirmed")).toBeInTheDocument();
    expect(screen.getByText("当前执行状态：primary_selected")).toBeInTheDocument();
    expect(screen.getByText("已选 0 条")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认匹配" })).toBeDisabled();

    fireEvent.click(
      within(
        screen.getByText("候选：candidate-batch-live-1-2").closest("article") as HTMLElement,
      ).getByRole("button", { name: "设为主素材" }),
    );

    await waitFor(() => {
      expect(selectPrimaryAssetForImportBatchMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-batch-live-1",
        assetId: "asset-batch-live-1-2",
      });
    });

    await waitFor(() => {
      expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText("主素材选择已完成")).toBeInTheDocument();
    expect(screen.getByText("当前主素材：asset-batch-live-1-2")).toBeInTheDocument();
  });

  it("keeps the current import workbench visible and surfaces an action error when confirm matches fails", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-2");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-2"));
    confirmImportBatchItemsMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("batch-live-2")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("选择条目 item-batch-live-2"));
    fireEvent.click(screen.getByRole("button", { name: "确认匹配" }));

    expect(await screen.findByText("匹配确认失败：network down")).toBeInTheDocument();
    expect(screen.getByText("batch-live-2")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the current import workbench visible and surfaces an action error when select primary asset fails", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-3");
    loadImportBatchWorkbenchMock.mockResolvedValue(
      createImportWorkbenchWithPool("batch-live-3", "confirmed"),
    );
    selectPrimaryAssetForImportBatchMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("batch-live-3")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen.getByText("候选：candidate-batch-live-3-2").closest("article") as HTMLElement,
      ).getByRole("button", { name: "设为主素材" }),
    );

    expect(await screen.findByText("主素材选择失败：network down")).toBeInTheDocument();
    expect(screen.getByText("batch-live-3")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("renders the upload registration actions for the import workbench", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-4");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-4"));

    render(<App />);

    expect(await screen.findByText("batch-live-4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登记上传文件" })).toBeInTheDocument();
    expect(screen.getByLabelText("选择本地文件")).toBeInTheDocument();
  });

  it("registers the selected upload file and refreshes the import workbench", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-5");
    loadImportBatchWorkbenchMock
      .mockResolvedValueOnce(createImportWorkbench("batch-live-5"))
      .mockResolvedValueOnce({
        ...createImportWorkbench("batch-live-5", "confirmed"),
        uploadSessions: [
          {
            id: "upload-session-created",
            status: "uploaded",
            fileName: "scene.png",
            checksum: "sha256:abc",
            sizeBytes: 1024,
            retryCount: 0,
            resumeHint: "upload complete for scene.png",
          },
        ],
      });

    render(<App />);

    expect(await screen.findByText("batch-live-5")).toBeInTheDocument();

    const file = new File(["demo"], "scene.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择本地文件"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(deriveUploadFileMetadataMock).toHaveBeenCalledWith(file);
    });

    fireEvent.click(screen.getByRole("button", { name: "登记上传文件" }));

    await waitFor(() => {
      expect(createUploadSessionForImportBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          projectId: "project-1",
          importBatchId: "batch-live-5",
          fileName: "scene.png",
          checksum: "sha256:abc",
          sizeBytes: 1024,
        }),
      );
    });
    await waitFor(() => {
      expect(completeUploadSessionForImportBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "upload-session-created",
          shotExecutionId: "shot-exec-batch-live-5",
          mimeType: "image/png",
          locale: "zh-CN",
          width: 1920,
          height: 1080,
        }),
      );
    });

    expect(await screen.findByText("上传登记已完成")).toBeInTheDocument();
    expect(screen.getByText("当前上传状态：uploaded")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces an upload registration error and keeps the current import workbench", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-6");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-6"));
    createUploadSessionForImportBatchMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("batch-live-6")).toBeInTheDocument();

    const file = new File(["demo"], "scene.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择本地文件"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(deriveUploadFileMetadataMock).toHaveBeenCalledWith(file);
    });

    fireEvent.click(screen.getByRole("button", { name: "登记上传文件" }));

    expect(await screen.findByText("上传登记失败：network down")).toBeInTheDocument();
    expect(screen.getByText("batch-live-6")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("retries the latest expired upload session and refreshes the import workbench", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-7");
    loadImportBatchWorkbenchMock
      .mockResolvedValueOnce({
        ...createImportWorkbench("batch-live-7"),
        uploadSessions: [
          {
            id: "upload-session-old",
            status: "completed",
            fileName: "old.png",
            checksum: "sha256:old",
            sizeBytes: 100,
            retryCount: 0,
            resumeHint: "",
          },
          {
            id: "upload-session-expired",
            status: "expired",
            fileName: "expired.png",
            checksum: "sha256:expired",
            sizeBytes: 512,
            retryCount: 0,
            resumeHint: "resume expired.png",
          },
        ],
      })
      .mockResolvedValueOnce({
        ...createImportWorkbench("batch-live-7", "confirmed"),
        uploadSessions: [
          {
            id: "upload-session-expired",
            status: "pending",
            fileName: "expired.png",
            checksum: "sha256:expired",
            sizeBytes: 512,
            retryCount: 1,
            resumeHint: "resume expired.png",
          },
        ],
      });

    render(<App />);

    expect(await screen.findByText("batch-live-7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试最近过期会话" }));

    await waitFor(() => {
      expect(retryUploadSessionForImportBatchMock).toHaveBeenCalledWith({
        sessionId: "upload-session-expired",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(await screen.findByText("上传会话重试已完成")).toBeInTheDocument();
    expect(screen.getByText("当前上传状态：pending")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(2);
  });

  it("subscribes to import workbench SSE after the first successful load", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-subscribe");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-subscribe"));

    render(<App />);

    expect(await screen.findByText("batch-live-subscribe")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeWorkbenchEventsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          projectId: "project-1",
          workbenchKind: "import",
        }),
      );
    });
  });

  it("reads shotId from search params, loads the workbench, and renders the live data", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-1");
    loadShotWorkbenchMock.mockResolvedValueOnce(createShotWorkbench("shot-live-1"));
    loadShotReviewTimelineMock.mockResolvedValueOnce(
      createShotReviewTimeline("shot-live-1", "pending", "pending"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-live-1", "candidate_ready", "passed"),
    );
    loadShotReviewTimelineMock.mockResolvedValueOnce(
      createShotReviewTimeline("shot-live-1", "passed", "passed"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-live-1", "submitted_for_review", "approved"),
    );
    loadShotReviewTimelineMock.mockResolvedValueOnce(
      createShotReviewTimeline("shot-live-1", "passed", "approved"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    runSubmissionGateChecksMock.mockResolvedValue({
      passedChecks: ["asset_selected", "review_ready"],
      failedChecks: ["copyright_missing"],
    });
    submitShotForReviewMock.mockResolvedValue(undefined);

    render(<App />);

    expect(screen.getByText("正在建立开发会话")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          shotId: "shot-live-1",
        }),
      );
    });
    expect(loadShotReviewTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shotExecutionId: "shot-exec-shot-live-1",
      }),
    );
    expect(loadShotWorkflowPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shotExecutionId: "shot-exec-shot-live-1",
        projectId: "project-1",
      }),
    );

    expect(await screen.findByText("shot-exec-shot-live-1")).toBeInTheDocument();
    expect(screen.getByText(/workflow-run-1/)).toBeInTheDocument();
    expect(screen.getByText("评审时间线")).toBeInTheDocument();
    expect(screen.getByText("review-shot-live-1-pending")).toBeInTheDocument();
    expect(screen.getAllByText("pending").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));

    await waitFor(() => {
      expect(runSubmissionGateChecksMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-shot-live-1",
      });
    });

    expect(await screen.findByText("Gate 检查已完成")).toBeInTheDocument();
    expect(screen.getByText("asset_selected")).toBeInTheDocument();
    expect(screen.getByText("review_ready")).toBeInTheDocument();
    expect(screen.getByText("copyright_missing")).toBeInTheDocument();
    expect(screen.getAllByText("最近评估：passed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("review-shot-live-1-passed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交评审" }));

    await waitFor(() => {
      expect(submitShotForReviewMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-shot-live-1",
      });
    });

    expect(await screen.findByText("提交评审已完成")).toBeInTheDocument();
    expect(screen.getByText("最新评审结论：approved")).toBeInTheDocument();
    expect(screen.getByText("review-shot-live-1-approved")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(3);
    });

    expect(await screen.findByText(/submitted_for_review/)).toBeInTheDocument();
  });

  it("selects a shot primary asset and refreshes workbench, review timeline, and workflow panel together", async () => {
    window.history.pushState({}, "", "/?shotId=shot-primary-select");
    loadShotWorkbenchMock
      .mockResolvedValueOnce(
        createShotWorkbenchWithPool("shot-primary-select", "candidate_ready", "pending"),
      )
      .mockResolvedValueOnce(
        createShotWorkbenchWithPool(
          "shot-primary-select",
          "candidate_ready",
          "approved",
          "asset-shot-primary-select-2",
        ),
      );
    loadShotReviewTimelineMock
      .mockResolvedValueOnce(
        createShotReviewTimeline("shot-primary-select", "pending", "pending"),
      )
      .mockResolvedValueOnce(
        createShotReviewTimeline("shot-primary-select", "passed", "approved"),
      );
    loadShotWorkflowPanelMock
      .mockResolvedValueOnce(createShotWorkflowPanel("running", "workflow-run-1"))
      .mockResolvedValueOnce(createShotWorkflowPanel("failed", "workflow-run-2"));
    selectPrimaryAssetForShotWorkbenchMock.mockResolvedValue(undefined);

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-primary-select")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen
          .getByText("候选：candidate-shot-primary-select-2")
          .closest("article") as HTMLElement,
      ).getByRole("button", { name: "设为主素材" }),
    );

    await waitFor(() => {
      expect(selectPrimaryAssetForShotWorkbenchMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-shot-primary-select",
        assetId: "asset-shot-primary-select-2",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(await screen.findByText("镜头主素材已更新")).toBeInTheDocument();
    expect(screen.getByText("主素材：asset-shot-primary-select-2")).toBeInTheDocument();
    expect(screen.getByText("review-shot-primary-select-approved")).toBeInTheDocument();
    expect(screen.getByText(/workflow-run-2/)).toBeInTheDocument();
    expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(2);
    expect(loadShotReviewTimelineMock).toHaveBeenCalledTimes(2);
    expect(loadShotWorkflowPanelMock).toHaveBeenCalledTimes(2);
  });

  it("subscribes to shot workbench SSE after the first successful load", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-subscribe");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-live-subscribe"));
    loadShotReviewTimelineMock.mockResolvedValue(
      createShotReviewTimeline("shot-live-subscribe"),
    );
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-live-subscribe")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeWorkbenchEventsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          projectId: "project-1",
          workbenchKind: "shot",
        }),
      );
    });
  });

  it("keeps the current shot workbench visible and surfaces an action error when gate checks fail", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-2");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-live-2"));
    loadShotReviewTimelineMock.mockResolvedValue(createShotReviewTimeline("shot-live-2"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());
    runSubmissionGateChecksMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-live-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));

    expect(await screen.findByText("Gate 检查失败：network down")).toBeInTheDocument();
    expect(screen.getByText("shot-exec-shot-live-2")).toBeInTheDocument();
    expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces string rejections from gate checks without collapsing them into a generic shot error", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-2-string");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-live-2-string"));
    loadShotReviewTimelineMock.mockResolvedValue(createShotReviewTimeline("shot-live-2-string"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());
    runSubmissionGateChecksMock.mockRejectedValue("network down");

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-live-2-string")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));

    expect(await screen.findByText("Gate 检查失败：network down")).toBeInTheDocument();
  });

  it("silently refreshes the shot workbench when a subscribed event arrives", async () => {
    window.history.pushState({}, "", "/?shotId=shot-sse-1");
    loadShotWorkbenchMock
      .mockResolvedValueOnce(createShotWorkbench("shot-sse-1", "candidate_ready", "pending"))
      .mockResolvedValueOnce(createShotWorkbench("shot-sse-1", "submitted_for_review", "approved"));
    loadShotReviewTimelineMock
      .mockResolvedValueOnce(createShotReviewTimeline("shot-sse-1", "pending", "pending"))
      .mockResolvedValueOnce(createShotReviewTimeline("shot-sse-1", "passed", "approved"));
    loadShotWorkflowPanelMock
      .mockResolvedValueOnce(createShotWorkflowPanel("running", "workflow-run-1"))
      .mockResolvedValueOnce(createShotWorkflowPanel("failed", "workflow-run-2"));

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-sse-1")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeWorkbenchEventsMock).toHaveBeenCalledTimes(1);
    });
    expect(latestWorkbenchSubscription?.workbenchKind).toBe("shot");

    await act(async () => {
      latestWorkbenchSubscription?.onRefreshNeeded();
    });

    expect(await screen.findByText(/submitted_for_review/)).toBeInTheDocument();
    expect(screen.getByText(/workflow-run-2/)).toBeInTheDocument();
    expect(screen.getByText("review-shot-sse-1-approved")).toBeInTheDocument();
    expect(screen.queryByText("正在执行 Gate 检查")).not.toBeInTheDocument();
    expect(screen.queryByText("Gate 检查失败")).not.toBeInTheDocument();
    expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(2);
    expect(loadShotWorkflowPanelMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the shot workbench visible when the review timeline is unavailable", async () => {
    window.history.pushState({}, "", "/?shotId=shot-timeline-unavailable");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-timeline-unavailable"));
    loadShotReviewTimelineMock.mockResolvedValue(
      createShotReviewTimeline(
        "shot-timeline-unavailable",
        "pending",
        "pending",
        "评审时间线暂不可用",
      ),
    );
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-timeline-unavailable")).toBeInTheDocument();
    expect(screen.getByText("评审时间线暂不可用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gate 检查" })).toBeInTheDocument();
  });

  it("silently refreshes the import workbench without clearing the selected file", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-sse-1");
    loadImportBatchWorkbenchMock
      .mockResolvedValueOnce(createImportWorkbench("batch-sse-1"))
      .mockResolvedValueOnce({
        ...createImportWorkbench("batch-sse-1", "confirmed"),
        uploadSessions: [
          {
            id: "upload-session-created",
            status: "uploaded",
            fileName: "scene.png",
            checksum: "sha256:abc",
            sizeBytes: 1024,
            retryCount: 0,
            resumeHint: "upload complete for scene.png",
          },
        ],
      });

    render(<App />);

    expect(await screen.findByText("batch-sse-1")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeWorkbenchEventsMock).toHaveBeenCalledTimes(1);
    });

    const file = new File(["demo"], "scene.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择本地文件"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("文件名：scene.png")).toBeInTheDocument();
    expect(latestWorkbenchSubscription?.workbenchKind).toBe("import");

    await act(async () => {
      latestWorkbenchSubscription?.onRefreshNeeded();
    });

    expect(await screen.findByText("当前状态 confirmed，来源 upload_session")).toBeInTheDocument();
    expect(screen.getByText("文件名：scene.png")).toBeInTheDocument();
    expect(screen.queryByText("正在登记上传文件")).not.toBeInTheDocument();
    expect(screen.queryByText("上传登记失败")).not.toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(2);
  });

  it("queues only one additional shot refresh while a silent refresh is already in flight", async () => {
    window.history.pushState({}, "", "/?shotId=shot-sse-queued");
    let resolveFirstRefresh: ((value: ReturnType<typeof createShotWorkbench>) => void) | undefined;
    let resolveFirstWorkflowRefresh:
      | ((value: ReturnType<typeof createShotWorkflowPanel>) => void)
      | undefined;
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-sse-queued", "candidate_ready", "pending"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    loadShotWorkbenchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstRefresh = resolve as typeof resolveFirstRefresh;
        }) as never,
    );
    loadShotWorkflowPanelMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstWorkflowRefresh = resolve as typeof resolveFirstWorkflowRefresh;
        }) as never,
    );
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-sse-queued", "submitted_for_review", "approved"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("failed", "workflow-run-2"));

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-sse-queued")).toBeInTheDocument();
    await waitFor(() => {
      expect(subscribeWorkbenchEventsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      latestWorkbenchSubscription?.onRefreshNeeded();
      latestWorkbenchSubscription?.onRefreshNeeded();
      latestWorkbenchSubscription?.onRefreshNeeded();
    });

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveFirstRefresh?.(createShotWorkbench("shot-sse-queued", "candidate_ready", "pending"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(loadShotWorkflowPanelMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveFirstWorkflowRefresh?.(createShotWorkflowPanel("running"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(3);
    });
  });

  it("switches locale, persists it, and renders english shot feedback", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-4");
    loadShotWorkbenchMock.mockResolvedValueOnce(createShotWorkbench("shot-live-4"));
    loadShotReviewTimelineMock.mockResolvedValueOnce(
      createShotReviewTimeline("shot-live-4", "pending", "pending"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    loadShotWorkbenchMock.mockResolvedValueOnce(createShotWorkbench("shot-live-4"));
    loadShotReviewTimelineMock.mockResolvedValueOnce(
      createShotReviewTimeline("shot-live-4", "pending", "pending"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-live-4", "candidate_ready", "passed"),
    );
    loadShotReviewTimelineMock.mockResolvedValueOnce(
      createShotReviewTimeline("shot-live-4", "passed", "passed"),
    );
    loadShotWorkflowPanelMock.mockResolvedValueOnce(createShotWorkflowPanel("running"));
    runSubmissionGateChecksMock.mockResolvedValue({
      passedChecks: ["asset_selected"],
      failedChecks: ["copyright_missing"],
    });

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-live-4")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ui-locale-select"), {
      target: { value: "en-US" },
    });

    expect(window.localStorage.getItem(CREATOR_UI_LOCALE_STORAGE_KEY)).toBe("en-US");
    expect(await screen.findByRole("button", { name: "Run Gate Checks" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run Gate Checks" }));

    expect(await screen.findByText("Gate checks completed")).toBeInTheDocument();
    expect(screen.getByText("Passed checks")).toBeInTheDocument();
  });

  it("starts a shot workflow, refreshes the panel, and shows workflow feedback", async () => {
    window.history.pushState({}, "", "/?shotId=shot-workflow-start");
    loadShotWorkbenchMock
      .mockResolvedValueOnce(createShotWorkbench("shot-live-1"))
      .mockResolvedValueOnce(createShotWorkbench("shot-live-1"));
    loadShotWorkflowPanelMock
      .mockResolvedValueOnce({ latestWorkflowRun: undefined })
      .mockResolvedValueOnce(createShotWorkflowPanel("running", "workflow-run-2"));

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-live-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "发起工作流" }));

    await waitFor(() => {
      expect(startShotWorkflowMock).toHaveBeenCalledWith({
        orgId: "org-1",
        projectId: "project-1",
        shotExecutionId: "shot-exec-shot-live-1",
        workflowType: "shot_pipeline",
        userId: undefined,
      });
    });

    expect(await screen.findByText("工作流已发起")).toBeInTheDocument();
    expect(screen.getByText(/workflow-run-2/)).toBeInTheDocument();
  });

  it("retries a failed workflow run and refreshes the panel", async () => {
    window.history.pushState({}, "", "/?shotId=shot-workflow-retry");
    loadShotWorkbenchMock
      .mockResolvedValueOnce(createShotWorkbench("shot-live-1"))
      .mockResolvedValueOnce(createShotWorkbench("shot-live-1"));
    loadShotWorkflowPanelMock
      .mockResolvedValueOnce(createShotWorkflowPanel("failed", "workflow-run-failed"))
      .mockResolvedValueOnce(createShotWorkflowPanel("running", "workflow-run-failed"));

    render(<App />);

    expect(await screen.findByText(/workflow-run-failed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));

    await waitFor(() => {
      expect(retryShotWorkflowRunMock).toHaveBeenCalledWith({
        workflowRunId: "workflow-run-failed",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(await screen.findByText("工作流已重试")).toBeInTheDocument();
    expect(screen.getByText(/当前状态：running/)).toBeInTheDocument();
  });

  it("falls back to the action-specific workflow error when retry rejects with an opaque value", async () => {
    window.history.pushState({}, "", "/?shotId=shot-workflow-retry-opaque");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-live-opaque"));
    loadShotWorkflowPanelMock.mockResolvedValue(
      createShotWorkflowPanel("failed", "workflow-run-opaque"),
    );
    retryShotWorkflowRunMock.mockRejectedValue(undefined);

    render(<App />);

    expect(await screen.findByText(/workflow-run-opaque/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));

    expect(
      await screen.findByText("工作流重试失败：creator: unknown workflow retry error"),
    ).toBeInTheDocument();
  });
});
