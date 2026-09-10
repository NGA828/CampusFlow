-- CampusFlow · 005_office
-- Administrative office ticketing: a service workflow, intentionally modelled separately
-- from room admission queues (PROMPT §24, §25) because the business rules differ:
-- service windows, per-window capacity, appointments, expected service time and staff
-- assignment.

CREATE TABLE IF NOT EXISTS administrative_offices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    TEXT NOT NULL UNIQUE,
    name                    TEXT NOT NULL,
    description             TEXT,
    building_id             UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id                UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_id                 UUID REFERENCES rooms(id) ON DELETE SET NULL,
    ticket_prefix           TEXT NOT NULL,
    service_duration_minutes INTEGER NOT NULL DEFAULT 10 CHECK (service_duration_minutes > 0),
    concurrent_capacity     INTEGER NOT NULL DEFAULT 1 CHECK (concurrent_capacity > 0),
    daily_capacity          INTEGER NOT NULL DEFAULT 60 CHECK (daily_capacity > 0),
    check_in_radius_m       DOUBLE PRECISION NOT NULL DEFAULT 60 CHECK (check_in_radius_m > 0),
    grace_period_seconds    INTEGER NOT NULL DEFAULT 300 CHECK (grace_period_seconds >= 0),
    requires_proximity_to_request BOOLEAN NOT NULL DEFAULT false,
    requires_appointment    BOOLEAN NOT NULL DEFAULT false,
    contact_email           TEXT,
    contact_phone           TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_service_windows (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id           UUID NOT NULL REFERENCES administrative_offices(id) ON DELETE CASCADE,
    day_of_week         SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    opens_at            TIME NOT NULL,
    closes_at           TIME NOT NULL,
    capacity            INTEGER NOT NULL DEFAULT 10 CHECK (capacity > 0),
    avg_service_minutes INTEGER NOT NULL DEFAULT 10 CHECK (avg_service_minutes > 0),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (closes_at > opens_at)
);

CREATE INDEX IF NOT EXISTS office_service_windows_office_idx ON office_service_windows (office_id, day_of_week);

CREATE TABLE IF NOT EXISTS office_staff (
    office_id UUID NOT NULL REFERENCES administrative_offices(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'officer' CHECK (role IN ('officer', 'supervisor')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (office_id, user_id)
);

CREATE TABLE IF NOT EXISTS office_tickets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id           UUID NOT NULL REFERENCES administrative_offices(id) ON DELETE CASCADE,
    student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number       TEXT NOT NULL,
    sequence_no         INTEGER NOT NULL,
    position            INTEGER NOT NULL CHECK (position > 0),
    status              TEXT NOT NULL DEFAULT 'REQUESTED'
                        CHECK (status IN ('REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING',
                                          'CALLED', 'CHECK_IN_WINDOW', 'CHECKED_IN', 'IN_SERVICE',
                                          'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED')),
    subject             TEXT NOT NULL,
    notes               TEXT,
    priority            INTEGER NOT NULL DEFAULT 0,
    eta_seconds         INTEGER,
    window_starts_at    TIMESTAMPTZ,
    window_ends_at      TIMESTAMPTZ,
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at           TIMESTAMPTZ,
    check_in_deadline   TIMESTAMPTZ,
    checked_in_at       TIMESTAMPTZ,
    service_started_at  TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    no_show_at          TIMESTAMPTZ,
    expired_at          TIMESTAMPTZ,
    service_minutes     INTEGER,
    handled_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (office_id, sequence_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS office_tickets_one_active_per_student
    ON office_tickets (office_id, student_id)
    WHERE status IN ('REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING', 'CALLED',
                     'CHECK_IN_WINDOW', 'CHECKED_IN', 'IN_SERVICE');

CREATE UNIQUE INDEX IF NOT EXISTS office_tickets_unique_position
    ON office_tickets (office_id, position)
    WHERE status IN ('REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING', 'CALLED', 'CHECK_IN_WINDOW');

CREATE INDEX IF NOT EXISTS office_tickets_student_idx
    ON office_tickets (student_id)
    WHERE status IN ('REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING', 'CALLED',
                     'CHECK_IN_WINDOW', 'CHECKED_IN', 'IN_SERVICE');

CREATE INDEX IF NOT EXISTS office_tickets_status_idx ON office_tickets (office_id, status, position);

CREATE TABLE IF NOT EXISTS office_counters (
    office_id   UUID PRIMARY KEY REFERENCES administrative_offices(id) ON DELETE CASCADE,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    counter     INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_check_ins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES office_tickets(id) ON DELETE CASCADE,
    method      TEXT NOT NULL DEFAULT 'geofence' CHECK (method IN ('qr', 'geofence', 'staff', 'manual')),
    verified    BOOLEAN NOT NULL DEFAULT false,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    distance_m  DOUBLE PRECISION,
    qr_node_id  UUID REFERENCES qr_nodes(id) ON DELETE SET NULL,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_ticket_events (
    id         BIGSERIAL PRIMARY KEY,
    office_id  UUID NOT NULL REFERENCES administrative_offices(id) ON DELETE CASCADE,
    ticket_id  UUID REFERENCES office_tickets(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS office_ticket_events_office_idx ON office_ticket_events (office_id, created_at DESC);
