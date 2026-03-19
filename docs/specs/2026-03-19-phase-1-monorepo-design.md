# AI 剧集平台 Phase 1 Monorepo 设计文档

## 1. 文档定位

本文是对以下文档的仓库与工程组织层补充设计：

- [AI 剧集生产协作平台设计文档](D:/Documents/Hualala/docs/specs/2026-03-18-ai-series-platform-design.md)
- [AI 剧集平台 Phase 1 对齐版实施计划](D:/Documents/Hualala/docs/plans/2026-03-19-phase-1-ai-series-platform-aligned-plan.md)
- [AI 剧集平台 Phase 1 数据库设计稿](D:/Documents/Hualala/docs/specs/2026-03-18-phase-1-database-design.md)
- [AI 剧集平台 Phase 1 Proto 与 Migration 约定](D:/Documents/Hualala/docs/specs/2026-03-19-phase-1-proto-and-migration-conventions.md)

本文只解决 Phase 1 的 `monorepo 目录结构`、`Go 后端包边界`、`proto/sdk 共享策略`、`tooling 与 infra 组织方式`、`发布轨设计` 五件事，不展开到页面交互、数据库字段级 DDL 和详细任务拆分。

## 2. 已确认约束

本设计基于以下已确认约束：

1. Phase 1 采用 monorepo 组织代码
2. 工程编排优先采用 `pnpm workspace + turbo + buf + Go`
3. Go 后端保持单个应用入口，但内部必须明确拆出领域包和分层边界
4. 前后端只共享 `proto/sdk`
5. UI 组件和业务 ViewModel 由 `admin`、`creator` 各端自管
6. 发布策略采用混合模式：`backend + admin` 为主发布轨，`creator` 可独立发版
7. `数据库迁移` 与 `环境模板` 进入主仓，完整私有化部署清单暂不作为 Phase 1 主体
8. Phase 1 在原有生产主链基础上，新增 `DAG/工作流编排` 与 `成本计量/计费守卫`
9. Phase 1 将正文版本化纳入最小实现，但动态样片预演只预留扩展边界，不作为 MVP 硬验收前置

## 3. 设计目标与非目标

### 3.1 设计目标

- 用一个仓库承载 Phase 1 的多应用、多协议和共享通信层
- 在不拆微服务的前提下，把 Go 后端的领域边界和依赖方向先做清楚
- 把 `proto` 定义为唯一通信事实源，避免前后端重复维护协议类型
- 降低本地开发、CI 和代码生成的复杂度
- 为未来服务化拆分预留边界，但不提前承担多服务治理成本

### 3.2 非目标

- Phase 1 不拆成多个独立后端服务仓库
- Phase 1 不建立共享 UI 组件包
- Phase 1 不建立共享业务类型包
- Phase 1 不把完整私有化部署体系一次性塞进主仓
- Phase 1 不用顶层目录直接模拟微服务拓扑

## 4. 总体方案选择

Phase 1 采用 `混合收口型 monorepo`：

- 顶层仓库保持简单稳定，按 `应用 / 协议 / 共享通信 / 工程工具 / 运行资产 / 文档` 分层
- `apps/backend` 保持单一后端应用入口
- `apps/backend/internal` 内部用清晰的 `domain / application / interfaces / platform` 结构划清职责
- `proto/` 作为通信协议唯一事实源
- `packages/sdk` 只负责前端通信层，不承载 UI 与业务页面类型

不采用其他两类方案的原因如下：

### 4.1 不采用“应用优先型”

“应用优先型”虽然简单，但容易让 monorepo 只剩目录聚合，无法把 Go 后端内部边界前置固化。对当前项目这种“单后端应用但业务域较多”的场景，约束力不够。

### 4.2 不采用“平台分层型”

“平台分层型”会把顶层目录直接拆成多个领域与平台层，边界更强，但会显著提高 Phase 1 的装配、调试、路径管理和交付复杂度，容易过早进入“伪微服务”状态。

### 4.3 采用“混合收口型”的理由

- 顶层目录简单，便于初期稳定推进
- 后端内部仍能实现强边界约束
- 与“只共享 proto/sdk”的要求天然一致
- 后续若拆服务，可沿着内部领域边界平移，而不必先推翻整个仓库结构

## 5. Phase 1 Monorepo 顶层结构

推荐顶层目录如下：

```text
.
├─ apps/
│  ├─ admin/
│  ├─ creator/
│  └─ backend/
├─ proto/
├─ packages/
│  └─ sdk/
├─ tooling/
├─ infra/
│  ├─ migrations/
│  ├─ env/
│  └─ docker/
├─ docs/
├─ tests/
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ buf.yaml
└─ buf.gen.yaml
```

