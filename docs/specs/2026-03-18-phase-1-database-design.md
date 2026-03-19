# AI 剧集平台 Phase 1 数据库设计稿

## 1. 文档目标

本文是 [AI 剧集生产协作平台总设计](D:/Documents/Hualala/docs/specs/2026-03-18-ai-series-platform-design.md) 的数据库落地稿，聚焦 Phase 1 的核心生产链，不覆盖完整商业化计费与后续 SaaS 扩展细节。

本文主要解决四件事：

1. 明确 Phase 1 需要落地的核心表、字段、约束和索引
2. 固化 `Shot -> Asset -> Workflow -> Usage -> Billing -> Event` 的数据边界
3. 明确在 `不使用 FK` 的前提下，数据库与 Golang Guard 的责任分工
4. 给出可直接进入 migration 的 SQL 草案

## 2. 范围与边界

### 2.1 本文覆盖范围

- PostgreSQL 主数据结构
- Phase 1 核心主干表与工作流 / 成本治理补充表的 DDL 草案
- 补充表的边界与优先级
- 状态机字段与业务唯一键
- 高频查询索引
- 迁移批次与初始化策略

### 2.2 本文不覆盖范围

- 完整 SaaS 多租户计费表
- 模型供应商配置细表
- 平台内图片 / 视频生成专用流水表
- BI 专用汇总表
- 月度 / 年度归档与冷热分层策略

## 3. 设计原则

### 3.1 基本约束

- 数据库：PostgreSQL
- 主键：`uuid`
- 时间：`timestamptz`
- 状态字段：`text + check`
- 柔性结构：`jsonb`
- `updated_at`：由应用层维护，不依赖 trigger
- UUID：由 Golang 应用层生成

### 3.2 约束策略

本项目 Phase 1 明确采用：

- `不使用外键约束`
- `保留 PK / UNIQUE / CHECK / INDEX`
- `引用完整性由 Golang Guard / Validator 负责`

这样做的原因是：

- 私有化环境差异大
- 批量导入与数据回填较多
- 需要更灵活地处理异步任务和补偿逻辑

但代价也明确存在：

- 需要更强的应用层 Guard
- 需要一致性巡检任务
- 需要更完整的状态审计

### 3.3 应用层完整性策略

所有写操作建议统一遵循以下顺序：

1. 解析身份与组织上下文
2. 校验 Membership 与 RBAC 权限
3. 校验父资源存在性
4. 校验父资源组织归属一致性
5. 校验状态机前置条件
6. 执行业务写入
7. 记录 `state_transitions`
8. 写入 `event_outbox`

## 4. 分层与表清单

### 4.1 治理层

| 表名 | 说明 | 优先级 |
| --- | --- | --- |
| `organizations` | 组织隔离边界 | P1 |
| `users` | 全局身份 | P1 |
| `memberships` | 用户与组织关系 | P1 |
| `roles` | 角色定义 | P1 |
| `role_permissions` | 角色权限码 | P1 |

### 4.2 内容层

| 表名 | 说明 | 优先级 |
| --- | --- | --- |
| `projects` | 项目主表 | P0 |
| `episodes` | 集数主表 | P0 |
| `story_bibles` | 世界观对象 | P1 |
| `characters` | 角色对象 | P1 |
| `scripts` | 剧本对象 | P1 |
| `storyboards` | 分镜对象 | P1 |
| `shots` | 镜头对象，Phase 1 核心锚点 | P0 |
| `content_snapshots` | 文本版本快照 | P1 |

### 4.3 资产接入层

| 表名 | 说明 | 优先级 |
| --- | --- | --- |
| `import_batches` | 一轮业务导入 | P0 |
| `upload_sessions` | 一次上传行为 | P0 |
| `upload_files` | 上传文件记录 | P0 |
| `media_assets` | 正式沉淀后的素材资产 | P0 |
| `import_batch_items` | 自动匹配与人工确认中间层 | P0 |
| `shot_asset_links` | 镜头当前主素材 | P0 |
| `shot_candidate_assets` | 镜头候选素材池 | P0 |
| `asset_links` | 角色 / 场景 / 镜头多目标挂接 | P1 |

### 4.4 流程与治理层

| 表名 | 说明 | 优先级 |
| --- | --- | --- |
| `jobs` | 统一长任务中心 | P0 |
| `workflow_runs` | 高价值长链路工作流实例 | P0 |
| `workflow_steps` | 工作流节点执行记录 | P1 |
| `usage_records` | 使用量计量事实表 | P0 |
| `budget_policies` | 组织 / 项目预算守卫策略 | P0 |
| `billing_events` | 预算预警、拒绝与熔断审计 | P0 |
| `approvals` | 通用审批 | P1 |
| `shot_reviews` | 导演抽检与关键镜头审核 | P0 |
| `state_transitions` | 状态迁移审计 | P0 |
| `event_outbox` | SSE 可靠事件来源 | P0 |

### 4.5 Phase 1 主干表

