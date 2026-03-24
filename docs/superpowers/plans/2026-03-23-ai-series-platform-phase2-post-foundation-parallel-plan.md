# AI 剧集平台 Phase 2 Post-Foundation Parallel Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Phase 2 foundation 已合入 `master` 的前提下，按并行 worktree 模式推进并交付 Phase 2 全量目标：实时协同、预演工作台、多轨音频、跨项目素材复用。

**Architecture:** 共享契约继续遵守“小 foundation patch 先收口，再由产品分支消费”的模式；产品能力按四条主线并行推进，creator 承担主创作工作流，admin 承担治理与可观测面，backend 承担 durable runtime、存储与事件回放。任何新增 proto、SDK public API、SSE payload 或 upload/asset wire shape 的改动，都不得直接混入产品分支，必须先回到新的 foundation patch。

**Tech Stack:** Monorepo、pnpm workspace、turbo、Buf、Connect RPC、SSE、Upload Session、Go backend、PostgreSQL、Vite React admin/creator、Playwright。

---

## 当前基线与缺口快照

- 当前 `master` 已完成 Phase 2 foundation，顶层状态见 `README.md`，foundation 执行边界见 `docs/runbooks/phase2-foundation-baseline.md`。
- creator 当前只有 `home / shots / imports` 三个路由入口，定义见 `apps/creator/src/app/creatorRoutes.ts`；尚无协同编辑、预演工作台、音频工作台入口。
- admin 当前只有 `overview / workflow / assets / governance` 四个路由入口，定义见 `apps/admin/src/app/adminRoutes.ts`；尚无 Phase 2 专门的协同治理、多项目素材库、音频治理入口。
- `packages/sdk/src/index.ts` 当前只导出 `authOrg / asset / billing / execution / review / workflow` 客户端；尚无 `content`、`project`、协同、预演、音频、素材复用客户端。
- 当前仓库可见 `content.proto`、`project_service.proto`、`asset.proto`、`workflow.proto` 等 Phase 1/1.5 级对象，但尚无显式的 collaboration / preview / audio / reuse 协议面。
- 设计文档中 Phase 2 全量目标定义为“实时协同、预演工作台、多轨音频、跨项目素材复用”，位置见 `docs/specs/2026-03-20-ai-series-platform-final-design.md` 第 14.1 节。

## 规划原则

1. 主工作区 `D:\Documents\Hualala` 只保留给 `master` 集成、统一回归和计划同步，不直接开发功能。
2. 默认 worktree 根目录仍使用项目内 `.worktrees/`。
3. 新的共享变更先用短生命周期 foundation patch 收口，再由 backend/admin/creator 分支 `fetch + rebase origin/master` 消费。
4. `packages/sdk` 继续只承载稳定通信层，不放 React hooks、页面状态机和富文本协同适配器。
5. 每条并行线必须有自己的最小验证命令；Phase 2 收尾前必须再补一轮跨线联调。

## 建议 worktree 布局

### 必建控制线

| 线 | 分支建议 | worktree 目录 | 目的 |
| --- | --- | --- | --- |
| Phase 2 foundation micro-patches | `codex/phase2-foundation-<slice>` | `.worktrees/phase2-foundation-<slice>` | 处理新的 proto / SDK / SSE / upload / asset shared truth 增量 |

### 四条主并行线

| 线 | 分支建议 | worktree 目录 | 主责 |
| --- | --- | --- | --- |
| 实时协同 | `codex/phase2-realtime-collab` | `.worktrees/phase2-realtime-collab` | 内容协同编辑、presence、冲突处理、协同状态可视化 |
| 预演工作台 | `codex/phase2-preview-workbench` | `.worktrees/phase2-preview-workbench` | 预演装配、镜头串联、素材预览、回放与导出入口 |
| 多轨音频 | `codex/phase2-multitrack-audio` | `.worktrees/phase2-multitrack-audio` | 音频轨模型、音频导入/生成、轨道编排、波形与混音状态 |
| 跨项目素材复用 | `codex/phase2-cross-project-asset-reuse` | `.worktrees/phase2-cross-project-asset-reuse` | 可复用素材库、跨项目引用、授权校验、来源审计 |

### 收尾线