### 5.1 顶层目录职责

| 目录 | 职责 | 说明 |
| --- | --- | --- |
| `apps/admin` | Web 管理端 | 管理组织、成员、配置、审批、审计、成本治理 |
| `apps/creator` | Tauri 创作端 | 创作工作台、内容编辑、资产浏览、流程触发 |
| `apps/backend` | Go 后端应用 | Connect RPC、SSE、上传会话、业务模块与基础设施装配 |
| `proto` | 协议定义 | 前后端共享通信事实源 |
| `packages/sdk` | 前端共享通信层 | Connect 客户端、SSE 订阅、上传会话客户端 |
| `tooling` | 工程工具 | 脚本、模板、生成器、开发辅助命令 |
| `infra` | 运行时资产 | 数据库迁移、环境模板、最小 Docker 运行样板 |
| `docs` | 设计与计划文档 | 规格说明、实施计划、数据库设计与后续 ADR |
| `tests` | 跨应用验证 | e2e、集成测试与跨端验收脚本 |

### 5.2 顶层目录设计原则

1. `apps` 只放可独立运行或发布的应用，不放共享业务库
2. `proto` 只放协议定义，不放业务实现和页面类型
3. `packages` 只放真正跨端共享且边界稳定的包，Phase 1 仅保留 `sdk`
4. `tooling` 与 `infra` 必须区分：
   - `tooling` 是开发与生成工具
   - `infra` 是运行与交付资产
5. `docs` 持续保留设计文档，不把关键架构决策埋进聊天记录

## 6. Go 后端组织方式

### 6.1 核心结论

`apps/backend` 在 Phase 1 推荐保持 `单个 Go module`，但在 `internal/` 中明确拆出逻辑上接近“子模块”的边界。

不建议 Phase 1 一开始就拆成多个 `go.mod` 或多个后端应用，原因如下：

- 会显著增加本地开发与 CI 的路径管理成本
- 会放大 Buf 生成代码、事务管理、迁移执行和接口装配复杂度
- 当前业务目标仍是“单体交付、边界清晰”，不是“独立服务发布”

### 6.2 推荐结构

```text
apps/backend/
├─ cmd/
│  └─ api/
├─ internal/
│  ├─ domain/
│  │  ├─ auth/
│  │  ├─ org/
│  │  ├─ project/
│  │  ├─ content/
│  │  ├─ execution/
│  │  ├─ asset/
│  │  ├─ workflow/
│  │  ├─ usage/
│  │  ├─ billing/
│  │  └─ review/
│  ├─ application/
│  │  ├─ authapp/
│  │  ├─ orgapp/
│  │  ├─ projectapp/
│  │  ├─ contentapp/
│  │  ├─ executionapp/
│  │  ├─ assetapp/
│  │  ├─ workflowapp/
│  │  ├─ usageapp/
│  │  ├─ billingapp/
│  │  └─ reviewapp/
│  ├─ interfaces/
│  │  ├─ connect/
│  │  ├─ sse/
│  │  ├─ upload/
│  │  └─ http/
│  └─ platform/
│     ├─ db/
│     ├─ storage/
│     ├─ events/
│     ├─ temporal/
│     ├─ pricing/
│     ├─ budget/
│     ├─ authz/
│     ├─ config/
│     └─ observability/
├─ gen/
└─ go.mod
```

### 6.3 分层职责

#### `domain/*`

负责表达业务本体：

- 实体
- 值对象
- 领域规则
- 状态机规则
- 仓储接口
- 领域服务

这一层只描述“业务是什么”，不感知 Connect、PostgreSQL、对象存储和 SSE。

#### `application/*`

负责表达用例编排：

- 命令与查询用例
- 权限校验顺序
- 事务边界
- 跨领域协作
- 失败补偿与业务一致性流程

这一层是跨领域协作的唯一合法入口。

#### `interfaces/*`

负责把外部协议映射到应用层：

- `connect/` 负责 Connect RPC handler
- `sse/` 负责事件流订阅与推送协议适配
- `upload/` 负责上传会话与对象存储上传协调
- `http/` 负责健康检查、探针和必要的 HTTP 辅助接口

这一层不写核心业务逻辑，只做协议适配与入参/出参转换。

#### `platform/*`

负责技术实现细节：

