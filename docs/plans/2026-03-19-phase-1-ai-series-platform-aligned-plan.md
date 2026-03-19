# AI 剧集平台 Phase 1 对齐版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可运行的 Phase 1 MVP，让小型短剧工作室能在系统内完成项目立项、文本生产、镜头拆解、外部视觉素材导入与挂接、导演抽检、动态样片预演，并具备高价值 AI 长链路 DAG 编排与成本守卫能力。

**Architecture:** 采用单仓多应用结构：`apps/backend` 提供 Go 服务、Connect RPC、SSE、上传会话与高价值工作流编排；`apps/creator` 提供 Tauri 创作工作台；`apps/admin` 提供 Web 管理后台；`proto/` 管理业务协议；`packages/sdk` 提供前端统一通信层。高价值长链路任务接入 Temporal，普通异步任务继续走 `jobs`；只共享 `proto/sdk`，不共享 UI 与业务 ViewModel。

**Tech Stack:** Go 1.24、PostgreSQL、Connect RPC、Buf、SSE、Upload Session、Temporal、对象存储适配层、pnpm workspace、turbo、React、Vite、Tauri 2、Tailwind CSS、shadcn/ui、Vitest、React Testing Library、Playwright

---

## 仓库结构与职责映射

### 顶层目录

- `apps/backend`: 后端应用与分层代码
- `apps/creator`: Tauri 创作端
- `apps/admin`: Web 管理端
- `proto`: 协议唯一事实源
- `packages/sdk`: Connect/SSE/Upload Session 前端通信层
- `tooling`: 代码生成、本地开发、测试辅助脚本
- `infra/migrations`: 数据库迁移
- `infra/env`: 环境模板

### 后端分层

- `apps/backend/internal/domain`: 领域模型与规则
- `apps/backend/internal/application`: 用例编排
- `apps/backend/internal/interfaces`: Connect/SSE/HTTP/Upload 适配层
- `apps/backend/internal/platform`: PostgreSQL、Temporal、对象存储、价格映射、预算守卫等技术实现

### 本计划与旧计划的关系

- 本计划替代 [2026-03-18-phase-1-ai-series-platform.md](D:/Documents/Hualala/docs/plans/2026-03-18-phase-1-ai-series-platform.md) 作为正式执行基线
- 旧计划保留为历史草稿，不再作为落地目录和任务顺序依据

---

### Task 1: 初始化 monorepo、Turbo、Buf 与共享通信层

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `buf.yaml`
- Create: `buf.gen.yaml`
- Create: `.editorconfig`
- Create: `.env.example`
- Create: `README.md`
- Create: `tooling/scripts/gen-proto.mjs`
- Create: `tooling/scripts/dev.mjs`
- Create: `tooling/scripts/test.mjs`
- Create: `proto/hualala/common/v1/common.proto`
- Create: `proto/hualala/auth/v1/auth.proto`
- Create: `proto/hualala/org/v1/org.proto`
- Create: `proto/hualala/project/v1/project.proto`
- Create: `proto/hualala/content/v1/content.proto`
- Create: `proto/hualala/asset/v1/asset.proto`
- Create: `proto/hualala/workflow/v1/workflow.proto`
- Create: `proto/hualala/billing/v1/billing.proto`
- Create: `proto/hualala/review/v1/review.proto`
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/src/gen/.gitkeep`
- Create: `packages/sdk/src/connect.ts`
- Create: `packages/sdk/src/events.ts`
- Create: `packages/sdk/src/uploads.ts`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/__tests__/sdk.spec.ts`

- [ ] **Step 1: 写共享协议与 SDK 工厂的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { createClientFactories } from "../connect";

