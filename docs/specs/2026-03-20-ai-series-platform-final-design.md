# AI 剧集生成平台最终设计文档

> 面向短剧工作室、MCN 与品牌内容团队的 AI 内容生产操作系统

- 版本：1.0 Final
- 日期：2026-03-19
- 文档属性：统一设计基线、研发实施依据、评审与交付口径
- 当前 UI 支持语言：简体中文（zh-CN）、English（en-US）
- 当前内容工作语言：支持中文与英文；允许项目按源语言与展示语言分离配置

## 1. 执行摘要

本平台的目标不是做一个“把提示词发给视频模型”的简单入口，而是做一套面向短剧生产团队的 AI 内容生产操作系统。系统必须同时管理四类真相：内容真相、执行真相、治理真相、合规真相。平台不仅要知道生成了什么，更要知道为什么这样生成、谁批准了、花了多少钱、是否能够发布。

Phase 1 的核心任务是跑通一条真实生产闭环：项目立项、Episode / Scene / Shot 结构化、文本快照管理、素材导入、候选资产生成、主素材确认、镜头执行、机器关卡、人审打回、预算拦截、合规留痕、审计导出。所有能力都应服务于这个闭环，而不是并列堆功能。

本最终设计文档将原有总设计、数据库设计、Proto 与 Migration 约定、Monorepo 设计整合为一份统一基线，并新增 i18n 设计，明确当前必须同时支持中文与英文。本文中的对象模型、服务边界、迁移批次、工程约束和验收脚本应作为后续研发与交付的共同事实源。

### 1.1 最终结论

| 主题 | 最终结论 |
| --- | --- |
| 产品定位 | 平台首先是内容生产协作与治理系统，其次才是模型调用入口 |
| Phase 1 策略 | 优先打通生产闭环，不做功能面扩张 |
| 内容结构 | 正式采用 `Project -> Episode -> Scene -> Shot` 四层结构 |
| 执行结构 | 正式采用 `ShotExecution -> ShotExecutionRun` 分层表达当前态与历史轮次 |
| AI 运行时 | 正式采用 `ModelProfile + PromptTemplate + ContextBundle` 三件套 |
| 资产治理 | 正式采用 `MediaAsset + MediaAssetVariant + RightsRecord` 结构 |
| 质量与审核 | 正式区分 `EvaluationRun`（机器关卡）与 `ShotReview`（人工审核） |
| 通信协议 | 以 `Proto + Connect RPC + SSE + Upload Session` 为统一通信基线 |
| 工程组织 | 采用 Monorepo；后端保持单应用入口，内部强分层 |
| i18n | 当前必须支持 `zh-CN` 与 `en-US`；区分 UI 语言与内容语言 |
| 数据库策略 | 采用 Greenfield 基线；迁移文件统一编号；对象状态以应用层 Guard 约束为主 |
| 发布前检查 | 来源、授权、AI 标识、预算、审核、审计信息缺一不可 |

## 2. 产品定义、目标与边界

### 2.1 产品定义

平台的一句话定义如下：**面向短剧工作室、MCN 与品牌内容团队的 AI 剧集生成与生产协作平台**。它不是“单次生成一个视频”的工具，而是把立项、世界观、分集、剧本、分镜、镜头执行、素材导入、审核、预算、合规和发布前检查统一收敛到一个工作台里的生产系统。

### 2.2 目标客户

| 客户类型 | 典型诉求 | 平台价值 |
| --- | --- | --- |
| 小型短剧工作室 | 快速起盘、压缩交付周期、降低返工 | 用结构化镜头执行与导入治理替代网盘 + 聊天群 + 表格 |
| MCN 内容团队 | 批量项目并行、流程标准化、多人协作 | 提供项目治理、预算守卫、审核留痕与统一资产入口 |
| 中型影视团队 AI 试验组 | 在不推翻现有流程的前提下引入 AI | 支持导入优先、平台内生成与外部资产共存 |
| 品牌内容部门 / 私有化客户 | 合规、可控、可追溯、可审计 | 提供组织隔离、模型白名单、发布前检查与审计导出 |

### 2.3 核心角色

| 角色 | 主要任务 | 平台核心支持 |
| --- | --- | --- |
| 制片 / 负责人 | 控项目、控进度、控预算、控风险 | 项目总览、预算告警、工作流状态、审计视图 |
| 主编剧 | 维护世界观、角色、分集与剧本一致性 | 正文版本化、上下文约束、双语内容管理 |
| 策划 / 分镜 | 将故事转换成可执行场次与镜头 | Scene / Shot 结构化、参考素材、连续性说明 |
| 执行人员 | 产出、导入、挂接、筛选素材 | 导入批次、候选池、主素材确认、执行轮次 |
| 审核 / 法务 | 判断是否可用、可发、可交付 | 机器关卡、人审流、来源摘要、合规阻断 |
| 管理员 / 运维 | 管权限、环境、模型、存储、告警 | 组织隔离、模型网关、配置与观测视图 |

### 2.4 北极星指标与产品成功标准

| 指标 | 定义 | Phase 1 目标方向 |
| --- | --- | --- |
| 北极星指标 | 从项目立项到首个可审核镜头包的 Lead Time | 持续缩短 |
| 首轮镜头通过率 | 首次提交后直接进入可用态的镜头比例 | 建立基线并逐步提升 |
| 导入自动匹配命中率 | 导入素材被正确匹配到目标镜头的比例 | 持续提升 |
| 预算拦截准确率 | 超预算或违规预算任务是否被准确阻断 | 必须 100% |
| 可追溯率 | 已交付结果能否回溯到运行、上下文与素材来源 | 必须 100% |
| 可发布资产完备率 | 可发布资产是否具备来源、授权、标识、审核、日志 | 必须 100% |

### 2.5 Phase 1 必做与不做

| 分类 | Phase 1 必做 | Phase 1 不做 |
| --- | --- | --- |
| 内容 | Project / Episode / Scene / Shot、正文快照、基本脚本与分镜管理 | 复杂多人实时共编、知识图谱化世界观 |
| 执行 | 镜头执行态、执行轮次、导入治理、候选池、主素材、审核打回 | 成片级自动编排、复杂自动重跑策略 |
| AI | 统一模型网关、Prompt 治理、上下文封包、成本记录 | 追求单模型效果极致、供应商深度绑定 |
| 协同 | 管理端 + 创作端基本协作、SSE 状态推送 | 实时协同编辑、CRDT 富文本共编 |
| 合规 | 来源、授权、AI 标识、审计、预算守卫、发布前检查 | 完整法务合同台账、完整凭证签发系统 |
| 国际化 | UI 中英双语、内容中英双语元数据与快照能力 | 自动全量翻译工作流、任意语种混编策略 |

## 3. 总体设计原则

### 3.1 平台级原则

