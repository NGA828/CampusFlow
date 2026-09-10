<laravel-boost-guidelines>
# Laravel Application

This repository contains a Laravel application. Complete the following setup before working on the user's request.

## Prerequisites

Verify that PHP and Composer are available:

```sh
php -v
composer -V
```

If either command is unavailable, detect the user's operating system and install the prerequisites with the appropriate command:

macOS:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/mac/8.5)"
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://php.new/install/windows/8.5'))
```

Linux:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/linux/8.5)"
```

After installation, ask the user to restart their terminal. If the agent needs the restarted shell to continue, ask the user to reopen their terminal and rerun their original prompt.

## Agent Setup

Install Laravel Boost from the application root before making application changes:

```sh
composer require laravel/boost --dev
php artisan boost:install
```

Boost replaces these bootstrap instructions with guidelines tailored to the application. After installation, read `AGENTS.md` again and continue with the user's original request using the generated guidelines.
</laravel-boost-guidelines>

# CampusFlow — Project Rules

These rules come from `/PROMPT.md`, the complete master development
prompt for CampusFlow. Read that file before starting. The rules below
are hard requirements and cannot be skipped for convenience.

## Architecture

- Modular monolith: Laravel REST API + PostgreSQL 17/PostGIS + Redis +
  Laravel Reverb (WebSockets). No unnecessary microservices.
- The deterministic backend controls correctness. AI interprets,
  predicts, recommends, assists — never let an LLM touch the database.
- Feature-oriented structure: feature Services/Actions/Policies per
  domain, not giant generic controllers.

## Backend authority & correctness

- Backend authorization is authoritative: middleware + policies +
  validation. Never trust role, user ID, queue position, capacity, or
  permissions sent by the frontend.
- Queue capacity & concurrency: transactions, `SELECT ... FOR UPDATE`,
  unique constraints, atomic operations. No duplicate positions, no
  over-capacity admission, no race-condition tickets, no ghost/duplicate
  tickets (proximity/geofence eligibility rules).
- Every endpoint: defined URL, method, auth, authorization, request
  validation, response format, error behavior. Uniform JSON envelope
  (`success`/`data`/`message`/`errors`). Correct HTTP statuses — never
  200 for failures.
- QR payloads are untrusted input: validate against backend records.
- Off-route is not abandonment: warn → grace period → recalculate;
  cancel only when abandonment criteria are met.
- Location data is sensitive: collect only when needed; do not store
  continuous location history.

## Testing (PHPUnit/Pest)

- Test auth, authorization, validation, business rules, queue
  concurrency, capacity, geofence, ticket generation, office ticket
  logic, cancellation, timeout, no-show, check-in, navigation, API
  responses, policies.
- Compiling/rendering is not "done" — see PROMPT.md §93 Definition of
  Done.

## Seed data & docs

- Realistic fictional dev seed data: buildings, floors, rooms, QR
  nodes, navigation graph, geofences, courses, users, enrollments,
  timetables, events, announcements, queues, offices
  (Principal's Office, Secretary's Office, Student Affairs Office,
  Dean's Office, Registrar), service windows.
- Keep `docs/api.md` synchronized with implementation; never build
  clients against imaginary endpoints.
- Never fabricate data, endpoints, or design research.