describe("sdk factories", () => {
  it("builds rpc, sse and upload endpoints from one config", () => {
    const sdk = createClientFactories({
      baseHttpUrl: "http://localhost:8080",
      organizationId: "org_001",
    });

    expect(sdk.rpcBaseUrl).toBe("http://localhost:8080/rpc");
    expect(sdk.eventsUrl).toBe("http://localhost:8080/events/stream");
    expect(sdk.organizationId).toBe("org_001");
  });
});
```

- [ ] **Step 2: 初始化 workspace、Turbo、Buf 和 SDK 骨架**

Run: `pnpm install`

Expected: 根目录生成锁文件，`packages/sdk` 可被 `pnpm --filter @hualala/sdk test` 识别。

- [ ] **Step 3: 定义 proto 包与前端通信层**

```proto
service BillingService {
  rpc GetBudgetSnapshot(GetBudgetSnapshotRequest) returns (GetBudgetSnapshotResponse);
  rpc ListUsageRecords(ListUsageRecordsRequest) returns (ListUsageRecordsResponse);
}
```

```ts
export function createClientFactories(config: SDKConfig) {
  return {
    rpcBaseUrl: `${config.baseHttpUrl}/rpc`,
    eventsUrl: `${config.baseHttpUrl}/events/stream`,
    uploadsUrl: `${config.baseHttpUrl}/upload-sessions`,
    organizationId: config.organizationId,
  };
}
```

- [ ] **Step 4: 运行 proto 生成与 SDK 测试**

Run: `node tooling/scripts/gen-proto.mjs`
Expected: `apps/backend/gen` 与 `packages/sdk/src/gen` 产出生成代码。

Run: `pnpm --filter @hualala/sdk test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json buf.yaml buf.gen.yaml .editorconfig .env.example README.md tooling proto packages/sdk
git commit -m "chore: initialize monorepo, proto, and sdk foundation"
```

### Task 2: 搭建 Go 后端底座、分层骨架与基础传输层

**Files:**
- Create: `apps/backend/go.mod`
- Create: `apps/backend/cmd/api/main.go`
- Create: `apps/backend/internal/app/app.go`
- Create: `apps/backend/internal/interfaces/http/router.go`
- Create: `apps/backend/internal/interfaces/http/handlers/health.go`
- Create: `apps/backend/internal/interfaces/connect/router.go`
- Create: `apps/backend/internal/interfaces/connect/interceptors/auth.go`
- Create: `apps/backend/internal/interfaces/sse/hub.go`
- Create: `apps/backend/internal/interfaces/sse/handler.go`
- Create: `apps/backend/internal/interfaces/upload/handler.go`
- Create: `apps/backend/internal/platform/config/config.go`
- Create: `apps/backend/internal/platform/db/postgres.go`
- Create: `apps/backend/internal/platform/events/outbox.go`
- Create: `apps/backend/internal/platform/storage/storage.go`
- Create: `apps/backend/internal/platform/storage/local.go`
- Create: `apps/backend/internal/platform/temporal/client.go`
- Create: `apps/backend/internal/interfaces/http/handlers/health_test.go`
- Create: `apps/backend/internal/interfaces/sse/handler_test.go`

- [ ] **Step 1: 写健康检查与 SSE 的失败测试**

```go
func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	NewHealthHandler().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "ok")
}
```

```go
func TestSSEHandlerAcceptsConnection(t *testing.T) {
	hub := NewHub()
	req := httptest.NewRequest(http.MethodGet, "/events/stream", nil)
	rec := httptest.NewRecorder()

	NewHandler(hub).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
}
```

- [ ] **Step 2: 初始化 Go module 与应用装配骨架**

Run: `go test ./apps/backend/...`

Expected: FAIL，提示 handler 或 router 未定义。

- [ ] **Step 3: 实现配置、路由、SSE、Upload 和 Temporal 客户端骨架**

```go
type Storage interface {
	Put(ctx context.Context, key string, body io.Reader) (string, error)
}
```

```go
type WorkflowEngine interface {
	Start(ctx context.Context, input StartWorkflowInput) (StartWorkflowResult, error)
}
```

- [ ] **Step 4: 跑基础设施测试**

Run: `go test ./apps/backend/...`

Expected: PASS，`/healthz` 返回成功，SSE 可建立连接，Temporal 客户端可被装配。

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat: bootstrap backend composition root and transports"
```

### Task 3: 实现组织、项目与文本生产主链路

