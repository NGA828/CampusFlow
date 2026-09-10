-- CampusFlow · 004_queue
-- Controlled room admission queues.
--
-- Concurrency contract (PROMPT §21): ticket issuance and every state transition run inside
-- a database transaction. The queue row is locked with SELECT ... FOR UPDATE before the
-- next position is allocated, and the partial unique indexes below make duplicate active
-- tickets by construction impossible — even if two requests interleave.
--
-- Ghost-ticket prevention (PROMPT §20): joining requires a verified proximity fix when
-- requires_proximity_to_join is set, and a student may only hold one active ticket per
-- queue plus a hard ceiling of active tickets across the campus.

CREATE TABLE IF NOT EXISTS room_queues (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id                   UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
    is_active                 BOOLEAN NOT NULL DEFAULT true,
    max_size                  INTEGER NOT NULL DEFAULT 40 CHECK (max_size > 0),
    waitlist_limit            INTEGER NOT NULL DEFAULT 60 CHECK (waitlist_limit > 0),
    admission_capacity        INTEGER NOT NULL DEFAULT 1 CHECK (admission_capacity > 0),
    avg_service_seconds       INTEGER NOT NULL DEFAULT 300 CHECK (avg_service_seconds > 0),
    proximity_radius_m        DOUBLE PRECISION NOT NULL DEFAULT 120 CHECK (proximity_radius_m > 0),
    requires_proximity_to_join BOOLEAN NOT NULL DEFAULT false,
    check_in_window_seconds   INTEGER NOT NULL DEFAULT 300 CHECK (check_in_window_seconds > 0),
    grace_period_seconds      INTEGER NOT NULL DEFAULT 180 CHECK (grace_period_seconds >= 0),
    max_active_tickets_per_student INTEGER NOT NULL DEFAULT 3 CHECK (max_active_tickets_per_student > 0),
    opens_at                  TIME,
    closes_at                 TIME,
    notes                     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active statuses share one predicate so the partial indexes stay in sync with the
-- application state machine.
--   QUEUE_PENDING · WAITING · CALLED · NAVIGATING · APPROACHING · CHECK_IN_WINDOW ·
--   CHECKED_IN · ADMITTED   (terminal: COMPLETED · NO_SHOW · CANCELLED · EXPIRED)
CREATE TABLE IF NOT EXISTS queue_tickets (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id           UUID NOT NULL REFERENCES room_queues(id) ON DELETE CASCADE,
    room_id            UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number      TEXT NOT NULL,
    sequence_no        INTEGER NOT NULL,
    position           INTEGER NOT NULL CHECK (position > 0),
    status             TEXT NOT NULL DEFAULT 'WAITING'
                       CHECK (status IN ('QUEUE_PENDING', 'WAITING', 'CALLED', 'NAVIGATING',
                                         'APPROACHING', 'CHECK_IN_WINDOW', 'CHECKED_IN',
                                         'ADMITTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED')),
    priority           INTEGER NOT NULL DEFAULT 0,
    eta_seconds        INTEGER,
    issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at          TIMESTAMPTZ,
    check_in_deadline  TIMESTAMPTZ,
    checked_in_at      TIMESTAMPTZ,
    admitted_at        TIMESTAMPTZ,
    no_show_at         TIMESTAMPTZ,
    cancelled_at       TIMESTAMPTZ,
    expired_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    join_distance_m    DOUBLE PRECISION,
    join_source        TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (queue_id, sequence_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS queue_tickets_one_active_per_student
    ON queue_tickets (queue_id, student_id)
    WHERE status IN ('QUEUE_PENDING', 'WAITING', 'CALLED', 'NAVIGATING', 'APPROACHING', 'CHECK_IN_WINDOW', 'CHECKED_IN', 'ADMITTED');

-- Position is a property of the *line*, so only line statuses participate: a student who
-- has checked in or been admitted leaves the line and no longer reserves a position.
CREATE UNIQUE INDEX IF NOT EXISTS queue_tickets_unique_position
    ON queue_tickets (queue_id, position)
    WHERE status IN ('QUEUE_PENDING', 'WAITING', 'CALLED', 'NAVIGATING', 'APPROACHING', 'CHECK_IN_WINDOW');

CREATE INDEX IF NOT EXISTS queue_tickets_student_active_idx
    ON queue_tickets (student_id)
    WHERE status IN ('QUEUE_PENDING', 'WAITING', 'CALLED', 'NAVIGATING', 'APPROACHING', 'CHECK_IN_WINDOW', 'CHECKED_IN', 'ADMITTED');

CREATE INDEX IF NOT EXISTS queue_tickets_queue_status_idx ON queue_tickets (queue_id, status, position);

-- Monotonic per-queue numbering, allocated under the queue row lock.
CREATE TABLE IF NOT EXISTS queue_counters (
    queue_id    UUID PRIMARY KEY REFERENCES room_queues(id) ON DELETE CASCADE,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    counter     INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_check_ins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES queue_tickets(id) ON DELETE CASCADE,
    method      TEXT NOT NULL DEFAULT 'geofence' CHECK (method IN ('qr', 'geofence', 'staff', 'manual')),
    verified    BOOLEAN NOT NULL DEFAULT false,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    distance_m  DOUBLE PRECISION,
    qr_node_id  UUID REFERENCES qr_nodes(id) ON DELETE SET NULL,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS queue_check_ins_ticket_idx ON queue_check_ins (ticket_id);

-- Append-only event log: drives realtime fan-out, analytics and audit.
CREATE TABLE IF NOT EXISTS queue_events (
    id         BIGSERIAL PRIMARY KEY,
    queue_id   UUID NOT NULL REFERENCES room_queues(id) ON DELETE CASCADE,
    ticket_id  UUID REFERENCES queue_tickets(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS queue_events_queue_idx ON queue_events (queue_id, created_at DESC);
