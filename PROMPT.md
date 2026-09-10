# CAMPUSFLOW — COMPLETE MASTER DEVELOPMENT PROMPT

You are the lead software architect, senior full-stack engineer, UI/UX designer, QA engineer, database architect, and technical product engineer responsible for building the complete CampusFlow application.

============================================================
1. PROJECT IDENTITY
============================================================

Product Name:
CampusFlow

Tagline:
Navigate. Learn. Connect.

Full Product Description:
CampusFlow — An Intelligent Campus Management, Navigation and Student Services Platform

CampusFlow is a smart campus platform that combines:

- Authentication and role-based access control
- Personalized student timetable management
- Campus map and spatial management
- QR-assisted indoor positioning
- Indoor/outdoor navigation
- Live location tracking
- Room search and availability
- Room admission queues
- Administrative office ticketing and queue management
- Real-time notifications
- Events and announcements
- AI Campus Assistant
- Staff dashboards
- Administrator dashboards
- Campus infrastructure management
- Spatial campus configuration
- Analytics

The system must be designed as a real, production-quality application and not as a basic academic CRUD demonstration.

============================================================
2. CORE PRODUCT PRINCIPLE
============================================================

CampusFlow must solve real campus problems.

The application should help students:

1. Know where they need to be.
2. Know when they need to be there.
3. Know how to get there.
4. Find rooms and facilities.
5. Determine room availability.
6. Request access to rooms where required.
7. Manage admission queues.
8. Visit administrative offices without unnecessary waiting.
9. Receive notifications at the correct time.
10. Interact naturally with campus services through an AI assistant.

The system must prioritize:

- correctness
- reliability
- usability
- security
- responsiveness
- real-time behavior
- scalability
- maintainability
- accessibility
- professional UI/UX

============================================================
3. DEVELOPMENT PHILOSOPHY
============================================================

Do NOT treat this as a simple CRUD project.

Do NOT generate thousands of files blindly.

Do NOT build fake functionality.

Do NOT create placeholder API calls and leave them unresolved.

Do NOT create buttons that do nothing.

Do NOT create fake success responses.

Do NOT hardcode API URLs throughout the application.

Do NOT assume that compiling means the feature is complete.

Do NOT use a generic dashboard template as the final product.

Do NOT build the UI first and invent the backend later.

Every feature must be:

1. Designed
2. Architected
3. Implemented
4. Connected to the backend
5. Validated
6. Tested
7. Integrated
8. Reviewed
9. Polished

Use incremental development.

For each major feature:

PLAN
→ IMPLEMENT BACKEND
→ TEST BACKEND
→ IMPLEMENT FRONTEND/MOBILE
→ CONNECT API
→ TEST INTEGRATION
→ TEST UI
→ FIX ERRORS
→ REVIEW UX
→ POLISH
→ MARK COMPLETE

============================================================
4. EXISTING PROJECT STRUCTURE
============================================================

The project already has:

CampusFlow/
    frontend/
    backend/

Frontend:
Next.js

Backend:
Laravel

Database:
PostgreSQL 17

Spatial extension:
PostGIS

Do not unnecessarily recreate the project from scratch if the existing setup is valid.

First inspect the repository.

Before modifying anything:

- inspect existing folders
- inspect package.json
- inspect composer.json
- inspect environment configuration
- inspect Laravel configuration
- inspect Next.js configuration
- inspect database configuration
- inspect existing routes
- inspect existing migrations
- inspect existing components
- inspect existing authentication
- inspect existing dependencies
- identify what is already implemented
- identify what is missing
- identify broken functionality
- identify architectural problems

Do not overwrite working functionality without understanding it.

============================================================
5. TECHNOLOGY STACK
============================================================

FRONTEND WEB

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- App Router
- Framer Motion where appropriate
- MapLibre/OpenStreetMap where appropriate
- Axios or a centralized HTTP client
- Laravel Echo for real-time communication

MOBILE

Use:

- React Native
- Expo
- TypeScript
- expo-location
- expo-camera
- expo-notifications
- expo-secure-store
- Axios

BACKEND

Use:

- Laravel
- PHP
- REST API
- Laravel Sanctum
- Laravel Reverb
- Laravel Echo
- Redis
- queues/jobs where appropriate
- policies
- middleware
- validation
- transactions

DATABASE

Use:

- PostgreSQL 17
- PostGIS

Do not replace PostgreSQL/PostGIS with a simpler database merely for convenience.

OPTIONAL MACHINE LEARNING

If substantial predictive functionality is required later:

- Python
- FastAPI

Do not introduce a Python microservice unnecessarily.

The primary backend remains Laravel.

============================================================
6. ARCHITECTURE
============================================================

Use a modular monolith architecture.

Do NOT create unnecessary microservices.

High-level architecture:

                    CAMPUSFLOW
                         |
          +--------------+--------------+
          |                             |
      WEB CLIENT                   MOBILE CLIENT
          |                             |
      Next.js                      React Native
      React                        Expo
      TypeScript                   TypeScript
          |                             |
          +-------------+---------------+
                        |
                      HTTPS
                        |
                        v
                 LARAVEL REST API
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
    PostgreSQL        Redis      Laravel Reverb
    + PostGIS                     WebSockets
          |
          +-- Users
          +-- Roles
          +-- Students
          +-- Staff
          +-- Courses
          +-- Enrollments
          +-- Timetables
          +-- Buildings
          +-- Floors
          +-- Rooms
          +-- QR Nodes
          +-- Navigation Nodes
          +-- Navigation Edges
          +-- Geofences
          +-- Room Queues
          +-- Queue Tickets
          +-- Check-ins
          +-- Administrative Offices
          +-- Office Tickets
          +-- Events
          +-- Announcements
          +-- Notifications
          +-- AI interactions

                        |
                        v
                 AI SERVICE LAYER
                        |
                        v
                    LLM API

Optional later:

AI Service
    |
    v
Python/FastAPI
Queue Prediction / Advanced ML

============================================================
7. ARCHITECTURAL RULE
============================================================

CRITICAL:

AI interprets, predicts, recommends and assists.

The deterministic backend controls correctness.

Examples:

Queue numbering:
→ PostgreSQL transaction and row locking

Capacity:
→ backend business rules

Geofence:
→ deterministic distance calculation

QR identity:
→ QR validation

Route calculation:
→ A* / Dijkstra

Authentication:
→ Laravel

Authorization:
→ Laravel middleware and policies

Real-time events:
→ Laravel Reverb