Phase 1 必须优先落地的主干表为：

- `projects`
- `episodes`
- `shots`
- `import_batches`
- `upload_sessions`
- `upload_files`
- `media_assets`
- `import_batch_items`
- `shot_asset_links`
- `shot_candidate_assets`
- `jobs`
- `workflow_runs`
- `workflow_steps`
- `usage_records`
- `budget_policies`
- `billing_events`
- `shot_reviews`
- `state_transitions`
- `event_outbox`

## 5. 核心对象与状态边界

### 5.1 `shots`

`shots` 是 Phase 1 最重要的生产对象，既是创作端镜头工作台的主锚点，也是素材挂接、抽检、打回和后续导演意图标准化的扩展基础。

关键字段：

- 结构化镜头语义：`shot_size`、`camera_move`
- 执行动作：`subject_action`
- 构图说明：`composition_notes`
- 连续性说明：`continuity_notes`
- 当前主素材：`primary_asset_id`
- 抽检状态：`spot_check_status`

### 5.2 `import_batch_items`

`import_batch_items` 描述“每条导入记录在自动匹配与人工确认中的位置”，不直接承担最终挂接真相。

推荐状态：

- `parsed`
- `matched`
- `pending_review`
- `confirmed`
- `rejected`

### 5.3 `shot_candidate_assets`

`shot_candidate_assets` 描述镜头当前可用的候选素材池，不承担导入过程状态。

推荐状态：

- `active`
- `rejected`
- `archived`

### 5.4 `shot_asset_links`

`shot_asset_links` 只负责“当前主素材是谁”，不再混入候选集合。

### 5.5 `jobs`

`jobs` 继续作为前端统一任务锚点，承载 AI 生成、导入批次解析、自动匹配、样片预演等异步动作，但不再独自承担高价值长链路编排真相。

建议补充字段：

- `backend_kind`
- `workflow_run_id`
- `estimated_cost`
- `actual_cost`

推荐状态：

- `pending`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `partial_success`

### 5.6 `workflow_runs`

`workflow_runs` 表达一条高价值长链路工作流实例，例如“剧本生成 -> 分镜拆解 -> 动态样片预演”。

推荐状态：

- `pending`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `compensating`
- `partially_succeeded`

### 5.7 `usage_records`

`usage_records` 是成本治理的事实层，负责记录模型调用、视频秒数、分辨率、Token、存储消耗等不可变用量记录。

推荐维度：

- `meter_type`
- `provider`
- `model`
- `quantity`
- `unit`
- `price_snapshot`
- `resource_type`
- `resource_id`
- `workflow_run_id`

### 5.8 `budget_policies`

`budget_policies` 用于表达组织级和项目级额度、预算阈值、告警与熔断策略。

推荐状态：

- `active`
- `paused`
- `archived`

### 5.9 媒体来源凭证与多轨音频预留边界

虽然 Phase 1 不把 `C2PA` 和多轨音频链路纳入主干交付，但数据库层应明确预留兼容边界：

- `media_assets` 必须允许 `audio` 作为合法媒体类型
- `media_assets.meta` 应预留 `provenance`、`content_credentials`、`generator_info` 等扩展位
- 后续建议增加 `asset_provenance_records`，保存来源凭证与导入 / 导出挂载记录
- 后续建议增加 `timeline_tracks / track_asset_bindings`，表达镜头与对白、拟音、环境音、配乐等多轨资产的时间轴绑定

### 5.10 `upload_sessions`

`upload_sessions` 管一次上传行为，和 `import_batches` 的“业务批次”不是同一层。

推荐状态：

- `pending`
- `uploading`
- `uploaded`
- `processing`
- `completed`
- `failed`
- `expired`

## 6. 高频查询与索引策略

### 6.1 项目工作台

高频查询：

- 按组织列项目
- 按状态 / 阶段筛项目
- 按负责人筛项目

关键索引：

- `projects (organization_id, status, updated_at desc)`
- `projects (organization_id, current_stage, updated_at desc)`
- `projects (owner_user_id, updated_at desc)`

### 6.2 镜头工作台

高频查询：

- 按 storyboard 列镜头
- 筛选无主素材镜头
- 筛选待抽检 / 已打回镜头
- 按责任人筛镜头

关键索引：

- `shots (storyboard_id, shot_no)`
- `shots (storyboard_id, status, shot_no)`
- `shots (storyboard_id, spot_check_status, shot_no)`
- `shots (assignee_user_id, status, updated_at desc)`
- `shots (storyboard_id, updated_at desc) where primary_asset_id is null`

### 6.3 导入批次确认页

高频查询：

- 按项目列批次
- 按批次列待确认条目
- 按置信度排序
- 查看未匹配项

关键索引：

- `import_batches (project_id, status, created_at desc)`
- `import_batch_items (import_batch_id, status)`
- `import_batch_items (import_batch_id, match_confidence desc)`
- `import_batch_items (matched_shot_id, status)`

### 6.4 任务监控

