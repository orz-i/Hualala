# Migrations

本目录承载 Greenfield PostgreSQL 初始迁移。

规则：

- 编号固定为四位全仓单调递增
- 命名格式固定为 `NNNN_<domain>_<action>_<target>.sql`
- 时间字段统一使用 `timestamptz`
- 主键统一使用 `uuid`
- 不新增 `misc.sql`、`fix.sql`、`compat.sql`、`backfill.sql`

当前批次：

1. `0001_org_create_organizations_users_memberships_roles.sql`
2. `0002_project_create_projects_episodes_scenes.sql`
3. `0003_content_create_story_bibles_characters_scripts_storyboards_shots_snapshots.sql`
4. `0004_ai_create_model_profiles_prompt_templates.sql`
5. `0005_execution_create_context_bundles_shot_executions_shot_execution_runs.sql`
6. `0006_workflow_create_jobs_workflow_runs_workflow_steps_state_transitions_outbox.sql`
7. `0007_asset_create_import_batches_upload_sessions_upload_files_media_assets_media_asset_variants.sql`
8. `0008_asset_create_rights_records_import_batch_items_candidate_assets.sql`
9. `0009_review_create_evaluation_runs_shot_reviews.sql`
10. `0010_billing_create_usage_budget_billing.sql`

验证边界：

- 当前阶段优先保证文件可顺序执行、核心表字段和索引齐全
- 真正的数据库执行验证待本地 PostgreSQL 启动后补齐
