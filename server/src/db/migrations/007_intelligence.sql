-- CampusFlow · 007_intelligence
-- Live navigation sessions, AI assistant conversations and request idempotency.

CREATE TABLE IF NOT EXISTS navigation_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_node_id      UUID REFERENCES navigation_nodes(id) ON DELETE SET NULL,
    destination_node_id UUID REFERENCES navigation_nodes(id) ON DELETE SET NULL,
    destination_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    destination_label   TEXT NOT NULL,
    requires_accessible BOOLEAN NOT NULL DEFAULT false,
    route               JSONB NOT NULL,
    distance_m          DOUBLE PRECISION NOT NULL,
    duration_seconds    INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'arrived', 'completed', 'abandoned', 'expired')),
    current_step_index  INTEGER NOT NULL DEFAULT 0,
    off_route_events    INTEGER NOT NULL DEFAULT 0,
    recalculations      INTEGER NOT NULL DEFAULT 0,
    last_position       JSONB,
    last_position_at    TIMESTAMPTZ,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navigation_sessions_user_idx ON navigation_sessions (user_id, status);

CREATE TABLE IF NOT EXISTS navigation_events (
    id         BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES navigation_sessions(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Off-route state is persisted so a deviation survives a page reload instead of being
-- silently treated as abandonment (PROMPT §16).
CREATE TABLE IF NOT EXISTS navigation_deviations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL REFERENCES navigation_sessions(id) ON DELETE CASCADE,
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    detections       INTEGER NOT NULL DEFAULT 1,
    max_distance_m   DOUBLE PRECISION NOT NULL DEFAULT 0,
    resolved_at      TIMESTAMPTZ,
    resolution       TEXT,
    status           TEXT NOT NULL DEFAULT 'grace' CHECK (status IN ('grace', 'recalculating', 'resolved', 'escalated'))
);

CREATE TABLE IF NOT EXISTS ai_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
    content         TEXT NOT NULL,
    intent          TEXT,
    tool_calls      JSONB NOT NULL DEFAULT '[]'::jsonb,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider        TEXT,
    model           TEXT,
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx ON ai_messages (conversation_id, created_at);

-- Idempotency for mutation endpoints (PROMPT §39): a retried request replays the stored
-- response instead of creating a second ticket.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key          TEXT PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint     TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status_code  INTEGER NOT NULL,
    response     JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expiry_idx ON idempotency_keys (expires_at);
