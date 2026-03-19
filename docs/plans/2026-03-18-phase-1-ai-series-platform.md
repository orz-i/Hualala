# AI 剧集平台 Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可运行的 Phase 1 MVP，让小型短剧工作室能在系统内完成项目立项、文本生产、镜头拆解、外部视觉素材导入与挂接、导演抽检、阶段评审，以及高价值 AI 长链路工作流编排与成本守卫。

**Architecture:** 采用单仓多应用结构：`apps/backend` 提供 Go 服务、Connect RPC、SSE、上传会话与高价值工作流编排能力，`apps/creator` 提供 Tauri 创作工作台，`apps/admin` 提供 Web 管理后台，`proto/` 管理业务协议，`packages/sdk` 提供前端统一通信层。视觉资产默认外部导入，平台负责批次管理、自动匹配、人工确认、主素材与候选素材治理；高价值长链路任务接入 Temporal，普通异步任务继续走 `jobs`。

**Tech Stack:** Go 1.24、PostgreSQL、Connect RPC、Buf、SSE、Upload Session、Temporal、对象存储适配层、pnpm workspace、React、Vite、Tauri 2、Tailwind CSS、shadcn/ui、Vitest、React Testing Library、Playwright

---

## 2026-03-19 修订说明

- 本计划的范围已被最新调研结论扩大，Phase 1 必须纳入 `DAG/工作流编排` 与 `成本计量/计费守卫`
- `proto/` 需要新增 `hualala/billing/v1`
- 高价值长链路任务以 Temporal 为主，普通异步任务继续使用 `jobs`
- 数据库迁移路径以 `infra/migrations` 为准，不再以 `apps/backend/db/migrations` 为准
- 后端目录组织以 [2026-03-19-phase-1-monorepo-design.md](D:/Documents/Hualala/docs/specs/2026-03-19-phase-1-monorepo-design.md) 为准，实施前需重排到 `domain / application / interfaces / platform`
- 本文可继续作为一期任务拆分参考，但在正式执行前应先输出一份与最新总设计和数据库设计完全对齐的修订版实施计划

### Task 1: 初始化仓库、Buf 与共享通信层

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `buf.yaml`
- Create: `buf.gen.yaml`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.env.example`
- Create: `README.md`
- Create: `proto/hualala/auth/v1/auth.proto`
- Create: `proto/hualala/org/v1/org.proto`
- Create: `proto/hualala/common/v1/common.proto`
- Create: `proto/hualala/project/v1/project.proto`
- Create: `proto/hualala/content/v1/content.proto`
- Create: `proto/hualala/asset/v1/asset.proto`
- Create: `proto/hualala/review/v1/review.proto`
- Create: `proto/hualala/workflow/v1/workflow.proto`
- Create: `proto/hualala/billing/v1/billing.proto`
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/src/connect.ts`
- Create: `packages/sdk/src/events.ts`
- Create: `packages/sdk/src/uploads.ts`
- Create: `packages/sdk/src/__tests__/sdk.spec.ts`

- [ ] **Step 1: 写共享协议与 SDK 的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { createClientFactories } from "../connect";