AI:
→ natural language interpretation and controlled tool selection

NEVER allow the LLM to directly manipulate the database.

============================================================
8. USER ROLES
============================================================

The system has four primary roles.

-----------------------------------
VISITOR
-----------------------------------

Visitor can:

- view public landing page
- view public campus information
- view public campus map where appropriate
- view public events
- view announcements
- register
- log in

-----------------------------------
STUDENT
-----------------------------------

Student can:

- log in
- view dashboard
- view personalized timetable
- view today's classes
- view next class
- view upcoming events
- view announcements
- receive notifications
- explore campus map
- scan QR codes
- determine current position
- search rooms
- view room details
- check room availability
- request room admission
- join queues
- view queue position
- view people ahead
- view estimated waiting time
- cancel queue ticket
- check in
- receive queue updates
- receive call notifications
- navigate to rooms
- receive off-route warnings
- use live navigation
- access administrative offices
- request administrative office tickets
- view office ticket number
- view office queue position
- view estimated waiting time
- view expected service window
- receive approaching notification
- receive "your turn" notification
- navigate to office
- check in at office
- view service status
- view ticket history
- use AI Campus Assistant
- manage profile

-----------------------------------
STAFF
-----------------------------------

Staff can:

- log in
- view staff dashboard
- manage authorized timetables
- publish events
- publish announcements
- monitor room queues
- call next student
- grant admission
- mark no-show
- check student check-ins
- manage administrative office queues where authorized
- call office tickets
- mark no-show
- start service
- complete service
- manage authorized office service windows

Staff access must be restricted according to role and permissions.

-----------------------------------
ADMINISTRATOR
-----------------------------------

Administrator can:

- manage users
- manage roles
- manage buildings
- manage floors
- manage rooms
- manage floor plans
- manage campus spatial coordinates
- manage QR nodes
- generate QR codes
- manage navigation nodes
- manage navigation edges
- manage geofences
- manage room capacities
- manage room access rules
- configure queues
- configure administrative offices
- configure office service hours
- configure office capacity
- configure ticket rules
- configure timeout rules
- view system analytics
- manage campus infrastructure
- manage authorized staff permissions

============================================================
9. FEATURE-ORIENTED FOLDER ARCHITECTURE
============================================================

Each feature must own its functionality.

Avoid giant generic folders.

-----------------------------------
WEB
-----------------------------------

frontend/

    app/
        (public)/
        (auth)/
        (student)/
        (staff)/
        (admin)/

    features/
        authentication/
        dashboard/
        timetable/
        campus-map/
        positioning/
        qr-scanner/
        navigation/
        rooms/
        queue/
        administrative-office/
        notifications/
        events/
        announcements/
        ai-assistant/
        profile/

    components/
        ui/
        layout/
        maps/
        navigation/
        queue/

    lib/
        api/
        auth/
        websocket/
        maps/

    hooks/

    types/

    utils/

-----------------------------------
MOBILE
-----------------------------------

mobile/

    app/
        (auth)/
        (student)/
        navigation/
        queue/
        offices/
        profile/
        notifications/
        assistant/

    features/
        authentication/
        timetable/
        qr-scanner/
        positioning/
        navigation/
        rooms/
        queue/
        administrative-office/
        notifications/
        events/
        ai-assistant/

    components/
        ui/
        maps/
        navigation/
        queue/
        cards/

    services/
        api/
        websocket/
        location/
        notifications/

    hooks/
    types/
    utils/
    constants/

-----------------------------------
LARAVEL
-----------------------------------

backend/

    app/

        Models/

        Http/
            Controllers/
                Auth/
                Student/
                Staff/
                Admin/
                Navigation/
                Positioning/
                Rooms/
                Queue/
                AdministrativeOffice/
                Notifications/
                AI/

            Requests/

            Resources/

        Services/
            Authentication/
            Timetable/
            Campus/
            Positioning/
            Navigation/
            Rooms/
            Queue/
            AdministrativeOffice/
            Notifications/
            AI/

        Actions/

        Policies/

        Events/

        Listeners/

        Jobs/

        Notifications/

    routes/
        api.php

    database/
        migrations/
        seeders/
        factories/

    tests/
        Feature/
        Unit/

Each domain must have clear ownership.

============================================================
10. DATABASE DESIGN
============================================================

Use PostgreSQL + PostGIS as the source of truth.

Design normalized relational structures.

Expected major entities include:

User
Role
Student
Staff
Course
Enrollment
Timetable
TimetableEntry
Building
Floor
Room
QRNode
NavigationNode
NavigationEdge
Geofence
RoomQueue
QueueTicket
QueueCheckIn
AdministrativeOffice
OfficeServiceWindow
OfficeTicket
OfficeCheckIn
Event
Announcement
Notification

Additional supporting entities may be introduced when justified.

Use:

- primary keys
- foreign keys
- unique constraints
- indexes
- timestamps
- appropriate enums/status fields
- spatial indexes
- database-level constraints where appropriate

Use PostGIS for spatial information.

Potential spatial information:

- building coordinates
- floor geometry
- room coordinates
- navigation nodes
- geofences
- QR anchor locations

Do not store spatial information only as arbitrary strings.

============================================================
11. AUTHENTICATION AND AUTHORIZATION
============================================================

Implement:

- registration
- login
- logout
- password reset
- account verification where appropriate
- session/token management
- role-based access control
- permission checks
- ownership checks

Use Laravel Sanctum.

Frontend role checks are only for UI.

Backend authorization is authoritative.

Never trust:

- role sent by frontend
- user ID sent by frontend
- queue position sent by frontend
- room capacity sent by frontend
- administrative permissions sent by frontend

Use:

- middleware
- policies
- request validation

============================================================
12. PERSONALIZED TIMETABLE
============================================================

The student's timetable must be generated from authoritative academic data.

Flow:

Student
→ enrollments
→ courses
→ master timetable
→ matching logic
→ personalized timetable

Student dashboard should show:

- today's classes
- next class
- course
- lecturer where available
- room
- start time
- end time
- building
- navigation action
- status

Useful AI intents:

GET_NEXT_CLASS
GET_TODAYS_SCHEDULE
GET_UPCOMING_CLASSES

============================================================
13. CAMPUS MAP
============================================================

The campus map must support:

- buildings
- floors
- rooms
- important facilities
- administrative offices
- navigation nodes
- QR anchors
- current position
- destination
- route visualization

Do not create a fake static map if actual spatial data is available.

