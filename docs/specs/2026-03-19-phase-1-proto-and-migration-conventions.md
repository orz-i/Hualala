# AI 剧集平台 Phase 1 Proto 与 Migration 约定

## 1. 文档定位

本文用于固化 Phase 1 的两类工程约束：

1. `proto` 的领域边界、服务归属、消息命名、事件命名与跨域引用规则
2. `infra/migrations` 的 greenfield 初始建库编号、命名与批次规则

当前项目以 `纯 greenfield 基线` 为前提：

- 不考虑旧 schema 迁移
- 不考虑历史数据回填
- 不考虑兼容表与双写过渡
- 不在主线中引入 `shot_asset_links`

如未来真的出现 PoC 旧库或临时数据迁移需求，应另写附录，不回灌当前基线文档。

本文是以下文档的补充约束源：

- [AI 剧集生产协作平台设计文档](D:/Documents/Hualala/docs/specs/2026-03-18-ai-series-platform-design.md)
- [AI 剧集平台 Phase 1 数据库设计稿](D:/Documents/Hualala/docs/specs/2026-03-18-phase-1-database-design.md)
- [AI 剧集平台 Phase 1 Monorepo 设计文档](D:/Documents/Hualala/docs/specs/2026-03-19-phase-1-monorepo-design.md)
- [AI 剧集平台 Phase 1 对齐版实施计划](D:/Documents/Hualala/docs/plans/2026-03-19-phase-1-ai-series-platform-aligned-plan.md)

## 2. 范围与非目标

### 2.1 本文覆盖范围

- `proto/hualala/*/v1` 的领域划分
- service 归属与最小服务面
- RPC 消息命名规则
- SSE 事件命名与事件 envelope 规则
- 跨域轻引用与聚合查询的建模规则
- `infra/migrations` 的编号与命名规范
- Phase 1 初始建库批次与正式文件名建议

### 2.2 本文不覆盖范围

- 具体 `.proto` 字段全集
- 具体 SQL DDL 细节
- 页面级 ViewModel 设计
- 具体 Temporal workflow 定义
- 具体 CI 命令实现
- 任何 legacy schema 迁移方案

## 3. Proto 领域边界

### 3.1 协议目录与职责

Phase 1 协议目录固定为：

```text
proto/
├─ hualala/common/v1/
├─ hualala/auth/v1/
├─ hualala/org/v1/
├─ hualala/project/v1/
├─ hualala/content/v1/
├─ hualala/execution/v1/
├─ hualala/asset/v1/
├─ hualala/workflow/v1/
├─ hualala/billing/v1/
└─ hualala/review/v1/
```

各域职责如下：

| 协议域 | 职责 |
| --- | --- |
| `common/v1` | 分页、时间窗、资源引用、操作者等稳定通用结构 |
| `auth/v1` | 登录态、会话、当前身份 |
| `org/v1` | 组织、成员、角色与权限 |
| `project/v1` | 项目、集数、阶段总览 |
| `content/v1` | 世界观、角色、剧本、分镜与 `Shot` 结构骨架 |
| `execution/v1` | `ShotExecution` 当前态与 `ShotExecutionRun` 历史轮次 |
| `asset/v1` | 导入批次、媒体资产、候选池、挂接动作 |
| `workflow/v1` | 高价值 DAG 实例、节点状态、取消与重试 |
| `billing/v1` | 预算快照、usage 明细、预算策略、成本事件 |
| `review/v1` | `ShotReview` 审核事件流与审核摘要 |

### 3.2 最小服务面

推荐最小服务面如下：

| Service | 最小接口 |
| --- | --- |
| `AuthService` | `GetCurrentSession`、`RefreshSession` |
| `OrgService` | `ListMembers`、`ListRoles`、`UpdateMemberRole` |
| `ProjectService` | `CreateProject`、`GetProject`、`ListProjects`、`ListEpisodes` |
| `ContentService` | `ListShots`、`GetShot`、`UpdateShotStructure` |
| `ExecutionService` | `GetShotExecution`、`ListShotExecutions`、`ListShotExecutionRuns`、`StartShotExecutionRun`、`SelectPrimaryAsset`、`SubmitShotForReview`、`MarkShotReworkRequired` |
| `ReviewService` | `ListShotReviews`、`CreateShotReview`、`GetLatestShotReviewSummary` |
| `AssetService` | `CreateImportBatch`、`ListImportBatchItems`、`ConfirmImportBatchItem`、`ListCandidateAssets` |
| `WorkflowService` | `StartWorkflow`、`GetWorkflowRun`、`ListWorkflowRuns`、`CancelWorkflowRun`、`RetryWorkflowRun` |
| `BillingService` | `GetBudgetSnapshot`、`ListUsageRecords`、`ListBillingEvents`、`UpdateBudgetPolicy` |