**Files:**
- Create: `apps/backend/internal/domain/org/member.go`
- Create: `apps/backend/internal/domain/org/repository.go`
- Create: `apps/backend/internal/domain/project/project.go`
- Create: `apps/backend/internal/domain/content/story_bible.go`
- Create: `apps/backend/internal/domain/content/script.go`
- Create: `apps/backend/internal/domain/content/storyboard.go`
- Create: `apps/backend/internal/domain/content/shot.go`
- Create: `apps/backend/internal/application/orgapp/service.go`
- Create: `apps/backend/internal/application/projectapp/service.go`
- Create: `apps/backend/internal/application/contentapp/service.go`
- Create: `apps/backend/internal/interfaces/connect/project_handler.go`
- Create: `apps/backend/internal/interfaces/connect/content_handler.go`
- Create: `apps/backend/internal/platform/db/org_repository.go`
- Create: `apps/backend/internal/platform/db/project_repository.go`
- Create: `apps/backend/internal/platform/db/content_repository.go`
- Create: `infra/migrations/0001_init_org_project.sql`
- Create: `infra/migrations/0002_init_story_content.sql`
- Create: `apps/backend/internal/application/projectapp/project_test.go`

- [ ] **Step 1: 写项目创建与默认生产阶段的失败测试**

```go
func TestCreateProjectCreatesDefaultStages(t *testing.T) {
	svc := newProjectServiceForTest(t)

	project, err := svc.CreateProject(context.Background(), CreateProjectInput{
		OrganizationID: "org_001",
		Name:           "短剧样板项目",
	})

	require.NoError(t, err)
	require.Len(t, project.DefaultStages, 7)
}
```

- [ ] **Step 2: 创建组织、项目与内容主链迁移**

Run: `go test ./apps/backend/internal/application/projectapp -run TestCreateProjectCreatesDefaultStages -v`

Expected: FAIL，提示表结构或 service 缺失。

- [ ] **Step 3: 实现领域模型、应用服务与 Connect handler**

```go
type Shot struct {
	ID              string
	StoryboardID    string
	Name            string
	Status          string
	ShotSize        string
	CameraMove      string
	SubjectAction   *string
	ContinuityNotes []byte
	PrimaryAssetID  *string
}
```

- [ ] **Step 4: 运行项目与内容模块测试**

Run: `go test ./apps/backend/internal/application/...`

Expected: PASS，项目创建后具备默认阶段和文本生产骨架。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal infra/migrations
git commit -m "feat: add organization, project, and content flow"
```

### Task 4: 实现工作流双层模型与 Temporal 编排桥接

**Files:**
- Create: `apps/backend/internal/domain/workflow/run.go`
- Create: `apps/backend/internal/domain/workflow/step.go`
- Create: `apps/backend/internal/domain/workflow/repository.go`
- Create: `apps/backend/internal/application/workflowapp/service.go`
- Create: `apps/backend/internal/application/workflowapp/router.go`
- Create: `apps/backend/internal/interfaces/connect/workflow_handler.go`
- Create: `apps/backend/internal/platform/db/workflow_repository.go`
- Create: `apps/backend/internal/platform/db/job_repository.go`
- Create: `apps/backend/internal/platform/temporal/workflows/high_value_generation.go`
- Create: `apps/backend/internal/platform/temporal/activities/content_activity.go`
- Create: `apps/backend/internal/platform/temporal/activities/preview_activity.go`
- Create: `infra/migrations/0003_init_workflow_core.sql`
- Create: `proto/hualala/workflow/v1/workflow.proto`
- Create: `apps/backend/internal/application/workflowapp/workflow_test.go`

- [ ] **Step 1: 写高价值工作流实例创建与 job 桥接的失败测试**

```go
func TestStartWorkflowCreatesWorkflowRunAndJob(t *testing.T) {
	svc := newWorkflowServiceForTest(t)

	result, err := svc.StartWorkflow(context.Background(), StartWorkflowInput{
		OrganizationID: "org_001",
		ProjectID:      "proj_001",
		ResourceType:   "storyboard",
		ResourceID:     "sb_001",
		WorkflowType:   "preview_generation",
	})

	require.NoError(t, err)
	require.Equal(t, "temporal", result.Job.BackendKind)
	require.NotEmpty(t, result.WorkflowRunID)
}
```

- [ ] **Step 2: 建立 `jobs / workflow_runs / workflow_steps / state_transitions` 迁移**

Run: `go test ./apps/backend/internal/application/workflowapp -v`

Expected: FAIL，提示 repository 或 workflow start 未实现。

- [ ] **Step 3: 实现工作流服务、Temporal 适配和 `jobs` 统一观察面**

```go
type Job struct {
	ID            string
	BackendKind   string
	WorkflowRunID *string
	Status        string
	EstimatedCost *decimal.Decimal
	ActualCost    *decimal.Decimal
}
```

- [ ] **Step 4: 跑 workflow 模块测试**

Run: `go test ./apps/backend/internal/application/workflowapp -v`

Expected: PASS，高价值长链路任务可创建 `workflow_run` 并同步到 `jobs`。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal proto/hualala/workflow/v1/workflow.proto infra/migrations/0003_init_workflow_core.sql
git commit -m "feat: add workflow run model and temporal bridge"
```