高频查询：

- 按项目列任务
- 列运行中 / 失败任务
- 列某类资源的任务历史

关键索引：

- `jobs (organization_id, status, created_at desc)`
- `jobs (project_id, status, created_at desc)`
- `jobs (type, status, created_at desc)`
- `jobs (resource_type, resource_id, created_at desc)`

### 6.5 工作流监控

高频查询：

- 按组织 / 项目列工作流实例
- 查看某个资源最近一次高价值工作流
- 查看失败节点与重试历史

关键索引：

- `workflow_runs (organization_id, status, created_at desc)`
- `workflow_runs (project_id, status, created_at desc)`
- `workflow_runs (resource_type, resource_id, created_at desc)`
- `workflow_steps (workflow_run_id, step_no)`
- `workflow_steps (workflow_run_id, status, updated_at desc)`

### 6.6 成本治理

高频查询：

- 查看组织 / 项目预算快照
- 查看指定周期的 usage 明细
- 查看最近预算预警与拒绝记录

关键索引：

- `usage_records (organization_id, created_at desc)`
- `usage_records (project_id, created_at desc)`
- `usage_records (workflow_run_id, created_at desc) where workflow_run_id is not null`
- `billing_events (organization_id, created_at desc)`
- `billing_events (project_id, created_at desc) where project_id is not null`
- `budget_policies (organization_id, scope_type, scope_id, status)`

### 6.7 事件投递

高频查询：

- 扫描待发布 outbox
- 按项目追踪最近事件

关键索引：

- `event_outbox (status, created_at)`
- `event_outbox (organization_id, created_at desc)`
- `event_outbox (project_id, created_at desc) where project_id is not null`

## 7. 一致性与 Guard 要求

由于数据库不使用 FK，建议后端至少建立以下 Guard：

- `OrganizationGuard`
- `ProjectGuard`
- `ShotGuard`
- `AssetGuard`
- `WorkflowGuard`
- `BillingGuard`
- `UsageGuard`

这些 Guard 至少要覆盖：

- 资源存在性
- 组织归属一致性
- 项目归属一致性
- 当前角色是否有该动作权限
- 当前状态是否允许该动作

此外建议增加后台一致性巡检，至少扫描以下孤儿数据：

- `episodes.project_id` 找不到项目
- `shots.storyboard_id` 找不到分镜
- `media_assets.import_batch_id` 指向不存在批次
- `import_batch_items.media_asset_id` 指向不存在素材
- `shot_asset_links.primary_asset_id` 找不到素材
- `shot_candidate_assets.asset_id` 找不到素材
- `jobs.resource_id` 指向不存在资源

## 8. 迁移批次建议

### Batch 1：身份与项目骨架

- `organizations`
- `users`
- `memberships`
- `roles`
- `role_permissions`
- `projects`
- `episodes`

### Batch 2：内容主链

- `story_bibles`
- `characters`
- `scripts`
- `storyboards`
- `shots`
- `content_snapshots`

### Batch 3：资产接入链

- `import_batches`
- `upload_sessions`
- `upload_files`
- `media_assets`
- `import_batch_items`
- `shot_asset_links`
- `shot_candidate_assets`
- `asset_links`

### Batch 4：流程与事件

- `jobs`
- `workflow_runs`
- `workflow_steps`
- `usage_records`
- `budget_policies`
- `billing_events`
- `approvals`
- `shot_reviews`
- `state_transitions`
- `event_outbox`

## 9. SQL 草案

### 9.1 `projects`

```sql
create table if not exists projects (
    id uuid primary key,
    organization_id uuid not null,
    name text not null,
    genre text,
    target_audience text,
    status text not null default 'draft',
    current_stage text not null default 'project_init',
    owner_user_id uuid not null,
    description text,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_projects_name_non_empty check (length(trim(name)) > 0),
    constraint chk_projects_status check (status in ('draft', 'active', 'archived')),
    constraint chk_projects_current_stage check (
        current_stage in (
            'project_init', 'story_bible', 'script', 'storyboard',
            'asset_linking', 'spot_check', 'preview'
        )
    )
);

create index if not exists idx_projects_org_status_updated
    on projects (organization_id, status, updated_at desc);
create index if not exists idx_projects_org_stage_updated
    on projects (organization_id, current_stage, updated_at desc);
create index if not exists idx_projects_owner_updated
    on projects (owner_user_id, updated_at desc);
```

### 9.2 `episodes`

```sql
create table if not exists episodes (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid not null,
    episode_no integer not null,
    title text,
    status text not null default 'draft',
    summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_episodes_project_episode_no unique (project_id, episode_no),
    constraint chk_episodes_episode_no_positive check (episode_no > 0),
    constraint chk_episodes_status check (status in ('draft', 'active', 'archived'))
);

create index if not exists idx_episodes_project_status
    on episodes (project_id, status);
create index if not exists idx_episodes_org_project
    on episodes (organization_id, project_id);
create index if not exists idx_episodes_project_episode_no
    on episodes (project_id, episode_no);
```

