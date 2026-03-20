BEGIN;

CREATE TABLE model_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    model_name text NOT NULL,
    capability_type text NOT NULL,
    region text NOT NULL,
    supported_input_locales text[] NOT NULL DEFAULT '{}'::text[],
    supported_output_locales text[] NOT NULL DEFAULT '{}'::text[],
    pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    rate_limit_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT model_profiles_provider_model_region_capability_unique UNIQUE (provider, model_name, region, capability_type),
    CONSTRAINT model_profiles_provider_not_blank CHECK (btrim(provider) <> ''),
    CONSTRAINT model_profiles_model_name_not_blank CHECK (btrim(model_name) <> ''),
    CONSTRAINT model_profiles_capability_type_valid CHECK (capability_type IN ('text', 'image', 'video', 'audio')),
    CONSTRAINT model_profiles_region_not_blank CHECK (btrim(region) <> ''),
    CONSTRAINT model_profiles_status_valid CHECK (status IN ('active', 'paused', 'archived'))
);

CREATE TABLE prompt_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_family text NOT NULL,
    template_key text NOT NULL,
    locale text NOT NULL,
    version integer NOT NULL,
    content text NOT NULL,
    input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT prompt_templates_key_locale_version_unique UNIQUE (template_key, locale, version),
    CONSTRAINT prompt_templates_family_not_blank CHECK (btrim(template_family) <> ''),
    CONSTRAINT prompt_templates_key_not_blank CHECK (btrim(template_key) <> ''),
    CONSTRAINT prompt_templates_locale_not_blank CHECK (btrim(locale) <> ''),
    CONSTRAINT prompt_templates_version_positive CHECK (version > 0),
    CONSTRAINT prompt_templates_content_not_blank CHECK (btrim(content) <> ''),
    CONSTRAINT prompt_templates_status_valid CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE INDEX idx_model_profiles_provider_status ON model_profiles (provider, status);
CREATE INDEX idx_model_profiles_capability_status ON model_profiles (capability_type, status);
CREATE INDEX idx_prompt_templates_family_status ON prompt_templates (template_family, status);
CREATE INDEX idx_prompt_templates_key_locale ON prompt_templates (template_key, locale);

COMMIT;
