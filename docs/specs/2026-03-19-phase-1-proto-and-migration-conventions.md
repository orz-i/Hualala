# AI 剧集平台 Phase 1 Proto 与 Migration 约定

## 1. 文档定位

本文用于固化 Phase 1 的两类工程约束：

1. `proto` 的领域边界、服务归属、消息命名、事件命名与跨域引用规则
2. `infra/migrations` 的编号、命名、批次、回填与兼容窗口规则

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
- schema 变更、数据回填、切换与遗留清理的执行顺序

### 2.2 本文不覆盖范围

- 具体 `.proto` 字段全集
- 具体 SQL DDL 细节
- 页面级 ViewModel 设计
- 具体 Temporal workflow 定义
- 具体 CI 命令实现

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
| `ContentService` | `ListShots`、`GetShot`、`UpdateShotStructure` |
| `ExecutionService` | `GetShotExecution`、`ListShotExecutions`、`ListShotExecutionRuns`、`StartShotExecutionRun`、`SelectPrimaryAsset`、`SubmitShotForReview`、`MarkShotReworkRequired` |
| `ReviewService` | `ListShotReviews`、`CreateShotReview`、`GetLatestShotReviewSummary` |
| `AssetService` | `CreateImportBatch`、`ListImportBatchItems`、`ConfirmImportBatchItem`、`ListCandidateAssets` |
| `WorkflowService` | `StartWorkflow`、`GetWorkflowRun`、`ListWorkflowRuns`、`CancelWorkflowRun`、`RetryWorkflowRun` |
| `BillingService` | `GetBudgetSnapshot`、`ListUsageRecords`、`ListBillingEvents`、`UpdateBudgetPolicy` |

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
- `shot.review.updated`
- `workflow.updated`
- `import_batch.updated`
- `budget.updated`
- `billing.alert`

规则如下：

1. 事件名描述“发生了什么”
2. RPC 名描述“你要做什么”
3. 禁止把 RPC 动作名直接复用为事件名
4. `shot.updated` 仅表示结构骨架变更

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

## 5. Migration 规则

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
0003_execution_create_shot_executions.sql
0004_execution_create_shot_execution_runs.sql
0005_execution_backfill_shot_executions_from_shots.sql
0006_asset_backfill_candidate_assets_execution_refs.sql
0007_review_create_shot_reviews.sql
```

禁止长期使用：

- `init_xxx.sql`
- `update_xxx.sql`
- `misc.sql`
- `fix.sql`

### 5.3 批次与执行顺序

schema 演进固定采用：

```text
expand -> backfill -> switch -> contract
```

各阶段含义如下：

1. `expand`
   - 新增表、新增列、新增索引
   - 不删除旧结构
2. `backfill`
   - 把旧数据迁移到新结构
   - 要求幂等、可重跑
3. `switch`
   - 应用切到新读写入口
   - 旧结构只保兼容读，不鼓励长期双写
4. `contract`
   - 删除遗留列、遗留读路径、兼容表

禁止在一个 migration 中同时完成：

- 建表
- 数据回填
- 删除旧字段

### 5.4 回填规则

所有回填 migration 必须满足：

1. 幂等
2. 可重复执行
3. 明确映射假设
4. 带校验查询
5. 失败可人工复盘

### 5.5 兼容窗口规则

兼容窗口采用以下策略：

- 优先双读过渡
- 谨慎双写过渡
- 必须明确结束点

具体规则：

1. 兼容层只用于过渡，不得成为长期主写入口
2. 一旦新服务与新页面切换完成，应进入遗留清理阶段
3. 禁止新增功能继续写回旧过载字段

## 6. Shot 拆分的推荐迁移顺序

针对 `Shot -> ShotExecution -> ShotExecutionRun -> ShotReview` 拆分，推荐序列如下：

```text
0003_execution_create_shot_executions.sql
0004_execution_create_shot_execution_runs.sql
0005_execution_backfill_shot_executions_from_shots.sql
0006_execution_backfill_runs_from_shots.sql
0007_asset_backfill_candidate_assets_execution_refs.sql
0008_review_expand_shot_reviews_links.sql
0009_execution_switch_primary_asset_truth.sql
0010_cleanup_drop_legacy_shot_fields.sql
```

建议回填假设写死为：

1. 每个旧 `Shot` 回填一条 `shot_executions`
2. 若旧数据没有轮次概念，则补一条 `run_no = 1` 的 `shot_execution_runs`
3. 旧 `shots.primary_asset_id` 若存在，则回填到 `shot_executions.primary_asset_id`
4. 旧 `shot_candidate_assets` 必须补 `shot_execution_id`
5. 旧审核记录若缺执行轮次信息，允许只挂 `shot_id`

建议校验项至少包括：

1. `shots` 数量与 `shot_executions` 数量一致
2. 每个 `shot_execution` 都有合法 `shot_id`
3. 同一 `shot` 下 `run_no` 唯一
4. 候选池不存在悬空 `shot_execution_id`

## 7. 对现有文档的影响分析

### 7.1 直接影响分析

- 总设计中的 proto 与服务边界应引用本文，不再各自重复命名规则
- 数据库设计稿中的 migration 章节应以本文作为命名与回填规范
- monorepo 设计中的 `proto/sdk` 边界应以本文作为协议约束源
- 对齐版实施计划中的 migration 文件名允许作为任务占位，但正式落地应遵循本文

### 7.2 间接影响分析

- 前端 SDK 生成代码会围绕 `content / execution / review / workflow / billing` 清晰分域
- 前后端聚合查询会更倾向显式工作台 response，而不是继续膨胀单一资源对象
- 迁移实施时可以更早结束遗留兼容窗口，降低双真相风险

### 7.3 数据结构兼容性

- 本文不改变 `shot_id` 作为稳定核心标识
- 本文不要求立刻删除兼容表，但要求兼容表不再成为长期主真相
- 本文允许旧审核记录只挂 `shot_id`，以换取平滑迁移

## 8. 推荐的下一步

本文确认后，下一步建议按以下顺序推进：

1. 先补 `proto` 草案目录与最小 service 定义
2. 再细化 `infra/migrations` 的正式文件名与批次
3. 最后开始写第一批 migration 与 generated code 脚手架
