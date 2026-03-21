import { createAssetClient, createExecutionClient, createUploadClient } from "@hualala/sdk";
import * as mutateImportBatchWorkbench from "./mutateImportBatchWorkbench";

vi.mock("@hualala/sdk", () => ({
  createAssetClient: vi.fn(),
  createExecutionClient: vi.fn(),
  createUploadClient: vi.fn(),
}));

describe("mutateImportBatchWorkbench", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("confirms import batch items via the sdk asset client", async () => {
    const batchConfirmImportBatchItemsMock = vi.fn().mockResolvedValue({});
    vi.mocked(createAssetClient).mockReturnValue({
      batchConfirmImportBatchItems: batchConfirmImportBatchItemsMock,
    } as never);

    await mutateImportBatchWorkbench.confirmImportBatchItems({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(batchConfirmImportBatchItemsMock).toHaveBeenCalledWith({
      importBatchId: "batch-1",
      itemIds: ["item-1"],
    });
  });

  it("selects primary asset via the sdk execution client", async () => {
    const selectPrimaryAssetMock = vi.fn().mockResolvedValue({});
    vi.mocked(createExecutionClient).mockReturnValue({
      selectPrimaryAsset: selectPrimaryAssetMock,
    } as never);

    await mutateImportBatchWorkbench.selectPrimaryAssetForImportBatch({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(selectPrimaryAssetMock).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "asset-1",
    });
  });

  it("creates, retries, and completes upload sessions via the sdk upload client", async () => {
    const createSessionMock = vi.fn().mockResolvedValue({
      session_id: "upload-session-1",
      status: "pending",
    });
    const retrySessionMock = vi.fn().mockResolvedValue({
      session_id: "upload-session-1",
      retry_count: 1,
      status: "pending",
    });
    const completeSessionMock = vi.fn().mockResolvedValue({
      session_id: "upload-session-1",
      status: "uploaded",
      asset_id: "asset-1",
    });
    vi.mocked(createUploadClient).mockReturnValue({
      createSession: createSessionMock,
      retrySession: retrySessionMock,
      completeSession: completeSessionMock,
    } as never);

    const createUploadSessionForImportBatch = (mutateImportBatchWorkbench as Record<string, unknown>)
      .createUploadSessionForImportBatch as
      | ((input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;
    const retryUploadSessionForImportBatch = (mutateImportBatchWorkbench as Record<string, unknown>)
      .retryUploadSessionForImportBatch as
      | ((input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;
    const completeUploadSessionForImportBatch = (mutateImportBatchWorkbench as Record<string, unknown>)
      .completeUploadSessionForImportBatch as
      | ((input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;

    expect(createUploadSessionForImportBatch).toBeTypeOf("function");
    expect(retryUploadSessionForImportBatch).toBeTypeOf("function");
    expect(completeUploadSessionForImportBatch).toBeTypeOf("function");

    await createUploadSessionForImportBatch!({
      organizationId: "org-1",
      projectId: "project-1",
      importBatchId: "batch-1",
      fileName: "scene.png",
      checksum: "sha256:abc",
      sizeBytes: 1024,
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });
    await retryUploadSessionForImportBatch!({
      sessionId: "upload-session-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });
    await completeUploadSessionForImportBatch!({
      sessionId: "upload-session-1",
      shotExecutionId: "",
      mimeType: "image/png",
      locale: "zh-CN",
      width: 1920,
      height: 1080,
      baseUrl: "http://127.0.0.1:8080",
      fetchFn: vi.fn(),
    });

    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        project_id: "project-1",
        import_batch_id: "batch-1",
      }),
    );
    expect(retrySessionMock).toHaveBeenCalledWith("upload-session-1");
    expect(completeSessionMock).toHaveBeenCalledWith(
      "upload-session-1",
      expect.objectContaining({
        variant_type: "original",
        rights_status: "clear",
        ai_annotated: true,
        width: 1920,
        height: 1080,
      }),
    );
  });
});
