# AI 剧集生成平台 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于最终设计文档，在绿地仓库中搭建 AI 剧集生成平台 Phase 1 的可演示生产闭环，覆盖项目建模、双语内容快照、镜头执行、素材导入、审核、预算与审计基础能力。

**Architecture:** 先冻结 monorepo 骨架、proto 与数据库迁移，再落 Go 后端分层骨架与最小服务面，最后分别补齐管理端、创作端和 E2E 验收链路。所有工作围绕 Phase 1 主闭环展开，不提前扩张实时协同、自动全量翻译和企业交付增强能力。

**Tech Stack:** Monorepo、pnpm workspace、turbo、Buf、Connect RPC、SSE、Upload Session、Go 后端、PostgreSQL、Tauri、Web Admin、对象存储。

---

## 规划前提

- 当前仓库实际状态接近空仓，只有设计文档 `docs/specs/2026-03-20-ai-series-platform-final-design.md`；因此本计划以绿地搭建为前提。
- Phase 1 目标必须严格对齐设计文档中的生产闭环与验收脚本，不做功能面扩张，依据见设计文档第 1 章、第 2.5 节、第 14.2 节。
- 本计划按“先协议与数据、再后端主链、再前端工作台、最后验收与观测”排序，直接对应设计文档第 15 节实施顺序建议。

## 范围拆分

这份设计覆盖多个相互依赖的子系统，不适合作为单个开发任务一次性推进。实施时建议拆成 6 条主工作流：

1. 仓库与工具链基线
2. 协议与 SDK 基线
3. 数据库迁移与持久化基线
4. 后端主业务闭环
5. 管理端与创作端工作台
6. 验收、稳定性与观测性

## 里程碑

| 里程碑 | 目标 | 出口条件 |
| --- | --- | --- |
| M0 | 仓库骨架与工具链可运行 | `pnpm install`、`turbo run build`、`buf lint`、`go test ./...` 可跑通空骨架 |
| M1 | Proto、SDK、迁移基线冻结 | `proto/`、`packages/sdk/`、`infra/migrations/0001-0010` 落地 |
| M2 | 后端最小服务面可启动 | Connect RPC、SSE、Upload Session、数据库连接、配置、鉴权骨架可运行 |
| M3 | 内容与执行主闭环可走通 | 项目 -> Episode -> Scene -> Shot -> Snapshot -> Execution -> Candidate -> Review 主链打通 |
| M4 | 管理端与创作端可演示 | 管理端完成治理视图，创作端完成镜头工作台与导入工作台 |
| M5 | 稳定性、预算、审计和双语验收通过 | 对齐设计文档 14.2 的业务主链、稳定性链路和合规链路 |

## 工作流总图

1. 先搭仓库与 CI 门禁，保证后续所有模块都有统一生成、测试和发布入口。
2. 冻结 proto、SDK 和数据库迁移批次，避免前后端并行时协议与模型漂移。
3. 搭后端分层骨架与基础设施，再按 `project -> content -> execution -> asset -> review -> billing` 顺序补业务。
4. 管理端先做项目治理、语言策略、预算策略和审核视图；创作端先做镜头工作台、快照编辑、导入与候选池。
5. 最后补稳定性链路、演示脚本、观测视图和发布前阻断。

## Task 1: 初始化 Monorepo 与工具链

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `buf.yaml`
- Create: `buf.gen.yaml`
- Create: `apps/admin/package.json`
- Create: `apps/creator/package.json`
- Create: `apps/backend/go.mod`
- Create: `tests/README.md`
- Test: `package.json`

- [ ] **Step 1: 创建顶层目录骨架**

Run: `New-Item -ItemType Directory -Force apps/admin, apps/creator, apps/backend, proto, packages/sdk, tooling, infra/migrations, infra/env, infra/docker, tests`
Expected: 顶层目录与设计文档第 12.1 节一致。

- [ ] **Step 2: 写 workspace 与 turbo 配置**

要求：
- `pnpm-workspace.yaml` 只纳入 `apps/*`、`packages/*`、`tooling/*`
- `turbo.json` 至少包含 `build`、`lint`、`test`、`dev`
- 顶层 `package.json` 暴露 `build`、`lint`、`test`、`proto:lint`、`proto:gen`、`i18n:check`

- [ ] **Step 3: 写 Buf 基线**