1. **协作平台优先**：平台要管理生产过程与治理，而不是把自己做成单一模型入口。
2. **导入优先**：外部素材导入、回流和确认是主链路，不将平台内生成视作唯一素材来源。
3. **Provider-Agnostic**：所有模型与第三方平台通过统一网关接入，不允许业务层直接耦合供应商 SDK。
4. **真相层分离**：内容、执行、治理、媒体、审核、计费必须分层建模，避免单对象承载所有责任。
5. **可恢复与可审计**：任何高价值运行都必须可重试、可回溯、可导出最小证据链。
6. **代码存 Canonical，显示做 Localization**：数据库与协议中存稳定代码、枚举和值对象；界面语言由 i18n 资源渲染。
7. **发布前检查前置**：来源、授权、AI 标识、预算与审核不在最后补救，而在主链路中持续验证。

### 3.2 数据与建模原则

1. `Shot` 只表达镜头结构骨架，不保存执行态、审核态、主素材等当前态字段。
2. `ShotExecution` 表达镜头当前执行态；`ShotExecutionRun` 表达轮次历史。
3. `Scene` 是正式一级对象，不再作为可有可无的逻辑分组。
4. 所有关键状态字段存枚举代码，不存本地化展示文案。
5. 不把结构化真相塞进 `jsonb meta`；`jsonb` 仅承接可变供应商扩展信息与调试摘要。
6. 原始资产与派生文件分离建模，使用 `MediaAssetVariant` 保存缩略图、proxy、poster、提取音轨等文件。
7. 上下文、Prompt、模型配置必须可版本化并可与运行记录绑定。
8. 数据库以 Greenfield 为前提，不引入兼容表、双写表和历史回填逻辑。

### 3.3 工程与协议原则

1. `proto` 是通信事实源，前后端只共享 `proto/sdk`，不共享页面级业务类型。
2. 后端保持单应用入口，但内部必须遵守 `domain -> application -> interfaces/platform` 的依赖方向。
3. SSE 只承担单向状态推送，不承担多人实时共编。
4. Temporal 仅承接高价值长链路；普通异步任务走轻量任务体系。
5. 所有发布轨都受同一套协议兼容性门禁约束。

## 4. i18n 与内容语言设计

本章是当前版本新增的正式基线。平台必须从第一天支持中文和英文，但必须明确区分 **界面国际化（UI i18n）** 与 **内容语言管理（Content Localization）**。

### 4.1 目标与非目标

| 类型 | 说明 |
| --- | --- |
| 当前目标 | 支持 `zh-CN` 与 `en-US` 两种 UI 语言；支持项目内容以中文或英文作为源语言；支持快照级翻译挂接与回退 |
| 当前非目标 | 不在 Phase 1 承诺自动完成整项目机器翻译；不承诺同一正文块的多人跨语言实时协同；不承诺任意语种扩展流程 |

### 4.2 核心概念

| 概念 | 定义 |
| --- | --- |
| UI Locale | 用户界面、导航、按钮、表单、校验消息、系统通知的显示语言 |
| Content Locale | 剧本、分镜、镜头说明、审核意见等内容对象本身的语言 |
| Source Locale | 某个内容对象的原始创作语言 |
| Display Locale | 某次查询、导出或工作台希望呈现的语言 |
| Fallback Locale | 当目标语言内容不存在时使用的降级语言 |

### 4.3 当前支持语言与编码规则

| 项目 | 规则 |
| --- | --- |
| 支持语言 | `zh-CN`、`en-US` |
| 语言编码 | 使用 BCP 47 风格的 locale 字符串 |
| 存储规则 | 数据库存储 locale code，不存“中文 / English”显示值 |
| 枚举与状态 | 存 canonical code，客户端按 locale 显示本地化 label |
| 默认策略 | 组织可设默认 UI locale；项目可设默认内容语言；用户可覆盖自己的 UI locale |

### 4.4 i18n 范围

| 范围 | 必须支持 |
| --- | --- |
| Web 管理端 | 菜单、页面标题、按钮、表格列名、错误提示、空状态、通知、审核结论文案 |
| Tauri 创作端 | 工作台标题、编辑器工具栏、导入提示、任务状态、审核面板、上传与恢复提示 |
| 后端系统消息 | 结构化错误码、用户可见错误消息 key、通知模板、审计导出标题 |
| 业务对象显示 | 枚举状态、策略名称、预算告警类型、工作流状态、媒体类型标签 |
| 内容语言 | Story Bible、Script、Storyboard、Shot/Scene 文本快照支持中英文区分与挂接 |
| Prompt 治理 | PromptTemplate 支持 locale 维度；ContextBundle 必须记录实际使用的 locale |
| 导出物 | 审核摘要、项目清单、基础设计导出支持按 locale 生成 |

### 4.5 i18n 设计决策

1. **界面语言与内容语言分离**：用户可以用英文界面查看中文项目，也可以用中文界面查看英文项目。
2. **固定字段不做多语言存储**：状态码、资源类型、媒体类型、审批结论等使用 canonical code 存储，显示时再翻译。
3. **正文通过快照承载语言差异**：`content_snapshots` 负责保存某一对象在某一语言下的正文快照，并通过翻译链与源快照关联。
4. **Prompt 按 locale 版本化**：相同模板族可以有 `zh-CN` 和 `en-US` 两个变体，运行时明确解析到具体模板版本。
5. **接口不返回硬编码中文文案**：后端返回 `error_code`、`message_key` 与最小参数；前端在本地完成文案渲染。

### 4.6 数据模型中的 i18n 扩展

| 对象 / 表 | 新增或要求的字段 | 说明 |
| --- | --- | --- |
| `organizations` | `default_ui_locale`、`default_content_locale` | 组织级默认语言策略 |
| `users` | `preferred_ui_locale` | 用户个人界面语言 |
| `projects` | `primary_content_locale`、`supported_content_locales` | 项目内容工作语言配置 |
| `episodes` / `scenes` / `shots` | `source_locale`（可选） | 允许对象级继承或覆盖项目默认语言 |
| `content_snapshots` | `locale`、`translation_group_id`、`source_snapshot_id`、`translation_status` | 语言版本与翻译关系主落点 |
| `prompt_templates` | `template_family`、`locale`、`version` | 同一模板族下的多语言版本 |
| `context_bundles` | `input_locale`、`output_locale` | 固化运行使用语言 |
| `shot_reviews` | `comment_locale` | 审核意见原始语言 |
| `audit / export payload` | `resolved_locale` | 审计导出和报表生成使用的语言 |

### 4.7 协议与接口中的 i18n 规则

| 场景 | 规则 |
| --- | --- |
| 读接口 | 可接受 `display_locale`，用于请求目标显示语言 |
| 写接口 | 写入正文时必须显式带 `content_locale` |
| 错误返回 | 返回 `error_code`、`message_key`、`message_params`，不直接硬编码中文 |
| 聚合查询 | 聚合响应中的显示名允许带 `localized_label`，但基础状态码仍保留 code |
| SSE 事件 | envelope 中只推 code 和最小摘要；客户端收到后按当前 locale 本地化 |

### 4.8 前端实现规则

