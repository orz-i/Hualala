# Phase 1 Demo Runbook

## 目标

这份 runbook 现在区分两种模式：

- mock 演示模式：只起前端 Vite dev server，浏览器层拦截 Connect 请求
- 真实联调模式：通过本地 Postgres + backend + admin/creator 的真实链路联调

当前 Phase 1 仍然没有真实登录流程，因此两种模式都不使用账号体系；mock 模式用固定 demo IDs，真实联调模式使用 seed 命令输出的实际 IDs。

## 模式一：Mock 演示

### 启动顺序

1. `corepack pnpm install`
2. `corepack pnpm run demo:seed`
3. `corepack pnpm run test:e2e:phase1`

### 演示账号

当前 Phase 1 mock 演示无登录，用固定 demo IDs 代替账号：

- `org-live-1`
- `project-live-1`
- `shot-live-1`
- `shot-exec-live-1`
- `batch-live-1`
- `asset-live-1`

### 手动页面路径

- Admin：
  - `http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1`
- Creator Home（推荐入口）：
  - `http://127.0.0.1:4174/?projectId=project-live-1`
- Creator Shot：
  - `http://127.0.0.1:4174/?shotId=shot-live-1`
- Creator Import：
  - `http://127.0.0.1:4174/?importBatchId=batch-live-1`

## 模式二：真实联调

### 启动顺序

真实联调的启动、停机、排障和 demo 数据入口已经独立收口到：

- `docs/runbooks/local-real-dev.md`

最短路径：

1. `corepack pnpm run dev:real`
2. 另开终端执行 `corepack pnpm run dev:real:seed`

### 演示账号

当前 Phase 1 真实联调也无登录，用 `demo:seed:backend` 输出的真实 IDs 代替账号信息。

### 联调 ID 输出

`corepack pnpm run demo:seed:backend` 会：

- 调真实 backend 的 `ProjectService / ContentService / BillingService / ExecutionService / AssetService / ReviewService`
- 在 `_tmp_demo_seed/phase1-backend-seed.json` 写入真实生成的联调 IDs
- 同时在 stdout 输出可直接打开的 URL

至少包含：

- `admin.projectId`
- `admin.shotExecutionId`
- `creatorShot.projectId`
- `creatorShot.shotId`
- `creatorImport.projectId`
- `creatorImport.importBatchId`
- `urls.admin`
- `urls.creatorShot`
- `urls.creatorImport`

## 演示路径

### 1. Admin 最近变更与预算更新

- 打开 admin 页面，确认能看到 project ID
- 确认最近变更列表存在 3 条：计费、评估、评审
- 更新预算，确认页面依次出现：
  - `正在更新预算策略` 或 `Updating budget policy`
  - `预算策略已更新` 或 `Budget policy updated`

### 2. Creator Shot Gate 与提审

- 可直接打开 shot workbench，或先通过 Creator Home 输入 `projectId` / `shotId` 进入
- 确认存在 shot execution ID
- 点击 `Gate 检查`
- 确认页面出现：
  - `正在执行 Gate 检查` 或 `Running gate checks`
  - `Gate 检查已完成` 或 `Gate checks completed`
- 点击 `提交评审`
- 确认页面出现 `提交评审已完成` 或 `Submitted for review`

### 3. Creator Import 确认匹配与设主素材

- 优先打开 Creator Home，确认能看到 import batch ID
- 点击 `进入导入工作台`
- 确认进入 import workbench 后存在 import batch ID
- 点击 `确认匹配`
- 确认页面出现：
  - `正在确认匹配`
  - `匹配确认已完成`
- 点击 `设为主素材`
- 确认页面出现：
  - `主素材选择已完成`
  - `当前主素材`

### 4. Locale 切换

- 两端都支持 `zh-CN / en-US` UI locale 切换
- 切换后刷新页面，locale 会从本地 `localStorage` 记忆恢复

## 自动化验收

### Mock Smoke

- `corepack pnpm run test:e2e:admin`
- `corepack pnpm run test:e2e:creator`
- `corepack pnpm run test:e2e:phase1`

### 真实联调 Smoke

以下 3 条现在都视为正式质量门，其中 `test:e2e:phase1:real` 是 CI 级真实 backend acceptance：

- `corepack pnpm run test:e2e:admin:real`
- `corepack pnpm run test:e2e:creator:real`
- `corepack pnpm run test:e2e:phase1:real`

## 说明

- mock seed 继续由 `tooling/scripts/demo_seed.mjs` 提供，只服务于 mock/E2E
- 真实联调 seed 改由 `tooling/scripts/backend_seed.mjs` 提供，只走公共 API 注入
- 当前真实联调不启用 CORS，前端必须通过 Vite proxy 访问 backend
