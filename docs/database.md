# CampusFlow — Database Schema & Data Models

## Core Entity Relationship Diagram (Summary)

### 1. Spatial & Navigation Models
- `buildings` (id, name, code, latitude, longitude, status, description)
- `floors` (id, building_id, level, name, floor_plan_url)
- `rooms` (id, floor_id, building_id, code, name, capacity, room_type, is_active, requires_admission)
- `qr_nodes` (id, floor_id, room_id, code, payload, x_coordinate, y_coordinate)
- `navigation_nodes` (id, floor_id, code, name, x_coordinate, y_coordinate, node_type)
- `navigation_edges` (id, from_node_id, to_node_id, distance_meters, weight, is_accessible)

### 2. Queue & Admission Models
- `room_queues` (id, room_id, status, capacity, current_ticket_number, auto_admit)
- `queue_tickets` (id, queue_id, user_id, ticket_number, status, called_at, admitted_at, checked_in_at)
- `offices` (id, building_id, room_id, name, code, is_open, requires_proximity_to_request)
- `office_service_windows` (id, office_id, name, window_number, is_active)
- `office_tickets` (id, office_id, service_window_id, user_id, ticket_number, status, called_at, completed_at)

### 3. User & Engagement Models
- `users` (id, name, email, password, role)
- `terms` (id, code, name, starts_at, ends_at, is_current)
- `courses` (id, code, title, department)
- `timetable_entries` (id, course_id, room_id, lecturer_id, term_code, day_of_week, starts_at, ends_at)
- `campus_events` (id, title, description, venue, starts_at, status)
- `announcements` (id, title, body, priority, is_active)
- `user_notifications` (id, user_id, title, message, type, read_at)