| 端 | 建议实现 |
| --- | --- |
| `apps/admin` | 维护自己的 locale 资源文件与页面级翻译；支持运行时切换与记忆 |
| `apps/creator` | 维护自己的 locale 资源文件；离线缓存中保存上次选择的 UI locale |
| 共享约束 | 不新增共享 UI 包；各端自管翻译资源；共享部分仅为协议 code 与 message key 约定 |
| 文案校验 | 通过脚本检查 `zh-CN` / `en-US` key 完整性、占位参数一致性和未引用 key |

### 4.9 Prompt 与模型路由中的语言约束

1. `ModelProfile` 必须声明支持的输入语言、输出语言与文本 / 图像 / 视频能力组合。
2. `PromptTemplate` 必须按 locale 版本化，禁止同一模板在多语言下仅靠字符串替换。
3. `ContextBundle` 必须记录最终解析出的模板版本、输入语言、输出语言、参考快照语言。
4. 当模型不支持目标输出语言时，应在策略层阻断或降级到人工翻译，不允许静默输出错误语言。

### 4.10 i18n 验收要求

| 验收项 | 通过标准 |
| --- | --- |
| UI 切换 | 管理端与创作端可在中英之间切换，刷新后保持选择 |
| 内容快照 | 同一 Script / Storyboard / Shot 可保存中英两个语言快照，并可明确谁是源快照 |
| 导出 | 设计稿、审核摘要、项目概览可按中文或英文导出 |
| 回退 | 当目标语言内容缺失时，系统按明确规则回退并提示 |
| 日志与审计 | 日志、事件、状态码始终使用 canonical code，不受 UI locale 影响 |

## 5. 核心领域模型

### 5.1 真相层划分

| 真相层 | 核心对象 | 主要职责 |
| --- | --- | --- |
| 内容真相层 | `Project`、`Episode`、`Scene`、`Shot`、`StoryBible`、`Script`、`Storyboard`、`ContentSnapshot` | 承载叙事结构、正文版本与语言版本 |
| 执行真相层 | `ContextBundle`、`ShotExecution`、`ShotExecutionRun`、`EvaluationRun`、`ShotReview` | 承载镜头执行、轮次历史、机器关卡与人工审核 |
| 治理真相层 | `WorkflowRun`、`WorkflowStep`、`Job`、`UsageRecord`、`BudgetPolicy`、`BillingEvent`、`StateTransition`、`EventOutbox` | 承载工作流、成本、预算、可观察状态与事件 |
| 媒体真相层 | `ImportBatch`、`UploadSession`、`UploadFile`、`MediaAsset`、`MediaAssetVariant`、`ImportBatchItem`、`ShotCandidateAsset`、`RightsRecord` | 承载上传、导入、资产化、派生文件、挂接与授权信息 |
| 治理配置层 | `ModelProfile`、`PromptTemplate` | 承载模型策略、Prompt 版本与路由约束 |

### 5.2 关键关系链

```text
Project -> Episode -> Scene -> Shot
Shot -> ShotExecution -> ShotExecutionRun
ShotExecutionRun -> ContextBundle -> (PromptTemplate, ModelProfile)
ImportBatch -> UploadSession -> UploadFile -> MediaAsset -> MediaAssetVariant
ShotExecution -> ShotCandidateAsset -> MediaAsset
ShotExecutionRun -> EvaluationRun -> ShotReview
WorkflowRun -> WorkflowStep -> StateTransition / EventOutbox
ShotExecutionRun -> UsageRecord -> BillingEvent / BudgetPolicy
```

### 5.3 关键对象说明

| 对象 | 最终定义 |
| --- | --- |
| `Scene` | Episode 内稳定场次对象，用于承接剧本、分镜与镜头执行之间的中间层 |
| `Shot` | 最小镜头结构对象，只表达骨架定义，不表达当前执行态 |
| `ShotExecution` | 镜头当前执行态对象，承载当前候选池、主素材、当前状态、当前轮次 |
| `ShotExecutionRun` | 某次具体执行、重跑、导入回流或人工返工轮次的记录对象 |
| `ContextBundle` | 一次 AI 运行的上下文封包，必须可复现、可审计、可关联语言与模板 |
| `MediaAsset` | 正式资产对象，承载来源、授权、归属与可发布性信息 |
| `MediaAssetVariant` | 原文件、缩略图、proxy、poster、提取音轨等派生文件对象 |
| `RightsRecord` | 授权与使用边界记录，用于判断 license 与 consent 状态 |
| `EvaluationRun` | 机器质量关卡结果，不等同于人工审核 |
| `ShotReview` | 人工审核事件流，不承担镜头当前状态唯一真相 |
| `ModelProfile` | 平台治理后的模型能力配置对象，承载 provider、region、pricing 与语言支持 |
| `PromptTemplate` | 版本化 Prompt 模板，支持按业务域与 locale 管理 |

### 5.4 状态机最终口径

#### ShotExecution 当前态

| 状态 | 说明 |
| --- | --- |
| `pending` | 镜头已建立但未进入执行 |
| `in_progress` | 存在进行中的执行或人工处理中 |
| `candidate_ready` | 候选素材已形成，等待主素材确认 |
| `primary_selected` | 主素材已确定，具备进一步检查条件 |
| `submitted_for_review` | 已进入审核队列 |
| `rework_required` | 被打回，需要修订或重跑 |
| `approved_for_use` | 审核通过，可用于后续剪辑或预演 |
| `archived` | 历史归档或镜头废弃 |

#### ShotExecutionRun 轮次状态

| 状态 | 说明 |
| --- | --- |
| `pending` | 已创建轮次，尚未开始 |
| `running` | 执行中 |
| `completed` | 已完成 |
| `failed` | 执行失败 |
| `cancelled` | 被取消 |

#### ImportBatchItem 状态

| 状态 | 说明 |
| --- | --- |
| `parsed` | 已解析基础信息 |
| `matched` | 已完成自动匹配 |
| `pending_review` | 等待人工确认 |
| `confirmed` | 已确认挂接 |
| `rejected` | 已拒绝使用 |

#### ShotReview 结论状态

| 状态 | 说明 |
| --- | --- |
| `commented` | 记录意见但未给出最终结论 |
| `approved` | 审核通过 |
| `rejected` | 审核拒绝或打回 |

## 6. 最终数据库设计基线

### 6.1 数据库总体策略

1. 以 PostgreSQL 作为主事务数据库。
2. 以对象存储承载原始文件与派生文件。
3. 数据库采用 Greenfield 基线；迁移目录统一为 `infra/migrations/`。
4. 数据层不依赖跨域外键来表达全部业务一致性，核心一致性通过应用层 Guard、唯一约束与巡检任务保障。
5. 所有时间字段统一使用 `timestamptz`；主键统一使用 UUID。

### 6.2 最终表清单

#### 治理层

| 表名 | 说明 | Phase |
| --- | --- | --- |
| `organizations` | 组织隔离边界与默认语言策略 | P1 |
| `users` | 全局身份与用户语言偏好 | P1 |
| `memberships` | 用户与组织关系 | P1 |
| `roles` | 角色定义 | P1 |
| `role_permissions` | 角色权限码 | P1 |

