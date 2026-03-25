import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type {
	ContextBundleViewModel,
	ModelProfileViewModel,
	PromptTemplateViewModel,
} from "./governance";

type ModelProfileShape = Omit<ModelProfileViewModel, "createdAt" | "updatedAt"> & {
	createdAt?: Timestamp;
	updatedAt?: Timestamp;
};

type PromptTemplateShape = Omit<PromptTemplateViewModel, "createdAt" | "updatedAt"> & {
	createdAt?: Timestamp;
	updatedAt?: Timestamp;
};

type ContextBundleShape = Omit<ContextBundleViewModel, "createdAt"> & {
	createdAt?: Timestamp;
};

export function mapModelProfileViewModel(modelProfile: ModelProfileShape): ModelProfileViewModel {
	return {
		id: modelProfile.id,
		orgId: modelProfile.orgId,
		provider: modelProfile.provider,
		modelName: modelProfile.modelName,
		capabilityType: modelProfile.capabilityType,
		region: modelProfile.region,
		supportedInputLocales: [...modelProfile.supportedInputLocales],
		supportedOutputLocales: [...modelProfile.supportedOutputLocales],
		pricingSnapshotJson: modelProfile.pricingSnapshotJson,
		rateLimitPolicyJson: modelProfile.rateLimitPolicyJson,
		status: modelProfile.status,
		createdAt: timestampToIso(modelProfile.createdAt),
		updatedAt: timestampToIso(modelProfile.updatedAt),
	};
}

export function mapPromptTemplateViewModel(
	promptTemplate: PromptTemplateShape,
): PromptTemplateViewModel {
	return {
		id: promptTemplate.id,
		orgId: promptTemplate.orgId,
		templateFamily: promptTemplate.templateFamily,
		templateKey: promptTemplate.templateKey,
		locale: promptTemplate.locale,
		version: promptTemplate.version,
		content: promptTemplate.content,
		inputSchemaJson: promptTemplate.inputSchemaJson,
		outputSchemaJson: promptTemplate.outputSchemaJson,
		status: promptTemplate.status,
		createdAt: timestampToIso(promptTemplate.createdAt),
		updatedAt: timestampToIso(promptTemplate.updatedAt),
	};
}

export function mapContextBundleViewModel(
	contextBundle: ContextBundleShape,
): ContextBundleViewModel {
	return {
		id: contextBundle.id,
		orgId: contextBundle.orgId,
		projectId: contextBundle.projectId,
		shotId: contextBundle.shotId,
		shotExecutionId: contextBundle.shotExecutionId,
		modelProfileId: contextBundle.modelProfileId,
		promptTemplateId: contextBundle.promptTemplateId,
		inputLocale: contextBundle.inputLocale,
		outputLocale: contextBundle.outputLocale,
		resolvedPromptVersion: contextBundle.resolvedPromptVersion,
		sourceSnapshotIds: [...contextBundle.sourceSnapshotIds],
		referencedAssetIds: [...contextBundle.referencedAssetIds],
		payloadJson: contextBundle.payloadJson,
		createdByUserId: contextBundle.createdByUserId,
		createdAt: timestampToIso(contextBundle.createdAt),
	};
}

function timestampToIso(timestamp?: Timestamp) {
	if (!timestamp) {
		return "";
	}
	const seconds = Number(timestamp.seconds);
	const nanos = timestamp.nanos ?? 0;
	if (!Number.isFinite(seconds)) {
		return "";
	}
	return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}