### 9.3 `shots`

```sql
create table if not exists shots (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid not null,
    episode_id uuid not null,
    storyboard_id uuid not null,
    shot_no integer not null,
    title text,
    summary text,
    status text not null default 'draft',
    spot_check_status text not null default 'pending',
    assignee_user_id uuid,
    shot_size text not null default 'medium',
    camera_move text not null default 'static',
    subject_action text,
    composition_notes jsonb not null default '{}'::jsonb,
    continuity_notes jsonb not null default '{}'::jsonb,
    primary_asset_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_shots_storyboard_shot_no unique (storyboard_id, shot_no),
    constraint chk_shots_shot_no_positive check (shot_no > 0),
    constraint chk_shots_status check (
        status in ('draft', 'assets_linked', 'ready_for_spot_check', 'approved', 'rejected')
    ),
    constraint chk_shots_spot_check_status check (
        spot_check_status in ('pending', 'submitted', 'approved', 'rejected')
    ),
    constraint chk_shots_shot_size check (
        shot_size in ('wide', 'medium', 'close_up', 'extreme_close_up')
    ),
    constraint chk_shots_camera_move check (
        camera_move in ('static', 'dolly_push', 'dolly_pull', 'pan', 'tilt', 'track', 'handheld')
    )
);

create index if not exists idx_shots_storyboard_shot_no
    on shots (storyboard_id, shot_no);
create index if not exists idx_shots_storyboard_status_shot_no
    on shots (storyboard_id, status, shot_no);
create index if not exists idx_shots_storyboard_spot_check_shot_no
    on shots (storyboard_id, spot_check_status, shot_no);
create index if not exists idx_shots_project_episode_status
    on shots (project_id, episode_id, status);
create index if not exists idx_shots_assignee_status_updated
    on shots (assignee_user_id, status, updated_at desc);
create index if not exists idx_shots_primary_asset_present
    on shots (primary_asset_id) where primary_asset_id is not null;
create index if not exists idx_shots_storyboard_without_primary_asset
    on shots (storyboard_id, updated_at desc) where primary_asset_id is null;
create index if not exists idx_shots_storyboard_shot_size
    on shots (storyboard_id, shot_size);
create index if not exists idx_shots_storyboard_camera_move
    on shots (storyboard_id, camera_move);
```

### 9.4 `import_batches`

```sql
create table if not exists import_batches (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid not null,
    episode_id uuid,
    name text not null,
    source_type text not null,
    source_platform text,
    task_batch_name text,
    status text not null default 'draft',
    total_item_count integer not null default 0,
    matched_count integer not null default 0,
    unmatched_count integer not null default 0,
    confirmed_count integer not null default 0,
    rejected_count integer not null default 0,
    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_import_batches_name_non_empty check (length(trim(name)) > 0),
    constraint chk_import_batches_source_type check (
        source_type in ('manual_upload', 'external_platform_export', 'outsource_delivery')
    ),
    constraint chk_import_batches_status check (
        status in ('draft', 'uploading', 'processing', 'pending_review', 'completed', 'failed')
    ),
    constraint chk_import_batches_total_item_count_non_negative check (total_item_count >= 0),
    constraint chk_import_batches_matched_count_non_negative check (matched_count >= 0),
    constraint chk_import_batches_unmatched_count_non_negative check (unmatched_count >= 0),
    constraint chk_import_batches_confirmed_count_non_negative check (confirmed_count >= 0),
    constraint chk_import_batches_rejected_count_non_negative check (rejected_count >= 0)
);

create index if not exists idx_import_batches_project_status_created
    on import_batches (project_id, status, created_at desc);
create index if not exists idx_import_batches_project_created
    on import_batches (project_id, created_at desc);
create index if not exists idx_import_batches_org_created
    on import_batches (organization_id, created_at desc);
create index if not exists idx_import_batches_created_by
    on import_batches (created_by, created_at desc);
create index if not exists idx_import_batches_source_platform
    on import_batches (source_platform) where source_platform is not null;
```

### 9.5 `media_assets`