#### 内容层

| 表名 | 说明 | Phase |
| --- | --- | --- |
| `projects` | 项目主表 | P1 |
| `episodes` | 集数主表 | P1 |
| `scenes` | 场次主表 | P1 |
| `story_bibles` | 世界观对象 | P1 |
| `characters` | 角色对象 | P1 |
| `scripts` | 剧本对象 | P1 |
| `storyboards` | 分镜对象 | P1 |
| `shots` | 镜头结构骨架 | P1 |
| `content_snapshots` | 正文与语言快照 | P1 |

#### AI 与执行层

| 表名 | 说明 | Phase |
| --- | --- | --- |
| `model_profiles` | 模型治理与路由配置 | P1 |
| `prompt_templates` | Prompt 模板与版本管理 | P1 |
| `context_bundles` | 运行上下文封包 | P1 |
| `shot_executions` | 镜头当前执行态 | P1 |
| `shot_execution_runs` | 镜头执行轮次归档 | P1 |
| `evaluation_runs` | 机器质量关卡结果 | P1 |

#### 资产接入层

| 表名 | 说明 | Phase |
| --- | --- | --- |
| `import_batches` | 一轮业务导入 | P1 |
| `upload_sessions` | 一次上传行为 | P1 |
| `upload_files` | 上传文件记录 | P1 |
| `media_assets` | 正式资产对象 | P1 |
| `media_asset_variants` | 派生文件对象 | P1 |
| `rights_records` | 授权 / consent / 使用边界记录 | P1 |
| `import_batch_items` | 自动匹配与人工确认中间层 | P1 |
| `shot_candidate_assets` | 镜头候选素材池 | P1 |

#### 流程与治理层

| 表名 | 说明 | Phase |
| --- | --- | --- |
| `jobs` | 统一任务锚点 | P1 |
| `workflow_runs` | 高价值长链路实例 | P1 |
| `workflow_steps` | 工作流节点执行记录 | P1 |
| `shot_reviews` | 人工审核事件流 | P1 |
| `usage_records` | 使用量事实表 | P1 |
| `budget_policies` | 预算策略表 | P1 |
| `billing_events` | 预算预警、阻断与豁免事件 | P1 |
| `state_transitions` | 状态迁移审计 | P1 |
| `event_outbox` | 可靠事件来源 | P1 |

### 6.3 关键表字段要求

#### `projects`

| 字段 | 要求 |
| --- | --- |
| `organization_id` | 组织归属 |
| `owner_user_id` | 项目负责人 |
| `status` | `draft / active / archived` |
| `current_stage` | 项目当前阶段 |
| `primary_content_locale` | 项目源语言 |
| `supported_content_locales` | 项目支持语言列表 |
| `settings` | 项目级策略与默认值 |

#### `scenes`

| 字段 | 要求 |
| --- | --- |
| `episode_id` | 所属集数 |
| `scene_no` | 场次编号，项目内稳定 |
| `title` | 场次标题 |
| `summary` | 场次摘要 |
| `source_locale` | 场次源语言，可继承项目默认值 |
| `lifecycle_status` | 场次生命周期 |

#### `shots`

| 字段 | 要求 |
| --- | --- |
| `scene_id` | 所属场次 |
| `shot_no` | 镜头编号，场次内稳定 |
| `lifecycle_status` | 结构对象生命周期 |
| `shot_size`、`camera_move` | 结构化镜头语义 |
| `subject_action` | 主要动作 |
| `composition_notes` | 构图说明 |
| `continuity_notes` | 连续性说明 |
| `source_locale` | 镜头源语言 |

#### `content_snapshots`

| 字段 | 要求 |
| --- | --- |
| `resource_type` + `resource_id` | 关联对象 |
| `snapshot_kind` | `story_bible / script / storyboard / scene / shot / prompt_context` 等 |
| `locale` | 快照语言 |
| `translation_group_id` | 同一语义对象的多语言快照归组 |
| `source_snapshot_id` | 指向源快照 |
| `translation_status` | `source / draft_translation / reviewed_translation` 等 |
| `body` | 正文 |
| `summary` | 摘要 |

#### `model_profiles`

| 字段 | 要求 |
| --- | --- |
| `provider` | 供应商 |
| `model_name` | 模型名 |
| `capability_type` | 文本 / 图像 / 视频 / 音频等 |
| `region` | 区域策略 |
| `supported_input_locales` | 支持输入语言 |
| `supported_output_locales` | 支持输出语言 |
| `pricing_snapshot` | 成本快照 |
| `rate_limit_policy` | 限速策略 |
| `status` | `active / paused / archived` |

#### `prompt_templates`

| 字段 | 要求 |
| --- | --- |
| `template_family` | 模板族标识 |
| `template_key` | 业务内稳定 key |
| `locale` | 模板语言 |
| `version` | 版本号 |
| `content` | 模板内容 |
| `input_schema` / `output_schema` | 输入输出约束 |
| `status` | `draft / active / archived` |

#### `context_bundles`

| 字段 | 要求 |
| --- | --- |
| `bundle_hash` | 去重与审计摘要 |
| `payload` | 最终上下文封包 |
| `input_locale` / `output_locale` | 运行语言 |
| `prompt_template_id` | 使用的模板版本 |
| `model_profile_id` | 使用的模型配置 |
| `source_snapshot_ids` | 依赖的快照集合 |

#### `shot_executions`

| 字段 | 要求 |
| --- | --- |
| `shot_id` | 镜头主键引用 |
| `current_status` | 当前执行态 |
| `current_run_id` | 当前轮次 |
| `assignee_user_id` | 当前负责人 |
| `primary_asset_id` | 当前主素材真相 |
| `submission_gate_status` | 机器提审关卡结果 |
| `compliance_status` | 合规状态摘要 |
| `last_submitted_at` | 最近提审时间 |
| `last_reworked_at` | 最近打回时间 |

#### `shot_execution_runs`

| 字段 | 要求 |
| --- | --- |
| `shot_execution_id` | 所属执行态 |
| `run_no` | 轮次编号 |
| `status` | 轮次状态 |
| `source_type` | 生成 / 导入 / 回流 / 人工替换 |
| `trigger_type` | 用户触发 / 工作流触发 / 回调触发 |
| `workflow_run_id` | 关联长链路 |
| `context_bundle_id` | 使用的上下文 |
| `external_request_id` | 外部请求标识 |
| `idempotency_key` | 幂等键 |
| `estimated_cost_reserved` | 成本预占 |
| `actual_cost` | 实际成本 |
| `output_primary_asset_id` | 轮次产出主素材 |
| `failed_reason` | 失败原因 |

#### `media_assets`