| 线 | 分支建议 | worktree 目录 | 主责 |
| --- | --- | --- | --- |
| Phase 2 验收与 runbook | `codex/phase2-acceptance` | `.worktrees/phase2-acceptance` | Playwright、runbook、demo seed、CI 门禁、结项文档 |

## 并行顺序

1. 先冻结 Phase 2 契约增量队列，拆出首批 foundation micro-patch。
2. 首批 foundation patch 合入 `master` 后，再并行拉起“实时协同 / 预演工作台 / 多轨音频 / 跨项目素材复用”四条线。
3. 并行阶段只消费稳定契约；若任何一条线发现共享契约不足，暂停本线扩张，回到新的 foundation patch。
4. 最后建立 `phase2-acceptance` 线，统一补 Phase 2 mock / real 验收、runbook 与 CI 门。

## 里程碑

| 里程碑 | 目标 | 出口条件 |
| --- | --- | --- |
| M0 | 冻结 Phase 2 切片与共享契约增量队列 | 四条主线的 contract backlog、branch map、验证矩阵落文档 |
| M1 | 首批 shared truth 可消费 | 新 proto / SDK / Connect / SSE 基线合入 `master` |
| M2 | 实时协同最小闭环 | creator 可看到 presence、锁定/解锁、草稿协同状态；admin 可观测 |
| M3 | 预演工作台最小闭环 | creator 可装配并回放预演；相关素材与 workflow 可追溯 |
| M4 | 多轨音频最小闭环 | creator 可管理至少三类轨道（对白/旁白/BGM），backend 能保存轨道与渲染状态 |
| M5 | 跨项目素材复用最小闭环 | 可在项目间引用合规素材，保留授权与来源约束 |
| M6 | Phase 2 总体验收通过 | mock / real E2E、runbook、CI、closeout 文档齐备 |

## Task 1: 已完成的首批 shared truth foundation patch（协同 + 预演）

> Status: 已于 2026-03-23 合入 `master`，PR `#46`

**Files:**
- Modify: `docs/runbooks/phase2-foundation-baseline.md`
- Create: `docs/runbooks/phase2-contract-freeze.md`
- Modify: `proto/hualala/content/v1/content.proto`
- Modify: `proto/hualala/project/v1/project_service.proto`
- Create: `packages/sdk/src/connect/services/content.ts`
- Create: `packages/sdk/src/connect/services/project.ts`
- Modify: `packages/sdk/src/index.ts`
- Create: `infra/migrations/0015_phase2_collab_preview_shared_truth.sql`
- Test: `tooling/scripts/foundation_baseline_docs.test.mjs`
- Test: `tooling/scripts/foundation_shared_truth_guard.test.mjs`

- [x] 盘点四条主线的共享对象后，只冻结首批协同 / 预演最小字段，不把页面级状态揉进协议。
- [x] 为实时协同冻结第一批共享原语：协同会话、presence、锁状态、草稿版本号、冲突摘要。
- [x] 为预演工作台冻结第一批共享原语：预演装配单元、镜头排序、引用素材、导出状态占位。
- [x] 新增 SDK `content` / `project` client 工厂，并保持只放通信层，不放 React hooks 和页面 DTO。
- [x] 更新 foundation runbook 与 guard，明确 `content.proto`、`project_service.proto`、对应 SDK client 与 migration 是 shared truth 入口。
- [x] 跑 `corepack pnpm run proto:gen`、`corepack pnpm run test:tooling`、`go test ./apps/backend/internal/interfaces/connect/... -count=1`，并在 PR `#46` 中通过完整 backend / CI 验证。
- [x] 合入 `master` 后完成主工作区 fast-forward，并清理 `phase2-foundation-collab-preview-freeze` worktree。

**Deferred backlog:**
- [ ] 多轨音频 shared truth 仍需新的 foundation micro-patch，预计会触达 `asset.proto` / `workflow.proto`
- [ ] 跨项目素材复用 shared truth 仍需新的 foundation micro-patch，预计会触达 asset rights / provenance 相关 wire shape

**Exit checks:**
- Phase 2 第一批 shared truth 有文档、有 proto、有 SDK client、有 guard。
- 实时协同与预演工作台后续产品线可直接消费，不再需要在本分支私扩协议。

