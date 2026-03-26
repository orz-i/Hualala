import {
  createModelProfile,
  createPromptTemplateVersion,
  setModelProfileStatus,
  setPromptTemplateStatus,
  updateModelProfile,
  updatePromptTemplateDraft,
} from "./mutateModelGovernance";

describe("mutateModelGovernance", () => {
  it("posts model profile and prompt template writes through the dedicated governance routes", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            modelProfile: {
              id: "model-profile-2",
              orgId: "org-1",
              provider: "openai",
              modelName: "gpt-4.1-mini",
              capabilityType: "text",
              region: "global",
              supportedInputLocales: ["zh-CN"],
              supportedOutputLocales: ["zh-CN"],
              pricingSnapshotJson: "{\"input\":\"0.001\"}",
              rateLimitPolicyJson: "{\"rpm\":120}",
              status: "active",
              createdAt: "2026-03-25T09:05:00Z",
              updatedAt: "2026-03-25T09:05:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            modelProfile: {
              id: "model-profile-2",
              orgId: "org-1",
              provider: "openai",
              modelName: "gpt-4.1-mini",
              capabilityType: "text",
              region: "global",
              supportedInputLocales: ["zh-CN", "en-US"],
              supportedOutputLocales: ["zh-CN"],
              pricingSnapshotJson: "{\"input\":\"0.001\"}",
              rateLimitPolicyJson: "{\"rpm\":90}",
              status: "active",
              createdAt: "2026-03-25T09:05:00Z",
              updatedAt: "2026-03-25T09:06:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            modelProfile: {
              id: "model-profile-2",
              orgId: "org-1",
              provider: "openai",
              modelName: "gpt-4.1-mini",
              capabilityType: "text",
              region: "global",
              supportedInputLocales: ["zh-CN", "en-US"],
              supportedOutputLocales: ["zh-CN"],
              pricingSnapshotJson: "{\"input\":\"0.001\"}",
              rateLimitPolicyJson: "{\"rpm\":90}",
              status: "paused",
              createdAt: "2026-03-25T09:05:00Z",
              updatedAt: "2026-03-25T09:07:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promptTemplate: {
              id: "prompt-template-2",
              orgId: "org-1",
              templateFamily: "shot.generate",
              templateKey: "shot.generate.default",
              locale: "zh-CN",
              version: 2,
              content: "新的生成模板",
              inputSchemaJson: "{\"type\":\"object\"}",
              outputSchemaJson: "{\"type\":\"object\"}",
              status: "draft",
              createdAt: "2026-03-25T09:08:00Z",
              updatedAt: "2026-03-25T09:08:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promptTemplate: {
              id: "prompt-template-2",
              orgId: "org-1",
              templateFamily: "shot.generate",
              templateKey: "shot.generate.default",
              locale: "zh-CN",
              version: 2,
              content: "更新后的 draft 模板",
              inputSchemaJson: "{\"type\":\"object\"}",
              outputSchemaJson: "{\"type\":\"object\"}",
              status: "draft",
              createdAt: "2026-03-25T09:08:00Z",
              updatedAt: "2026-03-25T09:09:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promptTemplate: {
              id: "prompt-template-2",
              orgId: "org-1",
              templateFamily: "shot.generate",
              templateKey: "shot.generate.default",
              locale: "zh-CN",
              version: 2,
              content: "更新后的 draft 模板",
              inputSchemaJson: "{\"type\":\"object\"}",
              outputSchemaJson: "{\"type\":\"object\"}",
              status: "active",
              createdAt: "2026-03-25T09:08:00Z",
              updatedAt: "2026-03-25T09:10:00Z",
            },
          }),
          { status: 200 },
        ),
      );

    const createdProfile = await createModelProfile({
      orgId: "org-1",
      userId: "user-1",
      provider: "openai",
      modelName: "gpt-4.1-mini",
      capabilityType: "text",
      region: "global",
      supportedInputLocales: ["zh-CN"],
      supportedOutputLocales: ["zh-CN"],
      pricingSnapshotJson: "{\"input\":\"0.001\"}",
      rateLimitPolicyJson: "{\"rpm\":120}",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const updatedProfile = await updateModelProfile({
      orgId: "org-1",
      userId: "user-1",
      modelProfileId: "model-profile-2",
      supportedInputLocales: ["zh-CN", "en-US"],
      supportedOutputLocales: ["zh-CN"],
      pricingSnapshotJson: "{\"input\":\"0.001\"}",
      rateLimitPolicyJson: "{\"rpm\":90}",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const pausedProfile = await setModelProfileStatus({
      orgId: "org-1",
      userId: "user-1",
      modelProfileId: "model-profile-2",
      status: "paused",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const createdTemplate = await createPromptTemplateVersion({
      orgId: "org-1",
      userId: "user-1",
      templateFamily: "shot.generate",
      templateKey: "shot.generate.default",
      locale: "zh-CN",
      content: "新的生成模板",
      inputSchemaJson: "{\"type\":\"object\"}",
      outputSchemaJson: "{\"type\":\"object\"}",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const updatedTemplate = await updatePromptTemplateDraft({
      orgId: "org-1",
      userId: "user-1",
      promptTemplateId: "prompt-template-2",
      content: "更新后的 draft 模板",
      inputSchemaJson: "{\"type\":\"object\"}",
      outputSchemaJson: "{\"type\":\"object\"}",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });
    const publishedTemplate = await setPromptTemplateStatus({
      orgId: "org-1",
      userId: "user-1",
      promptTemplateId: "prompt-template-2",
      status: "active",
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
    });

    expect(createdProfile.modelName).toBe("gpt-4.1-mini");
    expect(updatedProfile.supportedInputLocales).toEqual(["zh-CN", "en-US"]);
    expect(pausedProfile.status).toBe("paused");
    expect(createdTemplate.version).toBe(2);
    expect(updatedTemplate.content).toBe("更新后的 draft 模板");
    expect(publishedTemplate.status).toBe("active");
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/hualala.model.v1.ModelGovernanceService/CreateModelProfile",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Hualala-Org-Id": "org-1",
          "X-Hualala-User-Id": "user-1",
        }),
      }),
    );
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });
});
