-- CampusFlow · 003_academic
-- Academic foundation: courses, enrolments and the master timetable that personalised
-- timetables are derived from.

CREATE TABLE IF NOT EXISTS terms (
    code       TEXT PRIMARY KEY,             -- e.g. '2026-FALL'
    name       TEXT NOT NULL,
    starts_on  DATE NOT NULL,
    ends_on    DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT,
    credits     INTEGER NOT NULL DEFAULT 3 CHECK (credits > 0),
    department  TEXT NOT NULL,
    level       TEXT NOT NULL DEFAULT 'undergraduate'
                CHECK (level IN ('foundation', 'undergraduate', 'postgraduate')),
    colour      TEXT NOT NULL DEFAULT '#2F4FE3',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_staff (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'lecturer' CHECK (role IN ('lecturer', 'assistant', 'coordinator')),
    PRIMARY KEY (course_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    term_code  TEXT NOT NULL REFERENCES terms(code) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'waitlisted', 'dropped', 'completed')),
    group_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, course_id, term_code)
);

CREATE INDEX IF NOT EXISTS enrollments_student_idx ON enrollments (student_id, term_code);

CREATE TABLE IF NOT EXISTS timetable_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    room_id      UUID REFERENCES rooms(id) ON DELETE SET NULL,
    staff_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    term_code    TEXT NOT NULL REFERENCES terms(code) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    starts_at    TIME NOT NULL,
    ends_at      TIME NOT NULL,
    session_type TEXT NOT NULL DEFAULT 'lecture'
                 CHECK (session_type IN ('lecture', 'lab', 'tutorial', 'seminar', 'exam')),
    week_pattern TEXT NOT NULL DEFAULT 'all' CHECK (week_pattern IN ('all', 'odd', 'even')),
    group_code   TEXT,
    notes        TEXT,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    UNIQUE (course_id, term_code, day_of_week, starts_at)
);

CREATE INDEX IF NOT EXISTS timetable_entries_room_idx ON timetable_entries (room_id, day_of_week);
CREATE INDEX IF NOT EXISTS timetable_entries_staff_idx ON timetable_entries (staff_id, day_of_week);