```sql
create table if not exists media_assets (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid not null,
    episode_id uuid,
    import_batch_id uuid,
    upload_file_id uuid,
    media_type text not null,
    mime_type text not null,
    file_name text not null,
    storage_key text not null,
    size_bytes bigint not null,
    width integer,
    height integer,
    duration_ms bigint,
    source_type text not null,
    source_platform text,
    status text not null default 'active',
    meta jsonb not null default '{}'::jsonb,
    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_media_assets_storage_key unique (storage_key),
    constraint chk_media_assets_media_type check (media_type in ('image', 'video', 'audio')),
    constraint chk_media_assets_status check (status in ('active', 'archived', 'invalid')),
    constraint chk_media_assets_source_type check (
        source_type in (
            'manual_upload', 'external_platform_export', 'outsource_delivery', 'platform_generated'
        )
    ),
    constraint chk_media_assets_file_name_non_empty check (length(trim(file_name)) > 0),
    constraint chk_media_assets_storage_key_non_empty check (length(trim(storage_key)) > 0),
    constraint chk_media_assets_size_bytes_non_negative check (size_bytes >= 0),
    constraint chk_media_assets_width_non_negative check (width is null or width >= 0),
    constraint chk_media_assets_height_non_negative check (height is null or height >= 0),
    constraint chk_media_assets_duration_non_negative check (duration_ms is null or duration_ms >= 0)
);

create index if not exists idx_media_assets_project_type_created
    on media_assets (project_id, media_type, created_at desc);
create index if not exists idx_media_assets_project_status_created
    on media_assets (project_id, status, created_at desc);
create index if not exists idx_media_assets_import_batch
    on media_assets (import_batch_id) where import_batch_id is not null;
create index if not exists idx_media_assets_upload_file
    on media_assets (upload_file_id) where upload_file_id is not null;
create index if not exists idx_media_assets_org_created
    on media_assets (organization_id, created_at desc);
create index if not exists idx_media_assets_source_platform
    on media_assets (source_platform) where source_platform is not null;
```

### 9.6 `import_batch_items`

```sql
create table if not exists import_batch_items (
    id uuid primary key,
    organization_id uuid not null,
    import_batch_id uuid not null,
    upload_file_id uuid not null,
    media_asset_id uuid,
    matched_shot_id uuid,
    matched_target_type text,
    matched_target_id uuid,
    match_method text,
    match_confidence numeric(5,4),
    status text not null default 'parsed',
    review_note text,
    confirmed_by uuid,
    confirmed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_import_batch_items_batch_file unique (import_batch_id, upload_file_id),
    constraint chk_import_batch_items_status check (
        status in ('parsed', 'matched', 'pending_review', 'confirmed', 'rejected')
    ),
    constraint chk_import_batch_items_target_type check (
        matched_target_type is null or matched_target_type in ('shot', 'character', 'scene')
    ),
    constraint chk_import_batch_items_match_method check (
        match_method is null
        or match_method in ('filename_rule', 'directory_rule', 'manifest_import', 'manual')
    ),
    constraint chk_import_batch_items_match_confidence_range check (
        match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)
    )
);

create index if not exists idx_import_batch_items_batch_status
    on import_batch_items (import_batch_id, status);
create index if not exists idx_import_batch_items_batch_confidence
    on import_batch_items (import_batch_id, match_confidence desc)
    where match_confidence is not null;
create index if not exists idx_import_batch_items_matched_shot_status
    on import_batch_items (matched_shot_id, status)
    where matched_shot_id is not null;
create index if not exists idx_import_batch_items_media_asset
    on import_batch_items (media_asset_id)
    where media_asset_id is not null;
create index if not exists idx_import_batch_items_target
    on import_batch_items (matched_target_type, matched_target_id)
    where matched_target_type is not null and matched_target_id is not null;
create index if not exists idx_import_batch_items_pending_review
    on import_batch_items (import_batch_id, created_at asc)
    where status = 'pending_review';
```

### 9.7 `shot_asset_links`

```sql
create table if not exists shot_asset_links (
    id uuid primary key,
    shot_id uuid not null,
    primary_asset_id uuid not null,
    confirmed_by uuid not null,
    confirmed_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_shot_asset_links_shot unique (shot_id)
);

create index if not exists idx_shot_asset_links_primary_asset
    on shot_asset_links (primary_asset_id);
create index if not exists idx_shot_asset_links_confirmed_by
    on shot_asset_links (confirmed_by, confirmed_at desc);
```

### 9.8 `shot_candidate_assets`

```sql
create table if not exists shot_candidate_assets (
    id uuid primary key,
    organization_id uuid not null,
    shot_id uuid not null,
    asset_id uuid not null,
    import_batch_item_id uuid,
    sort_order integer not null default 0,
    status text not null default 'active',
    is_promoted boolean not null default false,
    review_note text,
    added_by uuid not null,
    added_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_shot_candidate_assets_shot_asset unique (shot_id, asset_id),
    constraint chk_shot_candidate_assets_sort_order check (sort_order >= 0),
    constraint chk_shot_candidate_assets_status check (status in ('active', 'rejected', 'archived'))
);

create index if not exists idx_shot_candidate_assets_shot_status_sort
    on shot_candidate_assets (shot_id, status, sort_order);
create index if not exists idx_shot_candidate_assets_asset
    on shot_candidate_assets (asset_id);
create index if not exists idx_shot_candidate_assets_import_batch_item
    on shot_candidate_assets (import_batch_item_id)
    where import_batch_item_id is not null;
create index if not exists idx_shot_candidate_assets_shot_promoted
    on shot_candidate_assets (shot_id, is_promoted);
```

### 9.9 `upload_sessions`