| 字段 | 要求 |
| --- | --- |
| `organization_id` / `project_id` | 归属 |
| `media_type` | 图片 / 视频 / 音频 / 文档等 |
| `source_uri` | 来源 URI |
| `source_type` | 手工上传 / 外部导出 / 平台生成回流 |
| `ai_generated` / `ai_assisted` | AI 参与标记 |
| `label_status` | AI 标识状态 |
| `rights_status` | 授权状态 |
| `provenance_status` | 来源凭证状态 |
| `checksum` / `fingerprint` | 去重与追踪 |
| `meta` | 媒体元信息与扩展摘要 |

#### `media_asset_variants`

| 字段 | 要求 |
| --- | --- |
| `asset_id` | 关联资产 |
| `variant_type` | `original / proxy / poster / thumbnail / extracted_audio / waveform` |
| `storage_key` | 对象存储键 |
| `mime_type` | MIME 类型 |
| `width` / `height` / `duration_ms` | 媒体维度 |
| `checksum` | 文件校验 |
| `status` | `ready / failed / archived` |

#### `rights_records`

| 字段 | 要求 |
| --- | --- |
| `asset_id` | 关联资产 |
| `license_type` | 授权类型 |
| `license_scope` | 使用范围 |
| `rights_status` | `clear / restricted / unknown / expired` |
| `consent_status` | 敏感合成同意状态 |
| `expires_at` | 过期时间 |
| `evidence_uri` | 授权证明存放地址 |

#### `evaluation_runs`

| 字段 | 要求 |
| --- | --- |
| `shot_execution_run_id` | 关联执行轮次 |
| `gate_type` | `structure / continuity / compliance / budget / language` |
| `status` | `pass / warn / fail / blocked` |
| `score` | 可选评分 |
| `reasons` | 结构化失败原因 |
| `affected_resource_refs` | 影响对象 |

#### `shot_reviews`

| 字段 | 要求 |
| --- | --- |
| `shot_id` | 必填 |
| `shot_execution_id` | 可选 |
| `shot_execution_run_id` | 可选 |
| `asset_id` | 可选 |
| `review_status` | `commented / approved / rejected` |
| `comment_locale` | 审核意见语言 |
| `comment_body` | 审核正文 |
| `reviewer_user_id` | 审核人 |

### 6.4 高频约束与索引要求

| 场景 | 需要重点支持的查询 |
| --- | --- |
| 项目工作台 | 按组织、状态、负责人、更新时间列项目 |
| 内容工作台 | 按项目列 Episode / Scene / Shot，并支持语言过滤 |
| 镜头执行工作台 | 通过 `shot_id` 快速定位 `shot_execution`、当前轮次、主素材与候选池 |
| 导入确认页 | 通过 `import_batch_id` 查询导入项、自动匹配结果、待确认项 |
| 审核时间线 | 按镜头或执行轮次查询 `evaluation_runs + shot_reviews` |
| 预算治理 | 按项目 / 轮次查询 `usage_records + billing_events` |
| 工作流监控 | 按资源和状态查询 `workflow_runs` 与 `workflow_steps` |
| 语言视图 | 按 `locale / translation_group_id / source_snapshot_id` 查询内容快照 |

### 6.5 一致性与 Guard 体系

后端必须提供至少以下 Guard：

- `OrganizationGuard`
- `ProjectGuard`
- `ContentGuard`
- `ShotExecutionGuard`
- `AssetGuard`
- `WorkflowGuard`
- `BillingGuard`
- `LocalizationGuard`

Guard 至少覆盖以下检查：

1. 资源存在性
2. 组织归属一致性
3. 项目归属一致性
4. 当前角色是否有权限执行该动作
5. 当前状态是否允许该动作
6. 当前 locale 是否为项目允许语言
7. 翻译目标是否存在合法源快照

同时应提供定时一致性巡检任务，检查孤儿数据、失配资源、失效授权和缺失语言快照。

### 6.6 最终迁移批次与命名规则

#### 迁移规则

- 目录固定为 `infra/migrations/`
- 编号格式固定为四位全仓单调递增：`0001_...sql`
- 文件名格式固定为：`NNNN_<domain>_<action>_<target>.sql`
- 禁止长期使用 `misc.sql`、`fix.sql`、`compat.sql`、`backfill.sql`

#### 建议首批迁移清单

```text
0001_org_create_organizations_users_memberships_roles.sql
0002_project_create_projects_episodes_scenes.sql
0003_content_create_story_bibles_characters_scripts_storyboards_shots_snapshots.sql
0004_ai_create_model_profiles_prompt_templates.sql
0005_execution_create_context_bundles_shot_executions_shot_execution_runs.sql
0006_workflow_create_jobs_workflow_runs_workflow_steps_state_transitions_outbox.sql
0007_asset_create_import_batches_upload_sessions_upload_files_media_assets_media_asset_variants.sql
0008_asset_create_rights_records_import_batch_items_candidate_assets.sql
0009_review_create_evaluation_runs_shot_reviews.sql
0010_billing_create_usage_budget_billing.sql
```

## 7. 核心流程设计

### 7.1 主生产闭环

```text
项目立项
  -> 内容结构化（Episode / Scene / Shot）
  -> 正文快照与语言版本管理
  -> 导入或发起生成
  -> 形成 MediaAsset / Candidate Pool
  -> 确认 Primary Asset
  -> 运行 Submission Gate
  -> 进入人工审核
  -> 打回重跑或批准使用
  -> 计量、审计、可发布性检查
```

### 7.2 项目立项流程

| 输入 | 输出 | 必须写入的对象 / 事件 |
| --- | --- | --- |
| 项目名称、负责人、预算边界、语言策略、模型策略 | `Project`、默认 `BudgetPolicy`、默认模型绑定、默认语言配置 | `project.created`、`budget.policy.created` |

### 7.3 内容生产流程

| 步骤 | 说明 |
| --- | --- |
| 创建 Episode | 建立分集骨架 |
| 创建 Scene | 承接场次、时空信息、连续性与镜头分组 |
| 创建 Shot | 建立镜头结构骨架 |
| 创建 ContentSnapshot | 保存 Story Bible / Script / Storyboard / Scene / Shot 正文快照 |
| 创建翻译快照 | 在需要时生成英文或中文翻译版本，并挂接到源快照 |

### 7.4 资产导入八步

| 步骤 | 设计要求 |
| --- | --- |
| 1. 创建 `ImportBatch` | 区分导入来源与责任人 |
| 2. 创建 `UploadSession` | 协商上传方式、校验、过期时间与权限 |
| 3. 接收 `UploadFile` | 记录原始文件元信息 |
| 4. 预处理 | 病毒扫描、媒体信息提取、指纹提取、生成派生文件 |
| 5. 资产化 | 生成 `MediaAsset` 与 `MediaAssetVariant` |
| 6. 自动匹配 | 按文件名、目录、manifest、Episode / Scene / Shot 编码等做匹配 |
| 7. 候选池生成 | 写入 `ImportBatchItem` 与 `ShotCandidateAsset` |
| 8. 人工确认 | 批量确认、批量改绑、选主素材并推进执行态 |

### 7.5 镜头执行流程

