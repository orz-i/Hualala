# Phase 1 Demo Runbook

## 目标

这份 runbook 对应当前 Phase 1 的确定性演示模式，不启动真实 backend，不伪装成真实后端联调。
当前演示链路基于：

- `apps/admin` / `apps/creator` 的 Vite dev server
- Playwright route mock
- `tooling/scripts/demo_seed.mjs` 生成的固定 demo 场景

## 启动顺序

1. `corepack pnpm install`
2. `corepack pnpm run demo:seed`
3. `corepack pnpm run test:e2e:phase1`

如果只做手动演示，可分别启动：

1. `corepack pnpm --filter @hualala/admin dev -- --host 127.0.0.1 --port 4173`
2. `corepack pnpm --filter @hualala/creator dev -- --host 127.0.0.1 --port 4174`

## 演示账号

当前 Phase 1 mock 演示无登录，用固定 demo IDs 代替账号：

- `org-live-1`
- `project-live-1`
- `shot-live-1`
- `shot-exec-live-1`
- `batch-live-1`
- `asset-live-1`

## 手动页面路径

- Admin：
  - `http://127.0.0.1:4173/?projectId=project-live-1&shotExecutionId=shot-exec-live-1&orgId=org-live-1`
- Creator Shot：
  - `http://127.0.0.1:4174/?shotId=shot-live-1`
- Creator Import：
  - `http://127.0.0.1:4174/?importBatchId=batch-live-1`

## 演示路径

### 1. Admin 最近变更与预算更新

- 打开 admin 页面，确认能看到 `project-live-1`
- 确认最近变更列表存在 3 条：计费、评估、评审
- 切换 locale 为 `English`，刷新后确认仍保持英文
- 更新预算，确认页面依次出现：
  - `Updating budget policy`
  - `Budget policy updated`

### 2. Creator Shot Gate 与提审

- 打开 shot workbench，确认存在 `shot-exec-live-1`
- 切换 locale 为 `English`，刷新后确认仍保持英文
- 点击 `Run Gate Checks`
- 确认页面出现：
  - `Running gate checks`
  - `Gate checks completed`
  - `Passed checks`
  - `Failed checks`
- 点击 `Submit for review`
- 确认页面出现 `Submitted for review`

### 3. Creator Import 确认匹配与设主素材

- 打开 import workbench，确认存在 `batch-live-1`
- 点击 `确认匹配`
- 确认页面出现：
  - `正在确认匹配`
  - `匹配确认已完成`
- 点击 `设为主素材`
- 确认页面出现：
  - `主素材选择已完成`
  - `当前主素材：asset-live-1`

## 可选失败演示

如需演示失败路径，直接运行现有 smoke：

- `corepack pnpm run test:e2e:admin`
- `corepack pnpm run test:e2e:creator`

对应失败点：

- admin：预算更新失败
- creator shot：Gate 检查失败
- creator import：匹配确认失败

## 说明

- 当前 runbook 目标是“可重复、可稳定演示”
- 当前 demo seed 只服务于 mock 场景，不写数据库、不跑迁移
- 当前 Phase 1 还没有真实登录账号和真实后端演示链
