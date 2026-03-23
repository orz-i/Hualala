# Phase 2 Foundation Baseline

## 目标

这份 runbook 用来定义当前 `master` 上 Phase 2 foundation patch 的执行边界，而不只是描述现状。当前 foundation patch 的职责是治理共享真相层，避免 backend、admin、creator 在并行推进时把共享契约各自改漂。

当前 `master` 上的 foundation baseline 仍然以共享真相层治理为核心，但从 2026-03-23 这一轮开始，允许通过独立 foundation micro-patch 收口首批协同 / 预演 shared truth。默认允许变化的范围是：

- 共享测试入口的组织方式
- mock truth 的模块化与守护
- backend Connect contract test 的组织方式
- foundation 文档与 tooling guard
- 首批协同 / 预演 shared truth 的 proto、SDK client、SSE event contract、backend persistence 与 migration

README 只保留仓库顶层现状摘要，foundation 的执行规则统一收口到本文件。

## 共享入口清单

以下文件或路径属于 foundation 级 shared truth，后续多分支或多 session 推进时必须按 foundation patch 流程收口：

- `proto/hualala/**/*.proto`
- `apps/backend/internal/interfaces/connect/server.go`
- `apps/backend/internal/interfaces/connect/mapping.go`
- `apps/backend/internal/interfaces/connect/*.go`
- `packages/sdk/src/connect/services/*.ts`
- `packages/sdk/src/connect/services/content.ts`
- `packages/sdk/src/connect/services/project.ts`
- `packages/sdk/src/connect/transport.ts`
- `packages/sdk/src/connect/identity.ts`
- `packages/sdk/src/session/bootstrap.ts`
- `packages/sdk/src/sse/*`
- `packages/sdk/src/upload/*`
- `tests/e2e/fixtures/mockConnectRoutes.ts`
- `tests/e2e/fixtures/mock-connect/*.ts`
- `apps/backend/internal/interfaces/connect/server_test.go`
- `apps/backend/internal/interfaces/connect/server_*_test.go`
- `proto/hualala/content/v1/content.proto`
- `proto/hualala/project/v1/project_service.proto`
- `infra/migrations/0015_phase2_collab_preview_shared_truth.sql`

这些入口定义的是：

- 协议怎么暴露
- SDK 怎么消费
- mock truth 长什么样
- backend contract test 以什么 wire shape 为准

backend/admin/creator 的产品分支不应该直接改这些共享入口来补自身需求。

## 当前基线事实

- backend 真实运行时已切到原生 PostgreSQL runtime，本地真实联调默认契约是 `DB_DRIVER=postgres`
- real runtime 的 workflow durable path 默认是 `API + backend-worker` 双进程，而不是请求内同步直返 provider 结果
- session bootstrap 已统一收口到 `packages/sdk/src/session/bootstrap.ts`
- admin / creator 通过各自的 session bootstrap 桥接层消费共享 bootstrap
- mock / real 两条验收链路都保留在仓库脚本和 CI 中
- `mockConnectRoutes.ts` 的唯一公共入口仍是 `mockConnectRoutes(page, scenario)`，拆分只允许发生在内部模块
- backend Connect contract suite 默认以当前 wire shape 为真相，不在测试重组时引入超出 foundation micro-patch 的 proto 字段或 SDK 接口
- 首批协同 / 预演 shared truth 统一经由 `content.proto`、`project_service.proto`、对应 SDK client、`content.collaboration.updated` SSE 合同与 `0015_phase2_collab_preview_shared_truth.sql` 收口

## 变更准入规则

以下变更允许进入 foundation patch：

1. 需要同时影响 mock truth、backend contract test、tooling guard 的共享治理修改
2. 需要更新 shared truth 文档，明确准入边界和验证矩阵
3. 需要重组 `tests/e2e/fixtures/mockConnectRoutes.ts` 或 `apps/backend/internal/interfaces/connect/server_*_test.go` 的文件组织，但不改变 consumer 调用方式
4. 需要补 shared truth guard，阻止后续把逻辑重新堆回单体文件
5. 需要通过 foundation micro-patch 新增首批协同 / 预演 shared truth，且范围限定在 `content.proto`、`project_service.proto`、对应 SDK client、SSE event contract、backend persistence 与 migration