| 步骤 | 说明 |
| --- | --- |
| 创建或定位 `ShotExecution` | 以镜头为主键，读取当前执行态 |
| 新建 `ShotExecutionRun` | 为本次生成 / 回流 / 重跑创建轮次 |
| 解析 `ContextBundle` | 决定上下文、Prompt、模型、语言和预算 |
| 发起工作流或异步任务 | 写入 `Job` / `WorkflowRun` |
| 资产回流 | 将结果转化为 `MediaAsset` / `MediaAssetVariant` |
| 更新候选池与主素材 | 刷新 `ShotExecution` 当前态 |
| 写入计量与审计 | 写入 `UsageRecord`、`BillingEvent`、`StateTransition` |

### 7.6 Submission Gate 与审核流程

机器关卡先于人工审核执行。只有通过最小结构、来源、授权、AI 标识、预算和语言一致性检查的镜头，才允许进入人审。

| 关卡 | 检查内容 | 失败后动作 |
| --- | --- | --- |
| 结构关卡 | 必填字段、对象关联、编号合法性 | 阻断提审 |
| 内容一致性关卡 | 是否与 Story Bible / Scene / Shot 说明冲突 | 警告或阻断 |
| 来源与授权关卡 | 是否有来源、授权、consent | 阻断 |
| AI 标识关卡 | 是否需要标识、标识是否完成 | 阻断 |
| 预算关卡 | 是否超预算、是否命中项目熔断策略 | 阻断或升级审批 |
| 语言关卡 | 输出语言是否符合项目配置与模板要求 | 阻断 |

### 7.7 审核事件流

| 事件 | 说明 |
| --- | --- |
| `shot.review.created` | 新增人工审核事件 |
| `shot.review.summary.updated` | 审核摘要投影变化 |
| `shot.execution.updated` | 因审核结论导致执行态变化 |
| `billing.alert` | 因预算问题触发阻断或警告 |

## 8. AI 运行时、模型网关与 Prompt 治理

### 8.1 总体架构

统一模型网关负责屏蔽供应商 API 差异、认证方式、限速策略、同步 / 异步差异、回调协议和计费方式。业务层不允许直接调用任一供应商 SDK。

### 8.2 模型网关职责

| 职责 | 说明 |
| --- | --- |
| 统一调用入口 | 统一文本、图像、视频、音频调用入口 |
| Provider 适配 | 管理 SDK、认证、限速、错误映射、回调桥接 |
| 模型路由 | 根据能力、区域、预算、语言与合规策略路由 |
| 幂等与恢复 | 管理 `idempotency_key`、`external_request_id`、重试与恢复 |
| 成本归因 | 生成 `usage_records` 与 `billing_events` |
| 审计摘要 | 保存请求摘要、输出摘要、失败原因、耗时 |
| 治理控制 | 模型白名单、启停、参数阈值、发布策略 |

### 8.3 Prompt 治理最终方案

| 对象 | 说明 |
| --- | --- |
| `PromptTemplate` | 可版本化、可发布、可按语言维护的模板对象 |
| `ModelProfile` | 平台认可的模型配置对象 |
| `ContextBundle` | 某次运行最终使用的上下文快照 |
| `ShotExecutionRun` | 最终绑定到某次运行结果的执行轮次 |

### 8.4 ContextBundle 装配顺序

| 层级 | 内容 |
| --- | --- |
| 组织级 | 安全策略、模型白名单、默认语言与预算策略 |
| 项目级 | 项目风格、默认内容语言、禁用规则、交付标准 |
| 内容级 | Story Bible、Character、Episode / Scene / Shot 摘要与快照 |
| 任务级 | 本次任务目标、参考素材、约束、负面提示、输出格式 |
| 运行级 | PromptTemplate、ModelProfile、参数、预算上限、locale |
| 追溯级 | 操作者、时间戳、源快照 id、导入资产引用 |

### 8.5 运行复现要求

一次 AI 运行必须回答以下问题：

1. 使用了哪个 `ModelProfile`
2. 使用了哪个 `PromptTemplate` 版本与语言变体
3. 使用了哪些 `ContentSnapshot` 与素材引用
4. 由谁在什么预算边界下触发
5. 写给供应商的 `external_request_id` 是什么
6. 若失败，失败在工作流、供应商、预算还是合规阶段

## 9. 质量、合规与可发布性设计

### 9.1 质量体系拆分

| 层级 | 负责对象 | 说明 |
| --- | --- | --- |
| 机器关卡 | `EvaluationRun` | 结构、一致性、预算、语言、合规检查 |
| 人工审核 | `ShotReview` | 导演、制片、法务或审核人员给出的正式意见 |
| 当前可用态 | `ShotExecution` | 当前镜头是否可用于下一阶段的聚合状态 |

### 9.2 可发布性最低要求

| 要素 | 最低要求 |
| --- | --- |
| 来源 | 能查询素材从哪里来、由谁上传、属于哪个项目 |
| 授权 | 能判断 `license_type`、`license_scope`、`rights_status` |
| AI 标识 | 能判断是否 AI 生成 / 辅助、是否已完成标签 |
| 敏感合成 | 如涉及人脸、人声等敏感合成，应能查询 `consent_status` |
| 审核 | 能查询最近一次人工审核结论与时间 |
| 审计 | 能导出最小审计材料 |

### 9.3 发布前阻断条件

| 条件 | 动作 |
| --- | --- |
| 来源不明确 | 阻断 |
| 授权状态未知或受限 | 阻断 |
| 需要 AI 标识但未完成 | 阻断 |
| 涉及敏感合成但 consent 缺失 | 阻断 |
| 模型不在项目白名单内 | 阻断 |
| 预算越线且无豁免 | 阻断或升级审批 |
| 人工审核未通过 | 阻断 |
| 必要审计信息缺失 | 阻断 |

## 10. 协议、事件与接口设计

### 10.1 Proto 目录最终口径

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

### 10.2 领域边界

| 协议域 | 职责 |
| --- | --- |
| `common/v1` | 分页、时间窗、金额、资源引用、操作者、locale、localized label |
| `auth/v1` | 登录态、当前身份、会话刷新、用户偏好 |
| `org/v1` | 组织、成员、角色、权限、组织默认语言 |
| `project/v1` | 项目、集数、项目配置与语言策略 |
| `content/v1` | Scene / Shot 结构骨架、正文快照、语言快照 |
| `execution/v1` | `ShotExecution`、`ShotExecutionRun`、工作台聚合响应 |
| `asset/v1` | 导入批次、媒体资产、派生文件、候选池、来源摘要 |
| `workflow/v1` | DAG/长链路工作流实例、取消与重试 |
| `billing/v1` | 使用量、预算策略、预算快照、计费事件 |
| `review/v1` | `EvaluationRun`、`ShotReview`、审核摘要 |

### 10.3 最小服务面

