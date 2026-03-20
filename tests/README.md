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
- 不启动真实 backend，也不覆盖后端 proto/Connect 协议

常用命令：

- `corepack pnpm run test:e2e:admin`
- `corepack pnpm run test:e2e:creator`
- `corepack pnpm run test:e2e:phase1`
