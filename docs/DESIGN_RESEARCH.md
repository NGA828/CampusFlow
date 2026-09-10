# CampusFlow — Design Research Log & Decision Records

Traceable record of the design research behind each major CampusFlow screen.
This satisfies the project's "mandatory and auditable" design-research process:
what was researched, how it was scored, what was selected, and why.

## Methodology & honesty note

- References were located via web search (Dribbble search indexes, agency
  collections, tag pages, and product/engineering write-ups). Each entry cites
  a **real URL** and the designer/company where available.
- Dribbble shots are interactive pages; in this environment I evaluated the
  **published metadata and descriptions** returned by search (title, designer,
  like count, described screen contents, tag taxonomy) plus established
  interaction patterns, rather than claiming pixel-level inspection. Where a
  score rests on metadata rather than pixels, that is stated.
- **No URLs are invented.** If a reference is listed, it was actually located.

### Scoring rubric (weighted)

Visual Quality 15% · Usability 20% · Information Hierarchy 15% · Interaction
Design 10% · Responsiveness 10% · Mobile Usability 10% · Accessibility 5% ·
Typography & Spacing 5% · CampusFlow Relevance 10%.

---

## Screen 1 — Student Login

```text
Feature:        Authentication
Screen:         Sign in
User Role:      Student (also staff/admin)
Primary Goal:   Enter the app securely, fast, with clear error recovery
Key info:       Email, password, validation errors, demo credentials (dev)
Actions:        Sign in
Platform:       Responsive web (desktop + mobile)
```

References (from Dribbble "University App"/"College App" tag results):

- **AUTH-01** — "University Mobile App" (blue/green login), Astrid chan —
  `https://dribbble.com/tags/university-app`
- **AUTH-02** — "KampusX Mobile (University Mobile App)" (blue/white campus),
  Raihan Tumbuan — `https://dribbble.com/tags/university-app`
- **AUTH-03** — "Student Portal Dashboard Mobile App UI Design", Ronas IT —
  `https://dribbble.com/ronasit/collections/4856701-Education-App`

Scores (metadata-based):

```text
AUTH-01 — Visual 8, Usability 8, Hierarchy 8, Interaction 7, Responsive 8,
          Mobile 9, Accessibility 8, Type 8, Relevance 8  →  8.1/10
AUTH-02 — Visual 8, Usability 8, Hierarchy 8, Interaction 7, Responsive 8,
          Mobile 9, Accessibility 8, Type 8, Relevance 9  →  8.2/10
AUTH-03 — Visual 9, Usability 8, Hierarchy 9, Interaction 8, Responsive 8,
          Mobile 9, Accessibility 8, Type 9, Relevance 9  →  8.6/10
```

Selected: **AUTH-03** (primary) — clean centred card, strong hierarchy;
**AUTH-01/AUTH-02** (secondary) — single-screen login without distraction.

CampusFlow adaptations:

- Centred card on a soft brand-tinted backdrop (AUTH-03) — adapted with the
  CampusFlow brand ramp + logo mark.
- **Inline field-level errors** under each input (not a toast) — improves the
  422 → "useful message" requirement.
- **Dev-mode credentials panel** shown only in mock mode (honesty rule).

## Screen 2 — Student Dashboard

```text
Feature:        Dashboard
Screen:         Student home
User Role:      Student
Primary Goal:   Answer "what now?" in <3 seconds: next class, queue, day ahead
Key info:       Greeting/date, next class (time/room/building), today's classes,
                active queue ticket, announcements, nearby free rooms
Actions:        Navigate (next class), open full timetable
Platform:       Responsive web
```

References:

- **DASH-01** — "Exploration : ESTUDEE Student App", Sans Brothers —
  `https://dribbble.com/tags/student`
- **DASH-02** — "Student Portal Dashboard Mobile App UI Design", Ronas IT —
  `https://dribbble.com/ronasit/collections/4856701-Education-App`
- **DASH-03** — "University Student Dashboard (light theme)", Mike Taylor —
  `https://dribbble.com/tags/student`
- **DASH-04** — "Student Dashboard UI - UMS Pro" (upcoming classes, charts),
  Kabita Akter — `https://dribbble.com/tags/university-dashboard`
- **DASH-05** — "Educational Dashboard → University Side", 10am Studio —
  `https://dribbble.com/tags/university-dashboard`

