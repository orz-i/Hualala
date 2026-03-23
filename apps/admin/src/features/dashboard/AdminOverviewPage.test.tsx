import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AdminOverviewPage } from "./AdminOverviewPage";
import { createOverview } from "./overview-page/testData";

describe("AdminOverviewPage", () => {
  const t = createTranslator("zh-CN");

  function createProps(
    overrides: Partial<Parameters<typeof AdminOverviewPage>[0]> = {},
  ): Parameters<typeof AdminOverviewPage>[0] {
    return {
      overview: createOverview(),
      locale: "zh-CN",
      t,
      ...overrides,
    };
  }

  it("renders overview-only header and summary panels", () => {
    render(<AdminOverviewPage {...createProps()} />);

    expect(screen.getByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByText("概览")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("budget.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("billing.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("review.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("changes.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("usage.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("reviews.panel.title") })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: t("workflow.panel.title") }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: t("asset.panel.title") })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: t("governance.roles.title") }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("ui-locale-select")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits budget updates using the overview project id", () => {
    const onUpdateBudgetLimit = vi.fn();

    render(<AdminOverviewPage {...createProps({ onUpdateBudgetLimit })} />);

    fireEvent.change(screen.getByLabelText(t("budget.input.label")), {
      target: { value: "2468.50" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("budget.button.update") }));

    expect(onUpdateBudgetLimit).toHaveBeenCalledWith({
      projectId: "project-live-1",
      limitCents: 246850,
    });
  });

  it("renders budget feedback within the overview summary area", () => {
    render(
      <AdminOverviewPage
        {...createProps({
          budgetFeedback: {
            tone: "success",
            message: "预算已更新",
          },
        })}
      />,
    );

    expect(screen.getByText("预算已更新")).toBeInTheDocument();
  });
});