Phase 1 当前不单列 `ApprovalService`。通用审批流配置与审批状态机不进入首批协议面；镜头审核与导演抽检统一通过 `ReviewService` 事件流承接。

### 3.3 硬边界规则

1. `content/v1` 只表达结构骨架，严禁返回主素材、执行状态和审核状态
2. `execution/v1` 是镜头执行工作台的主协议域，负责当前态与轮次历史
3. `review/v1` 只表达审核事件流与审核摘要，不承担“当前审核态唯一真相”
4. `asset/v1` 可触发执行态变化，但不拥有执行状态机
5. `workflow/v1` 的资源绑定点优先落在 `shot_execution_run`
6. `billing/v1` 的成本归因点优先落在 `shot_execution_run`

## 4. 消息、事件与跨域引用规则

### 4.1 RPC 消息命名

请求与响应统一使用以下前缀：

- `GetXRequest / GetXResponse`
- `ListXRequest / ListXResponse`
- `CreateXRequest / CreateXResponse`
- `UpdateXRequest / UpdateXResponse`
- `StartXRequest / StartXResponse`
- `CancelXRequest / CancelXResponse`
- `RetryXRequest / RetryXResponse`

资源消息统一使用稳定名词：

- `Shot`
- `ShotExecution`
- `ShotExecutionRun`
- `ShotReview`
- `ImportBatch`
- `MediaAsset`
- `WorkflowRun`
- `BudgetPolicy`
- `UsageRecord`

禁止在 proto 层引入：

- `DTO`
- `VO`
- `Entity`
- `Model`

### 4.2 详情对象、摘要对象与聚合对象

协议消息分为三类：

1. 详情对象
   - 例如 `ShotExecution`、`ShotReview`、`WorkflowRun`
2. 摘要对象
   - 例如 `ShotReviewSummary`、`WorkflowRunSummary`、`BudgetSnapshot`
3. 聚合对象
   - 例如 `GetShotWorkbenchResponse`、`GetShotPipelineOverviewResponse`

规则如下：

- 详情对象不承担页面级无限扩展字段
- 摘要对象用于列表、状态条、告警卡片
- 聚合对象用于工作台或看板，不伪装成基础资源对象
- 聚合对象应由拥有主状态真相的 service 暴露，避免出现跨域“万能查询服务”

推荐归属如下：

- `GetShotWorkbenchResponse` 由 `ExecutionService` 暴露
- `GetShotPipelineOverviewResponse` 由 `ExecutionService` 暴露
- 组织成员 / 角色治理类聚合响应由 `OrgService` 暴露

### 4.3 跨域引用规则

跨域引用一律采用轻引用：

- 主体对象中只放外域 `id`
- 需要展示时，只补最小摘要字段
- 禁止深度内嵌完整外域对象

推荐：

- `ShotExecution` 保存 `shot_id`
- `ShotReview` 保存 `shot_id`、`shot_execution_id`、`shot_execution_run_id`、`asset_id`
- `WorkflowRun` 保存 `resource_type` 与 `resource_id`

禁止：

- 在 `ShotExecution` 中嵌完整 `Shot`
- 在 `ShotReview` 中嵌完整 `ShotExecution`
- 在 `AssetService` 的基础资源消息中返回整套 `Shot + Execution + Review`

### 4.4 事件命名规则

SSE 事件名统一使用点分语义：

- `shot.updated`
- `shot.execution.updated`
- `shot.execution.run.created`
- `shot.review.created`
- `shot.review.summary.updated`
- `workflow.updated`
- `import_batch.updated`
- `budget.updated`
- `billing.alert`

规则如下：

1. 事件名描述“发生了什么”
2. RPC 名描述“你要做什么”
3. 禁止把 RPC 动作名直接复用为事件名
4. `shot.updated` 仅表示结构骨架变更
5. `shot.review.created` 仅表示新增审核事件；如需表达摘要投影变化，应使用单独的 summary 类事件，而不是更新原始 review 事件

### 4.5 事件 envelope 规则

所有 SSE 事件建议统一包含：

- `event_id`
- `event_type`
- `organization_id`
- `project_id`
- `resource_type`
- `resource_id`
- `occurred_at`
- `payload`

其中 `payload` 只放该事件所需的最小摘要，不返回整页数据。

### 4.6 状态机与事件写出约束