### Task 5: 实现使用量计量、预算守卫与 Billing 接口

**Files:**
- Create: `apps/backend/internal/domain/usage/record.go`
- Create: `apps/backend/internal/domain/usage/repository.go`
- Create: `apps/backend/internal/domain/billing/policy.go`
- Create: `apps/backend/internal/domain/billing/event.go`
- Create: `apps/backend/internal/domain/billing/repository.go`
- Create: `apps/backend/internal/application/usageapp/service.go`
- Create: `apps/backend/internal/application/billingapp/service.go`
- Create: `apps/backend/internal/interfaces/connect/billing_handler.go`
- Create: `apps/backend/internal/platform/db/usage_repository.go`
- Create: `apps/backend/internal/platform/db/billing_repository.go`
- Create: `apps/backend/internal/platform/pricing/catalog.go`
- Create: `apps/backend/internal/platform/budget/guard.go`
- Create: `infra/migrations/0004_init_usage_billing.sql`
- Create: `proto/hualala/billing/v1/billing.proto`
- Create: `apps/backend/internal/application/billingapp/billing_test.go`

- [ ] **Step 1: 写预算拒绝与 usage 记录的失败测试**

```go
func TestBudgetGuardBlocksOverLimitWorkflow(t *testing.T) {
	svc := newBillingServiceForTest(t)

	err := svc.AssertCanStartWorkflow(context.Background(), AssertBudgetInput{
		OrganizationID: "org_001",
		ProjectID:      "proj_001",
		EstimatedCost:  decimal.RequireFromString("120.00"),
	})

	require.ErrorIs(t, err, ErrBudgetExceeded)
}
```

- [ ] **Step 2: 建立 `usage_records / budget_policies / billing_events` 迁移**

Run: `go test ./apps/backend/internal/application/billingapp -v`

Expected: FAIL，提示 guard 或 repository 未实现。

- [ ] **Step 3: 实现价格映射、预算守卫、usage 记录和 BillingService**

```go
type BudgetPolicy struct {
	ID              string
	ScopeType       string
	ScopeID         string
	HardLimit       decimal.Decimal
	SoftLimit       decimal.Decimal
	EnforcementMode string
}
```

- [ ] **Step 4: 运行 billing 与 usage 模块测试**

Run: `go test ./apps/backend/internal/application/billingapp ./apps/backend/internal/application/usageapp -v`

