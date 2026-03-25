export type CurrentSessionViewModel = {
	sessionId: string;
	orgId: string;
	userId: string;
	locale: string;
	roleId: string;
	roleCode: string;
	permissionCodes: string[];
	timezone: string;
};

export type UserPreferencesViewModel = {
	userId: string;
	displayLocale: string;
	timezone: string;
};

export type OrgMemberViewModel = {
	memberId: string;
	orgId: string;
	userId: string;
	roleId: string;
};

export type OrgRoleViewModel = {
	roleId: string;
	orgId: string;
	code: string;
	displayName: string;
	permissionCodes: string[];
	memberCount: number;
};

export type AvailablePermissionViewModel = {
	code: string;
	displayName: string;
	group: string;
};

export type OrgLocaleSettingsViewModel = {
	orgId: string;
	defaultLocale: string;
	supportedLocales: string[];
};

export type GovernanceCapabilitiesViewModel = {
	canManageRoles: boolean;
	canManageMembers: boolean;
	canManageOrgSettings: boolean;
	canManageUserPreferences: boolean;
};

export type AdminGovernanceViewModel = {
	currentSession: CurrentSessionViewModel;
	userPreferences: UserPreferencesViewModel;
	members: OrgMemberViewModel[];
	roles: OrgRoleViewModel[];
	availablePermissions: AvailablePermissionViewModel[];
	orgLocaleSettings: OrgLocaleSettingsViewModel;
	capabilities: GovernanceCapabilitiesViewModel;
};

export type ModelGovernanceCapabilitiesViewModel = {
	canReadModelGovernance: boolean;
	canWriteModelGovernance: boolean;
};

export type ModelGovernanceFiltersViewModel = {
	projectId: string;
	shotId: string;
	shotExecutionId: string;
};

export type ModelProfileViewModel = {
	id: string;
	orgId: string;
	provider: string;
	modelName: string;
	capabilityType: string;
	region: string;
	supportedInputLocales: string[];
	supportedOutputLocales: string[];
	pricingSnapshotJson: string;
	rateLimitPolicyJson: string;
	status: string;
	createdAt: string;
	updatedAt: string;
};

export type PromptTemplateViewModel = {
	id: string;
	orgId: string;
	templateFamily: string;
	templateKey: string;
	locale: string;
	version: number;
	content: string;
	inputSchemaJson: string;
	outputSchemaJson: string;
	status: string;
	createdAt: string;
	updatedAt: string;
};

export type ContextBundleViewModel = {
	id: string;
	orgId: string;
	projectId: string;
	shotId: string;
	shotExecutionId: string;
	modelProfileId: string;
	promptTemplateId: string;
	inputLocale: string;
	outputLocale: string;
	resolvedPromptVersion: number;
	sourceSnapshotIds: string[];
	referencedAssetIds: string[];
	payloadJson: string;
	createdByUserId: string;
	createdAt: string;
};

export type ModelGovernancePanelViewModel = {
	filters: ModelGovernanceFiltersViewModel;
	capabilities: ModelGovernanceCapabilitiesViewModel;
	modelProfiles: ModelProfileViewModel[];
	promptTemplates: PromptTemplateViewModel[];
	contextBundles: ContextBundleViewModel[];
};