以下变更默认不得进入 foundation patch，必须留在 backend/admin/creator 消费层，或另开新的 foundation patch：

1. 脱离 foundation micro-patch，直接在产品分支新增或修改 `proto/hualala/**/*.proto`
2. 脱离 foundation micro-patch，直接刷新 `packages/sdk/src/gen/**` 或新增 SDK public API
3. 修改 `packages/sdk/src/session/bootstrap.ts` 的 wire shape
4. 改变 mock / backend contract 已经承诺的 request / response 结构
5. 任何只服务于单一产品面的 UI/loader/page state 细节

如果 backend/admin/creator 并行开发时发现共享契约不够，不要在产品分支里直接扩协议，而要回到新的 foundation patch 收口。

## 验证矩阵

| 入口 | 负责兜底的风险 | 默认命令 |
| --- | --- | --- |
| mock fixture unit tests | mock payload shape、状态流转、scope 对齐 | `node --test tooling/scripts/mock_connect_fixture_modules.test.mjs` |
| foundation shared truth guard | 共享入口重新堆回单体文件、suite 漂移 | `node --test tooling/scripts/foundation_shared_truth_guard.test.mjs` |
| foundation docs guard | runbook/README 口径回退、执行边界失真 | `node --test tooling/scripts/foundation_baseline_docs.test.mjs` |
| backend connect contract suite | Connect route、workflow/import/asset/shot workbench wire shape 漂移 | `go test ./apps/backend/internal/interfaces/connect/... -count=1` |
| upload / sse interface tests | 非 Connect HTTP/SSE 入口被测试重组误伤 | `go test ./apps/backend/internal/interfaces/sse/... ./apps/backend/internal/interfaces/upload/... -count=1` |
| Playwright mock acceptance | admin / creator / phase1 mock 链路被 fixture 重组破坏 | `corepack pnpm run test:e2e:admin` `corepack pnpm run test:e2e:creator` `corepack pnpm run test:e2e:phase1` |
| real acceptance | foundation 改动意外影响真实链路 | `corepack pnpm run test:e2e:phase1:real` |
| tooling aggregate | 文档与守护未被纳入既有质量门 | `corepack pnpm run test:tooling` |

mock 模式必须继续满足一个基础不变量：不得把 `127.0.0.1:8080` 的真实请求泄漏回测试链路。

## Foundation 完成口径

当前 foundation patch 视为完成，至少需要满足：

1. `mockConnectRoutes.ts` 已只保留统一入口，内部逻辑拆到按域分组的模块
2. backend Connect contract tests 已按行为分组到多个 `server_*_test.go` suite
3. `server_test.go` 只保留最小 route registration smoke
4. shared truth guard 和 docs guard 已接入 `corepack pnpm run test:tooling`
5. backend/admin/creator 仍然消费相同 wire shape，没有新增 proto / SDK public API 漂移

## 推荐验证命令

```powershell
corepack pnpm run test:tooling
corepack pnpm run test:e2e:admin
corepack pnpm run test:e2e:creator
corepack pnpm run test:e2e:phase1
go test ./apps/backend/internal/interfaces/connect/... -count=1
go test ./apps/backend/internal/interfaces/sse/... ./apps/backend/internal/interfaces/upload/... -count=1
```

如果本次 foundation patch 触及真实链路风险，再补跑：

```powershell
go test ./apps/backend/... -count=1
corepack pnpm run test:e2e:phase1:real
```

## 后续并行开发规则

- backend、admin、creator 分支默认只消费当前 foundation，不自行扩共享契约
- 新的共享变更必须先以 foundation patch 进入 `master`，再由 backend/admin/creator 消费
- 主工作区只保留给 `master` 集成和最终回归，不直接承担功能开发
