import { render, screen } from "@testing-library/react";
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
});