Support floor-aware navigation.

For indoor maps use:

- SVG
- floor-plan images
- spatial overlays
- navigation graph

where appropriate.

============================================================
14. QR-ASSISTED INDOOR POSITIONING
============================================================

QR codes act as known location anchors.

Flow:

Student scans QR
        |
        v
QR payload
        |
        v
Backend validates QR
        |
        v
Known QR node
        |
        v
Building/Floor/Coordinates
        |
        v
Current position established
        |
        v
Navigation begins

QR data should identify:

- node ID
- building
- floor
- coordinates
- version/security information where appropriate

Do not blindly trust arbitrary QR payloads.

Validate the QR against backend records.

============================================================
15. LIVE NAVIGATION
============================================================

Navigation must support:

- current position
- destination
- route
- distance
- estimated walking time
- current floor
- floor changes
- navigation instructions
- live location updates
- off-route detection
- route recalculation

Use:

A*
or
Dijkstra

for route calculation.

Navigation graph:

Node
→ Edge
→ Node

Edges can include:

- distance
- floor
- stairs
- elevator
- corridor
- accessibility properties

Where possible, support accessible route preferences.

============================================================
16. OFF-ROUTE DETECTION
============================================================

IMPORTANT:

Off-route does NOT automatically mean abandoned.

If a student deviates:

1. detect deviation
2. display warning
3. allow grace period
4. attempt recalculation
5. continue monitoring
6. only classify as abandoned if actual abandonment criteria are satisfied

Never cancel navigation simply because the user temporarily deviates.

============================================================
17. ROOM SEARCH
============================================================

Students must be able to:

- search by room number
- search by building
- search by floor
- search by capacity
- search by availability
- search by purpose/type
- view room details
- view location
- navigate to room

Example:

"Find me a study room for 15 people."

The system should search actual room data.

Do not return fake rooms.

============================================================
18. ROOM AVAILABILITY
============================================================

Availability must be calculated using:

- room schedule
- current bookings/admissions
- room capacity
- access restrictions
- configured availability rules

Do not simply store a manually editable boolean as the only source of truth.

============================================================
19. STANDARD ROOM ADMISSION QUEUE
============================================================

Some rooms may require controlled admission.

Example:

Student
→ Room B204
→ Request admission
→ proximity verification
→ queue eligibility
→ ticket assignment
→ queue position
→ wait
→ call
→ navigate
→ check-in
→ admission

Queue states:

QUEUE_PENDING
WAITING
CALLED
NAVIGATING
APPROACHING
CHECK_IN_WINDOW
CHECKED_IN
NO_SHOW
CANCELLED
EXPIRED
OFF_ROUTE

The implementation may simplify states where appropriate, but the workflow must preserve these business meanings.

============================================================
20. QUEUE FLOODING / GHOST TICKETS
============================================================

Problem:

Students may request tickets for multiple rooms and never appear.

Solution:

Use proximity/geofencing.

A student may only join a restricted room queue if:

- they are within an allowed distance of the room/QR anchor
OR
- another explicitly configured eligibility rule permits access.

When called:

- start check-in window
- notify student
- monitor proximity where appropriate
- allow configured grace period
- mark no-show/expired after the grace period
- advance the queue

Do not allow unlimited ghost tickets.

Students must be prevented from creating unnecessary duplicate active tickets for the same queue.

============================================================
21. QUEUE CAPACITY AND CONCURRENCY
============================================================

CRITICAL.

Multiple students may attempt to join a queue simultaneously.

The backend must guarantee:

- no duplicate queue positions
- no over-capacity admission
- no race-condition ticket assignment
- correct queue ordering

Use:

- database transactions
- PostgreSQL row-level locking
- SELECT ... FOR UPDATE where appropriate
- unique constraints
- atomic operations

Never calculate queue position only in frontend JavaScript.

Backend is authoritative.

============================================================
22. REAL-TIME QUEUE UPDATES
============================================================

Use Laravel Reverb + Laravel Echo.

Events may include:

QueuePositionUpdated
TicketCalled
TicketExpired
TicketCancelled
StudentCheckedIn
OfficeTicketUpdated
RoomAvailabilityChanged
NotificationCreated

Student UI should update without requiring a manual refresh.

Example:

Student position:

#8

Staff calls another student.

Student's UI automatically updates:

#7

============================================================
23. QUEUE TIMEOUT
============================================================

When a student is called:

1. send notification
2. start check-in window
3. provide grace period
4. show countdown where useful
5. warn before expiration
6. mark no-show/expired if appropriate
7. advance queue

The timeout rules must be configurable.

============================================================
24. ADMINISTRATIVE OFFICE TICKETING
============================================================

This is a CORE feature.

Administrative offices include:

- Principal's Office
- Secretary's Office
- Student Affairs Office
- Dean's Office
- Registrar
- other configured offices

This workflow is different from ordinary room queues because the student is requesting administrative service.

Example:

Student
    ↓
Principal's Office
    ↓
Request Visit
    ↓
Check office hours
    ↓
Check service availability
    ↓
Assign ticket
    ↓
Ticket P-024
    ↓
Position #7
    ↓
Estimated wait
    ↓
Expected service window
    ↓
Approaching notification
    ↓
Your turn notification
    ↓
Navigate to office
    ↓
Proximity verification
    ↓
Check-in
    ↓
Staff admits student
    ↓
Service begins
    ↓
Service completed

============================================================
25. ADMINISTRATIVE OFFICE TICKET STATES
============================================================

Use states such as:

REQUESTED
TICKET_ASSIGNED
WAITING
APPROACHING
CALLED
CHECK_IN_WINDOW
CHECKED_IN
IN_SERVICE
COMPLETED
CANCELLED
NO_SHOW
EXPIRED

Do not force office tickets to use the exact same model as room queues if the business requirements differ.

============================================================
26. OFFICE TICKET INFORMATION
============================================================

Student must see:

- office name
- ticket number
- queue position
- number of people ahead
- estimated waiting time
- expected service window
- current ticket status
- office opening hours
- cancellation option
- navigation option
- check-in status

Example:

Principal's Office

Ticket:
P-024

Position:
#7

People ahead:
6

Estimated wait:
32 minutes

Expected service:
11:40–11:50

When appropriate:

"Your turn is approaching. Please start heading to the Principal's Office."

Then:

"It's your turn. Please proceed to the Principal's Office."

============================================================
27. OFFICE SERVICE WINDOWS
============================================================