| Service | 最小接口 |
| --- | --- |
| `AuthService` | `GetCurrentSession`、`RefreshSession`、`UpdateUserPreferences` |
| `OrgService` | `ListMembers`、`ListRoles`、`UpdateMemberRole`、`UpdateOrgLocaleSettings` |
| `ProjectService` | `CreateProject`、`GetProject`、`ListProjects`、`ListEpisodes` |
| `ContentService` | `ListScenes`、`GetScene`、`ListSceneShots`、`GetShot`、`UpdateShotStructure`、`CreateContentSnapshot`、`CreateLocalizedSnapshot` |
| `ExecutionService` | `GetShotWorkbench`、`GetShotExecution`、`ListShotExecutionRuns`、`StartShotExecutionRun`、`SelectPrimaryAsset`、`RunSubmissionGateChecks`、`SubmitShotForReview`、`MarkShotReworkRequired` |
| `AssetService` | `CreateImportBatch`、`ListImportBatchItems`、`BatchConfirmImportBatchItems`、`ListCandidateAssets`、`GetAssetProvenanceSummary` |
| `ReviewService` | `ListEvaluationRuns`、`ListShotReviews`、`CreateShotReview`、`GetShotReviewSummary` |
| `WorkflowService` | `StartWorkflow`、`GetWorkflowRun`、`ListWorkflowRuns`、`CancelWorkflowRun`、`RetryWorkflowRun` |
| `BillingService` | `GetBudgetSnapshot`、`ListUsageRecords`、`ListBillingEvents`、`UpdateBudgetPolicy` |

### 10.4 消息与建模规则

1. 请求响应命名统一使用 `GetXRequest`、`ListXResponse`、`CreateXRequest` 等固定前缀。
2. 基础资源消息使用稳定名词，如 `Shot`、`ShotExecution`、`MediaAsset`、`WorkflowRun`。
3. 禁止在 proto 中出现 `DTO`、`VO`、`Entity`、`Model` 等实现性命名。
4. 聚合响应必须显式命名为 `Workbench`、`Overview`、`Summary` 等，不伪装成基础资源对象。
5. 跨域引用统一使用轻引用：主体只保存外域 `id` 与必要摘要，不深嵌完整对象。

### 10.5 SSE 事件规范

#### 事件命名

- `shot.updated`
- `scene.updated`
- `shot.execution.updated`
- `shot.execution.run.created`
- `shot.review.created`
- `shot.review.summary.updated`
- `workflow.updated`
- `import_batch.updated`
- `budget.updated`
- `billing.alert`

#### Envelope 最小字段

| 字段 | 说明 |
| --- | --- |
| `event_id` | 事件唯一标识 |
| `event_type` | 事件类型 |
| `organization_id` | 组织归属 |
| `project_id` | 项目归属 |
| `resource_type` | 资源类型 |
| `resource_id` | 资源 id |
| `occurred_at` | 发生时间 |
| `payload` | 最小摘要 |

#### SSE 规则

1. 支持 `Last-Event-ID` 或等价 cursor 恢复。
2. 事件 payload 只放最小摘要，不返回整页数据。
3. 事件内容用 canonical code 表达，客户端按当前 locale 本地化。
4. 事件订阅必须受组织与项目权限控制。

## 11. 总体技术架构

### 11.1 架构组件

| 组件 | 职责 |
| --- | --- |
| Tauri 创作端 | 高频创作、导入、镜头工作台、离线草稿、本地缓存 |
| Web 管理端 | 项目配置、预算策略、审核工作台、组织与模型治理 |
| Connect RPC | 查询与命令入口 |
| SSE | 状态推送与事件时间线 |
| Upload Session | 大文件上传协商与对象存储直传 |
| Workflow / Temporal | 高价值长链路、恢复与补偿 |
| Gateway | 模型与第三方平台接入适配 |
| Policy | 预算守卫、模型白名单、发布前检查、语言策略 |
| Storage | 对象存储、元数据、派生文件、指纹与预览产物 |
| Observability | 日志、指标、追踪、告警与恢复视图 |

### 11.2 架构硬规则

| 主题 | 硬规则 |
| --- | --- |
| Connect RPC | 作为主业务入口；前后端协议以 proto 为准 |
| SSE | 仅推摘要；必须支持断线恢复 |
| Upload Session | 具备过期、重试、校验与 checksum 机制 |
| Temporal | 仅承接高价值长链路，不替代普通异步任务 |
| Tauri | 明确 capabilities、系统安全存储、自动更新签名、灰度与回滚策略 |
| 权限 | 跨组织强隔离；查询与订阅遵循同一权限边界 |
| 日志 | 贯穿 organization_id、project_id、shot_execution_run_id、workflow_run_id、external_request_id |

## 12. Monorepo、后端分层与工程约束

### 12.1 顶层目录最终口径

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

### 12.2 顶层目录职责

| 目录 | 职责 |
| --- | --- |
| `apps/admin` | Web 管理端 |
| `apps/creator` | Tauri 创作端 |
| `apps/backend` | Go 后端应用 |
| `proto` | 协议定义 |
| `packages/sdk` | Connect / SSE / Upload Session 共享通信层 |
| `tooling` | 脚本、模板、生成器与开发辅助命令 |
| `infra` | 迁移、环境模板与最小运行样板 |
| `docs` | 设计与 ADR 文档 |
| `tests` | 跨应用与跨协议验证 |

