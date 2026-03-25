import { createModelGovernanceClient, type HualalaFetch } from "@hualala/sdk";
import type { ModelProfileViewModel, PromptTemplateViewModel } from "./governance";
import {
	mapModelProfileViewModel,
	mapPromptTemplateViewModel,
} from "./modelGovernanceViewModel";

type ModelGovernanceMutationOptions = {
	orgId?: string;
	userId?: string;
	baseUrl?: string;
	fetchFn?: HualalaFetch;
};

type CreateModelProfileInput = ModelGovernanceMutationOptions & {
	provider: string;
	modelName: string;
	capabilityType: string;
	region?: string;
	supportedInputLocales: string[];
	supportedOutputLocales: string[];
	pricingSnapshotJson?: string;
	rateLimitPolicyJson?: string;
};

type UpdateModelProfileInput = ModelGovernanceMutationOptions & {
	modelProfileId: string;
	supportedInputLocales: string[];
	supportedOutputLocales: string[];
	pricingSnapshotJson?: string;
	rateLimitPolicyJson?: string;
};

type SetModelProfileStatusInput = ModelGovernanceMutationOptions & {
	modelProfileId: string;
	status: string;
};

type CreatePromptTemplateVersionInput = ModelGovernanceMutationOptions & {
	templateFamily: string;
	templateKey: string;
	locale: string;
	content: string;
	inputSchemaJson?: string;
	outputSchemaJson?: string;
};

type UpdatePromptTemplateDraftInput = ModelGovernanceMutationOptions & {
	promptTemplateId: string;
	content: string;
	inputSchemaJson?: string;
	outputSchemaJson?: string;
};

type SetPromptTemplateStatusInput = ModelGovernanceMutationOptions & {
	promptTemplateId: string;
	status: string;
};

function createClient(options: ModelGovernanceMutationOptions) {
	return createModelGovernanceClient({
		baseUrl: options.baseUrl,
		fetchFn: options.fetchFn,
		identity:
			options.orgId && options.userId
				? {
						orgId: options.orgId,
						userId: options.userId,
				  }
				: undefined,
	});
}

export async function createModelProfile({
	orgId,
	userId,
	provider,
	modelName,
	capabilityType,
	region,
	supportedInputLocales,
	supportedOutputLocales,
	pricingSnapshotJson,
	rateLimitPolicyJson,
	baseUrl,
	fetchFn,
}: CreateModelProfileInput): Promise<ModelProfileViewModel> {
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).createModelProfile({
		orgId,
		provider,
		modelName,
		capabilityType,
		region,
		supportedInputLocales,
		supportedOutputLocales,
		pricingSnapshotJson,
		rateLimitPolicyJson,
	});
	if (!payload.modelProfile?.id) {
		throw new Error("admin: model profile payload is incomplete");
	}
	return mapModelProfileViewModel(payload.modelProfile);
}

export async function updateModelProfile({
	orgId,
	userId,
	modelProfileId,
	supportedInputLocales,
	supportedOutputLocales,
	pricingSnapshotJson,
	rateLimitPolicyJson,
	baseUrl,
	fetchFn,
}: UpdateModelProfileInput): Promise<ModelProfileViewModel> {
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).updateModelProfile({
		orgId,
		modelProfileId,
		supportedInputLocales,
		supportedOutputLocales,
		pricingSnapshotJson,
		rateLimitPolicyJson,
	});
	if (!payload.modelProfile?.id) {
		throw new Error("admin: model profile payload is incomplete");
	}
	return mapModelProfileViewModel(payload.modelProfile);
}

export async function setModelProfileStatus({
	orgId,
	userId,
	modelProfileId,
	status,
	baseUrl,
	fetchFn,
}: SetModelProfileStatusInput): Promise<ModelProfileViewModel> {
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).setModelProfileStatus({
		orgId,
		modelProfileId,
		status,
	});
	if (!payload.modelProfile?.id) {
		throw new Error("admin: model profile payload is incomplete");
	}
	return mapModelProfileViewModel(payload.modelProfile);
}

export async function createPromptTemplateVersion({
	orgId,
	userId,
	templateFamily,
	templateKey,
	locale,
	content,
	inputSchemaJson,
	outputSchemaJson,
	baseUrl,
	fetchFn,
}: CreatePromptTemplateVersionInput): Promise<PromptTemplateViewModel> {
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).createPromptTemplateVersion({
		orgId,
		templateFamily,
		templateKey,
		locale,
		content,
		inputSchemaJson,
		outputSchemaJson,
	});
	if (!payload.promptTemplate?.id) {
		throw new Error("admin: prompt template payload is incomplete");
	}
	return mapPromptTemplateViewModel(payload.promptTemplate);
}

export async function updatePromptTemplateDraft({
	orgId,
	userId,
	promptTemplateId,
	content,
	inputSchemaJson,
	outputSchemaJson,
	baseUrl,
	fetchFn,
}: UpdatePromptTemplateDraftInput): Promise<PromptTemplateViewModel> {
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).updatePromptTemplateDraft({
		orgId,
		promptTemplateId,
		content,
		inputSchemaJson,
		outputSchemaJson,
	});
	if (!payload.promptTemplate?.id) {
		throw new Error("admin: prompt template payload is incomplete");
	}
	return mapPromptTemplateViewModel(payload.promptTemplate);
}

export async function setPromptTemplateStatus({
	orgId,
	userId,
	promptTemplateId,
	status,
	baseUrl,
	fetchFn,
}: SetPromptTemplateStatusInput): Promise<PromptTemplateViewModel> {
	const payload = await createClient({ orgId, userId, baseUrl, fetchFn }).setPromptTemplateStatus({
		orgId,
		promptTemplateId,
		status,
	});
	if (!payload.promptTemplate?.id) {
		throw new Error("admin: prompt template payload is incomplete");
	}
	return mapPromptTemplateViewModel(payload.promptTemplate);
}
