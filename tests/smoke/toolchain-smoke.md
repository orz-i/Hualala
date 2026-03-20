# Toolchain Smoke

用于记录空骨架阶段的基础验证结果。

建议执行顺序：

1. `pnpm install`
2. `pnpm exec turbo run build`
3. `pnpm exec turbo run test`
4. `pnpm exec buf lint`
5. `go test ./...`

记录要求：

- 标记执行时间
- 标记退出码
- 记录失败时的真实报错
- 若因当前阶段尚未具备前置文件而失败，明确阻塞项

## 2026-03-20 首轮结果

### 通过

- `corepack pnpm install`
  - 退出码：0
  - 备注：使用仓库内 `_tmp_corepack`、`_tmp_npm-cache`、`_tmp_pnpm-store`，避免写系统目录。
- `corepack pnpm run build`
  - 退出码：0
  - 备注：`@hualala/admin`、`@hualala/creator` 占位构建通过。
- `corepack pnpm run lint`
  - 退出码：0
- `corepack pnpm run test`
  - 退出码：0
- `corepack pnpm run proto:lint`
  - 退出码：0
  - 备注：通过 `tooling/scripts/run-buf.mjs` 设置本地 `BUF_CACHE_DIR` 后可执行。
- `go test ./apps/backend/...`
  - 退出码：0
  - 输出：`github.com/hualala/apps/backend/cmd/api [no test files]`

### 已识别前置坑

- 系统 `PATH` 中没有 `pnpm` 和 `buf`，不能直接依赖全局工具。
- `turbo` 初始失败原因为找不到 `pnpm` 二进制，已通过将 `pnpm` 固化为本地 devDependency 修复。
- `buf` 初始失败原因为默认写 `C:\\Users\\mouta\\AppData\\Local\\buf`，已通过本地 wrapper 修复。
- 当前主工作区 `D:/Documents/Hualala` 存在一次误写入的空骨架文件，尚未清理；后续如需清理，需先获得显式确认。
