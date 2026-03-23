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

当前 `master` 的 backend 真实运行时已经切成 **原生 PostgreSQL runtime**：

- `DB_DRIVER=postgres` 时，`db.OpenStore(...)` 直接返回 Postgres-backed runtime store
- workflow / asset / execution / billing / auth 等主域状态不再 materialize 成进程内 `*db.MemoryStore`
- workflow 启动链默认经由 backend 自己的 runtime adapter 与 direct executor 装配，不再把生产路径直接绑到测试用的 `FakeAdapter` / `InMemoryExecutor`
- `/sse/events` 的 replay 真相层来自 Postgres durable event path，而不是单纯依赖进程内 publisher

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

该命令在真正启动前会先做固定端口预检：

- 检查 `127.0.0.1:8080`、`127.0.0.1:4173`、`127.0.0.1:4174` 是否空闲
- 任一端口已被占用时，`dev:real` 会直接失败退出，并打印端口占用信息
- 这样可以避免表面上启动成功，实际却连到旧 backend 或旧 Vite 进程

端口预检通过后，命令会顺序执行：

1. `corepack pnpm run db:up`
2. 等待 Postgres 就绪
3. `corepack pnpm run db:migrate`
4. `corepack pnpm run db:bootstrap-dev`
5. 启动 backend
6. 启动 admin Vite（4173）
7. 启动 creator Vite（4174）

注意：

- `dev:real` 不会自动注入 demo 数据
- 若 `8080`、`4173`、`4174` 任一端口已被占用，脚本会直接失败退出，而不是继续沿用旧进程
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
- 在输出 creator URL 前，额外执行一次 `GetShotWorkbench` 校验，确认 `shotId -> shotExecution` 可读回
- 如果校验失败，命令会直接非 0 退出，并明确提示可能连到了旧 backend 或错误数据库

## 成功判定

当以下地址都可访问时，说明本地真实联调已就绪：

- backend health：`http://127.0.0.1:8080/healthz`
- admin：`http://127.0.0.1:4173`
- creator：`http://127.0.0.1:4174`

执行 `corepack pnpm run dev:real:seed` 后，admin / creator 应能看到真实数据：

- Admin：
  - `http://127.0.0.1:4173/?projectId=...&shotExecutionId=...&orgId=...`
- Creator Shot：
  - `http://127.0.0.1:4174/shots?shotId=...`
- Creator Import：
  - `http://127.0.0.1:4174/imports?importBatchId=...`

兼容说明：

- legacy `http://127.0.0.1:4174/?shotId=...`
- legacy `http://127.0.0.1:4174/?importBatchId=...`

首次打开 legacy 深链时，creator 会自动 `replaceState` 到 canonical pathname。

如果要确认当前 backend 真的是“真实持久化运行时”，而不是旧的 snapshot-backed memory，可以额外做这组验证：

1. 启动 `corepack pnpm run dev:real`
2. 执行 `corepack pnpm run dev:real:seed`
3. 打开 admin / creator，确认能看到 seed 后的数据
4. 只重启 backend 进程，再刷新页面

正确结果：

- 项目、workflow、asset、shot execution 数据仍然存在
- `/sse/events` 用 `Last-Event-ID` replay 仍能补到重启前写入的事件

如果 backend 重启后数据消失，优先检查：

- `DB_DRIVER` 是否被外部环境改成了 `memory`
- `DATABASE_URL` 是否指到了错误库
- 启动脚本是否还是旧的 snapshot-backed 运行方式

## Backend 容器化基线

当前仓库已经提供最小 backend 容器入口：

- Dockerfile：`apps/backend/Dockerfile`
- 构建命令：

```bash
docker build -f apps/backend/Dockerfile -t hualala-backend .
```

- 运行命令示例：

```bash
docker run --rm -p 8080:8080 ^
  -e DB_DRIVER=postgres ^
  -e DATABASE_URL=postgres://hualala:hualala@host.docker.internal:5432/hualala?sslmode=disable ^
  -e AUTO_MIGRATE=true ^
  -e HTTP_ADDR=:8080 ^
  hualala-backend
```

容器 env contract 只收口这 4 个变量：

- `DB_DRIVER`
  - 默认值：`postgres`
  - 本地 / CI / 预发的真实运行时都应保持这个值
- `DATABASE_URL`
  - 镜像内不内置默认值，必须在运行时显式注入
  - 需要指向真实 Postgres
  - 本地默认：`postgres://hualala:hualala@127.0.0.1:5432/hualala?sslmode=disable`
- `AUTO_MIGRATE`
  - 默认：`true`
  - 若显式设为 `false`，容器只启动 API，不会自动跑 migration
- `HTTP_ADDR`
  - 默认：`:8080`
  - 容器侧仍保持 backend 监听 `8080`

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

### 2.1 backend 重启后数据看起来“丢了”

症状：

- admin / creator 刷新后回到空状态
- workflow / asset 列表在 backend 重启后消失

处理：

- 先确认不是连到了新的数据库：
  - 检查 `DATABASE_URL`
- 再确认 backend 不是跑在 memory driver：
  - 检查 `DB_DRIVER`
- 如果是容器启动，确认容器内也带了同样的 env contract，而不是只在宿主机终端里设置了变量

### 3. backend 8080 未起来

症状：

- `http://127.0.0.1:8080/healthz` 不通
- 前端通过 Vite proxy 访问时报连接失败

处理：

- 单独执行 `node tooling/scripts/run-backend-dev.mjs`
- 查看 `go run ./apps/backend/cmd/api` 的启动错误
- 确认 `8080` 端口未被其他进程占用

### 4. `dev:real` 一启动就报端口占用并退出

症状：

- `corepack pnpm run dev:real` 在 `db:up` 之前直接失败退出
- stderr 明确指出 `8080`、`4173`、`4174` 中某个端口已被占用

处理：

- 这属于预期保护，不是脚本误报
- 先结束旧 backend / 旧 Vite 进程，再重跑 `corepack pnpm run dev:real`
- 如果不确定命中的是哪套进程，以脚本输出的 PID / 命令行为准
- 只有端口全部空闲后，才应该继续 real 联调

### 5. `dev:real:seed` 报 `GetShotWorkbench` 校验失败

症状：

- `corepack pnpm run dev:real:seed` 非 0 退出
- stderr 包含 `GetShotWorkbench`、`shotId`、期望的 `shotExecutionId`
- 提示可能连接到了旧 backend 或错误数据库

处理：

- 先确认 `dev:real` 是当前终端刚拉起的进程，而不是命中了历史残留服务
- 再检查 `DATABASE_URL` 是否指向预期本地库
- 必要时清掉旧进程后重跑 `corepack pnpm run dev:real`，再执行 `corepack pnpm run dev:real:seed`

### 6. admin / creator 起不来

症状：

- `4173` 或 `4174` 被占用
- Vite 直接退出

处理：

- 分别单独执行：
  - `corepack pnpm --filter @hualala/admin exec vite --host 127.0.0.1 --port 4173 --strictPort`
  - `corepack pnpm --filter @hualala/creator exec vite --host 127.0.0.1 --port 4174 --strictPort`
- 释放冲突端口后重试

### 7. Vite proxy 报 `ECONNREFUSED`

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
