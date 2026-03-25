import { createModelGovernanceClient, type HualalaFetch } from "@hualala/sdk";
import type { ModelGovernancePanelViewModel } from "./governance";
import {
	mapContextBundleViewModel,
	mapModelProfileViewModel,
	mapPromptTemplateViewModel,
} from "./modelGovernanceViewModel";

type LoadModelGovernancePanelOptions = {
	orgId?: string;
	userId?: string;
	projectId: string;
	shotId?: string;
	shotExecutionId?: string;
	sessionPermissionCodes: string[];
	baseUrl?: string;
	fetchFn?: HualalaFetch;
};

const governancePermissionRead = "org.model_governance.read";
const governancePermissionWrite = "org.model_governance.write";

export async function loadModelGovernancePanel({
	orgId,
	userId,
	projectId,
	shotId,
	shotExecutionId,
	sessionPermissionCodes,
	baseUrl,
	fetchFn,
}: LoadModelGovernancePanelOptions): Promise<ModelGovernancePanelViewModel> {
	const canReadModelGovernance = sessionPermissionCodes.includes(governancePermissionRead);
	const canWriteModelGovernance = sessionPermissionCodes.includes(governancePermissionWrite);
	const basePanel: ModelGovernancePanelViewModel = {
		filters: {
			projectId,
			shotId: shotId ?? "",
			shotExecutionId: shotExecutionId ?? "",
		},
		capabilities: {
			canReadModelGovernance,
			canWriteModelGovernance,
		},
		modelProfiles: [],
		promptTemplates: [],
		contextBundles: [],
	};

	if (!canReadModelGovernance) {
		return basePanel;
	}

	const client = createModelGovernanceClient({
		baseUrl,
		fetchFn,
		identity:
			orgId && userId
				? {
						orgId,
						userId,
				  }
				: undefined,
	});

	const [profilesPayload, templatesPayload, contextBundlesPayload] = await Promise.all([
		client.listModelProfiles({ orgId }),
		client.listPromptTemplates({ orgId }),
		client.listContextBundles({
			orgId,
			projectId,
			shotId: shotId || undefined,
			shotExecutionId: shotExecutionId || undefined,
		}),
	]);

	return {
		...basePanel,
		modelProfiles: (profilesPayload.modelProfiles ?? []).map(mapModelProfileViewModel),
		promptTemplates: (templatesPayload.promptTemplates ?? []).map(
			mapPromptTemplateViewModel,
		),
		contextBundles: (contextBundlesPayload.contextBundles ?? []).map(
			mapContextBundleViewModel,
		),
	};
}