要求：
- `buf.yaml` 管理 `proto/`
- `buf.gen.yaml` 生成 Go 与 TS 客户端代码
- 预留 breaking-change 检查所需配置

- [ ] **Step 4: 初始化后端 Go module**

Run: `go mod init github.com/hualala/apps/backend`
Expected: `apps/backend/go.mod` 存在，后续可挂接生成代码与应用入口。

- [ ] **Step 5: 为空骨架补 smoke tests**

Create: `tests/smoke/toolchain-smoke.md`
内容：
- 记录 `pnpm install`
- 记录 `buf lint`
- 记录 `go test ./...`
- 记录 `turbo run build`

- [ ] **Step 6: 本地验证空骨架**

Run: `pnpm install`
Run: `pnpm exec turbo run build`
Run: `pnpm exec turbo run test`
Run: `pnpm exec buf lint`
Run: `go test ./...`
Expected: 全部通过，哪怕当前只是空实现。

## Task 2: 冻结 Proto 目录与共享 SDK 基线

**Files:**
- Create: `proto/hualala/common/v1/*.proto`
- Create: `proto/hualala/auth/v1/*.proto`
- Create: `proto/hualala/org/v1/*.proto`
- Create: `proto/hualala/project/v1/*.proto`
- Create: `proto/hualala/content/v1/*.proto`
- Create: `proto/hualala/execution/v1/*.proto`
- Create: `proto/hualala/asset/v1/*.proto`
- Create: `proto/hualala/workflow/v1/*.proto`
- Create: `proto/hualala/billing/v1/*.proto`
- Create: `proto/hualala/review/v1/*.proto`
- Create: `packages/sdk/src/connect/`
- Create: `packages/sdk/src/sse/`
- Create: `packages/sdk/src/upload/`
- Create: `packages/sdk/src/i18n/`
- Test: `proto/**/*.proto`

- [ ] **Step 1: 落 `common/v1` 基础消息**

必须包含：
- 分页
- 时间窗
- 资源轻引用
- `LocaleCode`
- `LocalizedLabel`
- 金额与操作者摘要

- [ ] **Step 2: 按最小服务面定义 service 与 request/response**

依据设计文档第 10.3 节：
- `AuthService`
- `OrgService`
- `ProjectService`
- `ContentService`
- `ExecutionService`
- `AssetService`
- `ReviewService`
- `WorkflowService`
- `BillingService`

- [ ] **Step 3: 固化 SSE 事件 envelope**

Create: `proto/hualala/common/v1/event.proto`
必须覆盖：
- `event_id`
- `event_type`
- `organization_id`
- `project_id`
- `resource_type`
- `resource_id`
- `occurred_at`
- `payload`

- [ ] **Step 4: 生成 Go/TS 客户端**

Run: `pnpm exec buf generate`
Expected: 生成代码进入 `apps/backend/gen/` 与 `packages/sdk/src/gen/`。

- [ ] **Step 5: 实现 SDK 边界**

要求：
- 只放 Connect client 工厂、SSE 客户端、Upload Session 客户端、协议类型与 locale/message key 常量
- 严禁写 React hooks、UI 组件或页面级 ViewModel

- [ ] **Step 6: 加 proto 验证**

Run: `pnpm exec buf lint`
Run: `pnpm exec buf breaking --against '.git#branch=main'`
Expected: lint 通过；若仓库暂无 `main` 基线，则先在 CI 中占位并说明后续接入策略。

## Task 3: 创建数据库迁移批次与持久化约束

**Files:**
- Create: `infra/migrations/0001_org_create_organizations_users_memberships_roles.sql`
- Create: `infra/migrations/0002_project_create_projects_episodes_scenes.sql`
- Create: `infra/migrations/0003_content_create_story_bibles_characters_scripts_storyboards_shots_snapshots.sql`
- Create: `infra/migrations/0004_ai_create_model_profiles_prompt_templates.sql`
- Create: `infra/migrations/0005_execution_create_context_bundles_shot_executions_shot_execution_runs.sql`
- Create: `infra/migrations/0006_workflow_create_jobs_workflow_runs_workflow_steps_state_transitions_outbox.sql`
- Create: `infra/migrations/0007_asset_create_import_batches_upload_sessions_upload_files_media_assets_media_asset_variants.sql`
- Create: `infra/migrations/0008_asset_create_rights_records_import_batch_items_candidate_assets.sql`
- Create: `infra/migrations/0009_review_create_evaluation_runs_shot_reviews.sql`
- Create: `infra/migrations/0010_billing_create_usage_budget_billing.sql`
- Create: `infra/migrations/README.md`
- Test: `infra/migrations/*.sql`

