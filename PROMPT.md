# CampusFlow — Master Build Prompt

> Design section. These rules slot into the master prompt right after the
> existing design principles (the part that already points the agent at
> Dribbble). They make design research an explicit *search → inspect →
> compare → rate → select → extract* process, add a design quality gate per
> screen, and forbid falling back on a generic Tailwind/shadcn dashboard
> template for the final design.

============================================================
DESIGN RESEARCH, RATING & SELECTION
============================================================

DO NOT design CampusFlow screens blindly.

DO NOT use a generic Tailwind/shadcn dashboard template as the final design
simply because it is convenient. A template that technically satisfies the
requirements is NOT acceptable — the goal is a polished, original CampusFlow
interface built on the CampusFlow design system.

Before implementing the UI for any major feature, perform design research
using Dribbble and other high-quality design references available to you.

Use Dribbble as the PRIMARY source of visual inspiration.

Search specifically for the type of interface you are about to build.

Examples:

- campus dashboard
- university dashboard
- student dashboard
- campus navigation
- indoor navigation
- map application
- queue management dashboard
- appointment booking
- administrative dashboard
- mobile navigation
- QR scanner interface
- AI assistant mobile app
- notification center
- timetable application
- room booking application
- analytics dashboard

For EACH major screen:

1. Search for several relevant professional designs.
2. Inspect the designs rather than selecting the first result.
3. Compare them based on:

   - visual quality
   - usability
   - information hierarchy
   - navigation clarity
   - spacing
   - typography
   - color system
   - responsiveness
   - mobile usability
   - accessibility
   - interaction design
   - animation opportunities
   - suitability for CampusFlow

4. Give each candidate design/reference a score from 1–10.

Example:

Design A
Visual quality: 9/10
Usability: 8/10
Information hierarchy: 9/10
Mobile suitability: 7/10
CampusFlow suitability: 9/10
Overall: 8.4/10

Design B
Visual quality: 8/10
Usability: 9/10
Information hierarchy: 8/10
Mobile suitability: 9/10
CampusFlow suitability: 8/10
Overall: 8.4/10

5. Select the strongest design direction.

6. DO NOT copy the selected design.

Instead, extract its best design principles and create an ORIGINAL
CampusFlow interface.

============================================================
DESIGN QUALITY GATE
============================================================

Before considering a screen complete, evaluate it against the following:

Visual hierarchy
★★★★★
Usability
★★★★★
Consistency
★★★★★
Responsiveness
★★★★★
Accessibility
★★★★★
Information clarity
★★★★★
Interaction quality
★★★★★
CampusFlow relevance
★★★★★

Target average:

8/10 or higher.

If the screen does not reach this standard, improve it before moving on.

============================================================
FEATURE-SPECIFIC DESIGN RESEARCH
============================================================

Do NOT use the same dashboard layout for every role.

STUDENT:

Research:
- student dashboards
- navigation apps
- map interfaces
- mobile education apps
- queue/ticket interfaces
- AI assistant interfaces

STAFF:

Research:
- operations dashboards
- queue management systems
- appointment dashboards
- real-time monitoring interfaces

ADMIN:

Research:
- enterprise dashboards
- analytics dashboards
- infrastructure management
- map administration interfaces

NAVIGATION:

Research:
- Google Maps-style navigation
- indoor navigation
- wayfinding
- floor navigation
- live location interfaces

QUEUE:

Research:
- queue management
- appointment booking
- ticket systems
- live status interfaces

ADMINISTRATIVE OFFICES:

Research:
- appointment scheduling
- service-center queue systems
- government service portals
- hospital appointment/queue interfaces

AI ASSISTANT:

Research:
- modern AI chat interfaces
- contextual assistants
- mobile AI assistants
- action-oriented conversational UI

============================================================
IMPORTANT
============================================================

The purpose of design research is NOT to reproduce another application.

The goal is:

BEST DESIGN PRINCIPLES
        +
CAMPUSFLOW REQUIREMENTS
        +
GOOD UX
        +
ORIGINAL VISUAL IDENTITY
        =
CAMPUSFLOW DESIGN

============================================================
NO GENERIC TEMPLATES
============================================================

Do not use a generic Tailwind/shadcn dashboard template as the final design
simply because it is convenient.

An AI coding agent can technically satisfy the requirements while producing
something like:

┌─────────────────────────────────────┐
│ Sidebar │ Dashboard                 │
│         │ ┌─────┐ ┌─────┐ ┌─────┐ │
│ Home    │ │ 120 │ │ 45  │ │ 12  │ │
│ Users   │ └─────┘ └─────┘ └─────┘ │
│ Rooms   │                           │
│ Queue   │      Generic Table        │
│ Settings│                           │
└─────────────────────────────────────┘

That's functional, but NOT the polished CampusFlow product we want.

The agent should instead research the appropriate design for every major
feature, rate the references, extract the strongest ideas, and then create an
original interface around the CampusFlow design system.
