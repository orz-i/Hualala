# 2026-03-24 Phase 2 Closeout

## 总结

截至 `2026-03-24`，Phase 2 的五条主执行线都已经合入 `master`，本次收尾线补齐了 Phase 2 mock / real 验收入口、协同 fixture、CI 质量门、runbook 和仓库入口文档。当前仓库状态不再停留在“foundation 已合入、产品线分散推进”，而是进入了“Phase 2 有独立 acceptance、CI 和 closeout 文档”的阶段。

## 已合入主线与 PR

| 线 | 范围 | PR |
| --- | --- | --- |
| Foundation（协同 + 预演 shared truth） | 首批 shared truth、SDK、persistence、foundation guard、协同 SSE patch | `#46`、`#47` |
| 实时协同 | creator `/collab`、admin `/collaboration`、presence/lock/draftVersion 闭环 | `#48` |
| 预演工作台 | creator `/preview`、admin `/preview`、assembly 薄消费层 | `#49` |
| 多轨音频 | audio foundation patch + creator/admin 音频产品线 | `#50`、`#51` |
| 跨项目素材复用 | creator `/reuse`、admin `/reuse`、跨项目 reference 审计 | `#52` |

## 验证矩阵

### Mock acceptance

- 协同：`corepack pnpm run test:e2e:phase2:collaboration`
- 预演：`corepack pnpm run test:e2e:phase2:preview`
- 音频：`corepack pnpm run test:e2e:phase2:audio`
- 素材复用：`corepack pnpm run test:e2e:phase2:asset-reuse`
- 聚合入口：`corepack pnpm run test:e2e:phase2`

### Real smoke

- Phase 1 baseline：`corepack pnpm run test:e2e:phase1:real`
- 预演：`corepack pnpm run test:e2e:phase2:preview:real`
- 音频：`corepack pnpm run test:e2e:phase2:audio:real`
- 聚合入口：`corepack pnpm run test:e2e:phase2:real`

### 基础质量门

- `corepack pnpm run build`
- `corepack pnpm run test:tooling`
- `go test ./apps/backend/... -count=1`

## 当前 CI 出口

- `proto_frontend`：frontend lint / build / unit + tooling
- `backend`：PostgreSQL backend test
- `e2e`：Phase 1 mock + 全量 Phase 2 mock acceptance
- `e2e_real`：Phase 1 real + Phase 2 preview/audio real smoke

## Deferred backlog

只保留以下 deferred 项，不再复用旧计划中的泛化 checkbox：

1. `Task 3B` richer preview aggregation：shot/scene 友好标题、chooser、真实播放器、更细粒度 preview SSE。
2. 任何需要新增 proto / SDK public API / SSE / backend wire shape 的 Phase 3 能力，都必须先拆新的 foundation patch。

## Phase 3 接口

Phase 3 不应从“再补一个页面”开始，而应从 backlog 里的 contract 缺口重新切片：

1. richer preview aggregation 是否需要新的项目级/预演级 shared truth
2. 音频执行入口、波形资源协议、render callback 是否需要新的 foundation patch
3. 跨项目素材复用的 rights / consent / org policy 是否需要更强的 shared truth

## 备注

- `README.md`、`tests/README.md`、Phase 2 runbooks 和 CI 已同步到同一心智：Phase 2 有独立 mock acceptance 与 real smoke，不再借用 Phase 1 入口代指全局完成。
