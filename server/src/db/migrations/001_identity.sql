-- CampusFlow · 001_identity
-- Identity, roles, permissions and access tokens.
-- Roles are fixed in code (RBAC matrix); staff scope is data-driven.

CREATE TABLE IF NOT EXISTS roles (
    code        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    rank        SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_code       TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
    PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    email             TEXT NOT NULL,
    password_hash     TEXT NOT NULL,
    role_code         TEXT NOT NULL REFERENCES roles(code),
    status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    registration_no   TEXT,
    department        TEXT,
    phone             TEXT,
    avatar_url        TEXT,
    locale            TEXT NOT NULL DEFAULT 'en',
    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_registration_no_key ON users (registration_no) WHERE registration_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role_code);

-- Sanctum-style personal access tokens: only a hash is persisted.
CREATE TABLE IF NOT EXISTS api_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT 'web',
    token_hash   TEXT NOT NULL UNIQUE,
    abilities    JSONB NOT NULL DEFAULT '[]'::jsonb,
    device       TEXT,
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_tokens_user_idx ON api_tokens (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scoped staff authorization: which buildings / rooms / offices a staff member may operate.
CREATE TABLE IF NOT EXISTS staff_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_type  TEXT NOT NULL CHECK (scope_type IN ('building', 'room', 'office', 'queue')),
    scope_id    UUID NOT NULL,
    role_in_scope TEXT NOT NULL DEFAULT 'operator',
    can_manage_timetable BOOLEAN NOT NULL DEFAULT false,
    can_publish_content BOOLEAN NOT NULL DEFAULT false,
    can_call_tickets     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip          TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deterministic great-circle distance used by geofencing, navigation and analytics.
-- PostGIS (when installed) provides the same value through ST_Distance on geography;
-- this implementation keeps behaviour identical on plain PostgreSQL.
CREATE OR REPLACE FUNCTION cf_distance_m(
    lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
    SELECT 6371000.0 * 2 * asin(
        sqrt(
            power(sin(radians(lat2 - lat1) / 2), 2) +
            cos(radians(lat1)) * cos(radians(lat2)) *
            power(sin(radians(lng2 - lng1) / 2), 2)
        )
    );
$$ LANGUAGE sql IMMUTABLE;
