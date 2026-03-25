import type {
  ContextBundleState,
  ModelGovernanceState,
  ModelProfileState,
  PromptTemplateState,
} from "./types.ts";

const baseTimestamp = Date.parse("2026-03-25T09:00:00.000Z");

export function buildModelGovernanceBaseline(): ModelGovernanceState {
  return {
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
        pricingSnapshotJson: `{"input":"0.01"}`,
        rateLimitPolicyJson: `{"rpm":60}`,
        status: "active",
        createdAt: nextTimestamp(0),
        updatedAt: nextTimestamp(0),
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
        inputSchemaJson: `{"type":"object"}`,
        outputSchemaJson: `{"type":"object"}`,
        status: "active",
        createdAt: nextTimestamp(1),
        updatedAt: nextTimestamp(1),
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
        promptTemplateId: "prompt-template-1",
        inputLocale: "zh-CN",
        outputLocale: "en-US",
        resolvedPromptVersion: 1,
        sourceSnapshotIds: ["snapshot-live-1"],
        referencedAssetIds: ["asset-live-1"],
        payloadJson: `{"temperature":0.2,"top_p":0.9}`,
        createdByUserId: "user-live-1",
        createdAt: nextTimestamp(2),
      },
    ],
  };
}

export function createModelProfileState(
  state: ModelGovernanceState,
  input: {
    provider?: string;
    modelName?: string;
    capabilityType?: string;
    region?: string;
    supportedInputLocales?: string[];
    supportedOutputLocales?: string[];
    pricingSnapshotJson?: string;
    rateLimitPolicyJson?: string;
  },
): ModelGovernanceState {
  const nextIndex = state.modelProfiles.length + 1;
  const timestamp = nextTimestamp(nextIndex + 10);
  const nextProfile: ModelProfileState = {
    id: `model-profile-${nextIndex}`,
    orgId: "org-live-1",
    provider: input.provider ?? "",
    modelName: input.modelName ?? "",
    capabilityType: input.capabilityType ?? "",
    region: input.region ?? "",
    supportedInputLocales: [...(input.supportedInputLocales ?? [])],
    supportedOutputLocales: [...(input.supportedOutputLocales ?? [])],
    pricingSnapshotJson: input.pricingSnapshotJson ?? "{}",
    rateLimitPolicyJson: input.rateLimitPolicyJson ?? "{}",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    ...clone(state),
    modelProfiles: [...state.modelProfiles, nextProfile],
  };
}

export function updateModelProfileState(
  state: ModelGovernanceState,
  input: {
    modelProfileId: string;
    supportedInputLocales?: string[];
    supportedOutputLocales?: string[];
    pricingSnapshotJson?: string;
    rateLimitPolicyJson?: string;
  },
): ModelGovernanceState {
  return {
    ...clone(state),
    modelProfiles: state.modelProfiles.map((profile) =>
      profile.id === input.modelProfileId
        ? {
            ...profile,
            supportedInputLocales: [...(input.supportedInputLocales ?? profile.supportedInputLocales)],
            supportedOutputLocales: [...(input.supportedOutputLocales ?? profile.supportedOutputLocales)],
            pricingSnapshotJson: input.pricingSnapshotJson ?? profile.pricingSnapshotJson,
            rateLimitPolicyJson: input.rateLimitPolicyJson ?? profile.rateLimitPolicyJson,
            updatedAt: nextTimestamp(40),
          }
        : profile,
    ),
  };
}

export function setModelProfileStatusState(
  state: ModelGovernanceState,
  input: {
    modelProfileId: string;
    status: string;
  },
): ModelGovernanceState {
  return {
    ...clone(state),
    modelProfiles: state.modelProfiles.map((profile) =>
      profile.id === input.modelProfileId
        ? {
            ...profile,
            status: input.status,
            updatedAt: nextTimestamp(41),
          }
        : profile,
    ),
  };
}

