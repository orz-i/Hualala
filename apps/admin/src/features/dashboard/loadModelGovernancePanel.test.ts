import { loadModelGovernancePanel } from "./loadModelGovernancePanel";

describe("loadModelGovernancePanel", () => {
  it("loads model profiles, prompt templates, and filtered context bundles into one panel", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.model.v1.ModelGovernanceService/ListModelProfiles")) {
        return new Response(
          JSON.stringify({
            modelProfiles: [
              {
                id: "model-profile-1",
                orgId: "org-live-1",
                provider: "openai",
                modelName: "gpt-image-1",
                capabilityType: "image",
                region: "global",
                supportedInputLocales: ["zh-CN", "en-US"],
                supportedOutputLocales: ["zh-CN", "en-US"],
                pricingSnapshotJson: "{\"input\":\"0.01\"}",
                rateLimitPolicyJson: "{\"rpm\":60}",
                status: "active",
                createdAt: "2026-03-25T09:00:00Z",
                updatedAt: "2026-03-25T09:00:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.model.v1.ModelGovernanceService/ListPromptTemplates")) {
        return new Response(
          JSON.stringify({
            promptTemplates: [
              {
                id: "prompt-template-1",
                orgId: "org-live-1",
                templateFamily: "shot.generate",
                templateKey: "shot.generate.default",
                locale: "zh-CN",
                version: 1,
                content: "默认镜头生成提示词",
                inputSchemaJson: "{\"type\":\"object\"}",
                outputSchemaJson: "{\"type\":\"object\"}",
                status: "draft",
                createdAt: "2026-03-25T09:01:00Z",
                updatedAt: "2026-03-25T09:01:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          contextBundles: [
            {
              id: "context-bundle-1",
              orgId: "org-live-1",
              projectId: "project-live-1",
              shotId: "shot-live-1",
              shotExecutionId: "shot-exec-live-1",
              modelProfileId: "model-profile-1",
              promptTemplateId: "prompt-template-1",
              inputLocale: "zh-CN",
              outputLocale: "en-US",
              resolvedPromptVersion: 1,
              sourceSnapshotIds: ["snapshot-live-1"],
              referencedAssetIds: ["asset-live-1"],
              payloadJson: "{\"temperature\":0.2}",
              createdByUserId: "user-live-1",
              createdAt: "2026-03-25T09:02:00Z",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await loadModelGovernancePanel({
      orgId: "org-live-1",
      userId: "user-live-1",
      projectId: "project-live-1",
      shotId: "shot-live-1",
      shotExecutionId: "shot-exec-live-1",
      sessionPermissionCodes: [
        "org.model_governance.read",
        "org.model_governance.write",
      ],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.filters).toEqual({
      projectId: "project-live-1",
      shotId: "shot-live-1",
      shotExecutionId: "shot-exec-live-1",
    });
    expect(result.capabilities).toEqual({
      canReadModelGovernance: true,
      canWriteModelGovernance: true,
    });
    expect(result.modelProfiles[0]).toEqual(
      expect.objectContaining({
        id: "model-profile-1",
        modelName: "gpt-image-1",
        createdAt: "2026-03-25T09:00:00.000Z",
      }),
    );
    expect(result.promptTemplates[0]).toEqual(
      expect.objectContaining({
        id: "prompt-template-1",
        status: "draft",
        version: 1,
      }),
    );
    expect(result.contextBundles[0]).toEqual(
      expect.objectContaining({
        id: "context-bundle-1",
        projectId: "project-live-1",
        shotExecutionId: "shot-exec-live-1",
      }),
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("returns a read-disabled panel without calling the service when the session lacks read permission", async () => {
    const fetchFn = vi.fn();

    const result = await loadModelGovernancePanel({
      orgId: "org-live-1",
      userId: "user-live-1",
      projectId: "project-live-1",
      sessionPermissionCodes: ["org.roles.read"],
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(result.capabilities).toEqual({
      canReadModelGovernance: false,
      canWriteModelGovernance: false,
    });
    expect(result.modelProfiles).toEqual([]);
    expect(result.promptTemplates).toEqual([]);
    expect(result.contextBundles).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