### 12.3 Go 后端最终结构

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
│  │  ├─ review/
│  │  ├─ policy/
│  │  └─ gateway/
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
│  │  ├─ reviewapp/
│  │  ├─ policyapp/
│  │  └─ gatewayapp/
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
│     ├─ authz/
│     ├─ config/
│     ├─ observability/
│     └─ i18n/
├─ gen/
└─ go.mod
```

### 12.4 分层依赖规则

```text
interfaces -> application -> domain
platform   -> application -> domain
interfaces -> platform
```

禁止以下依赖：

```text
domain      -X-> application
application -X-> interfaces
application -X-> 其他应用层内部实现细节
domain      -X-> platform
```

### 12.5 `packages/sdk` 边界

`packages/sdk` 只承载稳定通信层：

- Connect client 工厂
- SSE 订阅与重连
- Upload Session 客户端
- 生成的协议类型与客户端
- 共享的 locale code / message key 约定

明确不放入 `packages/sdk` 的内容：

- React hooks
- 页面表单 schema
- 管理端与创作端共享的业务 ViewModel
- UI 组件
- 富文本协同适配器
- 页面级 DTO 与状态管理逻辑
- 两端共用的翻译资源文件

### 12.6 i18n 在仓内的落点

| 路径 | 说明 |
| --- | --- |
| `apps/admin/src/i18n/` | 管理端 locale 资源与页面翻译 |
| `apps/creator/src/i18n/` | 创作端 locale 资源与离线语言缓存 |
| `apps/backend/internal/platform/i18n/` | 后端 message key、模板解析、导出文案支持 |
| `tooling/scripts/i18n_*` | 校验 key 完整性、提取 message key、检测占位参数 |

### 12.7 工具链与 CI 门禁

| 工具 | 用途 |
| --- | --- |
| `pnpm workspace` | JS/TS workspace 管理 |
| `turbo` | `build / test / lint / dev` 编排与缓存 |
| `buf` | proto lint、breaking change 检查与代码生成 |
| `Go module` | 后端依赖与测试 |

最低 CI 门禁：

- `buf lint`
- `buf breaking`
- `turbo run lint`
- `turbo run test`
- `turbo run build`
- `go test ./...`
- `i18n key parity check`

### 12.8 发布轨策略

| 发布轨 | 说明 |
| --- | --- |
| `backend + admin` | 平台主发布轨 |
| `creator` | 桌面端独立发布轨 |
| 共同约束 | 三者都必须遵守 proto 兼容性与 i18n key 完整性门禁 |

## 13. 权限、安全、可靠性与观测性

### 13.1 权限与组织隔离

1. 所有核心对象必须带 `organization_id`。
2. 查询、写入、事件订阅、导出必须经过同一组织与项目权限校验。
3. 用户偏好语言不能突破项目内容权限边界；只能影响显示，不影响是否可见。

### 13.2 可靠性要求

| 场景 | 要求 |
| --- | --- |
| 工作流失败 | 支持恢复、重试、补偿与状态追踪 |
| 上传中断 | 支持会话过期与恢复提示 |
| SSE 断线 | 支持 cursor 恢复与事件补齐 |
| 外部回调重复 | 通过 `idempotency_key` 与 `external_request_id` 去重 |
| 预算超限 | 在调用前阻断或在回调后立即熔断 |

### 13.3 观测性要求

| 视图 | 说明 |
| --- | --- |
| 运行中 Workflow 视图 | 查看长链路堵点与恢复状态 |
| 最近失败 Workflow 视图 | 快速定位供应商错误、预算失败或业务约束失败 |
| 导入待确认队列 | 查看 ImportBatch 堆积与自动匹配命中率 |
| 审核滞留队列 | 查看长时间未处理的镜头 |
| Provider 健康视图 | 查看错误率、限速率、耗时与成本 |
| i18n 健康视图 | 查看缺失翻译 key、缺失内容语言快照与错误回退 |

## 14. 路线图、验收与 ADR

### 14.1 分阶段路线图

| 阶段 | 目标 | 关键交付 |
| --- | --- | --- |
| Phase 1 | 跑通生产闭环 | Scene / Shot、双语快照、执行态 / 轮次、导入与候选池、审核、预算、合规基础 |
| Phase 1.5 | 提升治理与质量 | EvaluationRun 增强、去重、来源摘要、导出能力、i18n 导出完善 |
| Phase 2 | 强化协同与多模态 | 实时协同、预演工作台、多轨音频、跨项目素材复用 |
| Phase 3 | 企业交付能力 | 私有化部署模板、模型白名单治理、备份恢复、合规增强 |

### 14.2 Phase 1 必须演示的验收脚本

#### 业务主链

1. 创建项目并设置默认内容语言与默认 UI 语言。
2. 创建 Episode、Scene、Shot。
3. 写入中文 Script 快照，再创建英文翻译快照。
4. 发起一次 AI 执行轮次，生成或回流素材。
5. 导入外部素材并自动匹配候选池。
6. 选定主素材，运行 Submission Gate。
7. 打回一个镜头并重跑，再通过一个镜头。
8. 查询 `usage / billing / workflow / review / audit` 结果。
9. 将管理端和创作端切换到英文界面，确认状态与审核面板正常显示。

#### 稳定性链路

1. Workflow 中途失败后恢复。
2. SSE 断连后恢复并补齐事件。
3. 上传会话过期后正确提示并允许重发。
4. 超预算任务被阻断。
5. 缺少英文翻译快照时，系统按规则回退并提示。

#### 合规链路

1. 缺来源素材不可标记为可发布。
2. 需要 AI 标识但未标识时不可进入发布链。
3. 涉及敏感合成时必须存在 `consent_status`。
4. 所有高价值动作都可审计。

### 14.3 待拍板 ADR 清单

| ADR | 建议结论 |
| --- | --- |
| Scene 是否进入首批基线 | 是 |
| ContextBundle 是否首批落表 | 是 |
| MediaAssetVariant 是否首批落表 | 是 |
| RightsRecord 是否首批落表 | 是 |
| EvaluationRun 是否首批落表 | 是，至少轻量实现 |
| i18n 是否区分 UI 语言与内容语言 | 是 |
| 是否新增共享 i18n 前端包 | 否；两端自管资源，协议只共享 code / key |
| Phase 1 是否支持自动全量翻译 | 否 |
| 模型白名单与语言支持是否纳入 Policy | 是 |
| 发布前检查是否阻断上线 | 是 |

## 15. 实施顺序建议

| 时间段 | 建议动作 | 输出物 |
| --- | --- | --- |
| 第 1 阶段 | 冻结对象模型、状态机、迁移批次、i18n 基线 | 本文、ADR 冻结稿 |
| 第 2 阶段 | 先写 proto 与 migration，再搭建后端骨架 | `proto/`、`infra/migrations/`、`apps/backend` 骨架 |
| 第 3 阶段 | 实现项目 / 内容 / 执行 / 导入 / 审核主链 | 最小闭环后端 + 前端工作台 |
| 第 4 阶段 | 接入网关、预算、语言快照与导出 | 模型接入、计量、双语导出 |
| 第 5 阶段 | 跑通真实业务验收脚本并补齐异常分支 | E2E、监控、恢复、演示环境 |

## 16. 核心术语表

| 术语 | 定义 |
| --- | --- |
| Scene | Episode 内稳定场次对象，连接剧情结构与镜头执行 |
| Shot | 最小镜头结构对象，只表达骨架定义 |
| ShotExecution | 镜头当前执行状态聚合对象 |
| ShotExecutionRun | 镜头某一轮具体执行历史 |
| ContextBundle | 一次 AI 运行的上下文封包 |
| ModelProfile | 经过治理的模型配置对象 |
| PromptTemplate | 版本化 Prompt 模板对象 |
| MediaAsset | 正式资产对象 |
| MediaAssetVariant | 资产派生文件对象 |
| RightsRecord | 授权与 consent 记录对象 |
| EvaluationRun | 机器质量关卡结果 |
| ShotReview | 人工审核事件 |
| UI Locale | 界面显示语言 |
| Content Locale | 内容对象语言 |
| Source Locale | 原始创作语言 |
| Fallback Locale | 缺失目标语言时的回退语言 |

## 17. 结论

本平台的核心竞争力不在于把某一家模型接得更深，而在于把内容结构、镜头执行、资产导入、质量关卡、预算约束、合规检查与双语工作方式收敛到一个统一、稳定、可追溯的生产系统中。只要这条主链跑通，模型能力、供应商接入、实时协作与企业交付能力都可以在此基础上持续扩展。

最终实施顺序应始终保持一致：**先统一对象与真相层，再统一协议与迁移，再落地闭环工作台，最后扩展模型与协作能力。**