describe("sdk factories", () => {
  it("creates connect and upload clients from one base config", () => {
    const sdk = createClientFactories({
      baseHttpUrl: "http://localhost:8080",
      organizationId: "org_001",
    });

    expect(sdk.rpcBaseUrl).toContain("localhost:8080");
    expect(sdk.organizationId).toBe("org_001");
  });
});
```

- [ ] **Step 2: 初始化 workspace、Buf 和共享包骨架**

Run: `pnpm install`

Expected: 根目录生成锁文件，`packages/sdk` 可被测试命令解析。

- [ ] **Step 3: 定义 proto 包和前端共享通信层**

```proto
service AssetService {
  rpc CreateImportBatch(CreateImportBatchRequest) returns (CreateImportBatchResponse);
  rpc ConfirmAssetLinks(ConfirmAssetLinksRequest) returns (ConfirmAssetLinksResponse);
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

- [ ] **Step 4: 运行 proto 生成和 SDK 测试**

Run: `pnpm --filter @hualala/sdk test`

Expected: PASS，且 `buf generate` 能产出前端 / 后端可用代码。

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml buf.yaml buf.gen.yaml .gitignore .editorconfig .env.example README.md proto packages/sdk
git commit -m "chore: initialize workspace, proto and sdk foundation"
```

### Task 2: 搭建 Go 后端底座、Connect RPC 与 SSE 基础设施

**Files:**
- Create: `apps/backend/go.mod`
- Create: `apps/backend/cmd/api/main.go`
- Create: `apps/backend/internal/app/app.go`
- Create: `apps/backend/internal/config/config.go`
- Create: `apps/backend/internal/transport/http/router.go`
- Create: `apps/backend/internal/transport/http/handlers/health.go`
- Create: `apps/backend/internal/transport/connect/router.go`
- Create: `apps/backend/internal/transport/connect/interceptors/auth.go`
- Create: `apps/backend/internal/transport/sse/hub.go`
- Create: `apps/backend/internal/transport/sse/handler.go`
- Create: `apps/backend/internal/platform/db/postgres.go`
- Create: `apps/backend/internal/platform/storage/storage.go`
- Create: `apps/backend/internal/platform/storage/local.go`
- Create: `apps/backend/internal/transport/http/handlers/health_test.go`
- Create: `apps/backend/internal/transport/sse/handler_test.go`

- [ ] **Step 1: 写健康检查的失败测试**

```go
func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	NewHealthHandler().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "ok")
}
```

- [ ] **Step 2: 初始化 Go 模块与应用装配**

Run: `go test ./...`

Expected: FAIL，提示 `NewHealthHandler`、Connect router 或 SSE handler 尚未定义。

- [ ] **Step 3: 实现配置、Connect 路由、SSE Hub、健康检查和存储适配接口**

```go
type Storage interface {
	Put(ctx context.Context, key string, body io.Reader) (string, error)
}
```

- [ ] **Step 4: 跑后端单元测试**

Run: `go test ./...`

Expected: PASS，`/healthz` 可返回 `{"status":"ok"}`，SSE handler 可建立连接。

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat: bootstrap backend api foundation"
```

### Task 3: 实现组织、项目与文本生产主链路

**Files:**
- Create: `apps/backend/internal/modules/org/model.go`
- Create: `apps/backend/internal/modules/org/repository.go`
- Create: `apps/backend/internal/modules/org/service.go`
- Create: `apps/backend/internal/modules/project/model.go`
- Create: `apps/backend/internal/modules/project/repository.go`
- Create: `apps/backend/internal/modules/project/service.go`
- Create: `apps/backend/internal/modules/project/connect.go`
- Create: `apps/backend/internal/modules/project/project_test.go`
- Create: `apps/backend/db/migrations/0001_init_org_project.sql`
- Create: `apps/backend/db/migrations/0002_init_story_content.sql`

- [ ] **Step 1: 写项目创建与文本节点流转的失败测试**

```go
func TestCreateProjectCreatesDefaultEpisodeFlow(t *testing.T) {
	svc := newProjectServiceForTest(t)

	project, err := svc.CreateProject(context.Background(), CreateProjectInput{
		OrganizationID: "org_001",
		Name:           "短剧样板项目",
	})

	require.NoError(t, err)
	require.Len(t, project.DefaultStages, 6)
}
```

- [ ] **Step 2: 建立组织、项目、Story Bible、Episode、Script、Storyboard、Shot 的数据库表**

Run: `go test ./internal/modules/project -run TestCreateProjectCreatesDefaultEpisodeFlow -v`

Expected: FAIL，提示表结构或 service 缺失。

- [ ] **Step 3: 实现 repository、service 和 Connect handler**

```go
type Shot struct {
	ID             string
	StoryboardID   string
	Name           string
	Status         string
	ShotSize       string
	CameraMove     string
	SubjectAction  *string
	ContinuityNotes []byte
	PrimaryAssetID *string
}
```

- [ ] **Step 4: 运行项目模块测试**

Run: `go test ./internal/modules/...`

