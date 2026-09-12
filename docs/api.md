# CampusFlow — API Reference & Specifications

> Base URL: `http://localhost:8001/api/v1`  
> Authentication: Bearer token via Laravel Sanctum (`Authorization: Bearer <token>`)

---

## 1. Authentication & User Profile (`/auth`, `/me`)

### `POST /auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ success: true, token: string, user: User }`

### `POST /auth/register`
- **Body**: `{ name, email, password, role?: 'student' | 'staff' }`
- **Response**: `{ success: true, token: string, user: User }`

### `GET /auth/me` / `GET /me`
- **Response**: `{ success: true, user: User }`

### `GET /me/dashboard`
- **Response**: `{ success: true, data: { user, today, next_class, queue_ticket, office_ticket, unread_count, upcoming_events, building_alerts } }`

---

## 2. Room Admission Queues (`/queues`, `/rooms/{id}/queue`)

### `GET /queues`
- **Response**: List of all room queues, waiting count, status, estimated wait.

### `POST /rooms/{room}/queue/join` or `POST /queues/{id}/tickets`
- **Body**: `{ position_lat?: float, position_lng?: float }`
- **Response**: `{ success: true, ticket: QueueTicket, position: int, estimated_wait_minutes: int }`

### `POST /queue-tickets/{id}/check-in`
- **Body**: `{ qr_payload?: string, lat?: float, lng?: float }`
- **Response**: `{ success: true, ticket: QueueTicket }`

---

## 3. Administrative Office Ticketing (`/offices`, `/office-tickets`)

### `GET /offices`
- **Response**: List of campus administrative offices, open service windows, queue length, average service duration.

### `POST /offices/{id}/tickets`
- **Body**: `{ service_window_id?: string, service_type?: string }`
- **Response**: `{ success: true, ticket: OfficeTicket, estimated_window: TimeWindow }`

### `POST /office-tickets/{id}/check-in`
- **Body**: `{ lat?: float, lng?: float }`
- **Response**: `{ success: true, ticket: OfficeTicket }`

---

## 4. Positioning & Spatial Navigation (`/positioning`, `/navigation`)

### `POST /positioning/scan`
- **Body**: `{ qr_payload: string }`
- **Response**: `{ success: true, position: LocationFix, room: Room, floor: Floor, building: Building }`

### `POST /navigation/route`
- **Body**: `{ origin: { x, y, floor_id }, destination: { room_code } }`
- **Response**: `{ success: true, path: Node[], total_distance_m: float, instructions: Instruction[] }`

---

## 5. Staff Operations (`/staff/*`)

- `GET /staff/dashboard`
- `GET /staff/queues/{id}/line`
- `POST /staff/queues/{id}/call-next`
- `POST /staff/queue-tickets/{id}/admit`
- `POST /staff/office-tickets/{id}/start-service`
- `POST /staff/office-tickets/{id}/complete`

---

## 6. Administration & Governance (`/admin/*`)

- `GET /admin/dashboard`, `GET /admin/analytics`, `GET /admin/audit-logs`
- CRUD for `users`, `buildings`, `floors`, `rooms`, `qr-nodes`, `navigation-nodes`, `courses`, `terms`, `enrollments`, `queues`, `offices`.