- [ ] **Step 1: 逐个迁移文件实现设计文档第 6.6 节建议批次**

要求：
- 四位递增编号
- 一个文件只覆盖一个明确 domain action
- 不使用 `misc.sql`、`fix.sql`、`compat.sql`、`backfill.sql`

- [ ] **Step 2: 先落组织、项目、内容主骨架**

优先表：
- `organizations`
- `users`
- `memberships`
- `projects`
- `episodes`
- `scenes`
- `shots`
- `content_snapshots`

- [ ] **Step 3: 再落执行、资产、审核与计费表**

关键表：
- `context_bundles`
- `shot_executions`
- `shot_execution_runs`
- `media_assets`
- `media_asset_variants`
- `rights_records`
- `evaluation_runs`
- `shot_reviews`
- `usage_records`
- `billing_events`

- [ ] **Step 4: 为 locale、状态机和唯一约束补索引**

至少覆盖：
- 项目和对象的 `organization_id`
- `content_snapshots(locale, translation_group_id)`
- `shot_execution_runs(shot_execution_id, run_number)`
- `media_assets(project_id, source_type)`

- [ ] **Step 5: 编写 schema smoke 测试**

Create: `tests/schema/migration-smoke.md`
Run: `psql -f infra/migrations/0001_org_create_organizations_users_memberships_roles.sql`
Expected: 可在空数据库顺序执行到 `0010`。

## Task 4: 搭建后端应用骨架与基础设施

**Files:**
- Create: `apps/backend/cmd/api/main.go`
- Create: `apps/backend/internal/domain/`
- Create: `apps/backend/internal/application/`
- Create: `apps/backend/internal/interfaces/connect/`
- Create: `apps/backend/internal/interfaces/sse/`
- Create: `apps/backend/internal/interfaces/upload/`
- Create: `apps/backend/internal/platform/db/`
- Create: `apps/backend/internal/platform/config/`
- Create: `apps/backend/internal/platform/authz/`
- Create: `apps/backend/internal/platform/events/`
- Create: `apps/backend/internal/platform/observability/`
- Create: `apps/backend/internal/platform/i18n/`
- Test: `apps/backend/...`

- [ ] **Step 1: 按设计文档第 12.3 节生成目录**

要求：
- `domain` 不依赖 `application`
- `application` 不依赖 `interfaces`
- `domain` 不依赖 `platform`

- [ ] **Step 2: 创建应用入口**

Create: `apps/backend/cmd/api/main.go`
内容要求：
- 读取配置
- 初始化数据库
- 注册 Connect 服务
- 启动 SSE 与 Upload Session handler
- 初始化日志与 tracing

- [ ] **Step 3: 写基础平台组件**

必须先落：
- `platform/config`
- `platform/db`
- `platform/authz`
- `platform/events`
- `platform/observability`
- `platform/i18n`

- [ ] **Step 4: 写统一错误模型**

要求：
- 后端返回 `error_code`
- 返回 `message_key`
- 返回 `message_params`
- 不直接返回硬编码中文错误文案

- [ ] **Step 5: 写后端启动测试**

Create: `apps/backend/internal/interfaces/connect/server_test.go`
Run: `go test ./...`
Expected: 服务可在最小配置下启动并注册基础路由。

## Task 5: 实现项目、内容与双语快照主链

**Files:**
- Create: `apps/backend/internal/domain/project/`
- Create: `apps/backend/internal/domain/content/`
- Create: `apps/backend/internal/application/projectapp/`
- Create: `apps/backend/internal/application/contentapp/`
- Create: `apps/backend/internal/interfaces/connect/project_service.go`
- Create: `apps/backend/internal/interfaces/connect/content_service.go`
- Create: `tests/integration/project-content-flow_test.go`
- Test: `tests/integration/project-content-flow_test.go`

- [ ] **Step 1: 实现 Project / Episode / Scene / Shot 聚合与 repository 接口**

必须支持：
- 创建项目
- 查询项目
- 创建 Episode / Scene / Shot
- 更新镜头结构

- [ ] **Step 2: 实现 ContentSnapshot 与翻译链**

必须支持：
- `locale`
- `translation_group_id`
- `source_snapshot_id`
- `translation_status`
- `source_locale` 继承或覆盖

