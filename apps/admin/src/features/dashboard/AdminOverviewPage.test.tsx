import { fireEvent, render, screen } from "@testing-library/react";
import type { AdminOperationsOverviewViewModel } from "./operationsOverview";
import { createTranslator } from "../../i18n";
import { AdminOverviewPage } from "./AdminOverviewPage";
import { createOverview } from "./overview-page/testData";

describe("AdminOverviewPage", () => {
  const t = createTranslator("zh-CN");

  function createOperationsOverview(): AdminOperationsOverviewViewModel {
    return {
      blockerCount: 2,
      blockers: [
        {
          id: "budget",
          kind: "budget",
          status: "blocked",
          remainingBudgetCents: 0,
        },
        {
          id: "workflow",
          kind: "workflow",
          status: "blocked",
          failedWorkflowCount: 1,
          workflowRunId: "workflow-run-1",
          workflowType: "shot_pipeline",
          lastError: "provider rejected request",
          target: {
            route: "workflow",
            workflowRunId: "workflow-run-1",
          },
        },
      ],
      runtimeHealth: {
        runningWorkflowCount: 1,
        failedWorkflowCount: 1,
        pendingImportBatchCount: 1,
        blockedImportBatchCount: 1,
        alerts: [
          {
            id: "workflow-failed",
            kind: "workflow_failed",
            count: 1,
            workflowRunId: "workflow-run-1",
            workflowType: "shot_pipeline",
            lastError: "provider rejected request",
            target: {
              route: "workflow",
              workflowRunId: "workflow-run-1",
            },
          },
          {
            id: "asset-attention",
            kind: "asset_attention",
            count: 1,
            importBatchId: "import-batch-1",
            pendingConfirmationCount: 3,
            blockedImportBatchCount: 1,
            batchStatus: "pending_review",
            target: {
              route: "assets",
              importBatchId: "import-batch-1",
            },
          },
        ],
      },
    };
  }

  function createProps(
    overrides: Partial<Parameters<typeof AdminOverviewPage>[0]> = {},
  ): Parameters<typeof AdminOverviewPage>[0] {
    return {
      overview: createOverview(),
      operationsOverview: createOperationsOverview(),
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
    expect(
      screen.getByRole("heading", { name: t("operations.release.panel.title") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("operations.runtime.panel.title") }),
    ).toBeInTheDocument();
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

  it("navigates to the workflow and asset routes from overview summary ctas", () => {
    const onNavigateOperationsTarget = vi.fn();

    render(
      <AdminOverviewPage
        {...createProps({
          onNavigateOperationsTarget,
        })}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: t("operations.target.workflow") })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: t("operations.target.asset") })[0]!);

    expect(onNavigateOperationsTarget).toHaveBeenNthCalledWith(1, {
      route: "workflow",
      workflowRunId: "workflow-run-1",
    });
    expect(onNavigateOperationsTarget).toHaveBeenNthCalledWith(2, {
      route: "assets",
      importBatchId: "import-batch-1",
    });
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
