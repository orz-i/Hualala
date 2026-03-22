import { fireEvent, render, screen } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import {
  createAssetBatchDetail,
  createAssetMonitor,
  createAssetProvenanceDetail,
} from "./assetMonitor.test-data";
import { AdminOverviewPage } from "./AdminOverviewPage";
import {
  createFailedWorkflowDetail,
  createGovernance,
  createOverview,
  createWorkflowMonitor,
} from "./overview-page/testData";

describe("AdminOverviewPage", () => {
  const t = createTranslator("zh-CN");

  function createProps(
    overrides: Partial<Parameters<typeof AdminOverviewPage>[0]> = {},
  ): Parameters<typeof AdminOverviewPage>[0] {
    return {
      overview: createOverview(),
      governance: createGovernance(),
      workflowMonitor: createWorkflowMonitor(),
      assetMonitor: createAssetMonitor("project-live-1"),
      locale: "zh-CN",
      t,
      onLocaleChange: vi.fn(),
      ...overrides,
    };
  }

  it("renders header and top-level panels and forwards locale changes", () => {
    const onLocaleChange = vi.fn();

    render(<AdminOverviewPage {...createProps({ onLocaleChange })} />);

    expect(screen.getByText("project-live-1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("budget.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("workflow.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("asset.panel.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("governance.session.title") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("governance.roles.title") })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ui-locale-select"), {
      target: { value: "en-US" },
    });

    expect(onLocaleChange).toHaveBeenCalledWith("en-US");
  });

  it("mounts the workflow detail dialog only when a workflow detail is provided", () => {
    render(
      <AdminOverviewPage
        {...createProps({
          workflowRunDetail: createFailedWorkflowDetail(),
        })}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: t("workflow.detail.title") }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: t("asset.detail.title") }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: t("asset.provenance.title") }),
    ).not.toBeInTheDocument();
  });

  it("mounts the import batch detail dialog when batch detail exists and provenance is closed", () => {
    render(
      <AdminOverviewPage
        {...createProps({
          importBatchDetail: createAssetBatchDetail("project-live-1"),
          selectedImportItemIds: ["import-item-1"],
        })}
      />,
    );

    expect(screen.getByRole("dialog", { name: t("asset.detail.title") })).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: t("asset.provenance.title") }),
    ).not.toBeInTheDocument();
  });

  it("prioritizes the provenance dialog over the import batch dialog", () => {
    render(
      <AdminOverviewPage
        {...createProps({
          importBatchDetail: createAssetBatchDetail("project-live-1"),
          assetProvenanceDetail: createAssetProvenanceDetail("project-live-1"),
        })}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: t("asset.provenance.title") }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: t("asset.detail.title") }),
    ).not.toBeInTheDocument();
  });
});