- [ ] **Step 3: 暴露 ContentService 最小接口**

至少实现：
- `ListScenes`
- `GetScene`
- `ListSceneShots`
- `GetShot`
- `UpdateShotStructure`
- `CreateContentSnapshot`
- `CreateLocalizedSnapshot`

- [ ] **Step 4: 写项目与内容主链集成测试**

Run: `go test ./tests/integration -run ProjectContentFlow -v`
Expected: 能完成“创建项目 -> Episode -> Scene -> Shot -> 中文快照 -> 英文翻译快照”。

## Task 6: 实现执行、导入、审核、预算与 Submission Gate

**Files:**
- Create: `apps/backend/internal/domain/execution/`
- Create: `apps/backend/internal/domain/asset/`
- Create: `apps/backend/internal/domain/review/`
- Create: `apps/backend/internal/domain/billing/`
- Create: `apps/backend/internal/domain/policy/`
- Create: `apps/backend/internal/application/executionapp/`
- Create: `apps/backend/internal/application/assetapp/`
- Create: `apps/backend/internal/application/reviewapp/`
- Create: `apps/backend/internal/application/billingapp/`
- Create: `apps/backend/internal/application/policyapp/`
- Create: `apps/backend/internal/interfaces/connect/execution_service.go`
- Create: `apps/backend/internal/interfaces/connect/asset_service.go`
- Create: `apps/backend/internal/interfaces/connect/review_service.go`
- Create: `apps/backend/internal/interfaces/connect/billing_service.go`
- Create: `tests/integration/shot-execution-flow_test.go`
- Test: `tests/integration/shot-execution-flow_test.go`

- [ ] **Step 1: 实现 `ShotExecution` 与 `ShotExecutionRun` 状态机**

必须覆盖状态：
- `pending`
- `in_progress`
- `candidate_ready`
- `primary_selected`
- `submitted_for_review`
- `rework_required`
- `approved_for_use`
- `archived`

- [ ] **Step 2: 实现导入与候选池主链**

必须覆盖：
- `ImportBatch`
- `UploadSession`
- `UploadFile`
- `MediaAsset`
- `MediaAssetVariant`
- `ImportBatchItem`
- `ShotCandidateAsset`
- `RightsRecord`

- [ ] **Step 3: 实现 Submission Gate**

至少检查：
- 结构完整性
- 内容一致性
- 来源与授权
- AI 标识
- 预算
- 语言一致性

- [ ] **Step 4: 实现 `EvaluationRun` 与 `ShotReview`**

要求：
- 机器关卡先于人工审核
- `ShotReview` 只记录事件，不作为当前态唯一真相
- 通过审核更新 `ShotExecution` 聚合态

- [ ] **Step 5: 实现计量与预算守卫**

要求：
- 记录 `UsageRecord`
- 记录 `BillingEvent`
- 能在调用前阻断超预算执行

- [ ] **Step 6: 写执行主链集成测试**

Run: `go test ./tests/integration -run ShotExecutionFlow -v`
Expected: 能完成“发起执行 -> 导入素材 -> 自动匹配候选 -> 选主素材 -> Gate 检查 -> 提审 -> 打回 -> 重跑 -> 通过”。

## Task 7: 接入工作流、SSE、上传恢复与网关适配

**Files:**
- Create: `apps/backend/internal/domain/workflow/`
- Create: `apps/backend/internal/domain/gateway/`
- Create: `apps/backend/internal/application/workflowapp/`
- Create: `apps/backend/internal/application/gatewayapp/`
- Create: `apps/backend/internal/interfaces/sse/server.go`
- Create: `apps/backend/internal/interfaces/upload/session_handler.go`
- Create: `apps/backend/internal/platform/temporal/`
- Create: `tests/integration/reliability-flow_test.go`
- Test: `tests/integration/reliability-flow_test.go`

- [ ] **Step 1: 实现普通异步任务与高价值长链路分流**

规则：
- 高频普通任务走轻量队列
- 高价值长链路才进入 Temporal

- [ ] **Step 2: 实现 SSE 事件投递与断线恢复**

必须支持：
- `Last-Event-ID` 或等价 cursor
- 最小 envelope
- 权限过滤

- [ ] **Step 3: 实现 Upload Session**

必须支持：
- 过期
- 校验和
- 重试
- 恢复提示

- [ ] **Step 4: 实现统一模型网关壳层**

