import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";
import { loadImportBatchWorkbench } from "../features/import-batches/loadImportBatchWorkbench";
import {
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../features/import-batches/mutateImportBatchWorkbench";
import {
  runSubmissionGateChecks,
  submitShotForReview,
} from "../features/shot-workbench/mutateShotWorkbench";

vi.mock("../features/shot-workbench/loadShotWorkbench", () => ({
  loadShotWorkbench: vi.fn(),
}));
vi.mock("../features/import-batches/loadImportBatchWorkbench", () => ({
  loadImportBatchWorkbench: vi.fn(),
}));
vi.mock("../features/import-batches/mutateImportBatchWorkbench", () => ({
  confirmImportBatchItems: vi.fn(),
  selectPrimaryAssetForImportBatch: vi.fn(),
}));
vi.mock("../features/shot-workbench/mutateShotWorkbench", () => ({
  runSubmissionGateChecks: vi.fn(),
  submitShotForReview: vi.fn(),
}));

const loadShotWorkbenchMock = vi.mocked(loadShotWorkbench);
const loadImportBatchWorkbenchMock = vi.mocked(loadImportBatchWorkbench);
const confirmImportBatchItemsMock = vi.mocked(confirmImportBatchItems);
const selectPrimaryAssetForImportBatchMock = vi.mocked(selectPrimaryAssetForImportBatch);
const runSubmissionGateChecksMock = vi.mocked(runSubmissionGateChecks);
const submitShotForReviewMock = vi.mocked(submitShotForReview);

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prefers importBatchId from search params, loads the import workbench, and renders the live data", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-1&shotId=shot-live-1");
    loadImportBatchWorkbenchMock.mockResolvedValueOnce({
      importBatch: {
        id: "batch-live-1",
        status: "matched_pending_confirm",
        sourceType: "upload_session",
      },
      uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
      items: [{ id: "item-live-1", status: "matched_pending_confirm", assetId: "asset-live-1" }],
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      shotExecutions: [{ id: "shot-exec-live-1", status: "candidate_ready", primaryAssetId: "" }],
    });
    loadImportBatchWorkbenchMock.mockResolvedValueOnce({
      importBatch: {
        id: "batch-live-1",
        status: "confirmed",
        sourceType: "upload_session",
      },
      uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
      items: [{ id: "item-live-1", status: "confirmed", assetId: "asset-live-1" }],
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      shotExecutions: [
        { id: "shot-exec-live-1", status: "primary_selected", primaryAssetId: "asset-live-1" },
      ],
    });
    loadImportBatchWorkbenchMock.mockResolvedValueOnce({
      importBatch: {
        id: "batch-live-1",
        status: "confirmed",
        sourceType: "upload_session",
      },
      uploadSessions: [{ id: "upload-session-live-1", status: "completed" }],
      items: [{ id: "item-live-1", status: "confirmed", assetId: "asset-live-1" }],
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      shotExecutions: [
        { id: "shot-exec-live-1", status: "primary_selected", primaryAssetId: "asset-live-1" },
      ],
    });
    confirmImportBatchItemsMock.mockResolvedValue(undefined);
    selectPrimaryAssetForImportBatchMock.mockResolvedValue(undefined);

    render(<App />);

    expect(screen.getByText("正在加载导入工作台")).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole("button", { name: "确认匹配" }));

    await waitFor(() => {
      expect(confirmImportBatchItemsMock).toHaveBeenCalledWith({
        importBatchId: "batch-live-1",
        itemIds: ["item-live-1"],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "设为主素材" }));

    await waitFor(() => {
      expect(selectPrimaryAssetForImportBatchMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-live-1",
        assetId: "asset-live-1",
      });
    });

    await waitFor(() => {
      expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(3);
    });
    expect(await screen.findByText("confirmed")).toBeInTheDocument();
  });

  it("reads shotId from search params, loads the workbench, and renders the live data", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-1");
    loadShotWorkbenchMock.mockResolvedValueOnce({
      shotExecution: {
        id: "shot-exec-live-1",
        shotId: "shot-live-1",
        status: "candidate_ready",
        primaryAssetId: "asset-live-1",
      },
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      reviewSummary: {
        latestConclusion: "pending",
      },
      latestEvaluationRun: {
        id: "eval-live-1",
        status: "pending",
      },
    });
    loadShotWorkbenchMock.mockResolvedValueOnce({
      shotExecution: {
        id: "shot-exec-live-1",
        shotId: "shot-live-1",
        status: "candidate_ready",
        primaryAssetId: "asset-live-1",
      },
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      reviewSummary: {
        latestConclusion: "passed",
      },
      latestEvaluationRun: {
        id: "eval-live-1",
        status: "passed",
      },
    });
    loadShotWorkbenchMock.mockResolvedValueOnce({
      shotExecution: {
        id: "shot-exec-live-1",
        shotId: "shot-live-1",
        status: "submitted_for_review",
        primaryAssetId: "asset-live-1",
      },
      candidateAssets: [{ id: "candidate-live-1", assetId: "asset-live-1" }],
      reviewSummary: {
        latestConclusion: "approved",
      },
      latestEvaluationRun: {
        id: "eval-live-1",
        status: "passed",
      },
    });
    runSubmissionGateChecksMock.mockResolvedValue({
      passedChecks: ["asset_selected", "review_ready"],
      failedChecks: ["copyright_missing"],
    });
    submitShotForReviewMock.mockResolvedValue(undefined);

    render(<App />);

    expect(screen.getByText("正在加载镜头工作台")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          shotId: "shot-live-1",
        }),
      );
    });

    expect(await screen.findByText("shot-exec-live-1")).toBeInTheDocument();
    expect(screen.getAllByText("pending")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));

    await waitFor(() => {
      expect(runSubmissionGateChecksMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-live-1",
      });
    });

    expect(await screen.findByText("Gate 检查已完成")).toBeInTheDocument();
    expect(screen.getByText("asset_selected")).toBeInTheDocument();
    expect(screen.getByText("review_ready")).toBeInTheDocument();
    expect(screen.getByText("copyright_missing")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("passed")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "提交评审" }));

    await waitFor(() => {
      expect(submitShotForReviewMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-live-1",
      });
    });

    expect(await screen.findByText("提交评审已完成")).toBeInTheDocument();
    expect(screen.getByText("最新评审结论：approved")).toBeInTheDocument();
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(3);
    });

    expect(await screen.findByText("submitted_for_review")).toBeInTheDocument();
  });

  it("keeps the current shot workbench visible and surfaces an action error when gate checks fail", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-2");
    loadShotWorkbenchMock.mockResolvedValue({
      shotExecution: {
        id: "shot-exec-live-2",
        shotId: "shot-live-2",
        status: "candidate_ready",
        primaryAssetId: "asset-live-2",
      },
      candidateAssets: [{ id: "candidate-live-2", assetId: "asset-live-2" }],
      reviewSummary: {
        latestConclusion: "pending",
      },
      latestEvaluationRun: {
        id: "eval-live-2",
        status: "pending",
      },
    });
    runSubmissionGateChecksMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("shot-exec-live-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));

    expect(await screen.findByText("Gate 检查失败：network down")).toBeInTheDocument();
    expect(screen.getByText("shot-exec-live-2")).toBeInTheDocument();
    expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(1);
  });
});
