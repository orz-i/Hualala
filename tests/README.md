# Tests

该目录承载跨应用和跨协议验证。

当前阶段先保留：

- `tests/smoke/`：工具链与空骨架验证记录
- `tests/integration/`：后端主链集成测试
- `tests/e2e/`：管理端、创作端与验收脚本

## E2E

当前 `tests/e2e/` 采用浏览器层 smoke 口径：

- 只启动 `apps/admin` 与 `apps/creator` 的 Vite dev server
- 通过 Playwright route mock 拦截 `/hualala.*` Connect 请求
- mock fixture 来源统一由 `tooling/scripts/demo_seed.mjs` 的 `buildPhase1DemoScenarios()` 提供
- 不启动真实 backend，也不覆盖后端 proto/Connect 协议

真实联调 smoke 则额外：

- 启动 `apps/backend` 内存态服务
- 通过 `apps/admin` / `apps/creator` 的 Vite proxy 把 `/hualala.*`、`/upload/*`、`/sse/*` 代理到 `http://127.0.0.1:8080`
- 使用 `tooling/scripts/backend_seed.mjs` 通过真实公共 API 注入联调数据
- 不复用 mock fixture 常量

常用命令：

- `corepack pnpm run demo:seed`
- `corepack pnpm run demo:seed:backend`
- `corepack pnpm run test:e2e:admin`
- `corepack pnpm run test:e2e:creator`
- `corepack pnpm run test:e2e:phase1`：mock acceptance
- `corepack pnpm run test:e2e:admin:real`
- `corepack pnpm run test:e2e:creator:real`
- `corepack pnpm run test:e2e:phase1:real`：CI 级真实 backend acceptance

其中：

- `test:e2e:phase1` 是 CI 中的 mock acceptance 门
- `test:e2e:phase1:real` 是 CI 中的真实 backend acceptance 门
