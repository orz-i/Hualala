import { useEffect, useState, type CSSProperties } from "react";
import type { AdminTranslator } from "../../i18n";
import type { AdminGovernanceViewModel } from "./governance";

type GovernanceRolesPanelProps = {
  governance: AdminGovernanceViewModel;
  governanceActionPending?: boolean;
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
};

const panelStyle: CSSProperties = {
  borderRadius: "22px",
  padding: "22px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(232,244,247,0.9))",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.08)",
};

const metricStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: "0.95rem",
};

export function GovernanceRolesPanel({
  governance,
  governanceActionPending,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  t,
}: GovernanceRolesPanelProps) {
  const canManageRoles = governance.capabilities.canManageRoles;
  const isPending = Boolean(governanceActionPending);
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDisplayName, setNewRoleDisplayName] = useState("");
  const [newRolePermissionCodes, setNewRolePermissionCodes] = useState<string[]>([]);
  const [roleDisplayNameDrafts, setRoleDisplayNameDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(governance.roles.map((role) => [role.roleId, role.displayName])),
  );
  const [rolePermissionDrafts, setRolePermissionDrafts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(governance.roles.map((role) => [role.roleId, [...role.permissionCodes]])),
  );

  useEffect(() => {
    setRoleDisplayNameDrafts(
      Object.fromEntries(governance.roles.map((role) => [role.roleId, role.displayName])),
    );
    setRolePermissionDrafts(
      Object.fromEntries(governance.roles.map((role) => [role.roleId, [...role.permissionCodes]])),
    );
  }, [governance.roles]);

  const createDisabled =
    !canManageRoles || isPending || newRoleCode.trim() === "" || newRoleDisplayName.trim() === "";

  return (
    <article style={panelStyle}>
      <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
        {t("governance.roles.title")}
      </h2>
      <div style={{ display: "grid", gap: "16px" }}>
        <div
          style={{
            display: "grid",
            gap: "10px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "rgba(255, 255, 255, 0.82)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
          }}
        >
          <h3 style={{ margin: 0 }}>{t("governance.roles.create.title")}</h3>
          <label style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.9rem" }}>
            <span>{t("governance.roles.create.code")}</span>
            <input
              aria-label={t("governance.roles.create.code")}
              value={newRoleCode}
              disabled={!canManageRoles || isPending}
              onChange={(event) => {
                setNewRoleCode(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "10px 12px",
                font: "inherit",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.9rem" }}>
            <span>{t("governance.roles.create.displayName")}</span>
            <input
              aria-label={t("governance.roles.create.displayName")}
              value={newRoleDisplayName}
              disabled={!canManageRoles || isPending}
              onChange={(event) => {
                setNewRoleDisplayName(event.target.value);
              }}
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.45)",
                padding: "10px 12px",
                font: "inherit",
              }}
            />
          </label>
          <div style={{ display: "grid", gap: "8px" }}>
            <strong style={{ fontSize: "0.95rem" }}>{t("governance.roles.permissions.title")}</strong>
            {governance.availablePermissions.map((permission) => (
              <label
                key={`create-${permission.code}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#334155",
                  fontSize: "0.9rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={newRolePermissionCodes.includes(permission.code)}
                  disabled={!canManageRoles || isPending}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setNewRolePermissionCodes((current) =>
                      checked
                        ? [...new Set([...current, permission.code])]
                        : current.filter((code) => code !== permission.code),
                    );
                  }}
                />
                {permission.displayName} ({permission.code})
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={createDisabled}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "10px 16px",
              background: createDisabled ? "#94a3b8" : "#0f766e",
              color: "#ecfeff",
              cursor: createDisabled ? "not-allowed" : "pointer",
              justifySelf: "start",
            }}
            onClick={() => {
              onCreateRole?.({
                code: newRoleCode,
                displayName: newRoleDisplayName,
                permissionCodes: newRolePermissionCodes,
              });
            }}
          >
            {t("governance.roles.create.submit")}
          </button>
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          {governance.roles.map((role) => {
            const displayNameDraft = roleDisplayNameDrafts[role.roleId] ?? role.displayName;
            const permissionCodesDraft = rolePermissionDrafts[role.roleId] ?? role.permissionCodes;
            const deleteDisabled = !canManageRoles || isPending || role.memberCount > 0;

            return (
              <article
                key={role.roleId}
                style={{
                  display: "grid",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#ffffff",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <div style={{ display: "grid", gap: "6px" }}>
                  <strong>{role.code}</strong>
                  <p style={metricStyle}>
                    {t("governance.roles.memberCount", { count: role.memberCount })}
                  </p>
                </div>
                <label
                  style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.9rem" }}
                >
                  <span>{t("governance.roles.edit.displayName")}</span>
                  <input
                    aria-label={t("governance.roles.edit.displayNameFor", { code: role.code })}
                    value={displayNameDraft}
                    disabled={!canManageRoles || isPending}
                    onChange={(event) => {
                      setRoleDisplayNameDrafts((current) => ({
                        ...current,
                        [role.roleId]: event.target.value,
                      }));
                    }}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "10px 12px",
                      font: "inherit",
                    }}
                  />
                </label>
                <div style={{ display: "grid", gap: "8px" }}>
                  <strong style={{ fontSize: "0.95rem" }}>
                    {t("governance.roles.permissions.title")}
                  </strong>
                  {governance.availablePermissions.map((permission) => (
                    <label
                      key={`${role.roleId}-${permission.code}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#334155",
                        fontSize: "0.9rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={permissionCodesDraft.includes(permission.code)}
                        disabled={!canManageRoles || isPending}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setRolePermissionDrafts((current) => {
                            const nextCodes = current[role.roleId] ?? [...role.permissionCodes];
                            return {
                              ...current,
                              [role.roleId]: checked
                                ? [...new Set([...nextCodes, permission.code])]
                                : nextCodes.filter((code) => code !== permission.code),
                            };
                          });
                        }}
                      />
                      {permission.displayName} ({permission.code})
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={!canManageRoles || isPending}
                    style={{
                      border: 0,
                      borderRadius: "999px",
                      padding: "10px 16px",
                      background: !canManageRoles || isPending ? "#94a3b8" : "#1d4ed8",
                      color: "#eff6ff",
                      cursor: !canManageRoles || isPending ? "not-allowed" : "pointer",
                    }}
                    onClick={() => {
                      onUpdateRole?.({
                        roleId: role.roleId,
                        displayName: displayNameDraft,
                        permissionCodes: permissionCodesDraft,
                      });
                    }}
                  >
                    {t("governance.roles.edit.submit")}
                  </button>
                  <button
                    type="button"
                    disabled={deleteDisabled}
                    style={{
                      border: 0,
                      borderRadius: "999px",
                      padding: "10px 16px",
                      background: deleteDisabled ? "#94a3b8" : "#991b1b",
                      color: "#fef2f2",
                      cursor: deleteDisabled ? "not-allowed" : "pointer",
                    }}
                    onClick={() => {
                      onDeleteRole?.({
                        roleId: role.roleId,
                      });
                    }}
                  >
                    {role.memberCount > 0
                      ? t("governance.roles.delete.inUse")
                      : t("governance.roles.delete.submit")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </article>
  );
}