Expected: PASS，超预算任务被阻止，允许的任务会写入 usage 与 billing events。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal proto/hualala/billing/v1/billing.proto infra/migrations/0004_init_usage_billing.sql
git commit -m "feat: add usage metering and budget guard"
```

### Task 6: 实现外部视觉素材导入、挂接与媒体预留边界

**Files:**
- Create: `apps/backend/internal/domain/asset/import_batch.go`
- Create: `apps/backend/internal/domain/asset/media_asset.go`
- Create: `apps/backend/internal/domain/asset/link.go`
- Create: `apps/backend/internal/application/assetapp/service.go`
- Create: `apps/backend/internal/interfaces/connect/asset_handler.go`
- Create: `apps/backend/internal/interfaces/upload/upload_handler.go`
- Create: `apps/backend/internal/platform/db/asset_repository.go`
- Create: `apps/backend/internal/platform/storage/upload_session.go`
- Create: `infra/migrations/0005_init_asset_import.sql`
- Modify: `proto/hualala/asset/v1/asset.proto`
- Create: `apps/backend/internal/application/assetapp/asset_test.go`

- [ ] **Step 1: 写导入批次自动匹配与音频媒体预留的失败测试**

```go
func TestImportBatchAutoMatchesByFileNameRule(t *testing.T) {
	svc := newAssetServiceForTest(t)

	result, err := svc.CreateImportBatch(context.Background(), CreateImportBatchInput{
		ProjectID: "proj_001",
		FileNames: []string{"E01-S03-SHOT012-main.png"},
	})

	require.NoError(t, err)
	require.Len(t, result.MatchResults, 1)
	require.Equal(t, "shot_012", result.MatchResults[0].ShotID)
}
```

```go
func TestMediaAssetSupportsAudioType(t *testing.T) {
	asset := NewMediaAsset("org_001", "proj_001", "audio", "audio/mpeg")
	require.Equal(t, "audio", asset.MediaType)
}
```

- [ ] **Step 2: 建立导入批次、上传会话、媒体资产与挂接关系迁移**

Run: `go test ./apps/backend/internal/application/assetapp -v`

Expected: FAIL，提示批次或媒体模型未实现。

- [ ] **Step 3: 实现导入、自动匹配、人工确认与媒体元数据预留**

```go
type MediaAsset struct {
	ID        string
	MediaType string
	Meta      json.RawMessage // reserved for provenance/content_credentials/generator_info
}
```

- [ ] **Step 4: 跑 asset 模块测试**

Run: `go test ./apps/backend/internal/application/assetapp -v`

Expected: PASS，支持导入批次、自动匹配、人工确认、主素材 / 候选素材治理以及音频媒体类型预留。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal proto/hualala/asset/v1/asset.proto infra/migrations/0005_init_asset_import.sql
git commit -m "feat: add asset import flow and media reservations"
```

### Task 7: 实现 Tauri 创作端 MVP 页面

**Files:**
- Create: `apps/creator/package.json`
- Create: `apps/creator/src/main.tsx`
- Create: `apps/creator/src/App.tsx`
- Create: `apps/creator/src/routes/project-list.tsx`
- Create: `apps/creator/src/routes/project-detail.tsx`
- Create: `apps/creator/src/routes/episode-detail.tsx`
- Create: `apps/creator/src/routes/shot-workbench.tsx`
- Create: `apps/creator/src/components/shot-status-board.tsx`
- Create: `apps/creator/src/components/import-batch-panel.tsx`
- Create: `apps/creator/src/components/workflow-run-status.tsx`
- Create: `apps/creator/src/components/budget-block-banner.tsx`
- Create: `apps/creator/src/lib/sdk.ts`
- Create: `apps/creator/src/__tests__/shot-workbench.spec.tsx`

- [ ] **Step 1: 写镜头工作台与预算拦截提示的失败测试**

```tsx
it("shows workflow status and budget block message", async () => {
  render(<ShotWorkbenchPage />);

  expect(await screen.findByText("工作流状态")).toBeInTheDocument();
  expect(screen.getByText("预算限制")).toBeInTheDocument();
});
```

- [ ] **Step 2: 初始化 creator 应用并接入 Tailwind / shadcn/ui**

Run: `pnpm --filter creator test`

Expected: FAIL，提示页面或组件未实现。

- [ ] **Step 3: 实现项目、镜头工作台、导入面板和工作流状态视图**

```tsx
<WorkflowRunStatus
  status="running"
  currentStepKey="preview_render"
  progressText="正在生成动态样片"
/>
```

- [ ] **Step 4: 运行 creator 测试**

Run: `pnpm --filter creator test`

Expected: PASS，镜头列表、导入批次面板、工作流状态和预算拦截提示可渲染。

- [ ] **Step 5: Commit**

```bash
git add apps/creator
git commit -m "feat: add creator workbench with workflow and budget feedback"
```

