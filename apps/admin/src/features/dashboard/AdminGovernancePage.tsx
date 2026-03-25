import type { AdminTranslator } from "../../i18n";
import type {
  AdminGovernanceViewModel,
  ModelGovernancePanelViewModel,
} from "./governance";
import { ModelGovernancePanel } from "./overview-page/ModelGovernancePanel";
import { GovernanceSessionPanel } from "./overview-page/GovernanceSessionPanel";
import { panelStyle, type FeedbackMessage } from "./overview-page/shared";

export function AdminGovernancePage({
  governance,
  modelGovernance,
  governanceActionFeedback,
  governanceActionPending,
  modelGovernanceActionFeedback,
  modelGovernanceActionPending,
  t,
  onUpdateUserPreferences,
  onUpdateMemberRole,
  onUpdateOrgLocaleSettings,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onCreateModelProfile,
  onUpdateModelProfile,
  onSetModelProfileStatus,
  onCreatePromptTemplateVersion,
  onUpdatePromptTemplateDraft,
  onSetPromptTemplateStatus,
}: {
  governance: AdminGovernanceViewModel;
  modelGovernance: ModelGovernancePanelViewModel;
  governanceActionFeedback?: FeedbackMessage;
  governanceActionPending?: boolean;
  modelGovernanceActionFeedback?: FeedbackMessage;
  modelGovernanceActionPending?: boolean;
  t: AdminTranslator;
  onUpdateUserPreferences?: (input: {
    userId: string;
    displayLocale: string;
    timezone: string;
  }) => void;
  onUpdateMemberRole?: (input: { memberId: string; roleId: string }) => void;
  onUpdateOrgLocaleSettings?: (input: { defaultLocale: string }) => void;
  onCreateRole?: (input: {
    code: string;
    displayName: string;
    permissionCodes: string[];
  }) => void;
  onUpdateRole?: (input: {
    roleId: string;
    displayName: string;
    permissionCodes: string[];
  }) => void;
  onDeleteRole?: (input: { roleId: string }) => void;
  onCreateModelProfile?: (input: {
    provider: string;
    modelName: string;
    capabilityType: string;
    region?: string;
    supportedInputLocales: string[];
    supportedOutputLocales: string[];
    pricingSnapshotJson?: string;
    rateLimitPolicyJson?: string;
  }) => void;
  onUpdateModelProfile?: (input: {
    modelProfileId: string;
    supportedInputLocales: string[];
    supportedOutputLocales: string[];
    pricingSnapshotJson?: string;
    rateLimitPolicyJson?: string;
  }) => void;
  onSetModelProfileStatus?: (input: { modelProfileId: string; status: string }) => void;
  onCreatePromptTemplateVersion?: (input: {
    templateFamily: string;
    templateKey: string;
    locale: string;
    content: string;
    inputSchemaJson?: string;
    outputSchemaJson?: string;
  }) => void;
  onUpdatePromptTemplateDraft?: (input: {
    promptTemplateId: string;
    content: string;
    inputSchemaJson?: string;
    outputSchemaJson?: string;
  }) => void;
  onSetPromptTemplateStatus?: (input: {
    promptTemplateId: string;
    status: string;
  }) => void;
}) {
  return (
    <>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.5rem" }}>
          {t("nav.governance")}
        </h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("governance.session.orgId", { orgId: governance.currentSession.orgId })} · project{" "}
          {modelGovernance.filters.projectId}
        </p>
      </section>

      <GovernanceSessionPanel
        governance={governance}
        governanceActionFeedback={governanceActionFeedback}
        governanceActionPending={governanceActionPending}
        onUpdateUserPreferences={onUpdateUserPreferences}
        onUpdateMemberRole={onUpdateMemberRole}
        onUpdateOrgLocaleSettings={onUpdateOrgLocaleSettings}
        onCreateRole={onCreateRole}
        onUpdateRole={onUpdateRole}
        onDeleteRole={onDeleteRole}
        t={t}
      />

      <ModelGovernancePanel
        modelGovernance={modelGovernance}
        modelGovernanceActionFeedback={modelGovernanceActionFeedback}
        modelGovernanceActionPending={modelGovernanceActionPending}
        onCreateModelProfile={onCreateModelProfile}
        onUpdateModelProfile={onUpdateModelProfile}
        onSetModelProfileStatus={onSetModelProfileStatus}
        onCreatePromptTemplateVersion={onCreatePromptTemplateVersion}
        onUpdatePromptTemplateDraft={onUpdatePromptTemplateDraft}
        onSetPromptTemplateStatus={onSetPromptTemplateStatus}
        t={t}
      />
    </>
  );
}