```sql
create table if not exists upload_sessions (
    id uuid primary key,
    import_batch_id uuid not null,
    organization_id uuid not null,
    storage_mode text not null,
    status text not null default 'pending',
    file_count integer not null default 0,
    total_bytes bigint not null default 0,
    uploaded_file_count integer not null default 0,
    uploaded_bytes bigint not null default 0,
    created_by uuid not null,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_upload_sessions_storage_mode check (storage_mode in ('direct', 'relay')),
    constraint chk_upload_sessions_status check (
        status in ('pending', 'uploading', 'uploaded', 'processing', 'completed', 'failed', 'expired')
    ),
    constraint chk_upload_sessions_file_count_non_negative check (file_count >= 0),
    constraint chk_upload_sessions_total_bytes_non_negative check (total_bytes >= 0),
    constraint chk_upload_sessions_uploaded_file_count_non_negative check (uploaded_file_count >= 0),
    constraint chk_upload_sessions_uploaded_bytes_non_negative check (uploaded_bytes >= 0)
);

create index if not exists idx_upload_sessions_batch_status
    on upload_sessions (import_batch_id, status);
create index if not exists idx_upload_sessions_org_created
    on upload_sessions (organization_id, created_at desc);
create index if not exists idx_upload_sessions_created_by
    on upload_sessions (created_by, created_at desc);
create index if not exists idx_upload_sessions_expires_at
    on upload_sessions (expires_at) where expires_at is not null;
```

### 9.10 `upload_files`

```sql
create table if not exists upload_files (
    id uuid primary key,
    upload_session_id uuid not null,
    organization_id uuid not null,
    file_name text not null,
    mime_type text not null,
    size_bytes bigint not null,
    storage_key text,
    checksum text,
    status text not null default 'pending',
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_upload_files_file_name_non_empty check (length(trim(file_name)) > 0),
    constraint chk_upload_files_size_bytes_non_negative check (size_bytes >= 0),
    constraint chk_upload_files_status check (
        status in ('pending', 'uploading', 'uploaded', 'processing', 'ready', 'failed')
    )
);

create index if not exists idx_upload_files_session_status
    on upload_files (upload_session_id, status);
create index if not exists idx_upload_files_org_created
    on upload_files (organization_id, created_at desc);
create index if not exists idx_upload_files_storage_key
    on upload_files (storage_key) where storage_key is not null;
create index if not exists idx_upload_files_checksum
    on upload_files (checksum) where checksum is not null;
```

### 9.11 `jobs`

```sql
create table if not exists jobs (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid,
    resource_type text not null,
    resource_id uuid,
    type text not null,
    backend_kind text not null default 'job_runner',
    workflow_run_id uuid,
    status text not null,
    progress integer not null default 0,
    estimated_cost numeric(18,6),
    actual_cost numeric(18,6),
    payload jsonb not null default '{}'::jsonb,
    message text,
    error_code text,
    error_message text,
    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_jobs_type_non_empty check (length(trim(type)) > 0),
    constraint chk_jobs_resource_type_non_empty check (length(trim(resource_type)) > 0),
    constraint chk_jobs_backend_kind check (backend_kind in ('job_runner', 'temporal')),
    constraint chk_jobs_status check (
        status in ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'partial_success')
    ),
    constraint chk_jobs_estimated_cost_non_negative check (
        estimated_cost is null or estimated_cost >= 0
    ),
    constraint chk_jobs_actual_cost_non_negative check (
        actual_cost is null or actual_cost >= 0
    ),
    constraint chk_jobs_progress_range check (progress >= 0 and progress <= 100)
);

create index if not exists idx_jobs_org_status_created
    on jobs (organization_id, status, created_at desc);
create index if not exists idx_jobs_project_status_created
    on jobs (project_id, status, created_at desc)
    where project_id is not null;
create index if not exists idx_jobs_type_status_created
    on jobs (type, status, created_at desc);
create index if not exists idx_jobs_resource_created
    on jobs (resource_type, resource_id, created_at desc)
    where resource_id is not null;
create index if not exists idx_jobs_workflow_run
    on jobs (workflow_run_id)
    where workflow_run_id is not null;
create index if not exists idx_jobs_created_by
    on jobs (created_by, created_at desc);
```

### 9.12 `workflow_runs`

```sql
create table if not exists workflow_runs (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid,
    resource_type text not null,
    resource_id uuid,
    workflow_type text not null,
    backend_kind text not null default 'temporal',
    status text not null,
    current_step_key text,
    started_by uuid not null,
    started_at timestamptz,
    finished_at timestamptz,
    input jsonb not null default '{}'::jsonb,
    output jsonb not null default '{}'::jsonb,
    error_summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_workflow_runs_resource_type_non_empty check (length(trim(resource_type)) > 0),
    constraint chk_workflow_runs_workflow_type_non_empty check (length(trim(workflow_type)) > 0),
    constraint chk_workflow_runs_backend_kind check (backend_kind in ('temporal', 'job_runner')),
    constraint chk_workflow_runs_status check (
        status in ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'compensating', 'partially_succeeded')
    )
);

create index if not exists idx_workflow_runs_org_status_created
    on workflow_runs (organization_id, status, created_at desc);
create index if not exists idx_workflow_runs_project_status_created
    on workflow_runs (project_id, status, created_at desc)
    where project_id is not null;
create index if not exists idx_workflow_runs_resource_created
    on workflow_runs (resource_type, resource_id, created_at desc)
    where resource_id is not null;
create index if not exists idx_workflow_runs_started_by
    on workflow_runs (started_by, created_at desc);
```