Administrative offices must support configurable service windows.

Example:

Office:
Principal's Office

Opening:
08:00

Closing:
16:00

Service window:
10 minutes

Capacity:
1 student at a time

Rules may vary per office.

Admin must be able to configure these.

============================================================
28. NOTIFICATIONS
============================================================

Support:

- in-app notifications
- push notifications on mobile where configured
- real-time updates
- queue alerts
- office ticket alerts
- class reminders
- navigation alerts
- announcements
- events

Examples:

"Your class starts in 15 minutes."

"Your queue position is now #3."

"Your turn is approaching."

"It's your turn. Please proceed to the Principal's Office."

"Navigation recalculated."

============================================================
29. EVENTS AND ANNOUNCEMENTS
============================================================

Students can:

- view events
- view announcements
- receive relevant notifications

Staff can manage authorized events/announcements.

Admin controls system-wide permissions.

============================================================
30. AI CAMPUS ASSISTANT
============================================================

The AI Campus Assistant is:

"A natural-language gateway to CampusFlow services."

It must NOT be a generic chatbot.

It should understand requests such as:

"What is my next class?"

"What's my timetable today?"

"Where is B204?"

"How do I get to the library?"

"Find me a study room for 15 people."

"Is B204 available?"

"What's my queue position?"

"How long will I wait?"

"Join the queue for B204."

"Cancel my ticket."

"Where is the Principal's Office?"

"When is my appointment?"

"How long until my turn?"

"Navigate me to the Principal's Office."

============================================================
31. AI ARCHITECTURE
============================================================

Use:

Student
   ↓
AI Campus Assistant
   ↓
Intent and Context Understanding
   ↓
Tool / Function Selection
   ↓
CampusFlow backend APIs
   ↓
Database / Navigation / Queue / Office services
   ↓
AI formats the response

The AI must not directly access PostgreSQL.

The AI must use controlled backend functions.

Possible tools:

get_student_schedule()
get_next_class()
get_room_details()
search_available_rooms()
get_current_position()
calculate_route()
get_queue_status()
join_queue()
cancel_queue_ticket()
get_office_details()
request_office_ticket()
get_office_ticket_status()
cancel_office_ticket()
get_events()
get_announcements()

============================================================
32. AI INTENTS
============================================================

Examples:

GET_NEXT_CLASS
GET_TODAYS_SCHEDULE
GET_ROOM_LOCATION
SEARCH_ROOM
START_NAVIGATION
GET_QUEUE_STATUS
JOIN_QUEUE
CANCEL_QUEUE
GET_CURRENT_POSITION
GET_EVENTS
GET_ANNOUNCEMENTS
GET_OFFICE_DETAILS
REQUEST_OFFICE_TICKET
GET_OFFICE_TICKET_STATUS
CANCEL_OFFICE_TICKET

The AI must ask for clarification when necessary.

Example:

User:
"Find me a room."

AI:
"What capacity do you need?"

============================================================
33. AI AUTHORIZATION
============================================================

AI actions must respect the logged-in user's permissions.

A student asking:

"Show me another student's timetable."

must be denied.

A student asking:

"Change the campus room capacity."

must be denied.

AI cannot bypass backend authorization.

Every AI action must pass through the same authorization rules as normal API requests.

============================================================
34. AI ROOM RECOMMENDATIONS
============================================================

The AI may recommend rooms based on:

- capacity
- availability
- location
- building
- floor
- room type
- current schedule
- student request

The final result must come from actual backend data.

============================================================
35. AI QUEUE WAIT-TIME PREDICTION
============================================================

Initial implementation may use deterministic estimates.

Later, if enough historical data exists, add ML prediction.

Possible inputs:

- historical service duration
- current queue size
- office
- time of day
- day of week
- staff availability
- average processing time

If advanced ML is introduced:

Python/FastAPI can be added later.

Do not create an unnecessary ML service during the first implementation.

============================================================
36. API ARCHITECTURE
============================================================

API communication MUST be robust.

NEVER scatter:

fetch("http://localhost:8000/...")

throughout the frontend.

Use centralized API clients.

Environment variables:

Web:

NEXT_PUBLIC_API_URL

Mobile:

EXPO_PUBLIC_API_URL

No hardcoded production URLs.

Use typed API interfaces where possible.

Every endpoint must have:

- defined URL
- HTTP method
- authentication requirements
- authorization requirements
- request validation
- response format
- error behavior
- frontend handling

============================================================
37. API RESPONSE FORMAT
============================================================

Success:

{
    "success": true,
    "data": {},
    "message": "..."
}

Error:

{
    "success": false,
    "message": "...",
    "errors": {}
}

Use correct HTTP statuses.

Examples:

200
201
204
400
401
403
404
409
422
429
500

Do not return HTTP 200 for failed operations.

============================================================
38. API ERROR HANDLING
============================================================

Every API request must handle:

- loading
- success
- validation errors
- authentication errors
- authorization errors
- not found
- conflict
- rate limiting
- server errors
- network failure
- timeout

Never show success if the backend failed.

Example:

"Unable to join the queue. Check your connection and try again."

Do not silently swallow errors.

Do not leave rejected promises unhandled.

============================================================
39. DUPLICATE REQUEST PROTECTION
============================================================

Prevent accidental duplicate requests.

Examples:

- double-click Join Queue
- double-submit ticket request
- duplicate office ticket
- duplicate booking
- duplicate navigation start

Use:

- disabled loading states
- request deduplication
- idempotency where appropriate
- backend constraints

============================================================
40. REAL-TIME COMMUNICATION
============================================================

Use Laravel Reverb.

Frontend/mobile must subscribe only to authorized channels.

Do not expose private queue information through public channels.

Ensure:

- authentication
- authorization
- reconnection
- connection failure handling
- cleanup on component unmount
- duplicate subscription prevention

============================================================
41. OFFLINE AND POOR NETWORK HANDLING
============================================================

Mobile must gracefully handle poor connectivity.

Never display:

"Queue joined successfully"

unless backend confirms it.

If request fails:

"Unable to join the queue. Check your connection and try again."

Use:

- retry where safe
- connection status
- stale-data indicators
- optimistic UI only where appropriate and reversible

Do not optimistically change critical queue/ticket states without backend confirmation.

============================================================
42. SECURITY
============================================================

Implement:

- secure authentication
- RBAC
- policies
- validation
- rate limiting
- secure token storage
- ownership checks
- CSRF/security mechanisms where applicable
- input sanitization
- protected WebSocket channels
- secure QR validation