## Task 2: 实时协同线（已完成）

> Status: 已于 2026-03-23 合入 `master`，PR `#48`

**Files:**
- Modify: `apps/creator/src/app/creatorRoutes.ts`
- Modify: `apps/creator/src/app/App.tsx`
- Create: `apps/creator/src/features/collaboration/`
- Create: `apps/creator/src/features/collaboration/CollabWorkbenchPage.tsx`
- Create: `apps/creator/src/features/collaboration/useCollabController.ts`
- Create: `apps/creator/src/features/collaboration/collabDraftState.ts`
- Create: `apps/creator/src/features/collaboration/collabPresence.ts`
- Modify: `apps/creator/src/i18n/zh-CN.json`
- Modify: `apps/creator/src/i18n/en-US.json`
- Modify: `apps/admin/src/app/adminRoutes.ts`
- Create: `apps/admin/src/features/dashboard/collaboration/`
- Create: `apps/admin/src/features/dashboard/AdminCollaborationPage.tsx`
- Modify: `apps/backend/internal/interfaces/connect/content_service.go`
- Create: `apps/backend/internal/application/contentapp/collaboration_service.go`
- Create: `apps/backend/internal/domain/content/collaboration.go`
- Modify: `apps/backend/internal/interfaces/sse/`
- Test: `apps/creator/src/app/App.test.tsx`
- Test: `apps/admin/src/app/App.test.tsx`
- Test: `tests/e2e/phase2-collaboration.spec.ts`

- [x] creator 已新增 `/collab` 路由与独立协同工作台，不再把协同状态塞回 `home / shots / imports`。
- [x] 已交付 “presence + 锁状态 + 草稿版本” 最小闭环，未引入完整 CRDT 富文本编辑器。
- [x] 富文本协同适配器继续留在 creator feature 内，没有进入 `packages/sdk`。
- [x] backend 已补齐协同会话读写、锁持有者、版本推进、最近冲突摘要，并通过 foundation SSE patch 广播变更。
- [x] admin 已新增协同观测页，只负责查看当前协同会话、锁冲突与滞留编辑锁。
- [x] 本地与 GitHub CI 已通过 creator/admin 单测、lint、build 与 PR 验证。

**Exit checks:**
- 至少一个内容对象可被两端看到 presence / lock / draft version。
- SSE 断连恢复后不会丢失最近协同状态。
- admin 能看到冲突或滞留会话，不需要登录 creator 才能排障。

## Task 3A: 预演工作台线（薄消费层）

> Status: 已于 2026-03-23 合入 `master`，PR `#49`

**Files:**
- Modify: `apps/creator/src/app/creatorRoutes.ts`
- Modify: `apps/creator/src/app/App.tsx`
- Create: `apps/creator/src/features/preview/`
- Create: `apps/creator/src/features/preview/PreviewWorkbenchPage.tsx`
- Create: `apps/creator/src/features/preview/usePreviewWorkbenchController.ts`
- Create: `apps/creator/src/features/preview/loadPreviewWorkbench.ts`
- Create: `apps/creator/src/features/preview/mutatePreviewWorkbench.ts`
- Create: `apps/creator/src/features/preview/previewWorkbench.ts`
- Modify: `apps/admin/src/app/adminRoutes.ts`
- Create: `apps/admin/src/features/dashboard/AdminPreviewPage.tsx`
- Create: `apps/admin/src/features/dashboard/useAdminPreviewController.tsx`
- Create: `apps/admin/src/features/dashboard/loadAdminPreviewWorkbench.ts`
- Create: `apps/admin/src/features/dashboard/adminPreview.ts`
- Test: `apps/creator/src/features/preview/*.test.tsx`
- Test: `tests/e2e/phase2-preview.spec.ts`

