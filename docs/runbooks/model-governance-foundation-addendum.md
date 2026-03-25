# Model Governance Foundation Addendum

## Scope

- `proto/hualala/model/v1` is the shared contract for model governance.
- This foundation patch only adds contract, SDK public API, backend service/repository plumbing, mock fixtures, and permission catalog updates.
- Real provider wiring and automatic context bundle generation remain out of scope for this slice.

## Service Surface

- `ModelGovernanceService` exposes:
  - `ListModelProfiles`
  - `CreateModelProfile`
  - `UpdateModelProfile`
  - `SetModelProfileStatus`
  - `ListPromptTemplates`
  - `GetPromptTemplate`
  - `CreatePromptTemplateVersion`
  - `UpdatePromptTemplateDraft`
  - `SetPromptTemplateStatus`
  - `ListContextBundles`
  - `GetContextBundle`

## Business Rules

- `ModelProfile` supports `active`, `paused`, and `archived`.
- `PromptTemplate` creates new content through `CreatePromptTemplateVersion`.
- `UpdatePromptTemplateDraft` only applies to `draft` versions.
- Only one `active` prompt template is allowed for the same `template_key + locale`.
- `pricing_snapshot_json`, `rate_limit_policy_json`, `input_schema_json`, `output_schema_json`, and `payload_json` remain raw JSON strings in `model/v1`.

## Context Bundles

- `ContextBundle` is a read-only audit object in `model/v1`.
- This patch only supports list/detail access.
- `ContextBundle` exists to show which `ModelProfile` and `PromptTemplate` were actually used for a project or shot execution, plus source snapshot and referenced asset scope.