Students cannot:

- modify other students' tickets
- modify queue positions
- alter room capacity
- access staff tools
- access admin tools
- access private data
- manipulate navigation configuration

Location data is sensitive.

Collect location only when needed.

Do not unnecessarily store continuous location history.

============================================================
43. PERFORMANCE
============================================================

Avoid:

- N+1 queries
- excessive API calls
- excessive location updates
- excessive WebSocket events
- unnecessary rerenders
- huge components
- huge controllers
- unnecessary database queries

Use:

- indexes
- pagination
- caching
- debouncing
- efficient queries
- sensible location intervals
- lazy loading
- code splitting where appropriate

============================================================
44. WEB UI/UX
============================================================

CampusFlow must look like a serious modern software product.

It must NOT look like:

- a generic CRUD dashboard
- a school assignment
- an old Bootstrap admin panel
- a default Tailwind template

Use:

- strong visual hierarchy
- professional typography
- thoughtful spacing
- responsive layouts
- modern cards
- useful data visualization
- clear navigation
- meaningful empty states
- loading skeletons
- error states
- success feedback
- polished interactions
- accessible components
- subtle animations

Use Framer Motion where it improves UX.

Do not over-animate.

============================================================
45. MANDATORY DESIGN RESEARCH
============================================================

CRITICAL.

DO NOT design major CampusFlow screens blindly.

Before implementing UI for every major screen, the agent MUST perform design research.

The agent must research professional references from:

- Dribbble
- Behance
- Mobbin
- Awwwards
- high-quality real-world products

Dribbble should be one of the primary research sources.

Do not simply search and immediately copy the first result.

============================================================
46. DESIGN RESEARCH BLOCKING RULE
============================================================

THIS IS A HARD REQUIREMENT.

For every major screen:

DO NOT begin final UI implementation until the design research review for that screen has been completed.

The required sequence is:

1. Identify screen
2. Search design references
3. Inspect multiple references
4. Record sources
5. Score references
6. Compare references
7. Select references
8. Document design decisions
9. Define original CampusFlow design direction
10. THEN begin implementation

If the research log is missing, incomplete, or does not contain sufficient references:

STOP UI IMPLEMENTATION FOR THAT SCREEN.

Do not bypass this process.

============================================================
47. REQUIRED DESIGN RESEARCH FILE
============================================================

Create and maintain:

docs/design-research.md

This file is mandatory.

Also create:

docs/design-decisions/

Each major screen should have a design decision record where appropriate.

Example:

docs/
    design-research.md

    design-decisions/
        student-dashboard.md
        timetable.md
        campus-map.md
        navigation.md
        room-search.md
        room-queue.md
        office-ticket.md
        ai-assistant.md
        staff-dashboard.md
        admin-dashboard.md

The exact file breakdown may be expanded as the project grows.

============================================================
48. DESIGN RESEARCH LOG FORMAT
============================================================

For every researched design, document:

Reference ID
Source
Title / Design Name
URL
Designer / Company if available
Screen Type
What Was Studied
Strengths
Weaknesses
Relevant Ideas
Score

Example:

Reference ID:
NAV-01

Source:
Dribbble

Title:
Indoor Navigation Mobile App

URL:
[actual URL]

Screen Type:
Mobile Navigation

What Was Studied:
Navigation hierarchy, map controls and destination information.

Strengths:
- clear route hierarchy
- strong ETA visibility
- good map interaction

Weaknesses:
- crowded bottom panel
- weak floor transition visualization

Relevant Ideas:
- floating map controls
- bottom destination card
- clear ETA

Score:
8.7/10

============================================================
49. DESIGN SOURCE HONESTY RULE
============================================================

NEVER invent sources.

NEVER invent URLs.

NEVER claim that a design was inspected if it was not inspected.

NEVER fabricate designer names.

If information is unavailable, explicitly write:

"Not available."

Research documentation must reflect actual research.

============================================================
50. DESIGN SCORING SYSTEM
============================================================

Every reference must be scored from 1–10.

Use:

Visual Quality — 15%
Usability — 20%
Information Hierarchy — 15%
Interaction Design — 10%
Responsiveness — 10%
Mobile Usability — 10%
Accessibility — 5%
Typography & Spacing — 5%
CampusFlow Relevance — 10%

Calculate an overall score.

Example:

Visual Quality:
9/10

Usability:
9/10

Information Hierarchy:
8/10

Interaction Design:
9/10

Responsiveness:
8/10

Mobile Usability:
9/10

Accessibility:
8/10

Typography & Spacing:
9/10

CampusFlow Relevance:
9/10

Overall:
8.7/10

Do not give every design the same score.

============================================================
51. MINIMUM DESIGN REFERENCE REQUIREMENT
============================================================

For every major screen:

Research at least 3 strong references whenever enough relevant references are available.

Do not select only one design.

Compare alternatives.

For especially important screens such as:

- Dashboard
- Campus Map
- Navigation
- Queue
- Administrative Office Ticketing
- AI Assistant

prefer 4–6 references when possible.

============================================================
52. DESIGN COMPARISON
============================================================

After researching references, create a comparison.

Example:

Screen:
Live Navigation

NAV-01 — 8.7/10
NAV-02 — 8.3/10
NAV-03 — 7.9/10
NAV-04 — 8.9/10

Highest rated:
NAV-04 — 8.9/10

However:

The highest-rated design does NOT automatically become the final design.

The agent must determine which design principles are most appropriate for CampusFlow.

============================================================
53. DESIGN REFERENCE SELECTION
============================================================

Document:

SELECTED REFERENCES

Primary Reference:
Reference ID:
Reason:

Secondary Reference:
Reference ID:
Reason:

Specific Design Patterns Adopted:
- ...
- ...
- ...

Patterns Rejected:
- ...
- ...
- ...

============================================================
54. CAMPUSFLOW DESIGN DECISIONS
============================================================

For every major screen, document:

Decision
Why
Inspired By
CampusFlow Adaptation

Example:

Decision:
Use a persistent bottom navigation card.

Why:
Students need route information without leaving the map.

Inspired By:
NAV-01

CampusFlow Adaptation:
The card will show:

- destination
- ETA
- distance
- current floor
- next instruction

============================================================
55. ORIGINALITY RULE
============================================================

Do NOT copy researched designs.

Do NOT copy:

- exact layouts
- logos
- proprietary graphics
- illustrations
- branding
- exact colors
- distinctive visual identity
- exact typography combinations