### 9.13 `workflow_steps`

```sql
create table if not exists workflow_steps (
    id uuid primary key,
    workflow_run_id uuid not null,
    organization_id uuid not null,
    step_no integer not null,
    step_key text not null,
    activity_name text not null,
    status text not null,
    attempt_no integer not null default 1,
    input_summary jsonb not null default '{}'::jsonb,
    output_summary jsonb not null default '{}'::jsonb,
    error_summary text,
    duration_ms bigint,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_workflow_steps_run_step unique (workflow_run_id, step_no),
    constraint chk_workflow_steps_step_no_positive check (step_no > 0),
    constraint chk_workflow_steps_attempt_no_positive check (attempt_no > 0),
    constraint chk_workflow_steps_step_key_non_empty check (length(trim(step_key)) > 0),
    constraint chk_workflow_steps_activity_name_non_empty check (length(trim(activity_name)) > 0),
    constraint chk_workflow_steps_status check (
        status in ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'skipped')
    ),
    constraint chk_workflow_steps_duration_non_negative check (duration_ms is null or duration_ms >= 0)
);

create index if not exists idx_workflow_steps_run_step_no
    on workflow_steps (workflow_run_id, step_no);
create index if not exists idx_workflow_steps_run_status_updated
    on workflow_steps (workflow_run_id, status, updated_at desc);
create index if not exists idx_workflow_steps_org_created
    on workflow_steps (organization_id, created_at desc);
```

### 9.14 `usage_records`

```sql
create table if not exists usage_records (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid,
    workflow_run_id uuid,
    job_id uuid,
    resource_type text not null,
    resource_id uuid,
    meter_type text not null,
    provider text not null,
    model text,
    quantity numeric(20,6) not null,
    unit text not null,
    unit_price numeric(18,6),
    total_cost numeric(18,6),
    price_snapshot jsonb not null default '{}'::jsonb,
    meta jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint chk_usage_records_resource_type_non_empty check (length(trim(resource_type)) > 0),
    constraint chk_usage_records_meter_type_non_empty check (length(trim(meter_type)) > 0),
    constraint chk_usage_records_provider_non_empty check (length(trim(provider)) > 0),
    constraint chk_usage_records_unit_non_empty check (length(trim(unit)) > 0),
    constraint chk_usage_records_quantity_non_negative check (quantity >= 0),
    constraint chk_usage_records_unit_price_non_negative check (unit_price is null or unit_price >= 0),
    constraint chk_usage_records_total_cost_non_negative check (total_cost is null or total_cost >= 0)
);

create index if not exists idx_usage_records_org_created
    on usage_records (organization_id, created_at desc);
create index if not exists idx_usage_records_project_created
    on usage_records (project_id, created_at desc)
    where project_id is not null;
create index if not exists idx_usage_records_workflow_created
    on usage_records (workflow_run_id, created_at desc)
    where workflow_run_id is not null;
create index if not exists idx_usage_records_job_created
    on usage_records (job_id, created_at desc)
    where job_id is not null;
create index if not exists idx_usage_records_meter_created
    on usage_records (meter_type, created_at desc);
```

### 9.15 `budget_policies`

```sql
create table if not exists budget_policies (
    id uuid primary key,
    organization_id uuid not null,
    scope_type text not null,
    scope_id uuid not null,
    status text not null default 'active',
    currency text not null default 'USD',
    period_type text not null,
    hard_limit numeric(18,6),
    soft_limit numeric(18,6),
    alert_thresholds jsonb not null default '[]'::jsonb,
    enforcement_mode text not null default 'warn_and_block',
    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_budget_policies_scope unique (organization_id, scope_type, scope_id),
    constraint chk_budget_policies_scope_type check (scope_type in ('organization', 'project')),
    constraint chk_budget_policies_status check (status in ('active', 'paused', 'archived')),
    constraint chk_budget_policies_period_type check (period_type in ('monthly', 'weekly', 'project_lifecycle')),
    constraint chk_budget_policies_hard_limit_non_negative check (hard_limit is null or hard_limit >= 0),
    constraint chk_budget_policies_soft_limit_non_negative check (soft_limit is null or soft_limit >= 0),
    constraint chk_budget_policies_enforcement_mode check (
        enforcement_mode in ('warn_only', 'warn_and_block', 'block_only')
    )
);

create index if not exists idx_budget_policies_org_scope_status
    on budget_policies (organization_id, scope_type, scope_id, status);
create index if not exists idx_budget_policies_created_by
    on budget_policies (created_by, created_at desc);
```