- [x] 为 creator 新增 `/preview?projectId=...` 入口，不与镜头工作台混成一个超大页面。
- [x] 当前 3A 只消费已冻结的 `ProjectService.GetPreviewWorkbench / UpsertPreviewAssembly`，不新增 proto、SDK public API 或 preview SSE。
- [x] creator 已交付“手动追加 shotId + 删除 + 上移/下移 + 整体保存 + provenance drilldown”最小闭环。
- [x] admin 已交付只读预演观测页，确认 assembly 状态、条目数、缺失主素材条目和 provenance 入口。
- [x] 已新增独立 preview mock fixture 与 `phase2-preview` Playwright 验收，不把 preview 逻辑继续堆回 Phase 1 spec。
- [x] 若预演对象需要友好标题、项目级 chooser、导出执行细节或 richer aggregation，拆到 Task 3B / foundation patch。

**Exit checks:**
- creator 能从项目级入口打开预演工作台并看到镜头顺序与素材引用。
- 预演页至少有一个稳定的“回到 shot/import/asset provenance”跳转链。
- 预演失败能在 admin 或 creator 里定位到 workflow / asset / rights / budget 原因。

## Task 3B: 预演 richer aggregation backlog

> Status: Phase 3 当前执行线，直接消费 `phase3-preview-contract-freeze.md` 冻结的 metadata / chooser contract

- [ ] creator `/preview` 消费 `PreviewShotSummary / PreviewAssetSummary / PreviewRunSummary`，把 raw ID 装配页升级成 metadata-first 工作台。
- [ ] creator `/preview` 引入项目级 shot chooser，默认通过 `ListPreviewShotOptions` 追加条目，不再把手输 `shotId` 当成主路径。
- [ ] admin `/preview` 升级为 metadata-first 只读审计页，补齐缺失主素材/来源运行摘要的统计和 provenance 入口。
- [ ] 评估是否需要项目级 preview 专用 SSE；若需要，先回 foundation patch，而不是在产品线私扩事件名。
- [ ] 预演导出、真实播放器、字幕/转场 richer payload、多轨音频联动，都放到 3B 之后与音频线协调推进。

## Task 4A: 多轨音频 foundation patch（项目级时间线）

**Files:**
- Modify: `proto/hualala/project/v1/project_service.proto`
- Modify: `proto/hualala/asset/v1/asset.proto`
- Modify: `packages/sdk/src/connect/services/project.ts`
- Modify: `packages/sdk/src/index.ts`
- Create: `infra/migrations/0016_phase2_audio_timeline_shared_truth.sql`
- Modify: `apps/backend/internal/application/projectapp/`
- Modify: `apps/backend/internal/domain/project/`
- Modify: `apps/backend/internal/domain/asset/`
- Modify: `apps/backend/internal/interfaces/connect/project_service.go`
- Modify: `apps/backend/internal/interfaces/connect/mapping.go`
- Modify: `apps/backend/internal/platform/db/`
- Test: `apps/backend/internal/application/projectapp/service_audio_test.go`
- Test: `apps/backend/internal/interfaces/connect/project_audio_service_test.go`

- [x] 已把音频当成 `media_type=audio` 的一等公民，而不是把 BGM/配音塞进图片或视频备注字段。
- [x] 已定义首批轨道类型：对白、旁白、BGM；每条轨道至少具备片段、时长、音量、静音/solo、来源资产。
- [x] 已利用现有 `media_assets.asset_type` 与 `media_asset_variants.duration_ms`，把 asset truth 显式映射到 domain / proto / SDK。
- [x] `project_service` 只新增 `GetAudioWorkbench / UpsertAudioTimeline`，workflow 继续复用通用 run，没有扩 `workflow.proto`。
- [x] backend 已持久化轨道与片段，并提供 `render_workflow_run_id / render_status`，首次读取会自动建空 timeline。
- [x] foundation 验证已跑过 `proto:gen`、SDK tests、connect tests、db tests 和 backend 全量回归；产品 UI 与 mock E2E 留给 4B。
- [x] provider 能力路由、成本归因、callback payload 仍留在后续 patch，不在 4A 混入。

## Task 4B: 多轨音频产品线