1. 所有改变 `shot_executions`、`shot_execution_runs`、`workflow_runs`、`budget_policies` 等可观察状态的写操作，都应由拥有当前态真相的应用服务负责写出 `state_transitions` 与 `event_outbox`
2. `AssetService`、`ReviewService` 可以触发执行态变化，但不得各自维护执行状态机真相；实际状态推进应由 `ExecutionService` 或对应应用编排层完成
3. `event_outbox` 应显式承载 envelope 关键字段，`payload` 仅保留最小摘要

## 5. Greenfield Migration 规则

### 5.1 编号规则

所有 migration 统一放在：

```text
infra/migrations/
```

编号格式固定为 4 位全仓单调递增：

```text
0001_...
0002_...
0003_...
```

硬规则如下：

1. 全仓只维护一条编号序列
2. 编号一旦占用，不复用、不重排
3. 不按 `content`、`execution`、`billing` 各自维护独立编号

### 5.2 文件命名规则

文件命名采用：

```text
NNNN_<domain>_<action>_<target>.sql
```

推荐示例：

```text
0008_execution_create_shot_executions.sql
0009_execution_create_shot_execution_runs.sql
0012_asset_create_import_batches_upload_sessions.sql
0015_review_create_shot_reviews.sql
```

禁止长期使用：

- `init_xxx.sql`
- `update_xxx.sql`
- `misc.sql`
- `fix.sql`
- `backfill_xxx.sql`
- `compat_xxx.sql`

### 5.3 初始建库原则

Phase 1 当前只允许描述 greenfield 初始建库：

1. 直接创建目标模型
2. 不创建只为兼容旧 schema 存在的表
3. 不写回填 migration
4. 不写双读 / 双写 / 切换窗口说明

因此当前基线下：

- `shots` 从第一天就是结构骨架
- 正文版本化的最小实现通过 `content_snapshots` 落地，可与 Batch 2 的内容 migration 同批创建
- `shot_executions.primary_asset_id` 从第一天就是主素材真相
- `shot_candidate_assets` 从第一天就挂 `shot_execution_id`
- `shot_reviews` 从第一天就是事件流
- 不创建 `shot_asset_links`
- 不创建 `approvals`

## 6. Phase 1 初始建库批次建议

### Batch 1：治理与项目骨架

```text
0001_org_create_organizations.sql
0002_org_create_users_memberships_roles.sql
0003_project_create_projects.sql
0004_project_create_episodes.sql
```

### Batch 2：内容结构骨架

```text
0005_content_create_story_bibles_characters.sql
0006_content_create_scripts_storyboards_snapshots.sql
0007_content_create_shots.sql
```

### Batch 3：镜头执行链

```text
0008_execution_create_shot_executions.sql
0009_execution_create_shot_execution_runs.sql
```

### Batch 4：工作流主干

```text
0010_workflow_create_jobs_workflow_runs.sql
0011_workflow_create_workflow_steps_state_transitions_outbox.sql
```

### Batch 5：资产接入链

```text
0012_asset_create_import_batches_upload_sessions.sql
0013_asset_create_upload_files_media_assets.sql
0014_asset_create_import_batch_items_candidate_assets.sql
```

### Batch 6：审核与成本治理

```text
0015_review_create_shot_reviews.sql
0016_billing_create_usage_budget_billing.sql
```

说明：

- Phase 1 首批 migration 不包含 `approvals`
- Phase 1 首批 migration 不包含通用 `asset_links`
- 角色 / 场景资产复用链路仅保留后续扩展边界

## 7. 对现有文档的影响分析

### 7.1 直接影响分析

- 总设计中的 proto 与服务边界应引用本文，不再各自重复命名规则
- 数据库设计稿中的 migration 章节应以本文作为 greenfield 初始建库规范
- monorepo 设计中的 `proto/sdk` 边界应以本文作为协议约束源
- 对齐版实施计划中的 migration 文件名应直接对齐本文，不再保留模糊占位名

### 7.2 间接影响分析

- 前端 SDK 生成代码会围绕 `content / execution / review / workflow / billing` 清晰分域
- 前后端聚合查询会更倾向显式工作台 response，而不是继续膨胀单一资源对象
- 数据库主线不再被兼容层和临时迁移方案污染

### 7.3 数据结构兼容性

- 当前基线不讨论旧数据兼容
- 当前基线不讨论旧客户端兼容
- 若未来出现历史包袱，应以新附录单独处理，不修改本基线

## 8. 推荐的下一步

本文确认后，下一步建议按以下顺序推进：

1. 先补 `proto` 草案目录与最小 service 定义
2. 再细化 `infra/migrations` 的正式文件名与批次
3. 最后开始写第一批 migration 与 generated code 脚手架