### 9.16 `billing_events`

```sql
create table if not exists billing_events (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid,
    workflow_run_id uuid,
    job_id uuid,
    budget_policy_id uuid,
    event_type text not null,
    severity text not null,
    amount numeric(18,6),
    currency text,
    summary text,
    meta jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint chk_billing_events_event_type_non_empty check (length(trim(event_type)) > 0),
    constraint chk_billing_events_severity check (severity in ('info', 'warning', 'critical')),
    constraint chk_billing_events_amount_non_negative check (amount is null or amount >= 0)
);

create index if not exists idx_billing_events_org_created
    on billing_events (organization_id, created_at desc);
create index if not exists idx_billing_events_project_created
    on billing_events (project_id, created_at desc)
    where project_id is not null;
create index if not exists idx_billing_events_policy_created
    on billing_events (budget_policy_id, created_at desc)
    where budget_policy_id is not null;
create index if not exists idx_billing_events_workflow_created
    on billing_events (workflow_run_id, created_at desc)
    where workflow_run_id is not null;
```

### 9.17 `shot_reviews`

```sql
create table if not exists shot_reviews (
    id uuid primary key,
    organization_id uuid not null,
    shot_id uuid not null,
    review_type text not null,
    status text not null,
    reason_codes jsonb not null default '[]'::jsonb,
    comment text,
    reviewed_by uuid not null,
    created_at timestamptz not null default now(),
    constraint chk_shot_reviews_review_type check (
        review_type in ('spot_check', 'key_shot_review')
    ),
    constraint chk_shot_reviews_status check (status in ('approved', 'rejected'))
);

create index if not exists idx_shot_reviews_shot_created
    on shot_reviews (shot_id, created_at desc);
create index if not exists idx_shot_reviews_reviewer_created
    on shot_reviews (reviewed_by, created_at desc);
create index if not exists idx_shot_reviews_org_created
    on shot_reviews (organization_id, created_at desc);
```

### 9.18 `state_transitions`

```sql
create table if not exists state_transitions (
    id uuid primary key,
    organization_id uuid not null,
    resource_type text not null,
    resource_id uuid not null,
    from_status text,
    to_status text not null,
    trigger_type text not null,
    triggered_by uuid not null,
    meta jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint chk_state_transitions_resource_type_non_empty
        check (length(trim(resource_type)) > 0),
    constraint chk_state_transitions_to_status_non_empty
        check (length(trim(to_status)) > 0),
    constraint chk_state_transitions_trigger_type
        check (trigger_type in ('manual', 'system', 'job', 'review'))
);

create index if not exists idx_state_transitions_resource_created
    on state_transitions (resource_type, resource_id, created_at desc);
create index if not exists idx_state_transitions_triggered_by_created
    on state_transitions (triggered_by, created_at desc);
create index if not exists idx_state_transitions_org_created
    on state_transitions (organization_id, created_at desc);
```

### 9.19 `event_outbox`

```sql
create table if not exists event_outbox (
    id uuid primary key,
    organization_id uuid not null,
    project_id uuid,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'pending',
    published_at timestamptz,
    created_at timestamptz not null default now(),
    constraint chk_event_outbox_event_type_non_empty
        check (length(trim(event_type)) > 0),
    constraint chk_event_outbox_status
        check (status in ('pending', 'published', 'failed'))
);

create index if not exists idx_event_outbox_status_created
    on event_outbox (status, created_at);
create index if not exists idx_event_outbox_org_created
    on event_outbox (organization_id, created_at desc);
create index if not exists idx_event_outbox_project_created
    on event_outbox (project_id, created_at desc)
    where project_id is not null;
```

## 10. 后续补充建议

当前数据库设计稿已经足够支撑：

- 项目工作台
- 镜头工作台
- 导入批次确认页
- 主素材 / 候选素材管理
- 高价值工作流实例跟踪
- 使用量计量与预算守卫
- 导演抽检与打回
- 长任务监控
- SSE 事件推送

后续建议按以下顺序补完非主干表：

1. `organizations / users / memberships / roles / role_permissions`
2. `story_bibles / characters / scripts / storyboards / content_snapshots`
3. `approvals / asset_links`
4. `workflow_runs / workflow_steps / usage_records / budget_policies / billing_events`
5. `asset_provenance_records / timeline_tracks / track_asset_bindings`
6. 如确有需要，再补 `job_events` 等时间线专用表

Phase 1 当前不建议单独建立 `job_events`，任务进度优先使用：

- `jobs.payload`
- `jobs.message`
- `state_transitions`
- `event_outbox`

来承载。

对于本轮调研新增结论，数据库层建议明确两条边界：

1. 实时协同编辑不建立在 `SSE` 之上，后续如做多人正文共编，应单独引入 `WebSocket + CRDT` 协议与操作日志存储
2. 音频和来源凭证不应继续作为视觉资产附属备注处理，而应通过独立媒体类型与后续专用绑定表建模
