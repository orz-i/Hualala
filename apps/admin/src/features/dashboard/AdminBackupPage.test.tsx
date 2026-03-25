import { render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AdminBackupPage } from "./AdminBackupPage";

describe("AdminBackupPage", () => {
  const t = createTranslator("zh-CN");

  it("does not show the empty-state create hint when the current user cannot manage backup", () => {
    render(
      <AdminBackupPage
        backup={{
          currentSession: {
            sessionId: "dev:org-demo-001:user-demo-001",
            orgId: "org-demo-001",
            userId: "user-demo-001",
            locale: "zh-CN",
            roleId: "role-viewer",
            roleCode: "viewer",
            permissionCodes: ["session.read"],
            timezone: "Asia/Shanghai",
          },
          backupPackages: [],
          capabilities: {
            canManageBackup: false,
            isRuntimeAvailable: true,
            unavailableReason: "",
          },
        }}
        selectedPackageId=""
        restorePreflight={null}
        t={t}
      />,
    );

    expect(
      screen.getByText("当前账号没有 org.settings.write，无法执行备份或恢复。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("还没有备份包，先生成一个新的备份。"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成备份" })).toBeDisabled();
  });

  it("shows a runtime unavailable message and keeps backup actions disabled", () => {
    render(
      <AdminBackupPage
        backup={{
          currentSession: {
            sessionId: "dev:org-demo-001:user-demo-001",
            orgId: "org-demo-001",
            userId: "user-demo-001",
            locale: "zh-CN",
            roleId: "role-admin",
            roleCode: "admin",
            permissionCodes: ["session.read", "org.settings.write"],
            timezone: "Asia/Shanghai",
          },
          backupPackages: [],
          capabilities: {
            canManageBackup: true,
            isRuntimeAvailable: false,
            unavailableReason: "backup restore requires postgres runtime",
          },
        }}
        selectedPackageId=""
        restorePreflight={null}
        t={t}
      />,
    );

    expect(
      screen.getByText("当前环境没有可用的 Postgres runtime，备份与恢复不可执行。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("服务端原因：backup restore requires postgres runtime"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("还没有备份包，先生成一个新的备份。"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成备份" })).toBeDisabled();
  });
});
