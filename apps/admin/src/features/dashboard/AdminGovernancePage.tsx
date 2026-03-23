import type { AdminTranslator } from "../../i18n";
import type { AdminGovernanceViewModel } from "./governance";
import { GovernanceSessionPanel } from "./overview-page/GovernanceSessionPanel";
import { panelStyle, type FeedbackMessage } from "./overview-page/shared";

export function AdminGovernancePage({
  governance,
  governanceActionFeedback,
  governanceActionPending,
  t,
  onUpdateUserPreferences,
  onUpdateMemberRole,
  onUpdateOrgLocaleSettings,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}: {
  governance: AdminGovernanceViewModel;
  governanceActionFeedback?: FeedbackMessage;
  governanceActionPending?: boolean;
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
}) {
  return (
    <>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.5rem" }}>
          {t("governance.roles.title")}
        </h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {t("governance.session.orgId", { orgId: governance.currentSession.orgId })}
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
    </>
  );
}
