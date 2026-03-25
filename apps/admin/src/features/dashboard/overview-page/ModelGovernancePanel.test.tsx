import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import type { ModelGovernancePanelViewModel } from "../governance";
import { ModelGovernancePanel } from "./ModelGovernancePanel";

function createPanel(): ModelGovernancePanelViewModel {
  return {
    filters: {
      projectId: "project-live-1",
      shotId: "shot-live-1",
      shotExecutionId: "shot-exec-live-1",
    },
    capabilities: {
      canReadModelGovernance: true,
      canWriteModelGovernance: true,
    },
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
        createdAt: "2026-03-25T09:00:00.000Z",
        updatedAt: "2026-03-25T09:00:00.000Z",
      },
    ],
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
        status: "active",
        createdAt: "2026-03-25T09:01:00.000Z",
        updatedAt: "2026-03-25T09:01:00.000Z",
      },
      {
        id: "prompt-template-2",
        orgId: "org-live-1",
        templateFamily: "shot.generate",
        templateKey: "shot.generate.default",
        locale: "zh-CN",
        version: 2,
        content: "草稿镜头生成提示词",
        inputSchemaJson: "{\"type\":\"object\"}",
        outputSchemaJson: "{\"type\":\"object\"}",
        status: "draft",
        createdAt: "2026-03-25T09:02:00.000Z",
        updatedAt: "2026-03-25T09:02:00.000Z",
      },
    ],
    contextBundles: [
      {
        id: "context-bundle-1",
        orgId: "org-live-1",
        projectId: "project-live-1",
        shotId: "shot-live-1",
        shotExecutionId: "shot-exec-live-1",
        modelProfileId: "model-profile-1",
        promptTemplateId: "prompt-template-2",
        inputLocale: "zh-CN",
        outputLocale: "en-US",
        resolvedPromptVersion: 2,
        sourceSnapshotIds: ["snapshot-live-1"],
        referencedAssetIds: ["asset-live-1"],
        payloadJson: "{\"temperature\":0.2}",
        createdByUserId: "user-live-1",
        createdAt: "2026-03-25T09:03:00.000Z",
      },
    ],
  };
}

describe("ModelGovernancePanel", () => {
  it("submits create, draft update, publish, and profile status actions while keeping context bundle detail readonly", () => {
    const onCreateModelProfile = vi.fn();
    const onSetModelProfileStatus = vi.fn();
    const onCreatePromptTemplateVersion = vi.fn();
    const onUpdatePromptTemplateDraft = vi.fn();
    const onSetPromptTemplateStatus = vi.fn();

    render(
      <ModelGovernancePanel
        modelGovernance={createPanel()}
        t={createTranslator("zh-CN")}
        onCreateModelProfile={onCreateModelProfile}
        onSetModelProfileStatus={onSetModelProfileStatus}
        onCreatePromptTemplateVersion={onCreatePromptTemplateVersion}
        onUpdatePromptTemplateDraft={onUpdatePromptTemplateDraft}
        onSetPromptTemplateStatus={onSetPromptTemplateStatus}
      />,
    );

    fireEvent.change(screen.getByLabelText("供应商"), {
      target: { value: "openai" },
    });
    fireEvent.change(screen.getByLabelText("模型名称"), {
      target: { value: "gpt-4.1-mini" },
    });
    fireEvent.change(screen.getByLabelText("能力类型"), {
      target: { value: "text" },
    });
    fireEvent.change(screen.getByLabelText("输入语言"), {
      target: { value: "zh-CN, en-US" },
    });
    fireEvent.change(screen.getByLabelText("输出语言"), {
      target: { value: "zh-CN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建模型 Profile" }));

    expect(onCreateModelProfile).toHaveBeenCalledWith({
      provider: "openai",
      modelName: "gpt-4.1-mini",
      capabilityType: "text",
      region: "",
      supportedInputLocales: ["zh-CN", "en-US"],
      supportedOutputLocales: ["zh-CN"],
      pricingSnapshotJson: "{}",
      rateLimitPolicyJson: "{}",
    });

    fireEvent.click(screen.getByRole("button", { name: "暂停 profile model-profile-1" }));
    expect(onSetModelProfileStatus).toHaveBeenCalledWith({
      modelProfileId: "model-profile-1",
      status: "paused",
    });

    fireEvent.change(screen.getByLabelText("模板族"), {
      target: { value: "shot.generate" },
    });
    fireEvent.change(screen.getByLabelText("模板键"), {
      target: { value: "shot.generate.default" },
    });
    fireEvent.change(screen.getByLabelText("模板内容"), {
      target: { value: "新增版本模板" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建 Prompt 新版本" }));
    expect(onCreatePromptTemplateVersion).toHaveBeenCalledWith({
      templateFamily: "shot.generate",
      templateKey: "shot.generate.default",
      locale: "zh-CN",
      content: "新增版本模板",
      inputSchemaJson: "{}",
      outputSchemaJson: "{}",
    });

    const activeCard = screen.getByTestId("prompt-template-card-prompt-template-1");
    expect(
      within(activeCard).getByRole("button", { name: "更新 draft prompt-template-1" }),
    ).toBeDisabled();

    const draftCard = screen.getByTestId("prompt-template-card-prompt-template-2");
    fireEvent.change(within(draftCard).getByLabelText("Prompt 内容 prompt-template-2"), {
      target: { value: "更新后的草稿模板" },
    });
    fireEvent.click(
      within(draftCard).getByRole("button", { name: "更新 draft prompt-template-2" }),
    );
    expect(onUpdatePromptTemplateDraft).toHaveBeenCalledWith({
      promptTemplateId: "prompt-template-2",
      content: "更新后的草稿模板",
      inputSchemaJson: "{\"type\":\"object\"}",
      outputSchemaJson: "{\"type\":\"object\"}",
    });

    fireEvent.click(within(draftCard).getByRole("button", { name: "发布版本 prompt-template-2" }));
    expect(onSetPromptTemplateStatus).toHaveBeenCalledWith({
      promptTemplateId: "prompt-template-2",
      status: "active",
    });

    fireEvent.click(screen.getByRole("button", { name: "查看上下文详情 context-bundle-1" }));
    const detailCard = screen.getByTestId("context-bundle-detail");
    expect(detailCard).toHaveTextContent("project-live-1");
    expect(detailCard).toHaveTextContent("snapshot-live-1");
    expect(detailCard).toHaveTextContent("{\"temperature\":0.2}");
    expect(screen.queryByRole("button", { name: "更新 ContextBundle" })).not.toBeInTheDocument();
  });
});
