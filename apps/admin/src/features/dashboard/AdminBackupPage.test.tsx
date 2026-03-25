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
});