- [x] creator 已新增独立 `/audio?projectId=<id>` 工作台，作为唯一完整编辑面；`/preview` 只保留音频摘要卡和跳转 CTA。
- [x] creator 音频工作台已消费 foundation patch 暴露的 `timeline / media_type / duration_ms`，支持三类轨道、clip block、新增/删除/重排、`mute / solo / volume_percent / trim / duration / start` 编辑。
- [x] creator 音频素材池基于现有 `listImportBatches + getImportBatchWorkbench` 拼装，只显示 `media_type=audio` 且携带 `duration_ms` 的素材；缺失时 fail closed。
- [x] creator/admin 都复用了既有 provenance drilldown，音频 clip 可直接查看来源，不新增音频专属 shared truth。
- [x] admin 已新增只读 `/audio` 观测页，聚焦 timeline 状态、轨道统计、render 状态、缺失素材和 provenance，而不是复刻 creator 编辑器。
- [x] creator/admin 全量组件测试、根级 build、`test:tooling`、`test:e2e:phase2:audio` 已完成。
- [ ] 若产品线实现中暴露出“项目级素材池接口、音频专用 SSE、混音执行 RPC、波形资源协议”缺口，需拆新的 foundation patch，不能在本线私扩。

**Exit checks:**
- 至少一个项目可保存并重新加载多轨音频结构。
- 音频轨的来源资产、授权状态、AI 标识能被追溯。
- 音频渲染失败不会只留在日志里，creator/admin 都能看到原因摘要。

## Task 5: 跨项目素材复用线

> Status: 已于 2026-03-24 合入 `master`，PR `#52`

**Files:**
- Modify: `apps/admin/src/app/adminRoutes.ts`
- Modify: `apps/admin/src/app/App.tsx`
- Modify: `apps/admin/src/app/App.test.tsx`
- Create: `apps/admin/src/features/dashboard/reuse/`
- Modify: `apps/creator/src/app/creatorRoutes.ts`
- Modify: `apps/creator/src/app/App.tsx`
- Modify: `apps/creator/src/app/App.test.tsx`
- Create: `apps/creator/src/features/reuse/`
- Modify: `tests/e2e/fixtures/mockConnectRoutes.ts`
- Create: `tests/e2e/fixtures/mock-connect/reuse.ts`
- Modify: `package.json`
- Create: `docs/runbooks/phase2-asset-reuse-demo.md`
- Test: `apps/admin/src/features/dashboard/reuse/*.test.tsx`
- Test: `apps/creator/src/features/reuse/*.test.tsx`
- Test: `tests/e2e/phase2-asset-reuse.spec.ts`

- [x] 复用语义收敛为“reference，不是 copy”；creator 最终仍通过既有 shot workbench 选择主素材，不额外复制素材或生成平行 provenance 记录。
- [x] creator 已新增 `/reuse?projectId=<id>&shotId=<id>` 独立入口，可按 `sourceProjectId` 加载外部项目素材并查看来源、授权、AI 标识与限制说明。
- [x] 当前实现只消费既有 `AssetService.ListImportBatches / GetImportBatchWorkbench / GetAssetProvenanceSummary` 与 `ExecutionService.GetShotWorkbench / SelectPrimaryAsset`，没有新增 proto、SDK public API、SSE 或 backend shared truth。
- [x] creator 对被限制、AI 标记且 consent 不可用的素材明确 fail closed：保留列表可见性和 blocked reason，但禁用“复用为当前镜头主素材”。
- [x] admin 已新增 `/reuse?projectId=<id>&shotExecutionId=<id>` 只读审计页，可查看来源项目、当前复用资格、blocked reason 与 provenance drilldown。
- [x] 已新增独立 reuse mock fixture 与 `phase2-asset-reuse` Playwright 验收，不把跨项目素材逻辑塞回 audio / preview / admin fixture。
- [x] 当前线已补 creator/admin 组件测试、独立 reuse E2E、demo runbook 与计划文档同步。
- [ ] 若跨项目可见性、授权范围、组织级策略不够表达，暂停本线并回 foundation micro-patch。

**Exit checks:**
- creator 能搜索并引用其他项目的合规素材。
- admin 能审计素材从哪个项目被谁复用到了哪里。
- rights/consent 不满足时，复用路径被明确阻断。

## Task 6: Phase 2 验收、runbook 与质量门

> Status: 已于 2026-03-24 完成，Phase 2 已进入 closeout

