import { useEffect, useId, useState } from "react";
import type { AdminTranslator } from "../../../i18n";
import { GovernanceRolesPanel } from "../GovernanceRolesPanel";
import type { AdminGovernanceViewModel } from "../governance";
import { getFeedbackPalette, metricStyle, panelStyle, type FeedbackMessage } from "./shared";

export function GovernanceSessionPanel({
  governance,
  governanceActionFeedback,
  governanceActionPending,
  onUpdateUserPreferences,
  onUpdateMemberRole,
  onUpdateOrgLocaleSettings,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  t,
}: {
  governance: AdminGovernanceViewModel;
  governanceActionFeedback?: FeedbackMessage;
  governanceActionPending?: boolean;
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
  t: AdminTranslator;
}) {
  const displayLocaleInputId = useId();
  const timezoneInputId = useId();
  const orgLocaleInputId = useId();
  const canManageMembers = governance.capabilities.canManageMembers;
  const canManageOrgSettings = governance.capabilities.canManageOrgSettings;
  const canManageUserPreferences = governance.capabilities.canManageUserPreferences;
  const [displayLocale, setDisplayLocale] = useState(governance.userPreferences.displayLocale);
  const [timezone, setTimezone] = useState(governance.userPreferences.timezone);
  const [orgDefaultLocale, setOrgDefaultLocale] = useState(
    governance.orgLocaleSettings.defaultLocale,
  );
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(governance.members.map((member) => [member.memberId, member.roleId])),
  );

  useEffect(() => {
    setDisplayLocale(governance.userPreferences.displayLocale);
    setTimezone(governance.userPreferences.timezone);
  }, [governance.userPreferences.displayLocale, governance.userPreferences.timezone]);

  useEffect(() => {
    setOrgDefaultLocale(governance.orgLocaleSettings.defaultLocale);
  }, [governance.orgLocaleSettings.defaultLocale]);

  useEffect(() => {
    setMemberRoleDrafts(
      Object.fromEntries(governance.members.map((member) => [member.memberId, member.roleId])),
    );
  }, [governance.members]);

  return (
    <>
      <article style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
          {t("governance.session.title")}
        </h2>
        <div style={{ display: "grid", gap: "8px", marginBottom: "18px" }}>
          <p style={metricStyle}>{t("governance.session.idLabel")}</p>
          <p style={metricStyle}>{governance.currentSession.sessionId}</p>
          <p style={metricStyle}>
            {t("governance.session.orgId", { orgId: governance.currentSession.orgId })}
          </p>
          <p style={metricStyle}>
            {t("governance.session.userId", { userId: governance.currentSession.userId })}
          </p>
          <p style={metricStyle}>
            {t("governance.session.locale", { locale: governance.currentSession.locale })}
          </p>
          <p style={metricStyle}>
            {t("governance.session.role", { roleCode: governance.currentSession.roleCode })}
          </p>
          <p style={metricStyle}>
            {t("governance.session.timezone", {
              timezone: governance.currentSession.timezone || "none",
            })}
          </p>
          <p style={metricStyle}>
            {t("governance.session.permissions", {
              permissions: governance.currentSession.permissionCodes.join(", ") || "none",
            })}
          </p>
        </div>
        <div style={{ display: "grid", gap: "10px" }}>
          <label
            htmlFor={displayLocaleInputId}
            style={{ fontSize: "0.9rem", color: "#334155" }}
          >
            {t("governance.preferences.displayLocale")}
          </label>
          <input
            id={displayLocaleInputId}
            value={displayLocale}
            disabled={!canManageUserPreferences || Boolean(governanceActionPending)}
            onChange={(event) => {
              setDisplayLocale(event.target.value);
            }}
            style={{
              borderRadius: "12px",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              padding: "10px 12px",
              font: "inherit",
            }}
          />
          <label htmlFor={timezoneInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
            {t("governance.preferences.timezone")}
          </label>
          <input
            id={timezoneInputId}
            value={timezone}
            disabled={!canManageUserPreferences || Boolean(governanceActionPending)}
            onChange={(event) => {
              setTimezone(event.target.value);
            }}
            style={{
              borderRadius: "12px",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              padding: "10px 12px",
              font: "inherit",
            }}
          />
          <button
            type="button"
            disabled={!canManageUserPreferences || Boolean(governanceActionPending)}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "10px 16px",
              background:
                !canManageUserPreferences || governanceActionPending ? "#94a3b8" : "#1d4ed8",
              color: "#eff6ff",
              cursor:
                !canManageUserPreferences || governanceActionPending ? "not-allowed" : "pointer",
              justifySelf: "start",
            }}
            onClick={() => {
              onUpdateUserPreferences?.({
                userId: governance.userPreferences.userId,
                displayLocale,
                timezone,
              });
            }}
          >
            {t("governance.preferences.update")}
          </button>
        </div>
      </article>

      <article style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
          {t("governance.org.title")}
        </h2>
        {governanceActionFeedback ? (
          <p
            style={{
              marginTop: 0,
              marginBottom: "12px",
              fontSize: "0.9rem",
              ...getFeedbackPalette(governanceActionFeedback),
            }}
          >
            {governanceActionFeedback.message}
          </p>
        ) : null}
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>{t("governance.members.title")}</h3>
            {governance.members.map((member) => {
              const draftRoleId = memberRoleDrafts[member.memberId] ?? member.roleId;
              return (
                <article
                  key={member.memberId}
                  style={{
                    display: "grid",
                    gap: "10px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.82)",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                  }}
                >
                  <p style={{ ...metricStyle, fontWeight: 600 }}>{member.userId}</p>
                  <select
                    aria-label={t("governance.members.roleSelect", { userId: member.userId })}
                    value={draftRoleId}
                    disabled={!canManageMembers || Boolean(governanceActionPending)}
                    onChange={(event) => {
                      setMemberRoleDrafts((current) => ({
                        ...current,
                        [member.memberId]: event.target.value,
                      }));
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "10px 12px",
                      font: "inherit",
                      background: "#ffffff",
                    }}
                  >
                    {governance.roles.map((role) => (
                      <option key={role.roleId} value={role.roleId}>
                        {role.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!canManageMembers || Boolean(governanceActionPending)}
                    style={{
                      border: 0,
                      borderRadius: "999px",
                      padding: "10px 16px",
                      background:
                        !canManageMembers || governanceActionPending ? "#94a3b8" : "#0f766e",
                      color: "#ecfeff",
                      cursor:
                        !canManageMembers || governanceActionPending ? "not-allowed" : "pointer",
                      justifySelf: "start",
                    }}
                    onClick={() => {
                      onUpdateMemberRole?.({
                        memberId: member.memberId,
                        roleId: draftRoleId,
                      });
                    }}
                  >
                    {t("governance.members.update")}
                  </button>
                </article>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>{t("governance.locale.title")}</h3>
            <label htmlFor={orgLocaleInputId} style={{ fontSize: "0.9rem", color: "#334155" }}>
              {t("governance.locale.defaultLocale")}
            </label>
            <input
              id={orgLocaleInputId}
              value={orgDefaultLocale}
              disabled={!canManageOrgSettings || Boolean(governanceActionPending)}
              onChange={(event) => {
                setOrgDefaultLocale(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "10px 12px",
                font: "inherit",
              }}
            />
            <p style={metricStyle}>
              {t("governance.locale.supportedLocales", {
                locales: governance.orgLocaleSettings.supportedLocales.join(", "),
              })}
            </p>
            <button
              type="button"
              disabled={!canManageOrgSettings || Boolean(governanceActionPending)}
              style={{
                border: 0,
                borderRadius: "999px",
                padding: "10px 16px",
                background:
                  !canManageOrgSettings || governanceActionPending ? "#94a3b8" : "#7c3aed",
                color: "#f5f3ff",
                cursor:
                  !canManageOrgSettings || governanceActionPending ? "not-allowed" : "pointer",
                justifySelf: "start",
              }}
              onClick={() => {
                onUpdateOrgLocaleSettings?.({
                  defaultLocale: orgDefaultLocale,
                });
              }}
            >
              {t("governance.locale.update")}
            </button>
          </div>
        </div>
      </article>

      <article style={panelStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
          {t("governance.policy.title")}
        </h2>
        <p style={metricStyle}>{t("governance.policy.summary")}</p>
        <div style={{ display: "grid", gap: "8px" }}>
          <p style={metricStyle}>{t("governance.policy.rule.sameProject")}</p>
          <p style={metricStyle}>{t("governance.policy.rule.rights")}</p>
          <p style={metricStyle}>{t("governance.policy.rule.aiConsent")}</p>
          <p style={metricStyle}>{t("governance.policy.rule.nonAiConsent")}</p>
        </div>
      </article>

      <GovernanceRolesPanel
        governance={governance}
        governanceActionPending={governanceActionPending}
        onCreateRole={onCreateRole}
        onUpdateRole={onUpdateRole}
        onDeleteRole={onDeleteRole}
        t={t}
      />
    </>
  );
}