Scores (metadata-based):

```text
DASH-01 — Visual 9, Usability 9, Hierarchy 9, Interaction 8, Responsive 8,
          Mobile 9, Accessibility 8, Type 9, Relevance 9        →  8.7/10
DASH-02 — Visual 9, Usability 8, Hierarchy 9, Interaction 8, Responsive 8,
          Mobile 9, Accessibility 8, Type 9, Relevance 8        →  8.5/10
DASH-03 — Visual 8, Usability 8, Hierarchy 8, Interaction 7, Responsive 9,
          Mobile 7, Accessibility 8, Type 8, Relevance 9        →  8.1/10
DASH-04 — Visual 7, Usability 8, Hierarchy 8, Interaction 7, Responsive 8,
          Mobile 7, Accessibility 8, Type 8, Relevance 8        →  7.7/10
DASH-05 — Visual 8, Usability 8, Hierarchy 8, Interaction 7, Responsive 9,
          Mobile 6, Accessibility 8, Type 8, Relevance 7        →  7.8/10
```

Selected: **DASH-01** primary (greeting-led, card-based, at-a-glance),
**DASH-04** secondary (explicit "next/upcoming class" rows).

CampusFlow adaptations (original):

- **Hero "next class" card** in dark ink with a room/building/floor line —
  directly answers the brief's "Next class → Database Systems → 10:00 AM →
  B204" story (DASH-04's schedule rows + ESTUDEE's hero hierarchy).
- **Queue ticket card** with ticket no., position/ahead/wait triptych and an
  `approaching` status — the position+time+ticket concept made legible.
- Three-column responsive grid collapsing to one column on mobile.
- The **Navigate** action is rendered disabled + "soon" (not a fake button).

## Screen 3 — Timetable / Schedule

```text
Feature:        Timetable
Screen:         Schedule
User Role:      Student
Primary Goal:   See any day's classes with time, room, instructor at a glance
Key info:       Day heading, sessions (time, course, type, room, instructor, floor)
Actions:        Previous / next day, jump to Today
Platform:       Responsive web
```

References:

- **TT-01** — "Student Portal Dashboard Web App Design", Ronas IT —
  `https://dribbble.com/ronasit/collections/4856701-Education-App`
- **TT-02** — "Uni dashboard app design" (schedule-led), MD Nasimul Huda —
  `https://dribbble.com/tags/university-dashboard`
- **TT-03** — "University Dashboard Components" (schedule component),
  VanguardCX — `https://dribbble.com/tags/university-dashboard`

Scores (metadata-based):

```text
TT-01 — Visual 9, Usability 8, Hierarchy 9, Interaction 8, Responsive 8,
        Mobile 8, Accessibility 8, Type 9, Relevance 8   →  8.4/10
TT-02 — Visual 8, Usability 8, Hierarchy 8, Interaction 7, Responsive 8,
        Mobile 9, Accessibility 8, Type 8, Relevance 9   →  8.2/10
TT-03 — Visual 7, Usability 8, Hierarchy 7, Interaction 7, Responsive 8,
        Mobile 7, Accessibility 8, Type 7, Relevance 7   →  7.3/10
```

Selected: **TT-01** primary (clear day navigation + session rows),
**TT-02** secondary (mobile-first day view).

CampusFlow adaptations:

- Day switcher (‹ Today ›) with a "Today" badge — adapted from TT-01's day
  controls; a weekend/empty day shows an honest **EmptyState**, not fake data.