当前只要求：
- provider 适配接口
- 路由策略接口
- `external_request_id`
- `idempotency_key`
- 审计摘要写入

- [ ] **Step 5: 写稳定性链路测试**

Run: `go test ./tests/integration -run ReliabilityFlow -v`
Expected: 能覆盖 workflow 恢复、SSE 断线恢复、上传过期恢复、预算阻断。

## Task 8: 落管理端基础界面与治理能力

**Files:**
- Create: `apps/admin/src/app/`
- Create: `apps/admin/src/i18n/zh-CN.ts`
- Create: `apps/admin/src/i18n/en-US.ts`
- Create: `apps/admin/src/features/projects/`
- Create: `apps/admin/src/features/review/`
- Create: `apps/admin/src/features/billing/`
- Create: `apps/admin/src/features/org-settings/`
- Create: `apps/admin/src/lib/sdk/`
- Create: `tests/e2e/admin-smoke.spec.ts`
- Test: `tests/e2e/admin-smoke.spec.ts`

- [ ] **Step 1: 初始化管理端应用壳**

必须有：
- 登录后主布局
- 项目列表页
- 项目详情页
- 审核工作台
- 预算策略页
- 组织语言设置页

- [ ] **Step 2: 实现 i18n 资源与切换**

要求：
- 中英切换
- 刷新后记忆
- 缺 key 检测

- [ ] **Step 3: 接入项目与审核服务**

必须支持：
- 创建项目
- 查看 Scene / Shot 结构
- 查看审核摘要
- 查看预算快照与告警

- [ ] **Step 4: 写管理端 smoke 与 i18n 测试**

Run: `pnpm exec playwright test tests/e2e/admin-smoke.spec.ts`
Expected: 能完成“切换英文 UI -> 创建项目 -> 查看审核面板”。

## Task 9: 落创作端工作台、快照编辑与导入工作流

**Files:**
- Create: `apps/creator/src/app/`
- Create: `apps/creator/src/i18n/zh-CN.ts`
- Create: `apps/creator/src/i18n/en-US.ts`
- Create: `apps/creator/src/features/shot-workbench/`
- Create: `apps/creator/src/features/content-snapshots/`
- Create: `apps/creator/src/features/import-batches/`
- Create: `apps/creator/src/features/candidate-assets/`
- Create: `apps/creator/src/features/review/`
- Create: `tests/e2e/creator-smoke.spec.ts`
- Test: `tests/e2e/creator-smoke.spec.ts`

- [ ] **Step 1: 初始化创作端工作台壳**

必须有：
- 项目选择
- Scene / Shot 导航
- 镜头工作台
- 内容快照编辑器
- 导入队列
- 候选池与主素材区域

- [ ] **Step 2: 实现离线 UI locale 缓存**

要求：
- 保存最近一次 UI locale
- 重启后恢复
- 不影响内容语言权限边界

- [ ] **Step 3: 接执行与导入主链**

必须支持：
- 发起执行轮次
- 查看执行历史
- 导入素材
- 自动匹配结果确认
- 选定主素材
- 发起提审

- [ ] **Step 4: 写创作端主链 E2E**

Run: `pnpm exec playwright test tests/e2e/creator-smoke.spec.ts`
Expected: 能完成“中文快照 -> 英文翻译快照 -> 发起执行 -> 导入素材 -> 选主素材 -> 提审”。

## Task 10: 补齐 CI 门禁、验收剧本与演示数据

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `tooling/scripts/i18n_key_parity_check.(ts|js)`
- Create: `tooling/scripts/demo_seed.(ts|js)`
- Create: `tests/e2e/phase1-acceptance.spec.ts`
- Create: `docs/runbooks/phase1-demo.md`
- Modify: `package.json`
- Test: `tests/e2e/phase1-acceptance.spec.ts`

- [ ] **Step 1: 将最低 CI 门禁写入流水线**

必须包含：
- `buf lint`
- `buf breaking`
- `turbo run lint`
- `turbo run test`
- `turbo run build`
- `go test ./...`
- `i18n key parity check`

- [ ] **Step 2: 编写 demo seed**

要求：
- 生成组织、用户、项目、Episode、Scene、Shot 示例数据
- 生成一组中文快照和英文翻译快照
- 生成导入批次和待审核镜头样例

- [ ] **Step 3: 按设计文档第 14.2 节写 Phase 1 验收脚本**