Extract principles.

Then create an original CampusFlow design.

============================================================
56. DESIGN DECISION RECORD
============================================================

Each major screen should have:

==================================================
CAMPUSFLOW DESIGN DECISION RECORD
==================================================

Screen:
Feature:
User Role:

Research Sources:
1.
2.
3.
4.

Reference Scores:
1. ___ / 10
2. ___ / 10
3. ___ / 10
4. ___ / 10

Selected Primary Reference:
Reason:

Selected Secondary Reference:
Reason:

Key Patterns Extracted:
-
-
-

Patterns Rejected:
-
-

CampusFlow Design Decisions:
-
-
-

Original CampusFlow Adaptations:
-
-
-

Accessibility Decisions:
-

Responsive Decisions:
-

Animation / Interaction Decisions:
-

Final Design Rationale:
[explanation]

==================================================
57. DESIGN QUALITY GATE
==================================================

Before marking a screen complete, score the actual implemented CampusFlow screen.

Evaluate:

Visual Quality
Usability
Information Hierarchy
Consistency
Responsiveness
Accessibility
Interaction Quality
Performance
CampusFlow Relevance
Originality

Target:

Average >= 8/10

If below 8/10:

1. identify weaknesses
2. research additional references
3. redesign
4. implement
5. test
6. score again

Do not knowingly ship a weak design.

============================================================
58. REQUIRED DESIGN RESEARCH COVERAGE
============================================================

Student:

- Student Dashboard
- Timetable
- Campus Map
- Room Search
- Room Details
- Live Navigation
- QR Scanner
- Room Queue
- Queue Status
- Administrative Office Ticket
- Office Queue Status
- Notifications
- Events
- Announcements
- AI Campus Assistant
- Profile

Staff:

- Staff Dashboard
- Queue Management
- Office Queue Management
- Timetable Management
- Events Management
- Announcement Management

Administrator:

- Admin Dashboard
- User Management
- Building Management
- Floor Management
- Room Management
- Spatial Editor
- QR Node Management
- Navigation Graph Management
- Queue Configuration
- Administrative Office Configuration
- Analytics

============================================================
59. DESIGN RESEARCH DOCUMENTATION QUALITY
============================================================

The agent must be able to answer:

1. What designs were researched?
2. Where were they found?
3. What URLs were used?
4. What was each design's score?
5. Why was each score given?
6. Which designs were selected?
7. Why were they selected?
8. What patterns were extracted?
9. What patterns were rejected?
10. How did the research influence CampusFlow?
11. What makes the final design original?
12. Does the implemented screen pass the 8/10 quality gate?

If these questions cannot be answered:

The design research is incomplete.

============================================================
60. DASHBOARD DESIGN
============================================================

Dashboards must be role-specific.

Student dashboard should prioritize:

- greeting
- today's schedule
- next class
- room
- navigation shortcut
- queue status
- office ticket status
- notifications
- upcoming events
- announcements
- AI assistant access

Staff dashboard:

- active queues
- current students
- pending actions
- office/service activity
- timetable
- announcements/events

Admin dashboard:

- users
- buildings
- rooms
- active queues
- system activity
- infrastructure
- analytics
- spatial management

Do not overload dashboards with irrelevant data.

============================================================
61. MOBILE UX
============================================================

Mobile is not a smaller desktop.

Design specifically for mobile.

Prioritize:

- thumb-friendly controls
- bottom navigation where appropriate
- map interactions
- QR scanning
- live navigation
- notifications
- queue status
- office ticket status
- fast actions

Use appropriate gestures.

Do not make critical actions difficult to access.

============================================================
62. ACCESSIBILITY
============================================================

Support:

- readable typography
- sufficient contrast
- keyboard navigation on web
- screen-reader-friendly labels
- semantic HTML
- accessible form controls
- meaningful focus states
- reduced-motion consideration
- non-color-only status indicators

Do not rely only on color to communicate queue states.

============================================================
63. SEED DATA
============================================================

Create realistic development seed data.

Include:

Buildings
Floors
Rooms
QR nodes
Navigation nodes
Navigation edges
Geofences
Courses
Students
Staff
Administrators
Enrollments
Timetables
Events
Announcements
Room queues
Administrative offices
Office service windows

Example offices:

Principal's Office
Secretary's Office
Student Affairs Office
Dean's Office
Registrar

Use realistic but fictional development data.

============================================================
64. TESTING PHILOSOPHY
============================================================

The project is NOT complete because:

- it compiles
- the UI renders
- login works
- one endpoint works

Every feature must be tested.

For each feature:

1. implement
2. backend test
3. frontend type check
4. lint
5. API test
6. integration test
7. UI test where appropriate
8. fix errors
9. repeat

============================================================
65. BACKEND TESTING
============================================================

Use PHPUnit/Pest.

Test:

- authentication
- authorization
- validation
- business rules
- queue concurrency
- capacity
- geofence
- ticket generation
- office ticket logic
- cancellation
- timeout
- no-show
- check-in
- navigation
- API responses
- policies

============================================================
66. CRITICAL END-TO-END TESTS
============================================================

Test:

1.
Student login
→ dashboard
→ timetable
→ next class

2.
QR scan
→ position resolved
→ destination
→ route
→ navigation

3.
Off-route
→ warning
→ recalculation

4.
Room search
→ availability

5.
Join queue
→ geofence
→ ticket

6.
Two users simultaneously join
→ unique positions

7.
Queue updates
→ WebSocket
→ UI updates without refresh

8.
Student called
→ notification
→ navigation
→ check-in

9.
No check-in
→ grace period
→ no-show/expired
→ next student

10.
Administrative office ticket
→ request
→ ticket
→ position
→ notification
→ navigation
→ check-in
→ service
→ completion

11.
Office ticket cancellation

12.
Unauthorized admin endpoint
→ 403

13.
Unauthenticated endpoint
→ 401

14.
Invalid request
→ 422
→ frontend displays validation error

============================================================
67. FRONTEND TESTING
============================================================

Verify:

- TypeScript
- lint
- component behavior
- loading states
- empty states
- error states
- authentication states
- responsive layouts
- API integration
- WebSocket behavior

============================================================
68. MOBILE TESTING
============================================================

Verify:

- Expo starts
- navigation
- authentication
- QR scanning
- location permissions
- notifications
- secure storage
- API connection
- poor network handling
- real device/emulator behavior

============================================================
69. API CONTRACT VALIDATION
============================================================