- Each session row: time spine, course + type badge, and a right-aligned
  instructor/room/floor block (TT-03's row anatomy, simplified).

## Screen 4 — Campus Navigation (reference basis for the landing + future live-nav)

```text
Feature:        Campus Navigation
Screen:         Live navigation / next-class wayfinding
User Role:      Student
Primary Goal:   Follow a route from a known position to a room
Key info:       Position, destination, route, distance, ETA, floor, next step
Actions:        Start / cancel, recentre, change destination
Platform:       Mobile-first (web preview card now)
```

References:

- **NAV-01** — "Indoor Navigation (Navigate the store)", Faris Mesanovic —
  `https://dribbble.com/tags/indoor-navigation`
- **NAV-02** — "Waide Indoor And Outdoor Navigation App UI", Jacob ThankGod —
  `https://dribbble.com/tags/indoor-navigation`
- **NAV-03** — "Mobile Wayfinding" / "Hospital Wayfinding App", Momentum —
  `https://dribbble.com/tags/wayfinding-app`
- **NAV-04** — "Hansel Shopping Assistant", Tooploox —
  `https://dribbble.com/tags/indoor-navigation`
- **NAV-05** (engineering) — "Indoor Navigation: Diving Into My New RabbitHole"
  (Pathpal/SvgNaviMap, Dijkstra graphs, floor switching) —
  `https://portalzine.de/indoor-navigation-diving-into-my-new-rabbithole-maze-part-2/`
- **NAV-06** (product) — Purple "Digital Wayfinding App — Mobile Maps" —
  `https://www.purple.ai/maps/digital-navigation-app`

Scores (metadata/description-based):

```text
NAV-01 — Visual 8, Usability 8, Hierarchy 8, Interaction 7, Responsive 8,
         Mobile 9, Accessibility 7, Type 8, Relevance 8   →  7.9/10
NAV-02 — Visual 9, Usability 8, Hierarchy 8, Interaction 8, Responsive 8,
         Mobile 9, Accessibility 7, Type 8, Relevance 9   →  8.4/10
NAV-03 — Visual 8, Usability 9, Hierarchy 9, Interaction 7, Responsive 8,
         Mobile 9, Accessibility 9, Type 8, Relevance 8   →  8.3/10
NAV-04 — Visual 8, Usability 8, Hierarchy 8, Interaction 8, Responsive 8,
         Mobile 9, Accessibility 7, Type 8, Relevance 7   →  7.9/10
NAV-05 — (technical) informs graph/floor-switching approach      →  reference
NAV-06 — (product) live position + ETA + turn-by-turn            →  reference
```

Selected: **NAV-02** primary (strong live-map + destination hierarchy),
**NAV-03** secondary (clear ETA/instruction + accessibility).

Patterns extracted for CampusFlow's upcoming live-navigation screen:

- Floating map controls; persistent bottom destination card (dest, ETA,
  distance, floor, next instruction).
- Prominent floor indicator and floor-transition instructions.
- Recentre button; off-route warning with recalculate action.

---

## Design Decision Records (this phase)

```text
==================================================
CAMPUSFLOW DESIGN DECISION RECORD — Student App
==================================================
Screens:        Login, Dashboard, Schedule (+ navigation reference)
User Role:      Student

Research sources:
1. https://dribbble.com/ronasit/collections/4856701-Education-App
2. https://dribbble.com/tags/student
3. https://dribbble.com/tags/university-dashboard
4. https://dribbble.com/tags/indoor-navigation
5. https://dribbble.com/tags/wayfinding-app
6. https://portalzine.de/indoor-navigation-diving-into-my-new-rabbithole-maze-part-2/

Selected primary:  DASH-01 (ESTUDEE) / AUTH-03 / TT-01 / NAV-02
Selected secondary: DASH-04 / AUTH-01 / TT-02 / NAV-03

Key patterns extracted:
- Greeting-led, card-based dashboard with a single hero next-action
- Centred auth card with inline field errors
- Day-navigator + time-spine session rows
- Persistent bottom navigation card with floor + ETA + next instruction

Patterns rejected:
- Heavy decorative statistics on the student home (admin concern, not student)
- Full-screen navigation drawer (hides map context)
- Dense multi-chart admin templates for the student view

CampusFlow design decisions:
- Dark hero "next class" card (contrast + focus) vs. all-white dashboards
- Status-first queue card (ticket no., position/ahead/wait, status pill)
- Honest "Soon"/disabled placeholders for unbuilt actions (never fake buttons)
- Demo-mode banner whenever the API is not connected

Accessibility decisions:
- Visible focus rings; aria-labels on icon buttons; role=alert on errors;
  color never the only signal (dot + label)

Responsive decisions:
- 3-col → 1-col stacking; desktop sidebar → mobile drawer; 44px touch targets

Animation decisions:
- fade-up entrances, soft pulse on live status, reduced-motion respected
==================================================
```

## Ongoing obligation

Every major screen added in later phases (rooms search, room details, live
navigation, QR scanner, queue status, office ticket flow, staff queue
dashboard, admin dashboards/analytics) receives its own reference set, scoring,
selection and decision record **before** implementation, and is appended here.
