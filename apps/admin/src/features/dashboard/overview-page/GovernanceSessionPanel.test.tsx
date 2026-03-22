import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator } from "../../../i18n";
import { GovernanceSessionPanel } from "./GovernanceSessionPanel";
import { createGovernance } from "./testData";

describe("GovernanceSessionPanel", () => {
  it("submits preferences, member role, and org locale actions", () => {
    const onUpdateUserPreferences = vi.fn();
    const onUpdateMemberRole = vi.fn();
    const onUpdateOrgLocaleSettings = vi.fn();

    render(
      <GovernanceSessionPanel
        governance={createGovernance()}
        t={createTranslator("zh-CN")}
        onUpdateUserPreferences={onUpdateUserPreferences}
        onUpdateMemberRole={onUpdateMemberRole}
        onUpdateOrgLocaleSettings={onUpdateOrgLocaleSettings}
      />,
    );

    fireEvent.change(screen.getByLabelText("显示语言"), {
      target: { value: "en-US" },
    });
    fireEvent.change(screen.getByLabelText("时区"), {
      target: { value: "America/Los_Angeles" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新偏好" }));

    expect(onUpdateUserPreferences).toHaveBeenCalledWith({
      userId: "user-live-1",
      displayLocale: "en-US",
      timezone: "America/Los_Angeles",
    });

    fireEvent.click(screen.getByRole("button", { name: "更新成员角色" }));
    expect(onUpdateMemberRole).toHaveBeenCalledWith({
      memberId: "member-1",
      roleId: "role-admin",
    });

    fireEvent.change(screen.getByLabelText("组织默认语言"), {
      target: { value: "en-US" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新组织语言" }));
    expect(onUpdateOrgLocaleSettings).toHaveBeenCalledWith({
      defaultLocale: "en-US",
    });
  });

  it("disables mutable controls when governance is pending or capabilities are missing", () => {
    const governance = createGovernance();
    const t = createTranslator("zh-CN");
    governance.capabilities.canManageMembers = false;
    governance.capabilities.canManageOrgSettings = false;
    governance.capabilities.canManageUserPreferences = false;

    render(
      <GovernanceSessionPanel
        governance={governance}
        governanceActionPending
        t={t}
      />,
    );

    expect(screen.getByLabelText("显示语言")).toBeDisabled();
    expect(screen.getByLabelText("时区")).toBeDisabled();
    expect(screen.getByRole("button", { name: "更新偏好" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "更新成员角色" })).toBeDisabled();
    expect(screen.getByLabelText("组织默认语言")).toBeDisabled();
    expect(screen.getByRole("button", { name: "更新组织语言" })).toBeDisabled();

    const membersSection = screen.getByText(t("governance.members.title")).closest("div");
    expect(membersSection).not.toBeNull();
    if (!membersSection) {
      throw new Error("members section should exist");
    }
    expect(within(membersSection).getByDisplayValue("Administrator")).toBeDisabled();
  });
});
