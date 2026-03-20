export type CurrentSessionViewModel = {
  sessionId: string;
  orgId: string;
  userId: string;
  locale: string;
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
};

export type OrgLocaleSettingsViewModel = {
  orgId: string;
  defaultLocale: string;
  supportedLocales: string[];
};

export type AdminGovernanceViewModel = {
  currentSession: CurrentSessionViewModel;
  userPreferences: UserPreferencesViewModel;
  members: OrgMemberViewModel[];
  roles: OrgRoleViewModel[];
  orgLocaleSettings: OrgLocaleSettingsViewModel;
};