export function createPromptTemplateVersionState(
  state: ModelGovernanceState,
  input: {
    templateFamily?: string;
    templateKey?: string;
    locale?: string;
    content?: string;
    inputSchemaJson?: string;
    outputSchemaJson?: string;
  },
): ModelGovernanceState {
  const sameTemplate = state.promptTemplates.filter(
    (template) =>
      template.templateKey === (input.templateKey ?? "") &&
      template.locale === (input.locale ?? ""),
  );
  const nextVersion = Math.max(0, ...sameTemplate.map((template) => template.version)) + 1;
  const nextIndex = state.promptTemplates.length + 1;
  const timestamp = nextTimestamp(nextIndex + 50);
  const nextTemplate: PromptTemplateState = {
    id: `prompt-template-${nextIndex}`,
    orgId: "org-live-1",
    templateFamily: input.templateFamily ?? "",
    templateKey: input.templateKey ?? "",
    locale: input.locale ?? "",
    version: nextVersion,
    content: input.content ?? "",
    inputSchemaJson: input.inputSchemaJson ?? "{}",
    outputSchemaJson: input.outputSchemaJson ?? "{}",
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    ...clone(state),
    promptTemplates: [...state.promptTemplates, nextTemplate],
  };
}

export function updatePromptTemplateDraftState(
  state: ModelGovernanceState,
  input: {
    promptTemplateId: string;
    content?: string;
    inputSchemaJson?: string;
    outputSchemaJson?: string;
  },
): ModelGovernanceState {
  return {
    ...clone(state),
    promptTemplates: state.promptTemplates.map((template) => {
      if (template.id !== input.promptTemplateId) {
        return template;
      }
      if (template.status !== "draft") {
        throw new Error("only draft prompt template can be updated");
      }
      return {
        ...template,
        content: input.content ?? template.content,
        inputSchemaJson: input.inputSchemaJson ?? template.inputSchemaJson,
        outputSchemaJson: input.outputSchemaJson ?? template.outputSchemaJson,
        updatedAt: nextTimestamp(60),
      };
    }),
  };
}

export function setPromptTemplateStatusState(
  state: ModelGovernanceState,
  input: {
    promptTemplateId: string;
    status: string;
  },
): ModelGovernanceState {
  const target = state.promptTemplates.find((template) => template.id === input.promptTemplateId);
  return {
    ...clone(state),
    promptTemplates: state.promptTemplates.map((template) => {
      if (template.id === input.promptTemplateId) {
        return {
          ...template,
          status: input.status,
          updatedAt: nextTimestamp(61),
        };
      }
      if (
        input.status === "active" &&
        target &&
        template.templateKey === target.templateKey &&
        template.locale === target.locale &&
        template.status === "active"
      ) {
        return {
          ...template,
          status: "archived",
          updatedAt: nextTimestamp(61),
        };
      }
      return template;
    }),
  };
}

export function listContextBundlesState(
  state: ModelGovernanceState,
  input: {
    projectId?: string;
    shotId?: string;
    shotExecutionId?: string;
    modelProfileId?: string;
    promptTemplateId?: string;
  },
): ContextBundleState[] {
  return state.contextBundles.filter((bundle) => {
    if (input.projectId && bundle.projectId !== input.projectId) {
      return false;
    }
    if (input.shotId && bundle.shotId !== input.shotId) {
      return false;
    }
    if (input.shotExecutionId && bundle.shotExecutionId !== input.shotExecutionId) {
      return false;
    }
    if (input.modelProfileId && bundle.modelProfileId !== input.modelProfileId) {
      return false;
    }
    if (input.promptTemplateId && bundle.promptTemplateId !== input.promptTemplateId) {
      return false;
    }
    return true;
  });
}

export function getContextBundleState(
  state: ModelGovernanceState,
  contextBundleId: string,
): ContextBundleState | null {
  return state.contextBundles.find((bundle) => bundle.id === contextBundleId) ?? null;
}

function nextTimestamp(offsetMinutes: number) {
  return new Date(baseTimestamp + offsetMinutes * 60_000).toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
