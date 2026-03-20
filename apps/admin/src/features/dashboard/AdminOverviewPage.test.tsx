import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AdminOverviewPage } from "./AdminOverviewPage";
import type { AdminGovernanceViewModel } from "./governance";

describe("AdminOverviewPage", () => {
  const overview = {
    budgetSnapshot: {
      projectId: "project-live-1",
      limitCents: 120000,
      reservedCents: 18000,
      remainingBudgetCents: 102000,
    },
    usageRecords: [{ id: "usage-1", meter: "tts", amountCents: 6000 }],
    billingEvents: [{ id: "event-1", eventType: "budget_reserved", amountCents: 18000 }],
    reviewSummary: {
      shotExecutionId: "shot-exec-live-1",
      latestConclusion: "approved",
    },
    evaluationRuns: [{ id: "eval-1", status: "passed", failedChecks: [] }],
    shotReviews: [{ id: "review-1", conclusion: "approved" }],
    recentChanges: [
      {
        id: "billing-event-1",
        kind: "billing" as const,
        tone: "info" as const,
        eventType: "budget_reserved",
        amountCents: 18000,
      },
      {
        id: "evaluation-eval-1",
        kind: "evaluation" as const,
        tone: "success" as const,
        status: "passed",
        failedChecksCount: 0,
      },
      {
        id: "review-review-1",
        kind: "review" as const,
        tone: "success" as const,
        conclusion: "approved",
      },
    ],
  };
  const governance: AdminGovernanceViewModel = {
    currentSession: {
      sessionId: "dev:org-live-1:user-live-1",
      orgId: "org-live-1",
      userId: "user-live-1",
      locale: "zh-CN",
    },
    userPreferences: {
      userId: "user-live-1",
      displayLocale: "zh-CN",
      timezone: "Asia/Shanghai",
    },
    members: [{ memberId: "member-1", orgId: "org-live-1", userId: "user-live-1", roleId: "role-admin" }],
    roles: [{ roleId: "role-admin", orgId: "org-live-1", code: "admin", displayName: "Administrator" }],
    orgLocaleSettings: {
      orgId: "org-live-1",
      defaultLocale: "zh-CN",
      supportedLocales: ["zh-CN"],
    },
  };

  it("renders budget, billing, and review overview cards", () => {
    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.getByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByText("预算上限：1200.00 元")).toBeInTheDocument();
    expect(screen.getByText("1 条用量记录")).toBeInTheDocument();
    expect(screen.getByText("1 条计费事件")).toBeInTheDocument();
    expect(screen.getAllByText("approved").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("最近评估：passed")).toBeInTheDocument();
    expect(screen.getByText("最近变更")).toBeInTheDocument();
    expect(screen.getByText("最近计费事件")).toBeInTheDocument();
    expect(screen.getByText("budget_reserved · 180.00 元")).toBeInTheDocument();
    expect(screen.getByText("最近评估结果")).toBeInTheDocument();
    expect(screen.getByText("passed · 0 个失败检查")).toBeInTheDocument();
    expect(screen.getByText("最近评审结论")).toBeInTheDocument();
    expect(screen.getByText("当前会话")).toBeInTheDocument();
    expect(screen.getByText("dev:org-live-1:user-live-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Asia/Shanghai")).toBeInTheDocument();
    expect(screen.getByText("组织成员与语言设置")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("allows submitting a new budget limit", () => {
    const onUpdateBudgetLimit = vi.fn();

    const { rerender } = render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        onUpdateUserPreferences={vi.fn()}
        onUpdateMemberRole={vi.fn()}
        onUpdateOrgLocaleSettings={vi.fn()}
        budgetFeedback={{
          tone: "success",
          message: "预算策略已更新",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("预算上限（元）"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新预算" }));

    expect(onUpdateBudgetLimit).toHaveBeenCalledWith({
      limitCents: 150000,
      projectId: "project-live-1",
    });
    expect(screen.getByText("预算策略已更新")).toHaveStyle({ color: "#115e59" });

    rerender(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        onUpdateUserPreferences={vi.fn()}
        onUpdateMemberRole={vi.fn()}
        onUpdateOrgLocaleSettings={vi.fn()}
        budgetFeedback={{
          tone: "error",
          message: "预算策略更新失败：network down",
        }}
      />,
    );

    expect(screen.getByText("预算策略更新失败：network down")).toHaveStyle({
      color: "#991b1b",
    });
  });

  it("switches locale and renders recent changes in English", () => {
    const onLocaleChange = vi.fn();
    const onUpdateUserPreferences = vi.fn();
    const onUpdateMemberRole = vi.fn();
    const onUpdateOrgLocaleSettings = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={{
          ...governance,
          currentSession: { ...governance.currentSession, locale: "en-US" },
          userPreferences: { ...governance.userPreferences, displayLocale: "en-US" },
          orgLocaleSettings: { ...governance.orgLocaleSettings, defaultLocale: "en-US", supportedLocales: ["en-US"] },
        }}
        locale="en-US"
        t={createTranslator("en-US")}
        onLocaleChange={onLocaleChange}
        onUpdateUserPreferences={onUpdateUserPreferences}
        onUpdateMemberRole={onUpdateMemberRole}
        onUpdateOrgLocaleSettings={onUpdateOrgLocaleSettings}
      />,
    );

    expect(screen.getByText("Recent Changes")).toBeInTheDocument();
    expect(screen.getByText("Current Session")).toBeInTheDocument();
    expect(screen.getByText("Recent billing event")).toBeInTheDocument();
    expect(screen.getByText("budget_reserved · 180.00 元")).toBeInTheDocument();
    expect(screen.getByText("Recent evaluation result")).toBeInTheDocument();
    expect(screen.getByText("passed · 0 failed checks")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ui-locale-select"), {
      target: { value: "zh-CN" },
    });

    expect(onLocaleChange).toHaveBeenCalledWith("zh-CN");
  });

  it("submits governance actions", () => {
    const onUpdateUserPreferences = vi.fn();
    const onUpdateMemberRole = vi.fn();
    const onUpdateOrgLocaleSettings = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
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
});