Expected: PASS，项目创建后具备默认流程阶段、文本生产骨架和镜头语义字段。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/modules apps/backend/db/migrations
git commit -m "feat: add organization and project content flow"
```

### Task 4: 实现版本快照、审批流、工作流状态机与 SSE 事件发布

**Files:**
- Create: `apps/backend/internal/modules/workflow/model.go`
- Create: `apps/backend/internal/modules/workflow/service.go`
- Create: `apps/backend/internal/modules/workflow/repository.go`
- Create: `apps/backend/internal/modules/workflow/connect.go`
- Create: `apps/backend/internal/modules/workflow/events.go`
- Create: `apps/backend/internal/modules/workflow/workflow_test.go`
- Create: `apps/backend/db/migrations/0003_init_workflow.sql`
- Create: `proto/hualala/workflow/v1/workflow.proto`

- [ ] **Step 1: 写镜头状态流转与审批的失败测试**

```go
func TestShotMovesToReviewAfterPrimaryAssetSelected(t *testing.T) {
	svc := newWorkflowServiceForTest(t)

	err := svc.MarkShotPrimaryAsset(context.Background(), "shot_001", "asset_001", "writer_001")
	require.NoError(t, err)

	state, err := svc.GetShotState(context.Background(), "shot_001")
	require.NoError(t, err)
	require.Equal(t, "ready_for_spot_check", state)
}
```

- [ ] **Step 2: 增加版本快照、审批任务、状态迁移表结构**

Run: `go test ./internal/modules/workflow -v`

Expected: FAIL，提示状态机或 repository 未实现。

- [ ] **Step 3: 实现状态机规则**

```go
const (
	ShotStatusDraft             = "draft"
	ShotStatusAssetsLinked      = "assets_linked"
	ShotStatusReadyForSpotCheck = "ready_for_spot_check"
	ShotStatusApproved          = "approved"
	ShotStatusRejected          = "rejected"
)
```

```go
type JobEventPublisher interface {
	PublishJobUpdated(ctx context.Context, jobID string) error
}
```

- [ ] **Step 4: 跑 workflow 测试**

Run: `go test ./internal/modules/workflow -v`

Expected: PASS，镜头可按预期流转到抽检和打回状态。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/modules/workflow apps/backend/db/migrations proto/hualala/workflow/v1/workflow.proto
git commit -m "feat: add workflow snapshots, state machine and sse events"
```

### Task 5: 实现外部视觉素材导入、批次管理与挂接

**Files:**
- Create: `apps/backend/internal/modules/asset/model.go`
- Create: `apps/backend/internal/modules/asset/repository.go`
- Create: `apps/backend/internal/modules/asset/service.go`
- Create: `apps/backend/internal/modules/asset/connect.go`
- Create: `apps/backend/internal/modules/asset/upload_http.go`
- Create: `apps/backend/internal/modules/asset/matcher.go`
- Create: `apps/backend/internal/modules/asset/asset_test.go`
- Create: `apps/backend/db/migrations/0004_init_asset_import.sql`
- Create: `proto/hualala/asset/v1/asset.proto`

- [ ] **Step 1: 写导入批次和自动匹配的失败测试**

```go
func TestImportBatchAutoMatchesByFileNameRule(t *testing.T) {
	svc := newAssetServiceForTest(t)

	result, err := svc.CreateImportBatch(context.Background(), CreateImportBatchInput{
		ProjectID:  "proj_001",
		EpisodeID:  "ep_001",
		BatchName:  "ep1-batch-01",
		FileNames:  []string{"E01-S03-SHOT012-roleA-main.png"},
	})

	require.NoError(t, err)
	require.Len(t, result.MatchResults, 1)
	require.Equal(t, "shot_012", result.MatchResults[0].ShotID)
}
```

- [ ] **Step 2: 建立素材、导入批次、挂接关系与候选素材表**

Run: `go test ./internal/modules/asset -v`

Expected: FAIL，提示批次或匹配器未实现。

- [ ] **Step 3: 实现素材导入与挂接规则**

```go
type ShotAssetLink struct {
	ShotID            string
	PrimaryAssetID    string
	CandidateAssetIDs []string
	ConfirmedBy       string
}
```

```go
type UploadSession struct {
	ID           string
	ImportBatchID string
	StorageMode  string
	Status       string
}
```

- [ ] **Step 4: 跑资产模块测试**

Run: `go test ./internal/modules/asset -v`

Expected: PASS，支持 `ImportBatch`、自动匹配、人工确认、主素材与候选素材集合。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/internal/modules/asset apps/backend/db/migrations proto/hualala/asset/v1/asset.proto
git commit -m "feat: add connect asset service and upload sessions"
```

### Task 6: 实现 Tauri 创作端 MVP 页面

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
- Create: `apps/creator/src/components/asset-selector.tsx`
- Create: `apps/creator/src/lib/sdk.ts`
- Create: `apps/creator/src/__tests__/shot-workbench.spec.tsx`

- [ ] **Step 1: 写镜头工作台页面的失败测试**

```tsx
it("shows primary asset and candidate assets for a shot", async () => {
  render(<ShotWorkbenchPage />);

  expect(await screen.findByText("主素材")).toBeInTheDocument();
  expect(screen.getByText("候选素材")).toBeInTheDocument();
});
```

- [ ] **Step 2: 初始化 creator 应用并接入 Tailwind / shadcn/ui**

Run: `pnpm --filter creator test`

Expected: FAIL，提示 `ShotWorkbenchPage` 未实现。

- [ ] **Step 3: 实现四个核心页面**

```tsx
<ShotStatusBoard
  counts={{
    draft: 4,
    ready_for_spot_check: 7,
    approved: 18,
  }}
