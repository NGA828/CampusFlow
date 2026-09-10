-- CampusFlow · 002_campus
-- Campus infrastructure: buildings, floors, rooms, QR anchors, navigation graph, geofences.
-- Spatial storage strategy: canonical WGS84 latitude/longitude + floor-plan coordinates
-- (metres, floor-local) on every spatial entity. When the PostGIS extension is available
-- the same rows are enriched with indexed geography columns (see the guarded block below),
-- so ST_* operators can be used in analytical queries without changing the application
-- contract.

CREATE TABLE IF NOT EXISTS buildings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    description   TEXT,
    campus_name   TEXT NOT NULL DEFAULT 'Northfield University',
    address       TEXT,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    footprint     JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of [lng, lat] ring points
    has_elevator  BOOLEAN NOT NULL DEFAULT false,
    is_public     BOOLEAN NOT NULL DEFAULT true,
    opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL DEFAULT 'operational'
                  CHECK (status IN ('operational', 'limited', 'closed', 'maintenance')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buildings_lat_lng_idx ON buildings (lat, lng);

CREATE TABLE IF NOT EXISTS floors (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id    UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    level          INTEGER NOT NULL,
    name           TEXT NOT NULL,
    plan_width     DOUBLE PRECISION NOT NULL DEFAULT 60,
    plan_height    DOUBLE PRECISION NOT NULL DEFAULT 40,
    plan_units     TEXT NOT NULL DEFAULT 'm',
    plan_image_url TEXT,
    elevation_m    DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (building_id, level)
);

CREATE INDEX IF NOT EXISTS floors_building_idx ON floors (building_id, level);

CREATE TABLE IF NOT EXISTS rooms (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id       UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id          UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    code              TEXT NOT NULL,
    name              TEXT NOT NULL,
    room_type         TEXT NOT NULL DEFAULT 'study'
                      CHECK (room_type IN ('lecture', 'lab', 'study', 'office', 'library',
                                           'auditorium', 'meeting', 'service', 'other')),
    capacity          INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    description       TEXT,
    requires_admission BOOLEAN NOT NULL DEFAULT false,
    admission_policy  JSONB NOT NULL DEFAULT '{}'::jsonb,
    plan_x            DOUBLE PRECISION NOT NULL DEFAULT 0,
    plan_y            DOUBLE PRECISION NOT NULL DEFAULT 0,
    plan_w            DOUBLE PRECISION NOT NULL DEFAULT 6,
    plan_h            DOUBLE PRECISION NOT NULL DEFAULT 6,
    lat               DOUBLE PRECISION,
    lng               DOUBLE PRECISION,
    amenities         JSONB NOT NULL DEFAULT '[]'::jsonb,
    accessibility     JSONB NOT NULL DEFAULT '[]'::jsonb,
    status            TEXT NOT NULL DEFAULT 'available'
                      CHECK (status IN ('available', 'occupied', 'restricted', 'maintenance', 'closed')),
    photo_url         TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (building_id, code)
);

CREATE INDEX IF NOT EXISTS rooms_floor_idx ON rooms (floor_id);
CREATE INDEX IF NOT EXISTS rooms_type_idx ON rooms (room_type);
CREATE INDEX IF NOT EXISTS rooms_capacity_idx ON rooms (capacity);
CREATE INDEX IF NOT EXISTS rooms_code_lower_idx ON rooms (lower(code));

-- Weekly availability rules used by the availability engine.
CREATE TABLE IF NOT EXISTS room_availability_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Monday
    opens_at    TIME NOT NULL,
    closes_at   TIME NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'open' CHECK (kind IN ('open', 'closed', 'reserved')),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_availability_rules_room_idx ON room_availability_rules (room_id, day_of_week);

-- QR anchors: a scanned code resolves to a known, server-validated indoor position.
CREATE TABLE IF NOT EXISTS qr_nodes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id    UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_id     UUID REFERENCES rooms(id) ON DELETE SET NULL,
    nav_node_id UUID,
    plan_x      DOUBLE PRECISION NOT NULL DEFAULT 0,
    plan_y      DOUBLE PRECISION NOT NULL DEFAULT 0,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    secret      TEXT NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    scans_count INTEGER NOT NULL DEFAULT 0,
    last_scanned_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS navigation_nodes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT NOT NULL UNIQUE,
    label         TEXT NOT NULL,
    building_id   UUID REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id      UUID REFERENCES floors(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL DEFAULT 'corridor'
                  CHECK (kind IN ('corridor', 'junction', 'entrance', 'exit', 'stairs',
                                  'elevator', 'room', 'outdoor', 'qr', 'service')),
    plan_x        DOUBLE PRECISION,
    plan_y        DOUBLE PRECISION,
    lat           DOUBLE PRECISION,
    lng           DOUBLE PRECISION,
    is_accessible BOOLEAN NOT NULL DEFAULT true,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navigation_nodes_floor_idx ON navigation_nodes (floor_id);
CREATE INDEX IF NOT EXISTS navigation_nodes_building_idx ON navigation_nodes (building_id);

CREATE TABLE IF NOT EXISTS navigation_edges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id  UUID NOT NULL REFERENCES navigation_nodes(id) ON DELETE CASCADE,
    to_node_id    UUID NOT NULL REFERENCES navigation_nodes(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL DEFAULT 'corridor'
                  CHECK (kind IN ('corridor', 'stairs', 'elevator', 'ramp', 'door', 'outdoor', 'service')),
    distance_m    DOUBLE PRECISION NOT NULL CHECK (distance_m >= 0),
    bidirectional BOOLEAN NOT NULL DEFAULT true,
    is_accessible BOOLEAN NOT NULL DEFAULT true,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    floor_change  BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_node_id <> to_node_id),
    UNIQUE (from_node_id, to_node_id, kind)
);

CREATE INDEX IF NOT EXISTS navigation_edges_from_idx ON navigation_edges (from_node_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS navigation_edges_to_idx ON navigation_edges (to_node_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS geofences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('room', 'office', 'building', 'qr_node')),
    target_id   UUID NOT NULL,
    center_lat  DOUBLE PRECISION,
    center_lng  DOUBLE PRECISION,
    radius_m    DOUBLE PRECISION NOT NULL CHECK (radius_m > 0),
    purpose     TEXT NOT NULL DEFAULT 'presence'
                CHECK (purpose IN ('presence', 'queue_join', 'check_in', 'navigation')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geofences_target_idx ON geofences (target_type, target_id);

-- Current position only. CampusFlow deliberately keeps no continuous location history:
-- the row is upserted per user and carries an expiry, so stale positions are ignored by
-- the geofence engine instead of accumulating a movement trail.
CREATE TABLE IF NOT EXISTS user_positions (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    accuracy_m  DOUBLE PRECISION,
    source      TEXT NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'gps', 'manual', 'simulated')),
    qr_node_id  UUID REFERENCES qr_nodes(id) ON DELETE SET NULL,
    nav_node_id UUID REFERENCES navigation_nodes(id) ON DELETE SET NULL,
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    floor_id    UUID REFERENCES floors(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes'
);

-- PostGIS enrichment. Applied only when the extension is present; the application never
-- depends on it for correctness, but analytical and spatial queries may use ST_* columns.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') THEN
        CREATE EXTENSION IF NOT EXISTS postgis;
        ALTER TABLE buildings ADD COLUMN IF NOT EXISTS geom geography(Polygon, 4326);
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
        ALTER TABLE navigation_nodes ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
        ALTER TABLE geofences ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
        CREATE INDEX IF NOT EXISTS buildings_geom_idx ON buildings USING gist (geom);
        CREATE INDEX IF NOT EXISTS rooms_geom_idx ON rooms USING gist (geom);
        CREATE INDEX IF NOT EXISTS navigation_nodes_geom_idx ON navigation_nodes USING gist (geom);
        CREATE INDEX IF NOT EXISTS geofences_geom_idx ON geofences USING gist (geom);
    END IF;
END $$;
