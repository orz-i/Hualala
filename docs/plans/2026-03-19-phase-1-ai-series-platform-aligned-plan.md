# AI 剧集平台 Phase 1 对齐版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可运行的 Phase 1 MVP，让小型短剧工作室能在系统内完成项目立项、文本生产、镜头拆解、外部视觉素材导入与挂接、导演抽检、动态样片预演，并具备高价值 AI 长链路 DAG 编排与成本守卫能力。

**Architecture:** 采用单仓多应用结构：`apps/backend` 提供 Go 服务、Connect RPC、SSE、上传会话与高价值工作流编排；`apps/creator` 提供 Tauri 创作工作台；`apps/admin` 提供 Web 管理后台；`proto/` 管理业务协议；`packages/sdk` 提供前端统一通信层。后端按 `Shot` 结构骨架、`ShotExecution` 当前执行态、`ShotExecutionRun` 执行轮次、`ShotReview` 审核事件流拆分镜头主链；高价值长链路任务接入 Temporal，普通异步任务继续走 `jobs`；只共享 `proto/sdk`，不共享 UI 与业务 ViewModel。

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
- Create: `proto/hualala/execution/v1/execution.proto`
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
service ExecutionService {
  rpc GetShotExecution(GetShotExecutionRequest) returns (GetShotExecutionResponse);
  rpc ListShotExecutionRuns(ListShotExecutionRunsRequest) returns (ListShotExecutionRunsResponse);
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

### Task 3: 实现组织、项目与镜头结构骨架主链

**范围:** `org / project / content`

**核心文件:**
- `apps/backend/internal/domain/content/shot.go`
- `apps/backend/internal/application/contentapp/service.go`
- `apps/backend/internal/interfaces/connect/content_handler.go`
- `apps/backend/internal/platform/db/content_repository.go`
- `infra/migrations/0001_init_org_project.sql`
- `infra/migrations/0002_init_story_content.sql`

**关键要求:**
- `Shot` 只保留结构骨架字段，不再出现主素材、执行状态、审核状态
- 项目创建后仍自动初始化默认生产阶段
- `content/v1` 只返回结构骨架对象

**验证:**
- `go test ./apps/backend/internal/application/projectapp ./apps/backend/internal/application/contentapp -v`
- 期望：PASS，`Shot` 仅包含 `lifecycle_status / shot_size / camera_move / subject_action / composition_notes / continuity_notes`

### Task 4: 实现镜头执行域与执行轮次模型

**范围:** `execution / execution/v1`

**核心文件:**
- `apps/backend/internal/domain/execution/execution.go`
- `apps/backend/internal/domain/execution/run.go`
- `apps/backend/internal/application/executionapp/service.go`
- `apps/backend/internal/interfaces/connect/execution_handler.go`
- `apps/backend/internal/platform/db/execution_repository.go`
- `infra/migrations/0003_init_shot_execution.sql`
- `proto/hualala/execution/v1/execution.proto`

**关键要求:**
- `ShotExecution` 作为当前态表，一镜头只保留一条当前记录
- `ShotExecutionRun` 作为历史轮次表，承接初次执行、返工、重跑、替换
- `ExecutionService` 成为镜头执行工作台主接口

**验证:**
- `go test ./apps/backend/internal/application/executionapp -v`
- 期望：PASS，启动执行后会创建当前执行态并生成首条 `run_no = 1` 的执行轮次

### Task 5: 实现工作流双层模型并绑定执行轮次

**范围:** `workflow / jobs / temporal`

**核心文件:**
- `apps/backend/internal/application/workflowapp/service.go`
- `apps/backend/internal/platform/temporal/workflows/high_value_generation.go`
- `apps/backend/internal/platform/db/workflow_repository.go`
- `apps/backend/internal/platform/db/job_repository.go`
- `infra/migrations/0004_init_workflow_core.sql`
- `proto/hualala/workflow/v1/workflow.proto`

**关键要求:**
- 高价值工作流资源绑定点改为 `shot_execution_run`
- `jobs` 保持统一观察面，`workflow_runs` 保持编排真相
- `state_transitions` 记录执行态推进与工作流推进

**验证:**
- `go test ./apps/backend/internal/application/workflowapp -v`
- 期望：PASS，`StartWorkflow` 可基于 `shot_execution_run` 创建 `workflow_run` 并同步 `job.backend_kind = temporal`

### Task 6: 实现外部素材导入与执行态挂接

**范围:** `asset / upload / import`

**核心文件:**
- `apps/backend/internal/application/assetapp/service.go`
- `apps/backend/internal/interfaces/connect/asset_handler.go`
- `apps/backend/internal/interfaces/upload/upload_handler.go`
- `apps/backend/internal/platform/db/asset_repository.go`
- `infra/migrations/0005_init_asset_import.sql`
- `proto/hualala/asset/v1/asset.proto`

**关键要求:**
- 导入确认后更新 `ShotExecution.primary_asset_id`
- 候选池主挂 `shot_execution_id`，可选挂 `shot_execution_run_id`
- `shot_asset_links` 仅保留兼容写读窗口
- `media_assets` 继续允许 `audio` 并保留来源凭证扩展位

**验证:**
- `go test ./apps/backend/internal/application/assetapp -v`
- 期望：PASS，导入确认可把素材放入候选池并提升为当前执行态主素材

### Task 7: 实现审核事件流与返工链路

**范围:** `review / review/v1`

**核心文件:**
- `apps/backend/internal/domain/review/review.go`
- `apps/backend/internal/application/reviewapp/service.go`
- `apps/backend/internal/interfaces/connect/review_handler.go`
- `apps/backend/internal/platform/db/review_repository.go`
- `infra/migrations/0006_init_shot_review.sql`
- `proto/hualala/review/v1/review.proto`

**关键要求:**
- `ShotReview` 必有 `shot_id`，可选关联执行态、执行轮次和资产
- 审核记录改为事件流，不再承担“当前审核态唯一真相”
- 驳回审核可把 `ShotExecution.current_status` 推进到 `rework_required`

**验证:**
- `go test ./apps/backend/internal/application/reviewapp -v`
- 期望：PASS，导演抽检和关键镜头审核都能写成时间线事件，并可驱动返工

### Task 8: 实现使用量计量、预算守卫与 Billing 接口

**范围:** `usage / billing / billing/v1`

**核心文件:**
- `apps/backend/internal/application/usageapp/service.go`
- `apps/backend/internal/application/billingapp/service.go`
- `apps/backend/internal/interfaces/connect/billing_handler.go`
- `apps/backend/internal/platform/pricing/catalog.go`
- `apps/backend/internal/platform/budget/guard.go`
- `infra/migrations/0007_init_usage_billing.sql`
- `proto/hualala/billing/v1/billing.proto`

**关键要求:**
- 成本归因点统一落在 `shot_execution_run`
- 超预算工作流在执行前被拦截
- 允许的执行链会写入 `usage_records` 与 `billing_events`

**验证:**
- `go test ./apps/backend/internal/application/billingapp ./apps/backend/internal/application/usageapp -v`
- 期望：PASS，超预算执行轮次被拒绝，允许任务可完成 usage 与告警审计

### Task 9: 实现 Tauri 创作端镜头工作台

**范围:** `creator`

**核心文件:**
- `apps/creator/src/routes/shot-workbench.tsx`
- `apps/creator/src/components/shot-structure-panel.tsx`
- `apps/creator/src/components/shot-execution-panel.tsx`
- `apps/creator/src/components/shot-review-timeline.tsx`
- `apps/creator/src/components/import-batch-panel.tsx`
- `apps/creator/src/components/workflow-run-status.tsx`
- `apps/creator/src/components/budget-block-banner.tsx`

**关键要求:**
- 工作台固定为三块：结构骨架、当前执行态、审核时间线
- 触发高成本操作前必须显示预算拦截反馈
- 页面读模型不再直接依赖“大一统 Shot”

**验证:**
- `pnpm --filter creator test`
- 期望：PASS，页面能同时展示“镜头结构”“执行状态”“审核时间线”

### Task 10: 实现 Web 管理端执行与治理视图

**范围:** `admin`

**核心文件:**
- `apps/admin/src/routes/shot-pipeline.tsx`
- `apps/admin/src/routes/workflow-monitor.tsx`
- `apps/admin/src/routes/budget-policies.tsx`
- `apps/admin/src/routes/import-audit.tsx`
- `apps/admin/src/components/shot-execution-table.tsx`
- `apps/admin/src/components/workflow-run-table.tsx`
- `apps/admin/src/components/budget-policy-form.tsx`

**关键要求:**
- 管理端主看板围绕执行态、工作流、预算和导入审计展开
- `ShotExecution` 列表成为执行看板主对象
- 工作流与预算页面按 `shot_execution_run` 做监控与归因

**验证:**
- `pnpm --filter admin test`
- 期望：PASS，管理端可查看镜头执行看板、工作流实例、预算策略与导入审计

### Task 11: 联调、种子数据、验收与运行文档

**范围:** `seed / e2e / runbook`

**核心文件:**
- `apps/backend/cmd/seed/main.go`
- `tooling/scripts/bootstrap-dev.mjs`
- `tooling/scripts/run-e2e.mjs`
- `tests/e2e/phase1-flow.spec.ts`
- `docs/runbooks/local-setup.md`
- `docs/runbooks/phase1-acceptance.md`
- `README.md`

**关键要求:**
- 种子数据必须覆盖 `Shot`、`ShotExecution`、`ShotExecutionRun`、`ShotReview`
- E2E 主链验证必须覆盖结构、执行、审核、工作流、预算五段
- 启动文档明确本地依赖与脚本顺序

**验证:**
- `go test ./apps/backend/...`
- `pnpm --filter @hualala/sdk test && pnpm --filter creator test && pnpm --filter admin test`
- `pnpm exec playwright test tests/e2e/phase1-flow.spec.ts`
- 期望：PASS，完整链路可从项目创建走到镜头结构、执行态推进、导演抽检、工作流监控与预算守卫

## 实施备注

- 本计划以 [2026-03-18-ai-series-platform-design.md](D:/Documents/Hualala/docs/specs/2026-03-18-ai-series-platform-design.md)、[2026-03-18-phase-1-database-design.md](D:/Documents/Hualala/docs/specs/2026-03-18-phase-1-database-design.md) 和 [2026-03-19-phase-1-monorepo-design.md](D:/Documents/Hualala/docs/specs/2026-03-19-phase-1-monorepo-design.md) 为约束源。
- Phase 1 不把 `WebSocket + CRDT`、`C2PA` 和多轨音频链路拉入主实现，但已预留边界；执行中不得误把这些后续能力塞回当前主干任务。
- Phase 1 前端共享层只允许保留 `packages/sdk`，禁止新增共享 UI 包和共享业务类型包。
