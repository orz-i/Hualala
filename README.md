# Hualala

AI 剧集生成平台 monorepo。当前 `master` 已完成 Phase 1 主闭环，并已合入 Phase 2 foundation：原生 PostgreSQL 真实运行时、统一 SDK / session bootstrap、workflow / asset / governance 共享基线。

## 仓库组成

- `apps/backend`：Go Connect API、SSE、Upload Session、原生 PostgreSQL 真实运行时 backend
- `apps/admin`：治理端工作台
- `apps/creator`：创作端工作台
- `proto`：Buf 管理的服务与消息协议
- `packages/sdk`：共享 Connect / SSE / Upload / i18n SDK
- `tests/e2e`：mock 与 real Playwright 验收
- `docs`：设计、实施计划、runbook、结项文档

## 常用命令

- `corepack pnpm run lint`
- `corepack pnpm run build`
- `corepack pnpm run test`
- `go test ./apps/backend/...`
- `corepack pnpm run test:e2e:phase1`
- `corepack pnpm run test:e2e:phase2`
- `corepack pnpm run test:e2e:phase1:real`
- `corepack pnpm run test:e2e:phase2:real`

## 演示与验收模式

### Mock 模式

- 入口说明：`docs/runbooks/phase1-demo.md`
- Phase 2 协同：`docs/runbooks/phase2-collaboration-demo.md`
- Phase 2 预演：`docs/runbooks/phase2-preview-demo.md`
- Phase 2 音频：`docs/runbooks/phase2-audio-demo.md`
- Phase 2 素材复用：`docs/runbooks/phase2-asset-reuse-demo.md`
- 主命令：`corepack pnpm run demo:seed`
- 验收命令：`corepack pnpm run test:e2e:phase1`
- Phase 2 验收总入口：`corepack pnpm run test:e2e:phase2`

### 真实联调模式

- 入口说明：`docs/runbooks/local-real-dev.md`
- 主命令：`corepack pnpm run dev:real`
- demo 数据：`corepack pnpm run dev:real:seed`
- 验收命令：`corepack pnpm run test:e2e:phase1:real`
- Phase 2 真实 smoke：`corepack pnpm run test:e2e:phase2:real`
- backend 容器入口：`apps/backend/Dockerfile`

## 关键文档

- Phase 1 结项：`docs/reports/2026-03-20-phase1-closeout.md`
- Phase 2 结项：`docs/reports/2026-03-24-phase2-closeout.md`
- Phase 1 Runbook：`docs/runbooks/phase1-demo.md`
- Phase 2 协同 Runbook：`docs/runbooks/phase2-collaboration-demo.md`
- Phase 2 预演 Runbook：`docs/runbooks/phase2-preview-demo.md`
- Phase 2 Foundation Baseline：`docs/runbooks/phase2-foundation-baseline.md`
- 本地真实联调 Runbook：`docs/runbooks/local-real-dev.md`
- Final Design：`docs/specs/2026-03-20-ai-series-platform-final-design.md`
- Phase 2 并行计划：`docs/superpowers/plans/2026-03-23-ai-series-platform-phase2-post-foundation-parallel-plan.md`
- 实施计划归档：`docs/superpowers/plans/2026-03-20-ai-series-platform-phase1-implementation-plan.md`
