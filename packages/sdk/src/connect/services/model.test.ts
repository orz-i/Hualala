import { describe, expect, it, vi } from "vitest";
import { createModelGovernanceClient } from "./model";

describe("createModelGovernanceClient", () => {
  it("calls model governance routes with shared transport and identity headers", async () => {
    const fetchFn = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hualala.model.v1.ModelGovernanceService/ListModelProfiles")) {
        return new Response(
          JSON.stringify({
            modelProfiles: [
              {
                id: "model-profile-1",
                provider: "openai",
                modelName: "gpt-image-1",
                capabilityType: "image",
                region: "global",
                supportedInputLocales: ["zh-CN"],
                supportedOutputLocales: ["en-US"],
                pricingSnapshotJson: `{"input":"0.01"}`,
                rateLimitPolicyJson: `{"rpm":60}`,
                status: "active",
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
                templateFamily: "shot.generate",
                templateKey: "shot.generate.default",
                locale: "zh-CN",
                version: 1,
                content: "生成镜头",
                inputSchemaJson: `{"type":"object"}`,
                outputSchemaJson: `{"type":"object"}`,
                status: "active",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/hualala.model.v1.ModelGovernanceService/ListContextBundles")) {
        return new Response(
          JSON.stringify({
            contextBundles: [
              {
                id: "context-bundle-1",
                projectId: "project-1",
                shotId: "shot-1",
                modelProfileId: "model-profile-1",
                promptTemplateId: "prompt-template-1",
                payloadJson: `{"temperature":0.2}`,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          contextBundle: {
            id: "context-bundle-1",
            projectId: "project-1",
            shotId: "shot-1",
            modelProfileId: "model-profile-1",
            promptTemplateId: "prompt-template-1",
            payloadJson: `{"temperature":0.2}`,
          },
        }),
        { status: 200 },
      );
    });

    const client = createModelGovernanceClient({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const [profiles, templates, bundles, bundle] = await Promise.all([
      client.listModelProfiles({}),
      client.listPromptTemplates({ templateKey: "shot.generate.default" }),
      client.listContextBundles({ projectId: "project-1", shotId: "shot-1" }),
      client.getContextBundle({ contextBundleId: "context-bundle-1" }),
    ]);

    expect(profiles.modelProfiles[0]?.provider).toBe("openai");
    expect(templates.promptTemplates[0]?.status).toBe("active");
    expect(bundles.contextBundles[0]?.projectId).toBe("project-1");
    expect(bundle.contextBundle?.payloadJson).toBe(`{"temperature":0.2}`);
    expect(fetchFn.mock.calls[0]?.[1] ?? {}).toMatchObject({
      headers: expect.objectContaining({
        "X-Hualala-Org-Id": "org-1",
        "X-Hualala-User-Id": "user-1",
      }),
    });
  });

  it("creates updates and transitions profiles and prompt templates", async () => {
    const fetchFn = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            modelProfile: {
              id: "model-profile-1",
              provider: "openai",
              modelName: "gpt-4.1",
              capabilityType: "text",
              region: "global",
              supportedInputLocales: ["zh-CN"],
              supportedOutputLocales: ["zh-CN"],
              pricingSnapshotJson: `{"input":"0.001"}`,
              rateLimitPolicyJson: `{"rpm":120}`,
              status: "active",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            modelProfile: {
              id: "model-profile-1",
              provider: "openai",
              modelName: "gpt-4.1",
              capabilityType: "text",
              region: "global",
              supportedInputLocales: ["zh-CN", "en-US"],
              supportedOutputLocales: ["en-US"],
              pricingSnapshotJson: `{"input":"0.002"}`,
              rateLimitPolicyJson: `{"rpm":80}`,
              status: "active",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            modelProfile: {
              id: "model-profile-1",
              status: "paused",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promptTemplate: {
              id: "prompt-template-1",
              templateFamily: "shot.generate",
              templateKey: "shot.generate.default",
              locale: "zh-CN",
              version: 1,
              content: "第一版提示词",
              inputSchemaJson: `{"type":"object"}`,
              outputSchemaJson: `{"type":"object"}`,
              status: "draft",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promptTemplate: {
              id: "prompt-template-1",
              templateFamily: "shot.generate",
              templateKey: "shot.generate.default",
              locale: "zh-CN",
              version: 1,
              content: "修订后的提示词",
              inputSchemaJson: `{"type":"object","required":["goal"]}`,
              outputSchemaJson: `{"type":"object"}`,
              status: "draft",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            promptTemplate: {
              id: "prompt-template-1",
              status: "active",
            },
          }),
          { status: 200 },
        ),
      );

    const client = createModelGovernanceClient({
      baseUrl: "http://127.0.0.1:8080",
      fetchFn,
      identity: { orgId: "org-1", userId: "user-1" },
    });

    const createdProfile = await client.createModelProfile({
      provider: "openai",
      modelName: "gpt-4.1",
      capabilityType: "text",
      region: "global",
      supportedInputLocales: ["zh-CN"],
      supportedOutputLocales: ["zh-CN"],
      pricingSnapshotJson: `{"input":"0.001"}`,
      rateLimitPolicyJson: `{"rpm":120}`,
    });
    const updatedProfile = await client.updateModelProfile({
      modelProfileId: "model-profile-1",
      supportedInputLocales: ["zh-CN", "en-US"],
      supportedOutputLocales: ["en-US"],
      pricingSnapshotJson: `{"input":"0.002"}`,
      rateLimitPolicyJson: `{"rpm":80}`,
    });
    const pausedProfile = await client.setModelProfileStatus({
      modelProfileId: "model-profile-1",
      status: "paused",
    });
    const createdPrompt = await client.createPromptTemplateVersion({
      templateFamily: "shot.generate",
      templateKey: "shot.generate.default",
      locale: "zh-CN",
      content: "第一版提示词",
      inputSchemaJson: `{"type":"object"}`,
      outputSchemaJson: `{"type":"object"}`,
    });
    const updatedPrompt = await client.updatePromptTemplateDraft({
      promptTemplateId: "prompt-template-1",
      content: "修订后的提示词",
      inputSchemaJson: `{"type":"object","required":["goal"]}`,
      outputSchemaJson: `{"type":"object"}`,
    });
    const activatedPrompt = await client.setPromptTemplateStatus({
      promptTemplateId: "prompt-template-1",
      status: "active",
    });

    expect(createdProfile.modelProfile?.modelName).toBe("gpt-4.1");
    expect(updatedProfile.modelProfile?.pricingSnapshotJson).toBe(`{"input":"0.002"}`);
    expect(pausedProfile.modelProfile?.status).toBe("paused");
    expect(createdPrompt.promptTemplate?.status).toBe("draft");
    expect(updatedPrompt.promptTemplate?.content).toBe("修订后的提示词");
    expect(activatedPrompt.promptTemplate?.status).toBe("active");
  });
});