- PostgreSQL 访问与 repository 实现
- 对象存储适配
- event outbox 实现
- 鉴权与组织上下文基础设施
- 配置读取
- 日志、追踪、指标

这一层不拥有业务语义，只提供技术能力。

### 6.4 领域拆分建议

| 领域包 | 主要职责 |
| --- | --- |
| `auth` | 登录态、token/session、当前身份 |
| `org` | 组织、成员、角色、权限 |
| `project` | 项目、集数、阶段总览 |
| `content` | 世界观、角色、剧本、分镜、镜头结构骨架 |
| `execution` | 镜头当前执行态、执行轮次、主素材选择与返工推进 |
| `asset` | 导入批次、上传、媒体资产、镜头挂接、候选池 |
| `workflow` | 长任务、状态迁移、事件出站、流程推进 |
| `usage` | 模型调用、视频秒数、存储量等使用量事实记录 |
| `billing` | 额度、预算、预警、拒绝与熔断策略 |
| `review` | 审批、导演抽检、打回与结论 |

### 6.5 依赖方向

固定依赖方向如下：

```text
interfaces -> application -> domain
platform   -> application -> domain
interfaces -> platform
```

禁止的依赖方向如下：

```text
domain      -X-> application
domain      -X-> interfaces
domain      -X-> platform
application -X-> 其他应用层内部实现细节
```

### 6.6 关键边界规则

1. 跨领域协作只能经由 `application` 层完成
2. `domain` 不允许感知技术栈实现
3. repository 接口定义放在领域层，具体实现放在 `platform/db`
4. `cmd/api` 只负责应用装配与启动，不写业务逻辑
5. `asset` 与 `review` 不能互相直接修改对方实现，需由 `workflowapp` 或对应应用服务编排
6. `content` 只表达镜头结构骨架，不承担执行态与审核态
7. `workflow` 的资源绑定点应优先落在 `shot_execution_run`
8. `review` 只记录审核事件流，不回退成 `Shot` 当前状态真相

## 7. Proto、生成产物与 SDK 设计

### 7.1 协议目录

推荐协议目录如下：

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

### 7.2 协议设计原则

1. `proto` 是请求、响应、枚举和服务定义的唯一事实源
2. `common` 只保留跨域稳定通用结构，不建立一个巨大的业务共享 proto
3. 各业务对象尽量留在自己的领域 proto 中，避免“全局 shared business types”膨胀
4. `Shot` 相关协议明确拆为：
   - `content/v1` 只负责结构骨架
   - `execution/v1` 负责当前执行态与执行轮次
   - `review/v1` 负责审核事件流

### 7.3 生成产物位置

生成路径建议固定如下：

```text
apps/backend/gen/
packages/sdk/src/gen/
```

对应生成流：

```text
proto/*.proto
  -> buf generate
  -> apps/backend/gen/      # Go messages + Connect server/client stubs
  -> packages/sdk/src/gen/  # TS messages + Connect clients
```

### 7.4 `packages/sdk` 职责边界

推荐结构如下：

```text
packages/sdk/
├─ src/
│  ├─ gen/
│  ├─ connect.ts
│  ├─ events.ts
│  ├─ uploads.ts
│  └─ index.ts
└─ package.json
```

职责划分如下：

| 文件/目录 | 职责 |
| --- | --- |
| `src/gen` | Buf 生成的 TS 协议与客户端 |
| `connect.ts` | Connect client 工厂、base URL、header 注入、组织上下文传递 |
| `events.ts` | SSE 事件订阅、重连策略、事件分发 |
| `uploads.ts` | 上传会话客户端、对象存储直传协调 |
| `index.ts` | SDK 统一导出入口 |

### 7.5 明确不放进 `packages/sdk` 的内容

- React hooks
- 页面表单 schema
- 管理端与创作端共用的业务 ViewModel
- UI 组件
- 页面级别 DTO 和状态管理逻辑
- `WebSocket + CRDT` 协同适配器
- Yjs provider、富文本协同 binding、协同状态缓存

### 7.6 前端类型策略

`admin` 和 `creator` 各自维护页面本地业务类型：

- 管理端自行维护审批页、配置页、成员管理页的 ViewModel
- 创作端自行维护工作台、剧本编辑、镜头工作区、素材确认页的 ViewModel
- 前端页面层可基于 proto 生成类型做适配，但不反向抽成共享业务类型包

### 7.7 Phase 1 增量边界

本设计在调研优化后，要求 `proto` 与后端内部结构同步补足以下边界：

