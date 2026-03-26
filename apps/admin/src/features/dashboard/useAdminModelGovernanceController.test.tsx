import { act, renderHook, waitFor } from "@testing-library/react";
import type { ModelGovernancePanelViewModel } from "./governance";
import { createTranslator } from "../../i18n";
import { loadModelGovernancePanel } from "./loadModelGovernancePanel";
import { createModelProfile, setModelProfileStatus } from "./mutateModelGovernance";
import { useAdminModelGovernanceController } from "./useAdminModelGovernanceController";

vi.mock("./loadModelGovernancePanel", () => ({
  loadModelGovernancePanel: vi.fn(),
}));
vi.mock("./mutateModelGovernance", async () => {
  const actual =
    await vi.importActual<typeof import("./mutateModelGovernance")>("./mutateModelGovernance");
  return {
    ...actual,
    createModelProfile: vi.fn(),
    updateModelProfile: vi.fn(),
    setModelProfileStatus: vi.fn(),
    createPromptTemplateVersion: vi.fn(),
    updatePromptTemplateDraft: vi.fn(),
    setPromptTemplateStatus: vi.fn(),
  };
});
vi.mock("./waitForFeedbackPaint", () => ({
  waitForFeedbackPaint: vi.fn().mockResolvedValue(undefined),
}));

const loadModelGovernancePanelMock = vi.mocked(loadModelGovernancePanel);
const createModelProfileMock = vi.mocked(createModelProfile);
const setModelProfileStatusMock = vi.mocked(setModelProfileStatus);

function createModelGovernancePanel(
  overrides: Partial<ModelGovernancePanelViewModel> = {},
): ModelGovernancePanelViewModel {
  return {
    filters: {
      projectId: "project-live-1",
      shotId: "",
      shotExecutionId: "shot-exec-live-1",
    },
    capabilities: {
      canReadModelGovernance: true,
      canWriteModelGovernance: true,
    },
    modelProfiles: [
      {
        id: "model-profile-1",
        orgId: "org-demo-001",
        provider: "openai",
        modelName: "gpt-image-1",
        capabilityType: "image",
        region: "global",
        supportedInputLocales: ["zh-CN"],
        supportedOutputLocales: ["zh-CN"],
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
        orgId: "org-demo-001",
        templateFamily: "shot.generate",
        templateKey: "shot.generate.default",
        locale: "zh-CN",
        version: 1,
        content: "默认模板",
        inputSchemaJson: "{\"type\":\"object\"}",
        outputSchemaJson: "{\"type\":\"object\"}",
        status: "draft",
        createdAt: "2026-03-25T09:01:00.000Z",
        updatedAt: "2026-03-25T09:01:00.000Z",
      },
    ],
    contextBundles: [
      {
        id: "context-bundle-1",
        orgId: "org-demo-001",
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
        createdByUserId: "user-demo-001",
        createdAt: "2026-03-25T09:02:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("useAdminModelGovernanceController", () => {
  const t = createTranslator("zh-CN");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads model governance once the governance route is ready", async () => {
    loadModelGovernancePanelMock.mockResolvedValueOnce(createModelGovernancePanel());

    const { result } = renderHook(() =>
      useAdminModelGovernanceController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        sessionPermissionCodes: [
          "org.model_governance.read",
          "org.model_governance.write",
        ],
        projectId: "project-live-1",
        shotId: "",
        shotExecutionId: "shot-exec-live-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelGovernance?.modelProfiles[0]?.id).toBe("model-profile-1");
    });
  });

  it("refreshes the panel after a successful profile status change", async () => {
    loadModelGovernancePanelMock
      .mockResolvedValueOnce(createModelGovernancePanel())
      .mockResolvedValueOnce(
        createModelGovernancePanel({
          modelProfiles: [
            {
              ...createModelGovernancePanel().modelProfiles[0]!,
              status: "paused",
            },
          ],
        }),
      );
    setModelProfileStatusMock.mockResolvedValueOnce({
      ...createModelGovernancePanel().modelProfiles[0]!,
      status: "paused",
    });

    const { result } = renderHook(() =>
      useAdminModelGovernanceController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        sessionPermissionCodes: [
          "org.model_governance.read",
          "org.model_governance.write",
        ],
        projectId: "project-live-1",
        shotId: "",
        shotExecutionId: "shot-exec-live-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelGovernance?.modelProfiles[0]?.status).toBe("active");
    });

    act(() => {
      result.current.onSetModelProfileStatus({
        modelProfileId: "model-profile-1",
        status: "paused",
      });
    });

    await waitFor(() => {
      expect(result.current.modelGovernanceActionFeedback?.tone).toBe("success");
    });

    expect(setModelProfileStatusMock).toHaveBeenCalledWith({
      orgId: "org-demo-001",
      userId: "user-demo-001",
      modelProfileId: "model-profile-1",
      status: "paused",
    });
    expect(result.current.modelGovernance?.modelProfiles[0]?.status).toBe("paused");
  });

  it("does not load model governance when the route is not active", async () => {
    const { result } = renderHook(() =>
      useAdminModelGovernanceController({
        sessionState: "ready",
        enabled: false,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        sessionPermissionCodes: ["org.model_governance.read"],
        projectId: "project-live-1",
        shotId: "",
        shotExecutionId: "shot-exec-live-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelGovernance).toBeNull();
    });

    expect(loadModelGovernancePanelMock).not.toHaveBeenCalled();
  });

  it("does not execute write actions when the session lacks model governance write permission", async () => {
    loadModelGovernancePanelMock.mockResolvedValueOnce(
      createModelGovernancePanel({
        capabilities: {
          canReadModelGovernance: true,
          canWriteModelGovernance: false,
        },
      }),
    );

    const { result } = renderHook(() =>
      useAdminModelGovernanceController({
        sessionState: "ready",
        enabled: true,
        identityOverride: undefined,
        effectiveOrgId: "org-demo-001",
        effectiveUserId: "user-demo-001",
        sessionPermissionCodes: ["org.model_governance.read"],
        projectId: "project-live-1",
        shotId: "",
        shotExecutionId: "shot-exec-live-1",
        t,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelGovernance?.capabilities.canWriteModelGovernance).toBe(false);
    });

    act(() => {
      result.current.onCreateModelProfile({
        provider: "openai",
        modelName: "gpt-4.1-mini",
        capabilityType: "text",
        supportedInputLocales: ["zh-CN"],
        supportedOutputLocales: ["zh-CN"],
      });
    });

    expect(createModelProfileMock).not.toHaveBeenCalled();
    expect(result.current.modelGovernanceActionPending).toBe(false);
    expect(result.current.modelGovernanceActionFeedback).toBeNull();
  });
});