**Files:**
- Create: `tests/e2e/phase2-collaboration.spec.ts`
- Modify: `tests/e2e/fixtures/mockConnectRoutes.ts`
- Create: `tests/e2e/fixtures/mock-connect/collaboration.ts`
- Create: `tests/e2e/phase2-preview-real-smoke.spec.ts`
- Create: `tests/e2e/phase2-audio-real-smoke.spec.ts`
- Modify: `package.json`
- Create: `docs/runbooks/phase2-collaboration-demo.md`
- Create: `docs/runbooks/phase2-preview-demo.md`
- Modify: `docs/runbooks/phase2-audio-demo.md`
- Modify: `docs/runbooks/phase2-asset-reuse-demo.md`
- Create: `docs/reports/2026-03-24-phase2-closeout.md`
- Modify: `README.md`
- Modify: `tests/README.md`
- Modify: `.github/workflows/ci.yml`
- Test: `.github/workflows/ci.yml`

- [ ] 为四条主线分别补 mock E2E，避免只依赖一个超长 `phase2-acceptance` 场景。
- [ ] 需要 real backend 兜底的链路，至少为预演和多轨音频补独立 real smoke。
- [ ] `package.json` 增加 Phase 2 相关的 E2E 与 tooling 命令，保持命名对齐现有 `phase1` 风格。
- [ ] mock fixture 继续模块化，新增协同/预演/音频/复用模块，不把逻辑塞回单个入口文件。
- [ ] 为每条主线补单独 runbook，说明 demo seed、必填环境变量、操作脚本、失败排查入口。
- [ ] Phase 2 closeout 文档必须以当前 repo reality 为准，不复用旧实施计划 checkbox 作为完成依据。
- [ ] 统一回归命令至少覆盖 `corepack pnpm run build`、`corepack pnpm run test:tooling`、`go test ./apps/backend/... -count=1`、Phase 1/Phase 2 mock E2E、必要的 real E2E。

**Exit checks:**
- 四条主线各自有独立 mock 验收。
- 至少两条高风险真实链路有 real smoke。
- runbook、CI、closeout 文档齐备，能支持后续 Phase 3 继续推进。

## 跨线验证矩阵

| 线 | 最低验证 |
| --- | --- |
| foundation micro-patch | `corepack pnpm run proto:gen`、`corepack pnpm run test:tooling`、`go test ./apps/backend/internal/interfaces/connect/... -count=1` |
| 实时协同 | `corepack pnpm --filter @hualala/creator test`、`corepack pnpm --filter @hualala/admin test`、`corepack pnpm run test:e2e:creator`、`corepack pnpm run test:e2e:phase2:collaboration` |
| 预演工作台 | `corepack pnpm --filter @hualala/creator build`、`go test ./apps/backend/... -count=1`、`corepack pnpm run test:e2e:phase2:preview` |
| 多轨音频 | `go test ./apps/backend/internal/interfaces/connect/... -count=1`、`corepack pnpm --filter @hualala/creator test`、`corepack pnpm run test:e2e:phase2:audio` |
| 跨项目素材复用 | `corepack pnpm --filter @hualala/admin test`、`corepack pnpm --filter @hualala/creator test`、`corepack pnpm run test:e2e:phase2:asset-reuse` |
| Phase 2 收尾 | `corepack pnpm run build`、`corepack pnpm run test:tooling`、`go test ./apps/backend/... -count=1`、全部 mock E2E、必要的 real E2E |

## 必须升级为 foundation patch 的触发条件

出现以下任一情况，当前产品线必须暂停，转回新的 foundation micro-patch：

1. 需要新增 proto message / field / RPC。
2. 需要新增 `packages/sdk` public export。
3. 需要新增 SSE event name 或改变 payload shape。
4. 需要改变 upload session 或 asset provenance 的承诺结构。
5. 需要为音频、预演、素材复用补新的 workflow / asset shared truth。

## 建议执行节奏

1. Task 1、Task 2、Task 3A、Task 4A、Task 4B、Task 5 已完成；当前主线是 Task 6 验收与收尾线。
2. Task 6 继续只做 acceptance / CI / docs / runbook / 低风险修复，不再新增产品 shared truth。
3. Task 6 完成后，Phase 2 进入 closeout 状态，后续新增能力统一进入 Phase 3 或新的 foundation patch。