Before frontend integration:

Confirm:

- endpoint exists
- method is correct
- request body is correct
- authentication works
- authorization works
- validation works
- success response works
- error response works

Never build frontend against imaginary endpoints.

============================================================
70. ROUTE / API INVENTORY
============================================================

Maintain documentation:

docs/api.md

Document every major endpoint:

Method
Endpoint
Auth
Role
Request
Response
Errors
Notes

Keep this synchronized with implementation.

============================================================
71. ERROR LOGGING
============================================================

Errors should be:

- logged appropriately
- understandable during development
- not expose secrets
- not expose sensitive user information

Frontend should provide useful messages.

Backend logs should contain enough diagnostic information.

============================================================
72. ENVIRONMENT VARIABLES
============================================================

Never hardcode secrets.

Use:

.env

Examples:

APP_URL
DB_CONNECTION
DB_HOST
DB_PORT
DB_DATABASE
DB_USERNAME
DB_PASSWORD

NEXT_PUBLIC_API_URL

EXPO_PUBLIC_API_URL

Other API keys/secrets must be environment variables.

Do not commit secrets.

============================================================
73. GIT / DEVELOPMENT HYGIENE
============================================================

Keep code clean.

Avoid:

- unused files
- dead code
- commented-out massive blocks
- duplicate utilities
- duplicate API clients
- random experimental files

Use meaningful names.

Write maintainable code.

============================================================
74. DOCUMENTATION
============================================================

Maintain:

docs/
    architecture.md
    api.md
    database.md
    navigation.md
    queue-system.md
    administrative-office.md
    ai-assistant.md
    design-research.md
    testing.md
    deployment.md

And:

docs/design-decisions/

Documentation must reflect actual implementation.

============================================================
75. DEVELOPMENT PHASES
============================================================

Implement in this order unless repository conditions justify a different order.

PHASE 1
Repository inspection

PHASE 2
Architecture and environment foundation

PHASE 3
Database/PostGIS foundation

PHASE 4
Authentication and RBAC

PHASE 5
User/student/staff/admin foundation

PHASE 6
Campus infrastructure

Buildings
Floors
Rooms
Floor plans
Spatial data

PHASE 7
QR and positioning

PHASE 8
Navigation graph and routing

PHASE 9
Personalized timetable

PHASE 10
Room search and availability

PHASE 11
Standard room queue

PHASE 12
Administrative office ticket system

PHASE 13
Real-time WebSockets

PHASE 14
Notifications

PHASE 15
AI Campus Assistant

PHASE 16
AI room recommendation

PHASE 17
Queue wait-time prediction foundation

PHASE 18
Staff dashboards

PHASE 19
Admin dashboards

PHASE 20
Mobile application

PHASE 21
UI/UX refinement

PHASE 22
End-to-end testing

PHASE 23
Security review

PHASE 24
Performance review

PHASE 25
Final integration and bug fixing

============================================================
76. UI IMPLEMENTATION ORDER
============================================================

For each major screen:

STEP 1
Research design references.

STEP 2
Document sources.

STEP 3
Score references.

STEP 4
Compare references.

STEP 5
Select references.

STEP 6
Document design decisions.

STEP 7
Create original CampusFlow design direction.

STEP 8
Implement.

STEP 9
Test.

STEP 10
Score implemented screen.

STEP 11
Improve if score < 8/10.

Only then mark complete.

============================================================
77. NO GENERIC CRUD UI
============================================================

Admin pages should still be professional.

Do not make:

plain tables
+ basic forms
+ default buttons

and call it a dashboard.

Use:

- filtering
- search
- pagination
- statistics
- contextual actions
- confirmation dialogs
- useful empty states
- responsive tables
- detail panels
- maps/spatial visualization where appropriate
- meaningful analytics

============================================================
78. CAMPUS SPATIAL ADMINISTRATION
============================================================

Admin should be able to manage:

Building
→ Floor
→ Floor Plan
→ Rooms
→ Coordinates
→ QR Anchors
→ Navigation Nodes
→ Navigation Edges
→ Geofences

The spatial editor should allow administrators to configure the campus without manually editing database rows.

============================================================
79. NAVIGATION DATA MANAGEMENT
============================================================

Admin should be able to:

- create navigation nodes
- connect nodes
- define edge distance
- define floor
- define stairs/elevator
- define accessibility
- enable/disable paths
- configure QR anchors
- configure geofences

Navigation engine should consume this authoritative data.

============================================================
80. QUEUE ADMINISTRATION
============================================================

Admin should configure:

- room capacity
- maximum queue size
- proximity radius
- check-in window
- grace period
- no-show behavior
- duplicate-ticket rules
- queue opening/closing
- admission requirements

============================================================
81. OFFICE ADMINISTRATION
============================================================

Admin should configure:

- office name
- location
- building
- floor
- service hours
- capacity
- service duration
- ticket prefix
- check-in radius
- grace period
- staff assigned
- active/inactive status

============================================================
82. STAFF QUEUE MANAGEMENT UI
============================================================

Staff should see:

- current queue
- ticket number
- student
- position
- wait time
- status
- call next
- check in
- mark no-show
- start service
- complete service

Actions must require authorization.

============================================================
83. OFFICE QUEUE STAFF UI
============================================================

Staff should see:

- active office tickets
- ticket number
- position
- student
- request time
- expected window
- status

Actions:

Call Next
Check In
Start Service
Complete Service
Mark No-Show

============================================================
84. ANALYTICS
============================================================

Admin analytics may include:

- active students
- active staff
- room utilization
- queue volume
- average wait time
- no-show rate
- office service volume
- average service duration
- navigation usage
- most used rooms
- busiest offices

Analytics must use actual data.

Do not create fake charts.

============================================================
85. PERFORMANCE MONITORING
============================================================

Watch:

- API latency
- database query performance
- WebSocket load
- location update frequency
- queue update frequency
- frontend rendering
- mobile battery impact

============================================================
86. MOBILE LOCATION MANAGEMENT
============================================================

Location updates must be sensible.

Do not continuously request high-frequency GPS updates unnecessarily.

Use:

- appropriate accuracy
- distance intervals
- time intervals
- lifecycle awareness

Stop unnecessary tracking when navigation ends.

============================================================
87. QR SECURITY
============================================================

QR codes should not be treated as arbitrary trusted data.

Validate:

- QR identity
- active status
- node existence
- building/floor
- optional version/signature

Prevent users from spoofing arbitrary location data through modified QR contents.