- `execution/v1`：面向 `ShotExecution` 与 `ShotExecutionRun`，承接执行工作台主接口
- `workflow/v1`：面向高价值长链路工作流实例，而不再只表达平面 job 动作
- `billing/v1`：面向预算快照、使用量明细、成本事件与预算策略管理
- `domain/execution`：负责镜头执行态、执行轮次与主素材选择规则
- `domain/workflow`：负责工作流实例与节点语义
- `domain/usage`：负责使用量事实模型
- `domain/billing`：负责额度、预算、预警与熔断规则

### 7.8 实时协同与来源凭证的放置原则

针对后续调研里新增的两类能力，本仓结构建议保持以下纪律：

1. `SSE` 继续只承担单向状态推送，不承担剧本 / 分镜板的多人实时共编
2. 实时协同编辑在后续阶段单独采用 `WebSocket + CRDT / Yjs`，并优先放在各应用自身的协同模块，而不是直接塞入当前 `packages/sdk`
3. `packages/sdk` 仍保持“薄通信层”定位，只共享稳定的 Connect / SSE / Upload Session 能力
4. `C2PA` 与来源凭证能力优先体现在后端资产模型和导入 / 导出流程边界，不在当前 monorepo 中单独抽一个通用前端包

## 8. 工程编排与工具链设计

### 8.1 推荐工具组合

Phase 1 推荐组合如下：

- `pnpm workspace`：管理 JS/TS workspace 与共享依赖
- `turbo`：统一编排 `build / test / lint / dev` 与缓存
- `buf`：管理 proto lint、breaking change 检查和多端代码生成
- `Go module`：管理后端依赖和测试

### 8.2 `tooling/` 职责

推荐结构如下：

```text
tooling/
├─ scripts/
├─ templates/
└─ buf/
```

主要承载：

- 代码生成辅助脚本
- 本地开发脚本
- 新模块模板
- 工程约束辅助命令

`tooling/` 是“开发与生成工具目录”，不是业务代码目录，也不是运行时目录。

### 8.3 `infra/` 职责

推荐结构如下：

```text
infra/
├─ migrations/
├─ env/
└─ docker/
```

其中：

- `migrations/`：数据库迁移 SQL
- `env/`：环境变量模板与示例
- `docker/`：最小运行样板，例如本地 PostgreSQL、对象存储模拟等

### 8.4 `infra/` 范围控制

Phase 1 中，`infra/` 只需要承载能支撑研发与基础交付的最小资产：

- 本地与测试环境启动所需内容
- 基础迁移与环境模板
- 极少量容器化样板

暂不要求：

- 客户级私有化编排模板全覆盖
- 多套部署拓扑全部产品化
- 完整运维平台化脚本

## 9. 发布与版本策略

### 9.1 发布轨划分

Phase 1 采用混合发布模式：

1. `backend + admin` 作为平台主发布轨
2. `creator` 作为单独发布轨

原因如下：

- `admin` 与 `backend` 在组织治理、审批、配置、审计方面耦合更紧
- `creator` 作为 Tauri 桌面端，更新方式与节奏天然不同
- 单独维护 `creator` 发布轨可降低桌面端升级对平台主发布的阻塞

### 9.2 共享兼容性门槛

虽然发布轨不同，但三者必须受同一套协议兼容性约束：

- `proto` 改动必须通过 Buf 检查
- `packages/sdk` 必须保持对两端前端应用的兼容
- 若协议破坏兼容，应通过版本策略处理

最低门禁建议固定为：

- `buf lint`
- `buf breaking`
- `turbo run lint`
- `turbo run test`
- `turbo run build`
- `go test ./...`

## 10. 本地开发与 CI 建议

### 10.1 推荐任务流

建议把主流程固定成如下顺序：

```text
proto changed
  -> buf lint
  -> buf breaking
  -> buf generate
  -> sdk build/test
  -> admin build/test
  -> creator build/test
  -> backend test/build
```

### 10.2 任务编排建议

顶层由 `turbo` 统一触发任务，Go 任务可通过脚本桥接到 `apps/backend`：

- `turbo run lint`
- `turbo run test`
- `turbo run build`
- `turbo run dev`

CI 中建议至少拆成以下 job：

- `proto-contract`: 运行 `buf lint` 与 `buf breaking`
- `frontend-quality`: 运行 `turbo run lint test build`
- `backend-quality`: 运行 Go 单测与构建
- `e2e-phase1`: 运行关键主链 E2E

这样做的目的是：

- 统一本地命令入口
- 让前端和共享包利用缓存
- 让协议变更能自动触发受影响任务

