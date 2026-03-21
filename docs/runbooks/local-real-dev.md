# 本地真实联调 Runbook

## 目标

这份 runbook 是 Hualala 本地真实联调的唯一权威入口，负责说明：

- 如何一键拉起本地真实链路
- 如何显式注入 demo 数据
- 如何判断启动成功
- 如何排查常见故障

当前默认本地端口保持固定契约：

- backend：`http://127.0.0.1:8080`
- admin：`http://127.0.0.1:4173`
- creator：`http://127.0.0.1:4174`

## 前置依赖

- Docker Desktop 或兼容 `docker compose` 的本地 Docker
- Go
- Node.js
- `corepack pnpm`

首次进入仓库建议先执行：

- `corepack pnpm install`

## 标准启动命令

```bash
corepack pnpm run dev:real
```

该命令会顺序执行：

1. `corepack pnpm run db:up`
2. 等待 Postgres 就绪
3. `corepack pnpm run db:migrate`
4. `corepack pnpm run db:bootstrap-dev`
5. 启动 backend
6. 启动 admin Vite（4173）
7. 启动 creator Vite（4174）

注意：

- `dev:real` 不会自动注入 demo 数据
- 结束 `dev:real` 只会停止进程，不会自动删库

## Demo 数据入口

如需给真实 backend 注入一套可直接联调的样例数据，另开终端执行：

```bash
corepack pnpm run dev:real:seed
```

该命令复用现有 `demo:seed:backend`，会：

- 调真实 backend 的公共 API 注入项目、镜头执行、import batch、素材和评审数据
- 在 `_tmp_demo_seed/phase1-backend-seed.json` 输出联调 IDs
- 在 stdout 输出可直接打开的 admin / creator URL

## 成功判定

当以下地址都可访问时，说明本地真实联调已就绪：

- backend health：`http://127.0.0.1:8080/healthz`
- admin：`http://127.0.0.1:4173`
- creator：`http://127.0.0.1:4174`

执行 `corepack pnpm run dev:real:seed` 后，admin / creator 应能看到真实数据：

- Admin：
  - `http://127.0.0.1:4173/?projectId=...&shotExecutionId=...&orgId=...`
- Creator Shot：
  - `http://127.0.0.1:4174/?shotId=...`
- Creator Import：
  - `http://127.0.0.1:4174/?importBatchId=...`

## 停止与清理

- 停止前端和 backend：
  - 在运行 `dev:real` 的终端按 `Ctrl+C`
- 销毁本地数据库卷：
  - `corepack pnpm run db:down`

默认不要把 `db:down` 和 `dev:real` 绑在一起，避免误删本地数据。

## 常见排障

### 1. 5432 端口占用或 Postgres 未就绪

症状：

- `db:up` 后迁移卡住或失败
- `db:migrate` / `db:bootstrap-dev` 报数据库连接错误

处理：

- 检查本机是否已有其他 Postgres 占用 `5432`
- 确认 Docker Desktop 已启动
- 手动执行：
  - `corepack pnpm run db:up`
  - `docker compose -f infra/docker/postgres.compose.yml ps`

### 2. migrate / bootstrap 失败

症状：

- `corepack pnpm run db:migrate`
- `corepack pnpm run db:bootstrap-dev`
  任一命令退出非 0

处理：

- 先单独重跑对应命令，看原始错误
- 确认 `DATABASE_URL` 未被外部环境改坏
- 默认应指向：
  - `postgres://hualala:hualala@127.0.0.1:5432/hualala?sslmode=disable`

### 3. backend 8080 未起来

症状：

- `http://127.0.0.1:8080/healthz` 不通
- 前端通过 Vite proxy 访问时报连接失败

处理：

- 单独执行 `node tooling/scripts/run-backend-dev.mjs`
- 查看 `go run ./apps/backend/cmd/api` 的启动错误
- 确认 `8080` 端口未被其他进程占用

### 4. admin / creator 起不来

症状：

- `4173` 或 `4174` 被占用
- Vite 直接退出

处理：

- 分别单独执行：
  - `corepack pnpm --filter @hualala/admin exec vite --host 127.0.0.1 --port 4173 --strictPort`
  - `corepack pnpm --filter @hualala/creator exec vite --host 127.0.0.1 --port 4174 --strictPort`
- 释放冲突端口后重试

### 5. Vite proxy 报 `ECONNREFUSED`

症状：

- 页面能打开，但请求 `/hualala.*`、`/upload`、`/sse` 时失败
- 控制台或终端出现指向 `127.0.0.1:8080` 的 `ECONNREFUSED`

处理：

- 先确认 backend health 是否正常：
  - `http://127.0.0.1:8080/healthz`
- 再确认 admin / creator 的 proxy 目标没有被改动：
  - `apps/admin/vite.config.ts`
  - `apps/creator/vite.config.ts`

## 验收命令

仓库级真实验收入口保持不变：

```bash
corepack pnpm run test:e2e:phase1:real
```

如果只想验证 tooling / 契约层：

```bash
corepack pnpm run test:tooling
```