============================================================
88. EMPTY STATES
============================================================

Every major screen must have meaningful empty states.

Examples:

No classes today.

No available rooms.

No active queue tickets.

No upcoming office appointment.

No notifications.

No announcements.

Empty states should guide the user toward useful actions.

============================================================
89. LOADING STATES
============================================================

Use:

- skeletons
- spinners
- disabled actions
- progress indicators

Do not display blank screens while waiting.

============================================================
90. ERROR STATES
============================================================

Every important feature must have a useful error state.

Example:

"Unable to load room availability."

Actions:

Retry

or

"Check your connection."

============================================================
91. FINAL QUALITY STANDARD
============================================================

CampusFlow should feel like a real product.

The final system should demonstrate:

Professional architecture
+
Professional UI/UX
+
Real backend functionality
+
Reliable APIs
+
Secure authentication
+
PostgreSQL/PostGIS
+
Real navigation
+
Real queues
+
Administrative ticketing
+
Real-time updates
+
AI integration
+
Responsive web
+
Mobile application
+
Testing
+
Documentation

============================================================
92. ABSOLUTE RULES
============================================================

NEVER:

- fabricate data
- fabricate API endpoints
- fabricate design research
- fabricate URLs
- hardcode production API URLs
- trust frontend authorization
- allow AI direct database access
- calculate critical queue state only on frontend
- mark failed requests as successful
- ignore API errors
- ignore concurrency
- automatically cancel users merely because they temporarily go off-route
- allow unlimited ghost queue tickets
- build generic CRUD UI and call it finished
- skip design research
- skip design scoring
- skip design decision documentation
- skip testing

============================================================
93. DEFINITION OF DONE
============================================================

A feature is DONE only when:

[ ] Backend implemented
[ ] Database implemented
[ ] Validation implemented
[ ] Authorization implemented
[ ] API implemented
[ ] API error handling implemented
[ ] Frontend implemented
[ ] Mobile implemented where required
[ ] Loading states implemented
[ ] Empty states implemented
[ ] Error states implemented
[ ] Real-time behavior implemented where required
[ ] Tests implemented
[ ] API integration verified
[ ] Security verified
[ ] Responsive behavior verified
[ ] Accessibility reviewed
[ ] Design research completed
[ ] Design sources documented
[ ] Design references scored
[ ] Design references compared
[ ] Selected references documented
[ ] Design decisions documented
[ ] Implemented design scored
[ ] Final design score >= 8/10
[ ] Documentation updated
[ ] No known broken API calls
[ ] No fake functionality
[ ] No critical console errors
[ ] No critical backend errors

============================================================
94. FIRST ACTION — DO NOT START CODING IMMEDIATELY
============================================================

Your first task is NOT to start generating components.

FIRST:

1. Inspect the complete repository.
2. Understand what already exists.
3. Identify the current architecture.
4. Identify installed dependencies.
5. Identify existing functionality.
6. Identify incomplete functionality.
7. Identify broken functionality.
8. Identify database state.
9. Identify API state.
10. Identify authentication state.
11. Identify frontend state.
12. Identify mobile state if present.
13. Identify existing design system.
14. Identify missing documentation.

Then produce:

CAMPUSFLOW IMPLEMENTATION AUDIT

with:

- Current architecture
- Existing features
- Missing features
- Broken features
- Database status
- API status
- Authentication status
- Frontend status
- Mobile status
- Design status
- Testing status
- Security concerns
- Recommended implementation order

Do not destroy existing working code.

============================================================
95. SECOND ACTION — DESIGN SYSTEM FOUNDATION
============================================================

Before implementing large numbers of screens:

Research professional design systems and establish an original CampusFlow design system covering:

- typography
- spacing
- colors
- borders
- radius
- shadows
- cards
- buttons
- inputs
- tables
- modals
- navigation
- sidebar
- bottom navigation
- status badges
- map controls
- queue indicators
- notification patterns
- responsive breakpoints
- accessibility

Document the design system.

Then use it consistently.

============================================================
96. THIRD ACTION — IMPLEMENT INCREMENTALLY
============================================================

Do not attempt to build the entire application in one uncontrolled generation.

Build feature by feature.

After every major feature:

- run tests
- inspect errors
- inspect API behavior
- inspect UI
- fix problems
- update documentation
- continue

============================================================
97. FINAL PROJECT OBJECTIVE
============================================================

Build CampusFlow as a complete intelligent campus platform where:

A student can log in.

The system knows the student's schedule.

The student sees the next class.

The student can see where the room is.

The student can scan a QR code and establish their indoor position.

The system can calculate a route.

The student can navigate live.

If the student deviates, the system can warn and recalculate.

The student can search for rooms.

The student can see room availability.

If admission is required, the student can join a controlled queue.

The queue must handle concurrency correctly.

The student receives real-time queue updates.

The student is notified when their turn approaches.

The student can navigate to the room and check in.

The student can request an administrative office ticket.

The system assigns a ticket number and queue position.

The system estimates waiting time and service window.

The student receives an approaching notification.

The student receives a "your turn" notification.

The student navigates to the office.

The student checks in.

Staff manages the service.

The service is completed.

The student can ask the AI Campus Assistant natural-language questions.

The AI can use controlled CampusFlow tools.

The AI cannot bypass authorization or manipulate critical backend logic.

Staff have operational dashboards.

Administrators can manage the entire campus infrastructure.

The entire application is responsive, secure, tested, documented and professionally designed.

============================================================
98. FINAL INSTRUCTION
============================================================

Act as a senior engineering team, not a code generator.

Think before implementing.

Inspect before modifying.

Research before designing.

Document before selecting.

Score before approving.

Test before declaring completion.

Fix before moving forward.

For UI:

RESEARCH
→ DOCUMENT SOURCES
→ SCORE
→ COMPARE
→ SELECT
→ DOCUMENT DECISIONS
→ DESIGN ORIGINAL CAMPUSFLOW UI
→ IMPLEMENT
→ TEST
→ SCORE FINAL UI
→ IMPROVE IF < 8/10

For functionality:

DESIGN
→ DATABASE
→ BACKEND
→ API
→ TEST
→ FRONTEND/MOBILE
→ INTEGRATE
→ TEST
→ FIX
→ DOCUMENT
→ COMPLETE

Never bypass these processes for convenience.

The final CampusFlow application must be a polished, original, reliable, production-quality smart campus platform rather than a collection of basic CRUD screens.
