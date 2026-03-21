import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTranslator } from "../../i18n";
import { AdminOverviewPage } from "./AdminOverviewPage";
import {
  createAssetBatchDetail,
  createAssetMonitor,
  createAssetProvenanceDetail,
} from "./assetMonitor.test-data";
import type { AdminGovernanceViewModel } from "./governance";
import type { WorkflowMonitorViewModel, WorkflowRunDetailViewModel } from "./workflow";

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
  const workflowMonitor: WorkflowMonitorViewModel = {
    filters: {
      status: "",
      workflowType: "",
    },
    runs: [
      {
        id: "workflow-run-1",
        projectId: "project-live-1",
        resourceId: "shot-exec-live-1",
        workflowType: "shot_pipeline",
        status: "running",
        provider: "seedance",
        currentStep: "attempt_1.gateway",
        attemptCount: 1,
        lastError: "",
        externalRequestId: "request-1",
        createdAt: "2024-03-09T16:00:00.000Z",
        updatedAt: "2024-03-09T16:05:00.000Z",
      },
      {
        id: "workflow-run-2",
        projectId: "project-live-1",
        resourceId: "shot-exec-live-2",
        workflowType: "shot_pipeline",
        status: "failed",
        provider: "seedance",
        currentStep: "attempt_2.gateway",
        attemptCount: 2,
        lastError: "gateway timeout",
        externalRequestId: "request-2",
        createdAt: "2024-03-09T16:06:00.000Z",
        updatedAt: "2024-03-09T16:10:00.000Z",
      },
    ],
  };
  const assetMonitor = createAssetMonitor("project-live-1");
  const assetDetail = createAssetBatchDetail("project-live-1");
  const assetProvenanceDetail = createAssetProvenanceDetail("project-live-1");
  const actionableAssetDetail = {
    ...createAssetBatchDetail("project-live-1"),
    items: [
      {
        id: "import-item-1",
        status: "confirmed",
        assetId: "media-asset-1",
      },
      {
        id: "import-item-2",
        status: "matched_pending_confirm",
        assetId: "media-asset-2",
      },
      {
        id: "import-item-3",
        status: "pending_review",
        assetId: "",
      },
      {
        id: "import-item-4",
        status: "matched_pending_confirm",
        assetId: "media-asset-4",
      },
    ],
    candidateAssets: [
      {
        id: "candidate-1",
        shotExecutionId: "shot-exec-1",
        assetId: "media-asset-1",
        sourceRunId: "workflow-run-1",
      },
      {
        id: "candidate-2",
        shotExecutionId: "",
        assetId: "media-asset-2",
        sourceRunId: "workflow-run-2",
      },
      {
        id: "candidate-3",
        shotExecutionId: "shot-exec-3",
        assetId: "",
        sourceRunId: "workflow-run-3",
      },
    ],
  };
  const workflowDetail: WorkflowRunDetailViewModel = {
    run: workflowMonitor.runs[1]!,
    steps: [
      {
        id: "step-1",
        workflowRunId: "workflow-run-2",
        stepKey: "attempt_2.dispatch",
        stepOrder: 1,
        status: "completed",
        errorCode: "",
        errorMessage: "",
        startedAt: "2024-03-09T16:06:00.000Z",
        completedAt: "2024-03-09T16:06:05.000Z",
        failedAt: "",
      },
      {
        id: "step-2",
        workflowRunId: "workflow-run-2",
        stepKey: "attempt_2.gateway",
        stepOrder: 2,
        status: "failed",
        errorCode: "provider_error",
        errorMessage: "gateway timeout",
        startedAt: "2024-03-09T16:06:06.000Z",
        completedAt: "",
        failedAt: "2024-03-09T16:10:00.000Z",
      },
    ],
  };
  const runningWorkflowDetail: WorkflowRunDetailViewModel = {
    ...workflowDetail,
    run: workflowMonitor.runs[0]!,
    steps: [
      {
        id: "step-running-1",
        workflowRunId: "workflow-run-1",
        stepKey: "attempt_1.gateway",
        stepOrder: 2,
        status: "running",
        errorCode: "",
        errorMessage: "",
        startedAt: "2024-03-09T16:00:10.000Z",
        completedAt: "",
        failedAt: "",
      },
    ],
  };
  const succeededWorkflowDetail: WorkflowRunDetailViewModel = {
    ...workflowDetail,
    run: {
      ...workflowDetail.run,
      id: "workflow-run-3",
      status: "succeeded",
      currentStep: "attempt_1.gateway",
      lastError: "",
    },
  };

  it("renders budget, billing, and review overview cards", () => {
    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
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
    expect(screen.getByText("工作流监控")).toBeInTheDocument();
    expect(screen.getByText("资产监控")).toBeInTheDocument();
    expect(screen.getByText("import-batch-1")).toBeInTheDocument();
    expect(screen.getByText("workflow-run-1")).toBeInTheDocument();
    expect(screen.getByText(/attempt_1\.gateway/)).toBeInTheDocument();
  });

  it("allows submitting a new budget limit", () => {
    const onUpdateBudgetLimit = vi.fn();

    const { rerender } = render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
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
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
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
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
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
    expect(screen.getByText("Workflow Monitor")).toBeInTheDocument();
    expect(screen.getByText("Asset Monitor")).toBeInTheDocument();

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
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
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

  it("filters workflow runs and opens the workflow detail drawer", () => {
    const onWorkflowStatusFilterChange = vi.fn();
    const onWorkflowTypeFilterChange = vi.fn();
    const onSelectWorkflowRun = vi.fn();
    const onCloseWorkflowDetail = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        workflowRunDetail={workflowDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onWorkflowStatusFilterChange={onWorkflowStatusFilterChange}
        onWorkflowTypeFilterChange={onWorkflowTypeFilterChange}
        onSelectWorkflowRun={onSelectWorkflowRun}
        onCloseWorkflowDetail={onCloseWorkflowDetail}
      />,
    );

    fireEvent.change(screen.getByLabelText("工作流状态过滤"), {
      target: { value: "failed" },
    });
    fireEvent.change(screen.getByLabelText("工作流类型过滤"), {
      target: { value: "shot_pipeline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查看工作流详情 workflow-run-2" }));

    expect(onWorkflowStatusFilterChange).toHaveBeenCalledWith("failed");
    expect(onWorkflowTypeFilterChange).toHaveBeenCalledWith("shot_pipeline");
    expect(onSelectWorkflowRun).toHaveBeenCalledWith("workflow-run-2");
    expect(screen.getByRole("dialog", { name: "工作流详情" })).toBeInTheDocument();
    expect(screen.getByText(/provider_error/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭工作流详情" }));
    expect(onCloseWorkflowDetail).toHaveBeenCalled();
  });

  it("filters asset batches and opens detail plus provenance dialogs", () => {
    const onAssetStatusFilterChange = vi.fn();
    const onAssetSourceTypeFilterChange = vi.fn();
    const onSelectImportBatch = vi.fn();
    const onCloseImportBatchDetail = vi.fn();
    const onSelectAssetProvenance = vi.fn();
    const onCloseAssetProvenance = vi.fn();

    const { rerender } = render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        importBatchDetail={assetDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onAssetStatusFilterChange={onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={onAssetSourceTypeFilterChange}
        onSelectImportBatch={onSelectImportBatch}
        onCloseImportBatchDetail={onCloseImportBatchDetail}
        onSelectAssetProvenance={onSelectAssetProvenance}
        onCloseAssetProvenance={onCloseAssetProvenance}
      />,
    );

    fireEvent.change(screen.getByLabelText("资产状态过滤"), {
      target: { value: "matched_pending_confirm" },
    });
    fireEvent.change(screen.getByLabelText("资产来源过滤"), {
      target: { value: "workflow_import" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查看导入批次详情 import-batch-1" }));

    expect(onAssetStatusFilterChange).toHaveBeenCalledWith("matched_pending_confirm");
    expect(onAssetSourceTypeFilterChange).toHaveBeenCalledWith("workflow_import");
    expect(onSelectImportBatch).toHaveBeenCalledWith("import-batch-1");

    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
    expect(screen.getByText("hero.png")).toBeInTheDocument();
    expect(screen.getByText("candidate-1")).toBeInTheDocument();
    expect(screen.getAllByText("media-asset-1").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "查看资源来源 media-asset-1" })[0]!);

    expect(onSelectAssetProvenance).toHaveBeenCalledWith("media-asset-1");

    rerender(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        importBatchDetail={assetDetail}
        assetProvenanceDetail={assetProvenanceDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onAssetStatusFilterChange={onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={onAssetSourceTypeFilterChange}
        onSelectImportBatch={onSelectImportBatch}
        onCloseImportBatchDetail={onCloseImportBatchDetail}
        onSelectAssetProvenance={onSelectAssetProvenance}
        onCloseAssetProvenance={onCloseAssetProvenance}
      />,
    );

    expect(screen.getByRole("dialog", { name: "资源来源详情" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "导入批次详情" })).not.toBeInTheDocument();
    expect(screen.getByText(/source_type=upload_session/)).toBeInTheDocument();
    expect(screen.getByText("候选资源 ID：candidate-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭资源来源详情" }));
    expect(onCloseAssetProvenance).toHaveBeenCalled();

    rerender(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        importBatchDetail={assetDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onAssetStatusFilterChange={onAssetStatusFilterChange}
        onAssetSourceTypeFilterChange={onAssetSourceTypeFilterChange}
        onSelectImportBatch={onSelectImportBatch}
        onCloseImportBatchDetail={onCloseImportBatchDetail}
        onSelectAssetProvenance={onSelectAssetProvenance}
        onCloseAssetProvenance={onCloseAssetProvenance}
      />,
    );

    expect(screen.getByRole("dialog", { name: "导入批次详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭导入批次详情" }));
    expect(onCloseImportBatchDetail).toHaveBeenCalled();
  });

  it("traps focus inside the workflow detail dialog and locks background scroll", async () => {
    const onCloseWorkflowDetail = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        workflowRunDetail={workflowDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onCloseWorkflowDetail={onCloseWorkflowDetail}
      />,
    );

    const closeButton = screen.getByRole("button", { name: "关闭工作流详情" });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "重试工作流" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseWorkflowDetail).toHaveBeenCalled();
  });

  it("traps focus inside asset dialogs and closes the topmost dialog on Escape", async () => {
    const onCloseImportBatchDetail = vi.fn();
    const onCloseAssetProvenance = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        importBatchDetail={assetDetail}
        assetProvenanceDetail={assetProvenanceDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onCloseImportBatchDetail={onCloseImportBatchDetail}
        onCloseAssetProvenance={onCloseAssetProvenance}
      />,
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "关闭资源来源详情" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "关闭资源来源详情" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseAssetProvenance).toHaveBeenCalled();
    expect(onCloseImportBatchDetail).not.toHaveBeenCalled();
  });

  it("shows single-item, bulk, and primary-asset actions only for actionable asset rows", () => {
    const onToggleImportBatchItemSelection = vi.fn();
    const onConfirmImportBatchItem = vi.fn();
    const onConfirmSelectedImportBatchItems = vi.fn();
    const onConfirmAllImportBatchItems = vi.fn();
    const onSelectPrimaryAsset = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        importBatchDetail={actionableAssetDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        selectedImportItemIds={["import-item-2"]}
        onToggleImportBatchItemSelection={onToggleImportBatchItemSelection}
        onConfirmImportBatchItem={onConfirmImportBatchItem}
        onConfirmSelectedImportBatchItems={onConfirmSelectedImportBatchItems}
        onConfirmAllImportBatchItems={onConfirmAllImportBatchItems}
        onSelectPrimaryAsset={onSelectPrimaryAsset}
        assetActionFeedback={{
          tone: "success",
          message: "已确认所选匹配",
        }}
      />,
    );

    expect(screen.getByText("已确认所选匹配")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认已选项" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "确认全部可确认项" })).toBeEnabled();
    expect(screen.getByText("已选 1 项 / 可确认 2 项")).toBeInTheDocument();

    const actionableCheckbox = screen.getByRole("checkbox", {
      name: "选择导入条目 import-item-2",
    });
    expect(actionableCheckbox).toBeChecked();
    fireEvent.click(actionableCheckbox);
    expect(onToggleImportBatchItemSelection).toHaveBeenCalledWith({
      itemId: "import-item-2",
      checked: false,
    });

    expect(
      screen.queryByRole("checkbox", {
        name: "选择导入条目 import-item-1",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: "选择导入条目 import-item-3",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认导入条目 import-item-2" }));
    expect(onConfirmImportBatchItem).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemId: "import-item-2",
    });

    fireEvent.click(screen.getByRole("button", { name: "确认已选项" }));
    expect(onConfirmSelectedImportBatchItems).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-2"],
    });

    fireEvent.click(screen.getByRole("button", { name: "确认全部可确认项" }));
    expect(onConfirmAllImportBatchItems).toHaveBeenCalledWith({
      importBatchId: "import-batch-1",
      itemIds: ["import-item-2", "import-item-4"],
    });

    fireEvent.click(screen.getByRole("button", { name: "设置候选资源 candidate-1 为主素材" }));
    expect(onSelectPrimaryAsset).toHaveBeenCalledWith({
      shotExecutionId: "shot-exec-1",
      assetId: "media-asset-1",
    });

    expect(
      screen.queryByRole("button", { name: "设置候选资源 candidate-2 为主素材" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "设置候选资源 candidate-3 为主素材" }),
    ).not.toBeInTheDocument();
  });

  it("disables asset action controls while an asset action is pending", () => {
    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        importBatchDetail={actionableAssetDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        selectedImportItemIds={["import-item-2"]}
        assetActionPending
        assetActionFeedback={{
          tone: "pending",
          message: "正在确认已选匹配",
        }}
      />,
    );

    expect(screen.getByText("正在确认已选匹配")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "选择导入条目 import-item-2" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认导入条目 import-item-2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认已选项" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认全部可确认项" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "设置候选资源 candidate-1 为主素材" })).toBeDisabled();
  });

  it("shows retry action for failed workflow details and renders workflow feedback", () => {
    const onRetryWorkflowRun = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        assetMonitor={assetMonitor}
        workflowMonitor={workflowMonitor}
        workflowRunDetail={workflowDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onRetryWorkflowRun={onRetryWorkflowRun}
        workflowActionFeedback={{
          tone: "pending",
          message: "正在重试工作流",
        }}
        workflowActionPending
      />,
    );

    expect(screen.getByRole("button", { name: "重试工作流" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "取消工作流" })).not.toBeInTheDocument();
    expect(screen.getByText("正在重试工作流")).toBeInTheDocument();
  });

  it("shows cancel action for running workflow details", () => {
    const onCancelWorkflowRun = vi.fn();

    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        workflowRunDetail={runningWorkflowDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
        onCancelWorkflowRun={onCancelWorkflowRun}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "取消工作流" }));

    expect(onCancelWorkflowRun).toHaveBeenCalledWith("workflow-run-1");
    expect(screen.queryByRole("button", { name: "重试工作流" })).not.toBeInTheDocument();
  });

  it("does not show workflow action buttons for succeeded workflow details", () => {
    render(
      <AdminOverviewPage
        overview={overview}
        governance={governance}
        workflowMonitor={workflowMonitor}
        assetMonitor={assetMonitor}
        workflowRunDetail={succeededWorkflowDetail}
        locale="zh-CN"
        t={createTranslator("zh-CN")}
        onLocaleChange={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "重试工作流" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消工作流" })).not.toBeInTheDocument();
  });
});
