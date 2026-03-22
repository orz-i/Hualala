import { loadAssetMonitorPanel } from "./loadAssetMonitorPanel";
import { loadAssetProvenanceDetails } from "./loadAssetProvenanceDetails";
import { loadImportBatchDetails } from "./loadImportBatchDetails";

describe("asset monitor loaders", () => {
  it("maps import batch summaries and keeps applied filters", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.asset.v1.AssetService/ListImportBatches")) {
        return new Response(
          JSON.stringify({
            importBatches: [
              {
                id: "import-batch-2",
                orgId: "org-live-1",
                projectId: "project-live-1",
                operatorId: "user-live-1",
                sourceType: "upload_session",
                status: "confirmed",
                uploadSessionCount: 2,
                itemCount: 3,
                confirmedItemCount: 1,
                candidateAssetCount: 2,
                mediaAssetCount: 1,
                updatedAt: "2024-03-09T16:10:00.000Z",
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    const result = await loadAssetMonitorPanel({
      projectId: "project-live-1",
      status: "confirmed",
      sourceType: "upload_session",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.filters.status).toBe("confirmed");
    expect(result.filters.sourceType).toBe("upload_session");
    expect(result.importBatches[0]).toMatchObject({
      id: "import-batch-2",
      orgId: "org-live-1",
      projectId: "project-live-1",
      operatorId: "user-live-1",
      sourceType: "upload_session",
      status: "confirmed",
      uploadSessionCount: 2,
      itemCount: 3,
      confirmedItemCount: 1,
      candidateAssetCount: 2,
      mediaAssetCount: 1,
      updatedAt: "2024-03-09T16:10:00.000Z",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/hualala.asset.v1.AssetService/ListImportBatches",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-live-1",
          status: "confirmed",
          sourceType: "upload_session",
        }),
      }),
    );
  });

  it("loads import batch details from the workbench response", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.asset.v1.AssetService/GetImportBatchWorkbench")) {
        return new Response(
          JSON.stringify({
            importBatch: {
              id: "import-batch-9",
              orgId: "org-live-1",
              projectId: "project-live-1",
              operatorId: "user-live-1",
              sourceType: "upload_session",
              status: "confirmed",
            },
            uploadSessions: [
              {
                id: "upload-session-1",
                fileName: "hero.png",
                checksum: "sha256:abc",
                sizeBytes: 12345,
                retryCount: 1,
                status: "completed",
                resumeHint: "resume-1",
              },
            ],
            items: [
              {
                id: "import-item-1",
                status: "confirmed",
                assetId: "media-asset-1",
              },
            ],
            candidateAssets: [
              {
                id: "candidate-1",
                shotExecutionId: "shot-exec-1",
                assetId: "media-asset-1",
                sourceRunId: "workflow-run-1",
              },
            ],
            mediaAssets: [
              {
                id: "media-asset-1",
                projectId: "project-live-1",
                sourceType: "upload_session",
                rightsStatus: "clear",
                importBatchId: "import-batch-9",
                locale: "zh-CN",
                aiAnnotated: true,
              },
            ],
            shotExecutions: [
              {
                id: "shot-exec-1",
                shotId: "shot-1",
                status: "candidate_ready",
                primaryAssetId: "media-asset-1",
                currentRunId: "workflow-run-1",
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    const result = await loadImportBatchDetails({
      importBatchId: "import-batch-9",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.batch.id).toBe("import-batch-9");
    expect(result.uploadSessions[0]).toMatchObject({
      id: "upload-session-1",
      fileName: "hero.png",
      checksum: "sha256:abc",
      sizeBytes: 12345,
      retryCount: 1,
      status: "completed",
    });
    expect(result.candidateAssets[0]).toMatchObject({
      id: "candidate-1",
      shotExecutionId: "shot-exec-1",
      assetId: "media-asset-1",
      sourceRunId: "workflow-run-1",
    });
    expect(result.mediaAssets[0]).toMatchObject({
      id: "media-asset-1",
      sourceType: "upload_session",
      rightsStatus: "clear",
      importBatchId: "import-batch-9",
      locale: "zh-CN",
      aiAnnotated: true,
    });
  });

  it("loads structured asset provenance details", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.asset.v1.AssetService/GetAssetProvenanceSummary")) {
        return new Response(
          JSON.stringify({
            asset: {
              id: "media-asset-1",
              projectId: "project-live-1",
              sourceType: "upload_session",
              rightsStatus: "clear",
              importBatchId: "import-batch-9",
              locale: "zh-CN",
              aiAnnotated: true,
            },
            provenanceSummary:
              "source_type=upload_session import_batch_id=import-batch-9 rights_status=clear",
            candidateAssetId: "candidate-1",
            shotExecutionId: "shot-exec-1",
            sourceRunId: "workflow-run-1",
            importBatchId: "import-batch-9",
            variantCount: 2,
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    const result = await loadAssetProvenanceDetails({
      assetId: "media-asset-1",
      orgId: "org-live-1",
      userId: "user-live-1",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.asset.id).toBe("media-asset-1");
    expect(result.asset.sourceType).toBe("upload_session");
    expect(result.provenanceSummary).toContain("import_batch_id=import-batch-9");
    expect(result.candidateAssetId).toBe("candidate-1");
    expect(result.shotExecutionId).toBe("shot-exec-1");
    expect(result.sourceRunId).toBe("workflow-run-1");
    expect(result.importBatchId).toBe("import-batch-9");
    expect(result.variantCount).toBe(2);
  });

  it("throws when import batch detail payload is incomplete", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.asset.v1.AssetService/GetImportBatchWorkbench")) {
        return new Response(
          JSON.stringify({
            importBatch: {
              projectId: "project-live-1",
            },
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    await expect(
      loadImportBatchDetails({
        importBatchId: "import-batch-missing",
        orgId: "org-live-1",
        userId: "user-live-1",
        baseUrl: "http://127.0.0.1:8080",
        fetchFn,
      }),
    ).rejects.toThrow("admin: import batch detail payload is incomplete");
  });

  it("throws when asset provenance payload is incomplete", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.asset.v1.AssetService/GetAssetProvenanceSummary")) {
        return new Response(
          JSON.stringify({
            asset: {
              projectId: "project-live-1",
            },
          }),
          { status: 200 },
        );
      }

      return new Response("unexpected", { status: 500 });
    });

    await expect(
      loadAssetProvenanceDetails({
        assetId: "media-asset-missing",
        orgId: "org-live-1",
        userId: "user-live-1",
        baseUrl: "http://127.0.0.1:8080",
        fetchFn,
      }),
    ).rejects.toThrow("admin: asset provenance payload is incomplete");
  });
});