必须覆盖：
- 业务主链 9 步
- 稳定性链路 5 步
- 合规链路 4 步

- [ ] **Step 4: 编写演示 Runbook**

Create: `docs/runbooks/phase1-demo.md`
内容必须包含：
- 启动顺序
- 演示账号
- 演示路径
- 故障恢复演示点
- 预算阻断与审核打回演示点

- [ ] **Step 5: 跑完整体验收**

Run: `pnpm exec playwright test tests/e2e/phase1-acceptance.spec.ts`
Run: `go test ./...`
Run: `pnpm exec turbo run build lint test`
Expected: 全量通过后，M5 才可视为完成。

## 依赖关系

- Task 1 是所有任务的前置条件。
- Task 2 与 Task 3 可以并行，但都必须早于 Task 5 至 Task 9。
- Task 4 依赖 Task 2、Task 3。
- Task 5 依赖 Task 4。
- Task 6 依赖 Task 5。
- Task 7 依赖 Task 6。
- Task 8 与 Task 9 依赖 Task 2、Task 4，且需要 Task 5 至 Task 7 提供稳定接口后再补完整联调。
- Task 10 依赖前九个任务全部落地。

## 建议分工

| 小组 | 主责 |
| --- | --- |
| 平台组 | Task 1、Task 2、Task 10 |
| 后端组 | Task 3、Task 4、Task 5、Task 6、Task 7 |
| 管理端组 | Task 8 |
| 创作端组 | Task 9 |
| QA / 产品验收 | Task 10 的验收脚本、演示 runbook、回归矩阵 |

## 周度节奏建议

| 周次 | 目标 |
| --- | --- |
| Week 1 | 完成 M0，冻结 monorepo、buf、turbo、Go module 和基础目录 |
| Week 2 | 完成 M1，冻结 proto、SDK 边界、迁移文件 0001-0010 |
| Week 3 | 完成 M2，后端可启动，Connect/SSE/Upload Session 可用 |
| Week 4-5 | 完成 M3，项目内容主链与执行主链打通 |
| Week 6 | 完成 M4，管理端与创作端主工作台联调 |
| Week 7 | 完成 M5，稳定性、预算、审计、双语和合规验收通过 |

## 风险与应对

| 风险 | 真实影响 | 应对动作 |
| --- | --- | --- |
| 先写前端再补 proto | 前后端接口漂移，返工高 | 强制 Task 2 先于前端联调 |
| 迁移批次后补模型字段 | 数据模型反复重写 | 先按第 6.3 节冻结关键字段 |
| 把 `Shot` 当成执行态对象 | 状态和结构耦合，后续审核与回流混乱 | 严格分离 `Shot`、`ShotExecution`、`ShotExecutionRun` |
| 把 i18n 做成 UI 文案层修补 | 内容语言、Prompt locale、导出语言无法闭环 | 从 `content_snapshots`、`prompt_templates`、`context_bundles` 一起落 |
| 提前做高级协同 | 稀释 Phase 1 主闭环 | 明确实时协同属于 Phase 2 |
| 没有验收脚本先开发 | 到联调阶段才暴露断链 | Week 2 就先起草 `phase1-acceptance.spec.ts` 骨架 |

## 完成定义

当且仅当以下条件同时成立，Phase 1 才算完成：

1. 设计文档第 14.2 节业务主链 9 步全部可演示。
2. 稳定性链路 5 步全部可验证。
3. 合规链路 4 步全部可验证。
4. 管理端与创作端都支持 `zh-CN` / `en-US` 切换并持久化。
5. 后端错误模型统一返回 `error_code`、`message_key`、`message_params`。
6. `Shot`、`ShotExecution`、`ShotExecutionRun`、`ContentSnapshot`、`MediaAsset`、`RightsRecord`、`EvaluationRun`、`ShotReview`、`UsageRecord` 全部有真实落表和接口流转。
7. CI 门禁稳定执行 `buf lint`、`buf breaking`、`turbo run lint`、`turbo run test`、`turbo run build`、`go test ./...`、`i18n key parity check`。

## 下一步

- 先按本计划拆出 3 份子计划：
  - `2026-03-20-ai-series-platform-foundation-plan.md`
  - `2026-03-20-ai-series-platform-backend-plan.md`
  - `2026-03-20-ai-series-platform-frontend-plan.md`
- 再从 Task 1 开始执行，执行时严格按“先协议、后实现、再联调”的顺序推进。
