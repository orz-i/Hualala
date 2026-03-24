# Phase 2 Collaboration Demo

## 范围

- creator 使用 `/collab?projectId=<id>&shotId=<id>` 进入协同工作台。
- admin 使用 `/collaboration?projectId=<id>&shotExecutionId=<id>&shotId=<id>` 做只读协同观测。
- 当前验收只覆盖 presence、锁持有人、draft version、续租/释放反馈和 admin 同步观测。
- 当前真实 backend 验收不包含 collaboration；该线继续停留在 mock acceptance。

## 本地验证

```powershell
corepack pnpm --filter @hualala/creator test
corepack pnpm --filter @hualala/admin test
corepack pnpm run build
corepack pnpm run test:e2e:phase2:collaboration
corepack pnpm run test:e2e:phase2
corepack pnpm run test:tooling
```

## 演示流程

1. 打开 creator：`http://127.0.0.1:4174/collab?projectId=project-live-1&shotId=shot-collab-1`
2. 点击“进入开发会话”，确认页面显示当前锁持有人、draftVersion 和在线成员数。
3. 在“续租 draftVersion”中输入新的版本号，例如 `11`，点击“续租并声明编辑”。
4. 确认页面反馈“协同租约已续期”，并且锁持有人切换为当前用户、draftVersion 变为 `11`。
5. 打开 admin：`http://127.0.0.1:4173/collaboration?projectId=project-live-1&shotExecutionId=shot-exec-live-1&shotId=shot-collab-1`
6. 确认 admin 页面能看到同一个 `shot-collab-1` 的锁状态、draftVersion 和 presence 计数。

## 失败排查

- 如果 creator 进入 `/collab` 后一直停在 loading，先查 `ContentService/GetCollaborationSession` 是否返回了完整 `session.session_id / owner_id / presences`。
- 如果 creator 点击续租后没有反馈，先查 `ContentService/UpsertCollaborationLease` 是否返回成功，以及页面是否拿到了更新后的 `draft_version`。
- 如果 admin 看不到与 creator 一致的锁状态，先查 mock fixture 是否复用了同一份 collaboration state，而不是每次 route 命中都重新建状态。
- 如果 presence 数量异常，先查 payload 中 `session.presences` 是否带了稳定的 `presence_id / user_id / lease_expires_at`。