/>
```

```ts
const sdk = createCreatorSDK({
  rpcBaseUrl: "http://localhost:8080/rpc",
  eventsUrl: "http://localhost:8080/events/stream",
});
```

- [ ] **Step 4: 运行 creator 测试**

Run: `pnpm --filter creator test`

Expected: PASS，镜头列表、导入批次面板、主素材切换视图可渲染。

- [ ] **Step 5: Commit**

```bash
git add apps/creator
git commit -m "feat: add creator workbench for shots and asset import"
```

### Task 7: 实现 Web 管理端 MVP 页面

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/routes/org-settings.tsx`
- Create: `apps/admin/src/routes/workflow-settings.tsx`
- Create: `apps/admin/src/routes/import-audit.tsx`
- Create: `apps/admin/src/components/rule-editor.tsx`
- Create: `apps/admin/src/components/import-batch-table.tsx`
- Create: `apps/admin/src/lib/sdk.ts`
- Create: `apps/admin/src/__tests__/import-audit.spec.tsx`

- [ ] **Step 1: 写导入审计页的失败测试**

```tsx
it("renders import batch status and unmatched count", async () => {
  render(<ImportAuditPage />);

  expect(await screen.findByText("导入批次")).toBeInTheDocument();
  expect(screen.getByText("未匹配素材")).toBeInTheDocument();
});
```

- [ ] **Step 2: 初始化 admin 应用与路由**

Run: `pnpm --filter admin test`

Expected: FAIL，提示 `ImportAuditPage` 或组件不存在。

- [ ] **Step 3: 实现组织配置、工作流规则、导入审计三页**

```tsx
<ImportBatchTable
  rows={[
    { id: "batch_001", source: "external", unmatchedCount: 3, status: "pending_review" },
  ]}
/>
```

```ts
const sdk = createAdminSDK({
  rpcBaseUrl: "http://localhost:8080/rpc",
  eventsUrl: "http://localhost:8080/events/stream",
});
```

- [ ] **Step 4: 运行 admin 测试**

Run: `pnpm --filter admin test`

Expected: PASS，管理端可查看批次、匹配状态和规则配置入口。

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat: add admin console for workflow and import audit"
```

### Task 8: 联调、种子数据、验收与交付文档

**Files:**
- Create: `apps/backend/cmd/seed/main.go`
- Create: `scripts/dev.ps1`
- Create: `scripts/test.ps1`
- Create: `tests/e2e/phase1-flow.spec.ts`
- Create: `docs/runbooks/local-setup.md`
- Create: `docs/runbooks/phase1-acceptance.md`
- Modify: `README.md`

- [ ] **Step 1: 写端到端验收失败测试**

```ts
test("phase 1 flow runs from project creation to shot spot check", async ({ page }) => {
  await page.goto("/projects");
  await page.getByText("新建项目").click();
  await expect(page.getByText("导入批次")).toBeVisible();
  await expect(page.getByText("待抽检")).toBeVisible();
});
```

- [ ] **Step 2: 增加本地启动脚本与种子数据程序**

Run: `pnpm exec playwright test tests/e2e/phase1-flow.spec.ts`

Expected: FAIL，提示页面或种子数据尚未准备。

- [ ] **Step 3: 实现种子数据与验收 runbook**

```bash
go run ./apps/backend/cmd/seed
pnpm --filter creator dev
pnpm --filter admin dev
go run ./apps/backend/cmd/api
```

- [ ] **Step 4: 运行全量验证**

Run: `go test ./...`
Expected: PASS

Run: `pnpm --filter @hualala/sdk test && pnpm --filter creator test && pnpm --filter admin test`
Expected: PASS

Run: `pnpm exec playwright test tests/e2e/phase1-flow.spec.ts`
Expected: PASS，完整链路可从项目创建走到镜头抽检。

- [ ] **Step 5: Commit**

```bash
git add apps/backend/cmd/seed scripts tests/e2e docs/runbooks README.md
git commit -m "docs: add phase 1 runbooks and acceptance flow"
```

## 实施备注

- 当前工作区尚未初始化为 Git 仓库。执行前先完成 `git init` 或切到正式仓库目录，再按计划落地。
- 计划默认使用 `pnpm workspace`。如果你后续决定改为 `yarn`，仅需同步调整根脚本与命令，不影响模块边界。
- Phase 1 业务接口统一走 Connect RPC，长任务状态统一走 SSE，大文件统一走 Upload Session。后续即便接入平台内图片 / 视频生成，也只应复用 `Import Batch`、`Media Asset`、`ShotAssetLink` 和状态流转，不应推翻当前数据模型。