### 10.3 Go 任务建议

虽然 Go 后端不属于 pnpm 生态，但仍建议通过顶层脚本纳入统一编排，例如：

- 由 `tooling/scripts` 封装 `go test ./...`
- 由 `tooling/scripts` 封装 `go build ./cmd/api`
- 由 `tooling/scripts` 封装迁移命令

这样可以避免开发者在多个目录间手工切换。

## 11. 对现有文档的影响分析

本节用于明确本次 monorepo 设计对现有规划文档的直接与间接影响。

### 11.1 直接影响分析

#### 对现有 Phase 1 对齐版实施计划的影响

现有 [Phase 1 对齐版实施计划](D:/Documents/Hualala/docs/plans/2026-03-19-phase-1-ai-series-platform-aligned-plan.md) 中已经提出了：

- `apps/backend`
- `apps/admin`
- `apps/creator`
- `proto`
- `packages/sdk`

因此总体方向一致，不会推翻当前执行基线。

但以下路径需要以本文为准进行调整：

1. 数据库迁移路径从 `apps/backend/db/migrations` 调整为 `infra/migrations`
2. 后端生成代码路径固定为 `apps/backend/gen`
3. 前端生成代码路径固定为 `packages/sdk/src/gen`
4. Go 后端内部模块组织从“按模块散落实现”提升为“领域 + 应用 + 接口 + 平台”分层
5. `Shot` 相关实现必须拆为 `content`、`execution`、`review` 三个边界，不能继续由单一对象承载

#### 对 proto 服务边界的影响

会直接影响 proto 领域划分：

1. 新增 `hualala/execution/v1`
2. 新增 `ExecutionService`
3. `content/v1` 不再承担执行态字段
4. `review/v1` 保持审核事件流，不再回退成“镜头当前审核状态接口”

#### 对数据库设计稿的影响

会直接影响数据库设计稿：

1. `shots` 回归镜头结构骨架
2. 新增 `shot_executions` 与 `shot_execution_runs`
3. `shot_candidate_assets` 主挂点切换到 `shot_execution_id`
4. `shot_reviews` 改为审核事件流，并可关联执行态、执行轮次和资产
5. 主素材真相收口到 `shot_executions.primary_asset_id`

### 11.2 间接影响分析

1. 本地开发流程会从“各应用独立手工操作”收敛到顶层统一编排
2. CI 流程会围绕 `proto -> sdk -> apps` 的依赖顺序设计
3. 前端页面类型不再试图抽取到共享包，有助于降低管理端与创作端耦合
4. 后端跨领域调用会被强制提升到 `application` 层，减少隐式依赖扩散

### 11.3 Greenfield 基线分析

本次文档以纯 greenfield 基线为前提：

- `shot_id` 继续保留为核心稳定标识
- `shots` 从第一天起就是结构骨架，不承担执行态和审核态
- `shot_executions` 与 `shot_execution_runs` 从第一天起就是正式模型
- 不讨论旧数据回填、兼容表和迁移窗口

## 12. 关键约束清单

为避免 Phase 1 实现时结构失控，以下约束应视为硬规则：

1. 只共享 `proto/sdk`，不新增共享 UI 包
2. 不新增共享业务类型包
3. Go 后端保持单 `go.mod`，但必须遵守分层依赖规则
4. `infra/migrations` 与后端代码必须同仓演进
5. `creator` 可以独立发版，但不能绕开协议兼容性约束
6. `cmd/api` 不允许写业务逻辑
7. `domain` 不允许依赖 `platform` 和 `interfaces`
8. `Shot` 不允许继续持有主素材、执行状态和审核状态字段
9. `ExecutionService` 应作为镜头执行工作台的主接口
10. `workflow` 与 `billing/usage` 对镜头的归因点应统一落在 `shot_execution_run`
11. `tests/` 目录承担跨应用与跨协议验证，不把 E2E 混入单个应用目录
12. `creator` 虽可独立发版，但不得绕开 `buf breaking` 与共享协议兼容门槛

## 13. 推荐的下一步

本文完成后，下一步不应直接分散开工，而应先基于本设计补齐一份新的 Phase 1 实施计划，重点固化：

1. 顶层 workspace 初始化步骤
2. Buf 与多端生成配置
3. `apps/backend` 分层骨架搭建顺序
4. `infra/migrations` 与本地开发环境初始化方式
5. `admin`、`creator` 与 `packages/sdk` 的接线顺序

在未写清实施计划前，不建议直接进入大规模脚手架和业务代码落地。
