import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { ImportBatchWorkbenchPage } from "./ImportBatchWorkbenchPage";

describe("ImportBatchWorkbenchPage", () => {
  const workbench = {
    importBatch: {
      id: "batch-1",
      orgId: "org-1",
      projectId: "project-1",
      status: "matched_pending_confirm",
      sourceType: "upload_session",
    },
    uploadSessions: [
      {
        id: "upload-session-1",
        fileName: "scene.png",
        checksum: "sha256:abc",
        sizeBytes: 1024,
        retryCount: 0,
        status: "completed",
        resumeHint: "",
      },
    ],
    items: [{ id: "item-1", status: "matched_pending_confirm", assetId: "asset-1" }],
    candidateAssets: [{ id: "candidate-1", assetId: "asset-1" }],
    shotExecutions: [{ id: "shot-exec-1", status: "candidate_ready", primaryAssetId: "" }],
  };

  it("renders import batch status, upload progress, candidate count, and shot execution state", () => {
    render(
      <ImportBatchWorkbenchPage
        workbench={workbench}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("batch-1")).toBeInTheDocument();
    expect(screen.getByText(/matched_pending_confirm/)).toBeInTheDocument();
    expect(screen.getByText("1 个上传会话")).toBeInTheDocument();
    expect(screen.getByText("1 个候选素材")).toBeInTheDocument();
    expect(screen.getByText("candidate_ready")).toBeInTheDocument();
  });

  it("emits confirm and primary asset actions with the current workbench ids", () => {
    const onConfirmMatches = vi.fn();
    const onSelectPrimaryAsset = vi.fn();

    render(
      <ImportBatchWorkbenchPage
        workbench={workbench}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
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
        workbench={workbench}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        feedback={{
          tone: "success",
          message: "匹配确认已完成",
          sections: [
            { label: "当前批次状态", items: "confirmed" },
            { label: "当前执行状态", items: "primary_selected" },
            { label: "当前主素材", items: "asset-1" },
          ],
        }}
      />,
    );

    expect(screen.getByText("匹配确认已完成")).toBeInTheDocument();
    expect(screen.getByText("当前批次状态：confirmed")).toBeInTheDocument();
    expect(screen.getByText("当前执行状态：primary_selected")).toBeInTheDocument();
    expect(screen.getByText("当前主素材：asset-1")).toHaveStyle({ color: "#115e59" });

    rerender(
      <ImportBatchWorkbenchPage
        workbench={workbench}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
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

  it("renders upload registration controls and wires file selection plus expired retry", () => {
    const onChooseUploadFile = vi.fn();
    const onRegisterSelectedUpload = vi.fn();
    const onRetryUploadSession = vi.fn();
    const expiredWorkbench = {
      ...workbench,
      uploadSessions: [
        {
          id: "upload-session-1",
          fileName: "scene.png",
          checksum: "sha256:abc",
          sizeBytes: 1024,
          retryCount: 0,
          status: "completed",
          resumeHint: "",
        },
        {
          id: "upload-session-2",
          fileName: "expired.png",
          checksum: "sha256:def",
          sizeBytes: 2048,
          retryCount: 1,
          status: "expired",
          resumeHint: "resume expired.png",
        },
      ],
    };

    render(
      <ImportBatchWorkbenchPage
        workbench={expiredWorkbench}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        {...({
          selectedUploadFile: {
            fileName: "scene.png",
            sizeBytes: 1024,
            mimeType: "image/png",
            width: 1920,
            height: 1080,
            checksum: "sha256:abc",
          },
          onChooseUploadFile,
          onRegisterSelectedUpload,
          onRetryUploadSession,
        } as any)}
      />,
    );

    const fileInput = screen.getByLabelText("选择本地文件");
    const file = new File(["demo"], "scene.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onChooseUploadFile).toHaveBeenCalledWith(file);
    expect(screen.getByText("文件名：scene.png")).toBeInTheDocument();
    expect(screen.getByText("尺寸：1920×1080")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "登记上传文件" }));
    expect(onRegisterSelectedUpload).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "重试最近过期会话" }));
    expect(onRetryUploadSession).toHaveBeenCalledWith("upload-session-2");
  });

  it("switches locale and renders english import labels", () => {
    const onLocaleChange = vi.fn();

    render(
      <ImportBatchWorkbenchPage
        workbench={workbench}
        locale="en-US"
        t={createTranslator("en-US")}
        onLocaleChange={onLocaleChange}
      />,
    );

    expect(screen.getByText("Import Workbench")).toBeInTheDocument();
    expect(screen.getByText("Upload Sessions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm matches" })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ui-locale-select"), {
      target: { value: "zh-CN" },
    });

    expect(onLocaleChange).toHaveBeenCalledWith("zh-CN");
  });
});
