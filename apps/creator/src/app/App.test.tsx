import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CREATOR_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { loadImportBatchSummaries } from "../features/home/loadImportBatchSummaries";
import { CREATOR_HOME_PROJECT_ID_STORAGE_KEY } from "../features/home/projectIdMemory";
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
import { useAudioWorkbenchController } from "../features/audio/useAudioWorkbenchController";
import { usePreviewWorkbenchController } from "../features/preview/usePreviewWorkbenchController";
import { useAssetReusePicker } from "../features/reuse/useAssetReusePicker";
import { loadAssetProvenanceDetails } from "../features/shared/loadAssetProvenanceDetails";
import { subscribeWorkbenchEvents } from "../features/subscribeWorkbenchEvents";
import { App } from "./App";

const {
  useAssetReusePickerMock,
  useAudioWorkbenchControllerMock,
  useCollabControllerMock,
  usePreviewWorkbenchControllerMock,
} = vi.hoisted(() => ({
  useAssetReusePickerMock: vi.fn(),
  useAudioWorkbenchControllerMock: vi.fn(),
  useCollabControllerMock: vi.fn(),
  usePreviewWorkbenchControllerMock: vi.fn(),
}));

vi.mock("../features/shot-workbench/loadShotWorkbench", () => ({
  loadShotWorkbench: vi.fn(),
}));
vi.mock("../features/shot-workbench/loadShotReviewTimeline", () => ({
  loadShotReviewTimeline: vi.fn(),
}));
vi.mock("../features/shot-workbench/loadShotWorkflowPanel", () => ({
  loadShotWorkflowPanel: vi.fn(),
}));
vi.mock("../features/home/loadImportBatchSummaries", () => ({
  loadImportBatchSummaries: vi.fn(),
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
vi.mock("../features/shared/loadAssetProvenanceDetails", () => ({
  loadAssetProvenanceDetails: vi.fn(),
}));
vi.mock("../features/subscribeWorkbenchEvents", () => ({
  subscribeWorkbenchEvents: vi.fn(),
}));
vi.mock("../features/collaboration/useCollabController", () => ({
  useCollabController: useCollabControllerMock,
}));
vi.mock("../features/audio/useAudioWorkbenchController", () => ({
  useAudioWorkbenchController: useAudioWorkbenchControllerMock,
}));
vi.mock("../features/preview/usePreviewWorkbenchController", () => ({
  usePreviewWorkbenchController: usePreviewWorkbenchControllerMock,
}));
vi.mock("../features/reuse/useAssetReusePicker", () => ({
  useAssetReusePicker: useAssetReusePickerMock,
}));

let lastCollabWorkbenchPageProps: Record<string, unknown> | null = null;
let lastAudioWorkbenchPageProps: Record<string, unknown> | null = null;
let lastPreviewWorkbenchPageProps: Record<string, unknown> | null = null;
let lastAssetReusePageProps: Record<string, unknown> | null = null;

vi.mock("../features/collaboration/CollabWorkbenchPage", () => ({
  CollabWorkbenchPage: (props: Record<string, unknown>) => {
    lastCollabWorkbenchPageProps = props;
    return <div data-testid="creator-collab-page">creator-collab-page</div>;
  },
}));
vi.mock("../features/audio/AudioWorkbenchPage", () => ({
  AudioWorkbenchPage: (props: Record<string, unknown>) => {
    lastAudioWorkbenchPageProps = props;
    return <div data-testid="creator-audio-page">creator-audio-page</div>;
  },
}));
vi.mock("../features/preview/PreviewWorkbenchPage", () => ({
  PreviewWorkbenchPage: (props: Record<string, unknown>) => {
    lastPreviewWorkbenchPageProps = props;
    return (
      <div data-testid="creator-preview-page">
        creator-preview-page
        <button
          type="button"
          onClick={() => {
            (props.onOpenAudioWorkbench as (() => void) | undefined)?.();
          }}
        >
          creator-preview-open-audio
        </button>
      </div>
    );
  },
}));
vi.mock("../features/reuse/AssetReusePage", () => ({
  AssetReusePage: (props: Record<string, unknown>) => {
    lastAssetReusePageProps = props;
    return (
      <div data-testid="creator-reuse-page">
        <input
          aria-label="creator-reuse-source-input"
          value={(props.sourceProjectIdInput as string) ?? ""}
          onChange={(event) => {
            (props.onSourceProjectIdInputChange as ((value: string) => void) | undefined)?.(
              event.target.value,
            );
          }}
        />
        <button
          type="button"
          onClick={() => {
            (props.onLoadSourceProject as (() => void) | undefined)?.();
          }}
        >
          creator-reuse-load-source
        </button>
        <button
          type="button"
          onClick={() => {
            (props.onBackToShotWorkbench as ((shotId: string) => void) | undefined)?.(
              "shot-reuse-1",
            );
          }}
        >
          creator-reuse-back-shot
        </button>
      </div>
    );
  },
}));

const loadShotWorkbenchMock = vi.mocked(loadShotWorkbench);
const loadShotReviewTimelineMock = vi.mocked(loadShotReviewTimeline);
const loadShotWorkflowPanelMock = vi.mocked(loadShotWorkflowPanel);
const loadImportBatchSummariesMock = vi.mocked(loadImportBatchSummaries);
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
const useAssetReusePickerMocked = vi.mocked(useAssetReusePicker);
const useAudioWorkbenchControllerMocked = vi.mocked(useAudioWorkbenchController);
const usePreviewWorkbenchControllerMocked = vi.mocked(usePreviewWorkbenchController);
const loadAssetProvenanceDetailsMock = vi.mocked(loadAssetProvenanceDetails);
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

function createCollabControllerState() {
  return {
    collaborationSession: {
      session: {
        sessionId: "session-shot-collab-1",
        ownerType: "shot",
        ownerId: "shot-collab-1",
        draftVersion: 4,
        lockHolderUserId: "user-1",
      },
      presences: [],
    },
    feedback: null,
    errorMessage: "",
    claimDraftVersionInput: "4",
    conflictSummaryInput: "",
    setClaimDraftVersionInput: vi.fn(),
    setConflictSummaryInput: vi.fn(),
    handleClaimLease: vi.fn(),
    handleReleaseLease: vi.fn(),
  };
}

function createPreviewControllerState() {
  const buildShotSummary = (shotId: string, shotCode: string, shotTitle: string) => ({
    projectId: "project-preview-1",
    projectTitle: "项目预演",
    episodeId: "episode-preview-1",
    episodeTitle: "第一集",
    sceneId: "scene-preview-1",
    sceneCode: "SCENE-001",
    sceneTitle: "开场",
    shotId,
    shotCode,
    shotTitle,
  });

  return {
    previewWorkbench: {
      assembly: {
        assemblyId: "assembly-project-1",
        projectId: "project-preview-1",
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
          shotSummary: buildShotSummary("shot-preview-1", "SHOT-001", "第一镜"),
          primaryAssetSummary: {
            assetId: "asset-preview-1",
            mediaType: "image",
            rightsStatus: "cleared",
            aiAnnotated: true,
          },
          sourceRunSummary: {
            runId: "run-preview-1",
            status: "completed",
            triggerType: "manual",
          },
        },
      ],
    },
    draftItems: [
      {
        itemId: "item-1",
        assemblyId: "assembly-project-1",
        shotId: "shot-preview-1",
        primaryAssetId: "asset-preview-1",
        sourceRunId: "run-preview-1",
        sequence: 1,
        shotSummary: buildShotSummary("shot-preview-1", "SHOT-001", "第一镜"),
        primaryAssetSummary: {
          assetId: "asset-preview-1",
          mediaType: "image",
          rightsStatus: "cleared",
          aiAnnotated: true,
        },
        sourceRunSummary: {
          runId: "run-preview-1",
          status: "completed",
          triggerType: "manual",
        },
      },
    ],
    feedback: null,
    errorMessage: "",
    audioSummary: {
      trackCount: 3,
      clipCount: 2,
      renderStatus: "queued",
      missingAssetCount: 1,
    },
    audioSummaryErrorMessage: "",
    shotOptions: [
      {
        shotId: "shot-preview-2",
        label: "SCENE-001 / SHOT-002",
        shotExecutionId: "shot-exec-preview-2",
        shotExecutionStatus: "ready",
        shotSummary: buildShotSummary("shot-preview-2", "SHOT-002", "第二镜"),
        currentPrimaryAssetSummary: null,
        latestRunSummary: null,
      },
    ],
    shotOptionsErrorMessage: "",
    previewRuntime: {
      previewRuntimeId: "runtime-project-1",
      projectId: "project-preview-1",
      episodeId: "",
      assemblyId: "assembly-project-1",
      status: "idle",
      renderWorkflowRunId: "",
      renderStatus: "idle",
      playbackAssetId: "",
      exportAssetId: "",
      resolvedLocale: "zh-CN",
      createdAt: "2026-03-24T09:00:00.000Z",
      updatedAt: "2026-03-24T09:05:00.000Z",
    },
    runtimeErrorMessage: "",
    requestRenderDisabledReason: "",
    requestRenderPending: false,
    selectedShotOptionId: "shot-preview-2",
    setSelectedShotOptionId: vi.fn(),
    manualShotIdInput: "",
    setManualShotIdInput: vi.fn(),
    handleAddItemFromChooser: vi.fn(),
    handleAddManualItem: vi.fn(),
    handleRemoveItem: vi.fn(),
    handleMoveItem: vi.fn(),
    handleSaveAssembly: vi.fn(),
    handleRequestPreviewRender: vi.fn(),
    assetProvenanceDetail: null,
    assetProvenancePending: false,
    assetProvenanceErrorMessage: "",
    handleOpenAssetProvenance: vi.fn(),
    handleCloseAssetProvenance: vi.fn(),
  };
}

function createAudioControllerState() {
  return {
    audioWorkbench: {
      timeline: {
        audioTimelineId: "timeline-project-audio-1",
        projectId: "project-audio-1",
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
        missingDurationClipCount: 0,
      },
    },
    draftTracks: [],
    audioAssetPool: [],
    audioAssetPoolErrorMessage: "",
    feedback: null,
    errorMessage: "",
    assetProvenanceDetail: null,
    assetProvenancePending: false,
    assetProvenanceErrorMessage: "",
    handleAddClip: vi.fn(),
    handleRemoveClip: vi.fn(),
    handleMoveClip: vi.fn(),
    handleTrackVolumeChange: vi.fn(),
    handleTrackMutedChange: vi.fn(),
    handleTrackSoloChange: vi.fn(),
    handleClipFieldChange: vi.fn(),
    handleSaveTimeline: vi.fn(),
    handleOpenAssetProvenance: vi.fn(),
    handleCloseAssetProvenance: vi.fn(),
  };
}

function createReuseControllerState() {
  return {
    shotWorkbench: {
      ...createShotWorkbench("shot-reuse-1"),
      shotExecution: {
        ...createShotWorkbench("shot-reuse-1").shotExecution,
        projectId: "project-live-1",
      },
    },
    reusableAssets: [
      {
        assetId: "asset-external-1",
        sourceProjectId: "project-source-9",
        importBatchId: "batch-source-1",
        fileName: "hero-shot.png",
        mediaType: "image",
        sourceType: "upload_session",
        rightsStatus: "clear",
        locale: "zh-CN",
        aiAnnotated: false,
        sourceRunId: "run-source-1",
        mimeType: "image/png",
        allowed: true,
        blockedReason: "",
      },
    ],
    loading: false,
    feedback: null,
    errorMessage: "",
    assetProvenanceDetail: null,
    assetProvenancePending: false,
    assetProvenanceErrorMessage: "",
    handleApplyReuse: vi.fn(),
    handleOpenAssetProvenance: vi.fn(),
    handleCloseAssetProvenance: vi.fn(),
  };
}

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

function createImportBatchSummary(batchId: string, projectId = "project-1", status = "matched_pending_confirm") {
  return {
    id: batchId,
    orgId: "org-1",
    projectId,
    operatorId: "user-1",
    sourceType: "upload_session",
    status,
    uploadSessionCount: 1,
    itemCount: 2,
    confirmedItemCount: status === "confirmed" ? 2 : 0,
    candidateAssetCount: 2,
    mediaAssetCount: 2,
    updatedAt: "2026-03-23T00:00:00Z",
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

function createWorkflowSteps(
  workflowRunId: string,
  status = "running",
  attemptCount = status === "failed" ? 2 : 1,
  lastError = status === "failed" ? "provider rejected request" : "",
) {
  return [
    {
      id: `${workflowRunId}-step-dispatch`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.dispatch`,
      stepOrder: 1,
      status: "completed",
      errorCode: "",
      errorMessage: "",
    },
    {
      id: `${workflowRunId}-step-gateway`,
      workflowRunId,
      stepKey: `attempt_${attemptCount}.gateway`,
      stepOrder: 2,
      status,
      errorCode: status === "failed" ? "provider_error" : "",
      errorMessage: lastError,
    },
  ];
}

function createShotWorkflowPanel(
  status = "running",
  id = "workflow-run-1",
  overrides: Partial<{
    resourceId: string;
    projectId: string;
    provider: string;
    currentStep: string;
    attemptCount: number;
    lastError: string;
    externalRequestId: string;
    workflowSteps: ReturnType<typeof createWorkflowSteps>;
    detailUnavailableMessage: string;
  }> = {},
) {
  const attemptCount = overrides.attemptCount ?? (status === "failed" ? 2 : 1);
  const lastError =
    overrides.lastError ?? (status === "failed" ? "provider rejected request" : "");
  return {
    latestWorkflowRun: {
      id,
      workflowType: "shot_pipeline",
      status,
      resourceId: overrides.resourceId ?? "shot-exec-shot-live-1",
      projectId: overrides.projectId ?? "project-1",
      provider: overrides.provider ?? "seedance",
      currentStep: overrides.currentStep ?? `attempt_${attemptCount}.gateway`,
      attemptCount,
      lastError,
      externalRequestId: overrides.externalRequestId ?? `request-${id}`,
    },
    workflowSteps:
      overrides.workflowSteps ?? createWorkflowSteps(id, status, attemptCount, lastError),
    detailUnavailableMessage: overrides.detailUnavailableMessage,
  };
}

function createAssetProvenanceDetail(assetId: string, sourceRunId = "source-run-1") {
  return {
    asset: {
      id: assetId,
      projectId: "project-1",
      sourceType: "upload_session",
      rightsStatus: "clear",
      importBatchId: "batch-1",
      locale: "zh-CN",
      aiAnnotated: true,
    },
    provenanceSummary:
      "source_type=upload_session import_batch_id=batch-1 rights_status=clear",
    candidateAssetId: `candidate-${assetId}`,
    shotExecutionId: "shot-exec-1",
    sourceRunId,
    importBatchId: "batch-1",
    variantCount: 2,
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lastCollabWorkbenchPageProps = null;
    lastAudioWorkbenchPageProps = null;
    lastPreviewWorkbenchPageProps = null;
    lastAssetReusePageProps = null;
    latestWorkbenchSubscription = undefined;
    latestWorkbenchSubscriptionCleanup = vi.fn();
    window.history.replaceState({}, "", "/");
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
    useCollabControllerMock.mockReturnValue(createCollabControllerState());
    useAssetReusePickerMocked.mockReturnValue(createReuseControllerState());
    useAudioWorkbenchControllerMocked.mockReturnValue(createAudioControllerState());
    usePreviewWorkbenchControllerMocked.mockReturnValue(createPreviewControllerState());
    loadImportBatchSummariesMock.mockResolvedValue([]);
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("asset-default"),
    );
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

  it("shows creator home when no deep link or remembered project is present", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Creator 首页" })).toBeInTheDocument();
    expect(loadImportBatchSummariesMock).not.toHaveBeenCalled();
    expect(loadShotWorkbenchMock).not.toHaveBeenCalled();
    expect(loadImportBatchWorkbenchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "加载批次" })).toBeDisabled();
  });

  it("renders the collaboration route when pathname is /collab", async () => {
    window.history.pushState(
      {},
      "",
      "/collab?shotId=shot-collab-1&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    expect(await screen.findByTestId("creator-collab-page")).toBeInTheDocument();
    expect(useCollabControllerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        ownerType: "shot",
        ownerId: "shot-collab-1",
        orgId: "org-override-001",
        userId: "user-override-001",
      }),
    );
    expect(lastCollabWorkbenchPageProps).toEqual(
      expect.objectContaining({
        collaborationSession: expect.objectContaining({
          session: expect.objectContaining({
            ownerId: "shot-collab-1",
          }),
        }),
      }),
    );
  });

  it("renders the preview route when pathname is /preview", async () => {
    window.history.pushState(
      {},
      "",
      "/preview?projectId=project-preview-1&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    expect(await screen.findByTestId("creator-preview-page")).toBeInTheDocument();
    expect(usePreviewWorkbenchControllerMocked).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        projectId: "project-preview-1",
        locale: "zh-CN",
        orgId: "org-override-001",
        userId: "user-override-001",
      }),
    );
    expect(lastPreviewWorkbenchPageProps).toEqual(
      expect.objectContaining({
        previewWorkbench: expect.objectContaining({
          assembly: expect.objectContaining({
            projectId: "project-preview-1",
          }),
        }),
      }),
    );
  });

  it("navigates from the preview audio summary card to the audio workbench", async () => {
    window.history.pushState(
      {},
      "",
      "/preview?projectId=project-preview-1&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    expect(await screen.findByTestId("creator-preview-page")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "creator-preview-open-audio" }));

    expect(window.location.pathname).toBe("/audio");
    expect(window.location.search).toContain("projectId=project-preview-1");
    expect(await screen.findByTestId("creator-audio-page")).toBeInTheDocument();
  });

  it("renders the audio route when pathname is /audio", async () => {
    window.history.pushState(
      {},
      "",
      "/audio?projectId=project-audio-1&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    expect(await screen.findByTestId("creator-audio-page")).toBeInTheDocument();
    expect(useAudioWorkbenchControllerMocked).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        projectId: "project-audio-1",
        orgId: "org-override-001",
        userId: "user-override-001",
      }),
    );
    expect(lastAudioWorkbenchPageProps).toEqual(
      expect.objectContaining({
        audioWorkbench: expect.objectContaining({
          timeline: expect.objectContaining({
            projectId: "project-audio-1",
          }),
        }),
      }),
    );
  });

  it("renders the reuse route, preserves deep-link params, and routes back to the shot workbench", async () => {
    window.history.pushState(
      {},
      "",
      "/reuse?projectId=project-live-1&shotId=shot-reuse-1&sourceProjectId=project-source-9&orgId=org-override-001&userId=user-override-001",
    );

    render(<App />);

    expect(await screen.findByTestId("creator-reuse-page")).toBeInTheDocument();
    expect(useAssetReusePickerMocked).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        shotId: "shot-reuse-1",
        sourceProjectId: "project-source-9",
        orgId: "org-override-001",
        userId: "user-override-001",
      }),
    );
    expect(lastAssetReusePageProps).toEqual(
      expect.objectContaining({
        shotWorkbench: expect.objectContaining({
          shotExecution: expect.objectContaining({
            shotId: "shot-reuse-1",
            projectId: "project-live-1",
          }),
        }),
        sourceProjectIdInput: "project-source-9",
      }),
    );

    fireEvent.change(screen.getByLabelText("creator-reuse-source-input"), {
      target: { value: "project-source-8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "creator-reuse-load-source" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/reuse");
      expect(window.location.search).toContain("projectId=project-live-1");
      expect(window.location.search).toContain("shotId=shot-reuse-1");
      expect(window.location.search).toContain("sourceProjectId=project-source-8");
      expect(window.location.search).toContain("orgId=org-override-001");
      expect(window.location.search).toContain("userId=user-override-001");
    });

    fireEvent.click(screen.getByRole("button", { name: "creator-reuse-back-shot" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/shots");
      expect(window.location.search).toContain("shotId=shot-reuse-1");
      expect(window.location.search).not.toContain("sourceProjectId=");
      expect(window.location.search).toContain("orgId=org-override-001");
      expect(window.location.search).toContain("userId=user-override-001");
    });
  });

  it("loads import batches from the projectId query param and remembers it locally", async () => {
    window.history.pushState({}, "", "/?projectId=project-query-1");
    loadImportBatchSummariesMock.mockResolvedValue([
      createImportBatchSummary("batch-query-1", "project-query-1"),
    ]);

    render(<App />);

    await waitFor(() => {
      expect(loadImportBatchSummariesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-query-1",
        }),
      );
    });
    expect(await screen.findByText("batch-query-1")).toBeInTheDocument();
    expect(window.localStorage.getItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY)).toBe(
      "project-query-1",
    );
  });

  it("rehydrates the remembered projectId when the homepage opens without a query", async () => {
    window.localStorage.setItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY, "project-remembered-1");
    loadImportBatchSummariesMock.mockResolvedValue([
      createImportBatchSummary("batch-remembered-1", "project-remembered-1"),
    ]);

    render(<App />);

    await waitFor(() => {
      expect(loadImportBatchSummariesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-remembered-1",
        }),
      );
    });
    expect(await screen.findByDisplayValue("project-remembered-1")).toBeInTheDocument();
    expect(screen.getByText("当前 projectId：project-remembered-1")).toBeInTheDocument();
  });

  it("submits a projectId from the homepage, updates the URL, and persists it locally", async () => {
    loadImportBatchSummariesMock.mockResolvedValue([
      createImportBatchSummary("batch-home-submit", "project-home-submit"),
    ]);

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Creator 首页" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Project ID"), {
      target: { value: "project-home-submit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "加载批次" }));

    await waitFor(() => {
      expect(loadImportBatchSummariesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-home-submit",
        }),
      );
    });
    expect(await screen.findByText("batch-home-submit")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toContain("projectId=project-home-submit");
    expect(window.localStorage.getItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY)).toBe(
      "project-home-submit",
    );
  });

  it("opens the shot workbench from the homepage manual shotId entry", async () => {
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-home-1"));
    loadShotWorkflowPanelMock.mockResolvedValue(
      createShotWorkflowPanel("running", "workflow-run-home-shot", {
        resourceId: "shot-exec-shot-home-1",
      }),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Creator 首页" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Shot ID"), {
      target: { value: "shot-home-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "打开镜头工作台" }));

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          shotId: "shot-home-1",
        }),
      );
    });
    expect(await screen.findByText("shot-exec-shot-home-1")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/shots");
    expect(window.location.search).toContain("shotId=shot-home-1");
    expect(screen.getByRole("button", { name: "返回首页" })).toBeInTheDocument();
  });

  it("opens the import workbench from the homepage batch list action", async () => {
    window.history.pushState({}, "", "/?projectId=project-home-import");
    loadImportBatchSummariesMock.mockResolvedValue([
      createImportBatchSummary("batch-home-import", "project-home-import"),
    ]);
    loadImportBatchWorkbenchMock.mockResolvedValue(
      createImportWorkbench("batch-home-import"),
    );

    render(<App />);

    expect(await screen.findByText("batch-home-import")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入导入工作台" }));

    await waitFor(() => {
      expect(loadImportBatchWorkbenchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          importBatchId: "batch-home-import",
        }),
      );
    });
    expect(await screen.findByRole("button", { name: "确认匹配" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/imports");
    expect(window.location.search).toContain("importBatchId=batch-home-import");
    expect(screen.getByRole("button", { name: "返回首页" })).toBeInTheDocument();
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
    expect(window.location.pathname).toBe("/imports");
    expect(window.location.search).toContain("importBatchId=batch-live-1");
    expect(window.location.search).not.toContain("shotId=shot-live-1");
    expect(screen.getByText("candidate_ready")).toBeInTheDocument();
    const confirmMatchesButton = screen.getByRole("button", { name: "确认匹配" });
    expect(confirmMatchesButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("选择条目 item-batch-live-1-2"));
    await waitFor(() => {
      expect(confirmMatchesButton).toBeEnabled();
    });
    fireEvent.click(confirmMatchesButton);

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
    expect(confirmMatchesButton).toBeDisabled();

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

  it("normalizes a legacy shot deep link to the canonical pathname after load", async () => {
    window.history.pushState({}, "", "/?shotId=shot-legacy-1");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-legacy-1"));
    loadShotReviewTimelineMock.mockResolvedValue(createShotReviewTimeline("shot-legacy-1"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-legacy-1")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/shots");
    expect(window.location.search).toContain("shotId=shot-legacy-1");
  });

  it("returns to the home route from the shot workbench while keeping the remembered project", async () => {
    window.localStorage.setItem(CREATOR_HOME_PROJECT_ID_STORAGE_KEY, "project-home-remembered");
    window.history.pushState({}, "", "/shots?shotId=shot-back-home");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-back-home"));
    loadShotReviewTimelineMock.mockResolvedValue(createShotReviewTimeline("shot-back-home"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());
    loadImportBatchSummariesMock.mockResolvedValue([
      createImportBatchSummary("batch-home-remembered", "project-home-remembered"),
    ]);

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-back-home")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));

    expect(await screen.findByRole("heading", { name: "Creator 首页" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toContain("projectId=project-home-remembered");
    expect(screen.getByText("当前 projectId：project-home-remembered")).toBeInTheDocument();
  });

  it("keeps the current import workbench visible and surfaces an action error when confirm matches fails", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-2");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-2"));
    confirmImportBatchItemsMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("batch-live-2")).toBeInTheDocument();

    const confirmMatchesButton = screen.getByRole("button", { name: "确认匹配" });
    fireEvent.click(screen.getByLabelText("选择条目 item-batch-live-2"));
    await waitFor(() => {
      expect(confirmMatchesButton).toBeEnabled();
    });
    fireEvent.click(confirmMatchesButton);

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

  it("opens import asset provenance lazily, keeps the page stable on failure, and clears dialog state on close", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-provenance");
    loadImportBatchWorkbenchMock.mockResolvedValue(
      createImportWorkbenchWithPool("batch-live-provenance", "confirmed"),
    );
    loadAssetProvenanceDetailsMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        createAssetProvenanceDetail("asset-batch-live-provenance-2", "source-run-batch-2"),
      );

    render(<App />);

    expect(await screen.findByText("batch-live-provenance")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen
          .getByText("候选：candidate-batch-live-provenance-2")
          .closest("article") as HTMLElement,
      ).getByRole("button", { name: "查看来源" }),
    );

    await waitFor(() => {
      expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
        assetId: "asset-batch-live-provenance-2",
        orgId: undefined,
        userId: undefined,
      });
    });

    expect(await screen.findByText("来源详情加载失败：network down")).toBeInTheDocument();
    expect(screen.getByText("batch-live-provenance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭来源详情" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "素材来源详情" })).not.toBeInTheDocument();
    });

    fireEvent.click(
      within(
        screen
          .getByText("候选：candidate-batch-live-provenance-2")
          .closest("article") as HTMLElement,
      ).getByRole("button", { name: "查看来源" }),
    );

    expect(
      await screen.findByText(
        "source_type=upload_session import_batch_id=batch-1 rights_status=clear",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("来源运行 ID：source-run-batch-2")).toBeInTheDocument();
    expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledTimes(2);
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
    expect(screen.getByText("最近一次运行：workflow-run-1")).toBeInTheDocument();
    expect(screen.getByText("工作流提供方：seedance")).toBeInTheDocument();
    expect(screen.getByText("当前步骤：attempt_1.gateway")).toBeInTheDocument();
    expect(screen.getByText("尝试次数：1")).toBeInTheDocument();
    expect(screen.getByText("步骤：attempt_1.dispatch")).toBeInTheDocument();
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
    expect(screen.getByText("最近一次运行：workflow-run-2")).toBeInTheDocument();
    expect(screen.getByText("尝试次数：2")).toBeInTheDocument();
    expect(screen.getByText("最近错误：provider rejected request")).toBeInTheDocument();
    expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(2);
    expect(loadShotReviewTimelineMock).toHaveBeenCalledTimes(2);
    expect(loadShotWorkflowPanelMock).toHaveBeenCalledTimes(2);
  });

  it("opens shot asset provenance lazily and clears the dialog state after close", async () => {
    window.history.pushState({}, "", "/?shotId=shot-provenance");
    loadShotWorkbenchMock.mockResolvedValue(
      createShotWorkbenchWithPool("shot-provenance", "candidate_ready", "approved"),
    );
    loadShotReviewTimelineMock.mockResolvedValue(createShotReviewTimeline("shot-provenance"));
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("asset-shot-provenance-2", "source-run-shot-2"),
    );

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-provenance")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen
          .getByText("候选：candidate-shot-provenance-2")
          .closest("article") as HTMLElement,
      ).getByRole("button", { name: "查看来源" }),
    );

    await waitFor(() => {
      expect(loadAssetProvenanceDetailsMock).toHaveBeenCalledWith({
        assetId: "asset-shot-provenance-2",
        orgId: undefined,
        userId: undefined,
      });
    });

    const provenanceDialog = await screen.findByRole("dialog", { name: "素材来源详情" });
    expect(provenanceDialog).toBeInTheDocument();
    expect(await within(provenanceDialog).findByText("asset-shot-provenance-2")).toBeInTheDocument();
    expect(
      await within(provenanceDialog).findByText("来源运行 ID：source-run-shot-2"),
    ).toBeInTheDocument();
    expect(screen.getByText("shot-exec-shot-provenance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭来源详情" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "素材来源详情" })).not.toBeInTheDocument();
    });
  });

  it("commits shot provenance results under React StrictMode", async () => {
    window.history.pushState({}, "", "/?shotId=shot-provenance-strict");
    loadShotWorkbenchMock.mockResolvedValue(
      createShotWorkbenchWithPool("shot-provenance-strict", "candidate_ready", "approved"),
    );
    loadShotReviewTimelineMock.mockResolvedValue(
      createShotReviewTimeline("shot-provenance-strict"),
    );
    loadShotWorkflowPanelMock.mockResolvedValue(createShotWorkflowPanel());
    loadAssetProvenanceDetailsMock.mockResolvedValue(
      createAssetProvenanceDetail("asset-shot-provenance-strict-2", "source-run-shot-strict-2"),
    );

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await screen.findByText("shot-exec-shot-provenance-strict")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen
          .getByText("候选：candidate-shot-provenance-strict-2")
          .closest("article") as HTMLElement,
      ).getByRole("button", { name: "查看来源" }),
    );

    expect(
      await screen.findByText(
        "source_type=upload_session import_batch_id=batch-1 rights_status=clear",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("来源运行 ID：source-run-shot-strict-2"),
    ).toBeInTheDocument();
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
    expect(screen.getByText("最近一次运行：workflow-run-2")).toBeInTheDocument();
    expect(screen.getByText("当前步骤：attempt_2.gateway")).toBeInTheDocument();
    expect(screen.getByText("步骤：attempt_2.dispatch")).toBeInTheDocument();
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

  it("keeps the shot workbench visible when workflow details are unavailable", async () => {
    window.history.pushState({}, "", "/?shotId=shot-workflow-unavailable");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-workflow-unavailable"));
    loadShotReviewTimelineMock.mockResolvedValue(
      createShotReviewTimeline("shot-workflow-unavailable"),
    );
    loadShotWorkflowPanelMock.mockResolvedValue(
      createShotWorkflowPanel("failed", "workflow-run-unavailable", {
        workflowSteps: [],
        detailUnavailableMessage: "工作流详情暂不可用",
      }),
    );

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-workflow-unavailable")).toBeInTheDocument();
    expect(screen.getByText("工作流详情暂不可用")).toBeInTheDocument();
    expect(screen.getByText("最近一次运行：workflow-run-unavailable")).toBeInTheDocument();
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
      .mockResolvedValueOnce({ latestWorkflowRun: undefined, workflowSteps: [] })
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
    expect(screen.getByText("最近一次运行：workflow-run-2")).toBeInTheDocument();
    expect(screen.getByText("当前步骤：attempt_1.gateway")).toBeInTheDocument();
    expect(screen.getByText("尝试次数：1")).toBeInTheDocument();
    expect(screen.getByText("步骤：attempt_1.dispatch")).toBeInTheDocument();
  });

  it("retries a failed workflow run and refreshes the panel", async () => {
    window.history.pushState({}, "", "/?shotId=shot-workflow-retry");
    loadShotWorkbenchMock
      .mockResolvedValueOnce(createShotWorkbench("shot-live-1"))
      .mockResolvedValueOnce(createShotWorkbench("shot-live-1"));
    loadShotWorkflowPanelMock
      .mockResolvedValueOnce(createShotWorkflowPanel("failed", "workflow-run-failed"))
      .mockResolvedValueOnce(
        createShotWorkflowPanel("running", "workflow-run-failed", {
          attemptCount: 3,
          lastError: "",
        }),
      );

    render(<App />);

    expect(await screen.findByText("最近一次运行：workflow-run-failed")).toBeInTheDocument();

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
    expect(screen.getByText("尝试次数：3")).toBeInTheDocument();
    expect(screen.getByText("最近错误：无")).toBeInTheDocument();
    expect(screen.getByText("步骤：attempt_3.gateway")).toBeInTheDocument();
  });

  it("falls back to the action-specific workflow error when retry rejects with an opaque value", async () => {
    window.history.pushState({}, "", "/?shotId=shot-workflow-retry-opaque");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-live-opaque"));
    loadShotWorkflowPanelMock.mockResolvedValue(
      createShotWorkflowPanel("failed", "workflow-run-opaque"),
    );
    retryShotWorkflowRunMock.mockRejectedValue(undefined);

    render(<App />);

    expect(await screen.findByText("最近一次运行：workflow-run-opaque")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试工作流" }));

    expect(
      await screen.findByText("工作流重试失败：creator: unknown workflow retry error"),
    ).toBeInTheDocument();
  });
});
