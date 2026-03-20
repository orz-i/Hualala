import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CREATOR_UI_LOCALE_STORAGE_KEY } from "../i18n";
import { loadImportBatchWorkbench } from "../features/import-batches/loadImportBatchWorkbench";
import {
  confirmImportBatchItems,
  selectPrimaryAssetForImportBatch,
} from "../features/import-batches/mutateImportBatchWorkbench";
import { loadShotWorkbench } from "../features/shot-workbench/loadShotWorkbench";
import {
  runSubmissionGateChecks,
  submitShotForReview,
} from "../features/shot-workbench/mutateShotWorkbench";
import { App } from "./App";

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

function createImportWorkbench(batchId: string, status = "matched_pending_confirm") {
  return {
    importBatch: {
      id: batchId,
      status,
      sourceType: "upload_session",
    },
    uploadSessions: [{ id: `upload-session-${batchId}`, status: "completed" }],
    items: [{ id: `item-${batchId}`, status, assetId: `asset-${batchId}` }],
    candidateAssets: [{ id: `candidate-${batchId}`, assetId: `asset-${batchId}` }],
    shotExecutions: [
      {
        id: `shot-exec-${batchId}`,
        status: status === "matched_pending_confirm" ? "candidate_ready" : "primary_selected",
        primaryAssetId: status === "matched_pending_confirm" ? "" : `asset-${batchId}`,
      },
    ],
  };
}

function createShotWorkbench(shotId: string, status = "candidate_ready", conclusion = "pending") {
  return {
    shotExecution: {
      id: `shot-exec-${shotId}`,
      shotId,
      status,
      primaryAssetId: `asset-${shotId}`,
    },
    candidateAssets: [{ id: `candidate-${shotId}`, assetId: `asset-${shotId}` }],
    reviewSummary: {
      latestConclusion: conclusion,
    },
    latestEvaluationRun: {
      id: `eval-${shotId}`,
      status: conclusion === "pending" ? "pending" : "passed",
    },
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(CREATOR_UI_LOCALE_STORAGE_KEY, "zh-CN");
  });

  it("prefers importBatchId from search params, loads the import workbench, and renders the live data", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-1&shotId=shot-live-1");
    loadImportBatchWorkbenchMock.mockResolvedValueOnce(createImportWorkbench("batch-live-1"));
    loadImportBatchWorkbenchMock.mockResolvedValueOnce(createImportWorkbench("batch-live-1", "confirmed"));
    loadImportBatchWorkbenchMock.mockResolvedValueOnce(createImportWorkbench("batch-live-1", "confirmed"));
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
        itemIds: ["item-batch-live-1"],
      });
    });
    expect(await screen.findByText("匹配确认已完成")).toBeInTheDocument();
    expect(screen.getByText("当前批次状态：confirmed")).toBeInTheDocument();
    expect(screen.getByText("当前执行状态：primary_selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "设为主素材" }));

    await waitFor(() => {
      expect(selectPrimaryAssetForImportBatchMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-batch-live-1",
        assetId: "asset-batch-live-1",
      });
    });

    await waitFor(() => {
      expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText("主素材选择已完成")).toBeInTheDocument();
    expect(screen.getByText("当前主素材：asset-batch-live-1")).toBeInTheDocument();
  });

  it("keeps the current import workbench visible and surfaces an action error when confirm matches fails", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-2");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-2"));
    confirmImportBatchItemsMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("batch-live-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认匹配" }));

    expect(await screen.findByText("匹配确认失败：network down")).toBeInTheDocument();
    expect(screen.getByText("batch-live-2")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the current import workbench visible and surfaces an action error when select primary asset fails", async () => {
    window.history.pushState({}, "", "/?importBatchId=batch-live-3");
    loadImportBatchWorkbenchMock.mockResolvedValue(createImportWorkbench("batch-live-3", "confirmed"));
    selectPrimaryAssetForImportBatchMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("batch-live-3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "设为主素材" }));

    expect(await screen.findByText("主素材选择失败：network down")).toBeInTheDocument();
    expect(screen.getByText("batch-live-3")).toBeInTheDocument();
    expect(loadImportBatchWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("reads shotId from search params, loads the workbench, and renders the live data", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-1");
    loadShotWorkbenchMock.mockResolvedValueOnce(createShotWorkbench("shot-live-1"));
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-live-1", "candidate_ready", "passed"),
    );
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-live-1", "submitted_for_review", "approved"),
    );
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

    expect(await screen.findByText("shot-exec-shot-live-1")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "提交评审" }));

    await waitFor(() => {
      expect(submitShotForReviewMock).toHaveBeenCalledWith({
        shotExecutionId: "shot-exec-shot-live-1",
      });
    });

    expect(await screen.findByText("提交评审已完成")).toBeInTheDocument();
    expect(screen.getByText("最新评审结论：approved")).toBeInTheDocument();

    await waitFor(() => {
      expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(3);
    });

    expect(await screen.findByText(/submitted_for_review/)).toBeInTheDocument();
  });

  it("keeps the current shot workbench visible and surfaces an action error when gate checks fail", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-2");
    loadShotWorkbenchMock.mockResolvedValue(createShotWorkbench("shot-live-2"));
    runSubmissionGateChecksMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    expect(await screen.findByText("shot-exec-shot-live-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gate 检查" }));

    expect(await screen.findByText("Gate 检查失败：network down")).toBeInTheDocument();
    expect(screen.getByText("shot-exec-shot-live-2")).toBeInTheDocument();
    expect(loadShotWorkbenchMock).toHaveBeenCalledTimes(1);
  });

  it("switches locale, persists it, and renders english shot feedback", async () => {
    window.history.pushState({}, "", "/?shotId=shot-live-4");
    loadShotWorkbenchMock.mockResolvedValueOnce(createShotWorkbench("shot-live-4"));
    loadShotWorkbenchMock.mockResolvedValueOnce(
      createShotWorkbench("shot-live-4", "candidate_ready", "passed"),
    );
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
});
