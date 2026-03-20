BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    display_name text NOT NULL,
    default_ui_locale text NOT NULL,
    default_content_locale text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT organizations_slug_unique UNIQUE (slug),
    CONSTRAINT organizations_default_ui_locale_not_blank CHECK (btrim(default_ui_locale) <> ''),
    CONSTRAINT organizations_default_content_locale_not_blank CHECK (btrim(default_content_locale) <> '')
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    display_name text NOT NULL,
    preferred_ui_locale text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_email_not_blank CHECK (btrim(email) <> ''),
    CONSTRAINT users_preferred_ui_locale_not_blank CHECK (btrim(preferred_ui_locale) <> '')
);

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_code text NOT NULL,
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT roles_organization_role_code_unique UNIQUE (organization_id, role_code),
    CONSTRAINT roles_role_code_not_blank CHECK (btrim(role_code) <> '')
);

CREATE TABLE memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
    membership_status text NOT NULL DEFAULT 'active',
    joined_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT memberships_organization_user_unique UNIQUE (organization_id, user_id),
    CONSTRAINT memberships_status_valid CHECK (membership_status IN ('invited', 'active', 'suspended', 'removed'))
);

CREATE TABLE role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT role_permissions_role_permission_unique UNIQUE (role_id, permission_code),
    CONSTRAINT role_permissions_permission_code_not_blank CHECK (btrim(permission_code) <> '')
);

CREATE INDEX idx_roles_organization_id ON roles (organization_id);
CREATE INDEX idx_memberships_user_id ON memberships (user_id);
CREATE INDEX idx_memberships_role_id ON memberships (role_id) WHERE role_id IS NOT NULL;
CREATE INDEX idx_memberships_status ON memberships (membership_status);
CREATE INDEX idx_role_permissions_permission_code ON role_permissions (permission_code);

COMMIT;
