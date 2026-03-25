import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { createHualalaClient, type HualalaClientOptions } from "../transport";
import type {
  CreateModelProfileResponse,
  CreatePromptTemplateVersionResponse,
  GetContextBundleResponse,
  GetPromptTemplateResponse,
  ListContextBundlesResponse,
  ListModelProfilesResponse,
  ListPromptTemplatesResponse,
  SetModelProfileStatusResponse,
  SetPromptTemplateStatusResponse,
  UpdateModelProfileResponse,
  UpdatePromptTemplateDraftResponse,
} from "../../gen/hualala/model/v1/model_service_pb";
import {
  CreateModelProfileResponseSchema,
  CreatePromptTemplateVersionResponseSchema,
  GetContextBundleResponseSchema,
  GetPromptTemplateResponseSchema,
  ListContextBundlesResponseSchema,
  ListModelProfilesResponseSchema,
  ListPromptTemplatesResponseSchema,
  SetModelProfileStatusResponseSchema,
  SetPromptTemplateStatusResponseSchema,
  UpdateModelProfileResponseSchema,
  UpdatePromptTemplateDraftResponseSchema,
} from "../../gen/hualala/model/v1/model_service_pb";

function asJsonValue(response: Record<string, unknown>): JsonValue {
  return response as JsonValue;
}

export function createModelGovernanceClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);
  const unaryWithSchema = <TResponse>(
    schema: Parameters<typeof fromJson>[0],
    path: string,
    body: Record<string, unknown>,
    label: string,
  ): Promise<TResponse> =>
    client
      .unary<Record<string, unknown>>(path, body, label)
      .then((response) => fromJson(schema, asJsonValue(response)) as TResponse);

  return {
    listModelProfiles(body: {
      orgId?: string;
      capabilityType?: string;
      status?: string;
    }): Promise<ListModelProfilesResponse> {
      return unaryWithSchema<ListModelProfilesResponse>(
        ListModelProfilesResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/ListModelProfiles",
        body,
        "sdk: failed to list model profiles",
      );
    },
    createModelProfile(body: {
      orgId?: string;
      provider: string;
      modelName: string;
      capabilityType: string;
      region?: string;
      supportedInputLocales: string[];
      supportedOutputLocales: string[];
      pricingSnapshotJson?: string;
      rateLimitPolicyJson?: string;
    }): Promise<CreateModelProfileResponse> {
      return unaryWithSchema<CreateModelProfileResponse>(
        CreateModelProfileResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/CreateModelProfile",
        body,
        "sdk: failed to create model profile",
      );
    },
    updateModelProfile(body: {
      orgId?: string;
      modelProfileId: string;
      supportedInputLocales: string[];
      supportedOutputLocales: string[];
      pricingSnapshotJson?: string;
      rateLimitPolicyJson?: string;
    }): Promise<UpdateModelProfileResponse> {
      return unaryWithSchema<UpdateModelProfileResponse>(
        UpdateModelProfileResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/UpdateModelProfile",
        body,
        "sdk: failed to update model profile",
      );
    },
    setModelProfileStatus(body: {
      orgId?: string;
      modelProfileId: string;
      status: string;
    }): Promise<SetModelProfileStatusResponse> {
      return unaryWithSchema<SetModelProfileStatusResponse>(
        SetModelProfileStatusResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/SetModelProfileStatus",
        body,
        "sdk: failed to update model profile status",
      );
    },
    listPromptTemplates(body: {
      orgId?: string;
      templateKey?: string;
      locale?: string;
      status?: string;
    }): Promise<ListPromptTemplatesResponse> {
      return unaryWithSchema<ListPromptTemplatesResponse>(
        ListPromptTemplatesResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/ListPromptTemplates",
        body,
        "sdk: failed to list prompt templates",
      );
    },
    getPromptTemplate(body: {
      orgId?: string;
      promptTemplateId: string;
    }): Promise<GetPromptTemplateResponse> {
      return unaryWithSchema<GetPromptTemplateResponse>(
        GetPromptTemplateResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/GetPromptTemplate",
        body,
        "sdk: failed to get prompt template",
      );
    },
    createPromptTemplateVersion(body: {
      orgId?: string;
      templateFamily: string;
      templateKey: string;
      locale: string;
      content: string;
      inputSchemaJson?: string;
      outputSchemaJson?: string;
    }): Promise<CreatePromptTemplateVersionResponse> {
      return unaryWithSchema<CreatePromptTemplateVersionResponse>(
        CreatePromptTemplateVersionResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/CreatePromptTemplateVersion",
        body,
        "sdk: failed to create prompt template version",
      );
    },
    updatePromptTemplateDraft(body: {
      orgId?: string;
      promptTemplateId: string;
      content: string;
      inputSchemaJson?: string;
      outputSchemaJson?: string;
    }): Promise<UpdatePromptTemplateDraftResponse> {
      return unaryWithSchema<UpdatePromptTemplateDraftResponse>(
        UpdatePromptTemplateDraftResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/UpdatePromptTemplateDraft",
        body,
        "sdk: failed to update prompt template draft",
      );
    },
    setPromptTemplateStatus(body: {
      orgId?: string;
      promptTemplateId: string;
      status: string;
    }): Promise<SetPromptTemplateStatusResponse> {
      return unaryWithSchema<SetPromptTemplateStatusResponse>(
        SetPromptTemplateStatusResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/SetPromptTemplateStatus",
        body,
        "sdk: failed to update prompt template status",
      );
    },
    listContextBundles(body: {
      orgId?: string;
      projectId: string;
      shotId?: string;
      shotExecutionId?: string;
      modelProfileId?: string;
      promptTemplateId?: string;
    }): Promise<ListContextBundlesResponse> {
      return unaryWithSchema<ListContextBundlesResponse>(
        ListContextBundlesResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/ListContextBundles",
        body,
        "sdk: failed to list context bundles",
      );
    },
    getContextBundle(body: {
      orgId?: string;
      contextBundleId: string;
    }): Promise<GetContextBundleResponse> {
      return unaryWithSchema<GetContextBundleResponse>(
        GetContextBundleResponseSchema,
        "/hualala.model.v1.ModelGovernanceService/GetContextBundle",
        body,
        "sdk: failed to get context bundle",
      );
    },
  };
}

export type ModelGovernanceClient = ReturnType<typeof createModelGovernanceClient>;
