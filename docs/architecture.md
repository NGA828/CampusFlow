# CampusFlow — Architecture & Technical Design

## System Overview

CampusFlow is structured as an authoritative multi-tier application:

```
┌────────────────────────────────────────────────────────┐
│               Frontend Clients (React / Expo)          │
│   • Next.js Web Application                            │
│   • Expo React Native Mobile Application               │
└──────────────────────────┬─────────────────────────────┘
                           │ REST / JSON (Sanctum)
                           ▼
┌────────────────────────────────────────────────────────┐
│               Backend Service (Laravel 13)             │
│   • Controllers & Middleware (Sanctum Auth)            │
│   • Domain Models & State Engines                      │
│   • Queue & Office Admission Engine                    │
│   • Spatial Positioning & Routing Engine               │
└──────────────────────────┬─────────────────────────────┘
                           │ SQL Transactions / Row Locking
                           ▼
┌────────────────────────────────────────────────────────┐
│               Database (PostgreSQL / SQLite)           │
│   • Spatial & Geographic Schema                        │
│   • Concurrency-Safe Queue & Ticket Records            │
└────────────────────────────────────────────────────────┘
```

## Concurrency & Queue Engine Architecture
- **Room Admissions**: Managed in `QueueController` using PostgreSQL row locking (`lockForUpdate()`) and atomic database transactions.
- **Office Ticketing**: Daily ticket sequencing handled via DB locks on `Office` counters.

## Spatial Positioning & Navigation Graph
- Indoor positioning via QR anchor decoding.
- Pathfinding using Dijkstra / A* graph traversal over nodes and edges (`NavigationNode`, `NavigationEdge`).
