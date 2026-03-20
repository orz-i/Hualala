import { fireEvent, render, screen } from "@testing-library/react";
import { ImportBatchWorkbenchPage } from "./ImportBatchWorkbenchPage";

describe("ImportBatchWorkbenchPage", () => {
  it("renders import batch status, upload progress, candidate count, and shot execution state", () => {
    render(
      <ImportBatchWorkbenchPage
        workbench={{
          importBatch: {
            id: "batch-1",
            status: "matched_pending_confirm",
            sourceType: "upload_session",
          },
          uploadSessions: [{ id: "upload-session-1", status: "completed" }],
          items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
        }}
      />,
    );

    expect(screen.getByText("batch-1")).toBeInTheDocument();
    expect(screen.getByText("matched_pending_confirm")).toBeInTheDocument();
    expect(screen.getByText("1 个上传会话")).toBeInTheDocument();
    expect(screen.getByText("1 个候选素材")).toBeInTheDocument();
    expect(screen.getByText("candidate_ready")).toBeInTheDocument();
  });

  it("emits confirm and primary asset actions with the current workbench ids", () => {
    const onConfirmMatches = vi.fn();
    const onSelectPrimaryAsset = vi.fn();

    render(
      <ImportBatchWorkbenchPage
        workbench={{
          importBatch: {
            id: "batch-1",
            status: "matched_pending_confirm",
            sourceType: "upload_session",
          },
          uploadSessions: [{ id: "upload-session-1", status: "completed" }],
          items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
        }}
        onConfirmMatches={onConfirmMatches}
        onSelectPrimaryAsset={onSelectPrimaryAsset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认匹配" }));
    fireEvent.click(screen.getByRole("button", { name: "设为主素材" }));

    expect(onConfirmMatches).toHaveBeenCalledWith({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
    });
    expect(onSelectPrimaryAsset).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
    });
  });

  it("renders success and error feedback messages when provided", () => {
    const { rerender } = render(
      <ImportBatchWorkbenchPage
        workbench={{
          importBatch: {
            id: "batch-1",
            status: "matched_pending_confirm",
            sourceType: "upload_session",
          },
          uploadSessions: [{ id: "upload-session-1", status: "completed" }],
          items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
        }}
        feedback={{
          tone: "success",
          message: "匹配确认已完成",
          latestImportBatchStatus: "confirmed",
          latestShotExecutionStatus: "primary_selected",
          latestPrimaryAssetId: "asset-1",
        }}
      />,
    );

    expect(screen.getByText("匹配确认已完成")).toBeInTheDocument();
    expect(screen.getByText("当前批次状态：confirmed")).toBeInTheDocument();
    expect(screen.getByText("当前执行状态：primary_selected")).toBeInTheDocument();
    expect(screen.getByText("当前主素材：asset-1")).toHaveStyle({ color: "#115e59" });

    rerender(
      <ImportBatchWorkbenchPage
        workbench={{
          importBatch: {
            id: "batch-1",
            status: "matched_pending_confirm",
            sourceType: "upload_session",
          },
          uploadSessions: [{ id: "upload-session-1", status: "completed" }],
          items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
          candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
          shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
        }}
        feedback={{
          tone: "error",
          message: "主素材选择失败：network down",
        }}
      />,
    );

    expect(screen.getByText("主素材选择失败：network down")).toHaveStyle({
      color: "#991b1b",
    });
  });
});
