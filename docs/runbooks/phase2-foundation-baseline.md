# Phase 2 Foundation Baseline

## 目标

这份文档用于收口当前 `master` 上已经合并的 Phase 2 foundation 事实，明确后续 backend、admin、creator 并行开发时应共同依赖的共享事实源、验证入口和边界。

当前 foundation 的目标不是继续扩产品面，而是冻结共享层：

- proto request / response
- backend Connect 暴露与 mapping
- SDK client / transport / session bootstrap
- SSE / upload 共享入口
- mock fixture truth

## 当前共享事实源

后续多分支或多 session 推进时，以下文件应视为共享事实源：

- `proto/hualala/**/*.proto`
- `apps/backend/internal/interfaces/connect/server.go`
- `apps/backend/internal/interfaces/connect/mapping.go`
- `apps/backend/internal/interfaces/connect/*.go`
- `packages/sdk/src/connect/services/*.ts`
- `packages/sdk/src/connect/transport.ts`
- `packages/sdk/src/connect/identity.ts`
- `packages/sdk/src/session/bootstrap.ts`
- `packages/sdk/src/sse/*`
- `packages/sdk/src/upload/*`
- `tests/e2e/fixtures/mockConnectRoutes.ts`

这些入口负责定义“协议是什么”“Connect 如何对外暴露”“SDK 如何消费”“mock truth 长什么样”，不应在 backend/admin/creator 产品分支里各自漂移。

## 当前基线事实

- backend 真实运行时已切到原生 PostgreSQL runtime，本地真实联调以 `DB_DRIVER=postgres` 为默认契约
- session bootstrap 已统一收口到 `packages/sdk/src/session/bootstrap.ts`
- admin / creator 已通过各自 `features/session/sessionBootstrap.ts` 作为轻量桥接层消费共享 bootstrap
- mock / real 两条验收链路都保留在仓库脚本和 CI 中

## Foundation 完成口径

当前 foundation 视为完成，至少需要满足：

1. proto 可表达当前切片的最小共享契约
2. backend Connect 暴露已完整承接 proto
3. SDK client、transport、session、SSE、upload 已形成稳定入口
4. mock fixture 已与真实共享 truth 对齐
5. admin / creator 至少能基于共享层稳定 `build`
6. foundation 相关 tooling 和验收命令可稳定通过

## 推荐验证命令

```powershell
corepack pnpm run proto:gen
corepack pnpm --filter @hualala/sdk test
corepack pnpm --filter @hualala/sdk lint
corepack pnpm --filter @hualala/sdk build
go test ./apps/backend/... -count=1
corepack pnpm --filter @hualala/admin build
corepack pnpm --filter @hualala/creator build
corepack pnpm run test:tooling
corepack pnpm run test:e2e:phase1
```

如果本次 foundation 改动波及真实链路，再追加：

```powershell
corepack pnpm run test:e2e:phase1:real
```

## 后续并行开发规则

- backend、admin、creator 分支默认只消费当前 foundation，不自行扩共享契约
- 若并行开发中再次发现 request / response、session、SSE、upload 或 mock truth 不够，应先回到新的 foundation patch 收口
- 主工作区只保留给 `master` 集成和最终回归，不直接承担功能开发
