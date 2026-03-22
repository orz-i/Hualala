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