### Task 8: 实现 Web 管理端 MVP 页面

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/routes/org-settings.tsx`
- Create: `apps/admin/src/routes/workflow-monitor.tsx`
- Create: `apps/admin/src/routes/budget-policies.tsx`
- Create: `apps/admin/src/routes/import-audit.tsx`
- Create: `apps/admin/src/components/workflow-run-table.tsx`
- Create: `apps/admin/src/components/budget-policy-form.tsx`
- Create: `apps/admin/src/components/import-batch-table.tsx`
- Create: `apps/admin/src/lib/sdk.ts`
- Create: `apps/admin/src/__tests__/budget-policies.spec.tsx`

- [ ] **Step 1: 写预算策略页与工作流监控页的失败测试**

```tsx
it("renders budget policy form and workflow monitor", async () => {
  render(<BudgetPoliciesPage />);

  expect(await screen.findByText("预算策略")).toBeInTheDocument();
  expect(screen.getByText("工作流监控")).toBeInTheDocument();
});
```

- [ ] **Step 2: 初始化 admin 应用与路由**

Run: `pnpm --filter admin test`

Expected: FAIL，提示页面或组件不存在。

- [ ] **Step 3: 实现组织配置、工作流监控、预算策略、导入审计四页**

```tsx
<WorkflowRunTable
  rows={[
    { id: "wf_001", workflowType: "preview_generation", status: "running", currentStepKey: "render" },
  ]}
/>
```

- [ ] **Step 4: 运行 admin 测试**

Run: `pnpm --filter admin test`

Expected: PASS，管理端可查看工作流实例、预算策略和导入审计。

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat: add admin workflow monitor and budget policies"
```

### Task 9: 联调、种子数据、验收与运行文档

**Files:**
- Create: `apps/backend/cmd/seed/main.go`
- Create: `tooling/scripts/bootstrap-dev.mjs`
- Create: `tooling/scripts/run-e2e.mjs`
- Create: `tests/e2e/phase1-flow.spec.ts`
- Create: `docs/runbooks/local-setup.md`
- Create: `docs/runbooks/phase1-acceptance.md`
- Modify: `README.md`

- [ ] **Step 1: 写端到端失败测试**

```ts
test("phase 1 flow runs from project creation to workflow monitored preview", async ({ page }) => {
  await page.goto("/projects");
  await page.getByText("新建项目").click();
  await expect(page.getByText("导入批次")).toBeVisible();
  await expect(page.getByText("工作流状态")).toBeVisible();
});
```

- [ ] **Step 2: 增加本地启动脚本与种子数据程序**

Run: `pnpm exec playwright test tests/e2e/phase1-flow.spec.ts`

Expected: FAIL，提示页面或种子数据尚未准备。

- [ ] **Step 3: 实现 runbook、种子数据和启动脚本**

```bash
go run ./apps/backend/cmd/seed
pnpm --filter creator dev
pnpm --filter admin dev
go run ./apps/backend/cmd/api
```

- [ ] **Step 4: 运行全量验证**

Run: `go test ./apps/backend/...`
Expected: PASS

Run: `pnpm --filter @hualala/sdk test && pnpm --filter creator test && pnpm --filter admin test`
Expected: PASS

Run: `pnpm exec playwright test tests/e2e/phase1-flow.spec.ts`
Expected: PASS，完整链路可从项目创建走到镜头抽检、工作流监控与预算守卫。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/cmd/seed tooling tests/e2e docs/runbooks README.md
git commit -m "docs: add phase 1 runbooks and acceptance flow"
```

## 实施备注

- 本计划以 [2026-03-18-ai-series-platform-design.md](D:/Documents/Hualala/docs/specs/2026-03-18-ai-series-platform-design.md)、[2026-03-18-phase-1-database-design.md](D:/Documents/Hualala/docs/specs/2026-03-18-phase-1-database-design.md) 和 [2026-03-19-phase-1-monorepo-design.md](D:/Documents/Hualala/docs/specs/2026-03-19-phase-1-monorepo-design.md) 为约束源。
- Phase 1 不把 `WebSocket + CRDT`、`C2PA` 和多轨音频链路拉入主实现，但已预留边界；执行中不得误把这些后续能力塞回当前主干任务。
- Phase 1 前端共享层只允许保留 `packages/sdk`，禁止新增共享 UI 包和共享业务类型包。
