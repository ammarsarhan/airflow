# Airline Operations Management System

> **A production-inspired Airline Operations Platform designed to demonstrate advanced backend engineering, system design, and real-world operational workflows.**

This project is intentionally built as a **systems-heavy, architecture-focused application** to showcase skills expected from **FAANG / YC-level fullstack engineers**.

---

## Why this project exists (Context for reviewers)

Most portfolio projects demonstrate CRUD proficiency. This project intentionally goes further.

**Goal:** simulate the *internal software backbone of a real airline* — the type of system that coordinates thousands of daily operations across flights, crews, airports, and passengers.

This repository prioritizes:

* System design & architectural reasoning
* Real-world domain modeling
* State machines & workflows
* Event-driven patterns
* Scalability & failure-awareness
* Clear documentation & tradeoffs

---

## What this system is (and is not)

### This *IS*

* An **internal Airline Operations Management System**
* Comparable to software used by airlines like Emirates, Lufthansa, or Delta
* Focused on *operations*, not just ticket sales

### This is *NOT*

* A consumer flight aggregator (Skyscanner, Booking.com)
* A simple booking CRUD app
* A UI-first demo without backend depth

---

## Target Users

### Primary (Core Users)

* Airline administrators
* Airport operations staff
* Check-in agents
* Gate agents
* Baggage handlers
* Crew planners
* Maintenance engineers
* Operations Control Center (OCC)

### Secondary

* Airline management & analytics teams

### Limited / External

* Passengers (booking, online check-in, boarding pass only)

> **~90% of system functionality is internal-facing**, mirroring real airline software usage.

---

## Core Domain: Flight Lifecycle (System Backbone)

Every module supports a single core workflow: **the lifecycle of a flight**.

```
FLIGHT CREATED
   ↓
TICKETS SOLD
   ↓
CHECK-IN
   ↓
BAGGAGE DROP
   ↓
BOARDING
   ↓
DEPARTURE
   ↓
ARRIVAL
   ↓
POST-FLIGHT ANALYTICS
```

This mirrors how airlines operate in reality and drives all design decisions.

---

## Architecture Overview

The system follows a **domain-driven, event-oriented architecture**.

### Bounded Contexts

* Auth & Identity
* Flight Management
* Booking & Ticketing
* Check-In
* Boarding
* Baggage
* Aircraft & Maintenance
* Crew Management
* Operations Control
* Notifications
* Analytics & Reporting

> Implemented as a **modular monolith** with clear domain boundaries, intentionally designed for future service extraction.

---

## Explicit State Machines

### Booking Lifecycle

```
CREATED → CONFIRMED → CHECKED_IN → BOARDED → COMPLETED
                    ↘ CANCELLED
```

### Flight Status Lifecycle

```
SCHEDULED → BOARDING → DEPARTED → ARRIVED
     ↘ DELAYED
     ↘ CANCELLED
```

State transitions are:

* Explicit
* Role-restricted
* Fully validated

This eliminates entire classes of operational bugs.

---

## Event-Driven Design

The system emits **domain events** to decouple workflows:

* `booking.created`
* `checkin.completed`
* `flight.status.changed`
* `passenger.boarded`
* `baggage.status.updated`

Events trigger:

* Notifications
* Dashboard updates
* Analytics pipelines

This mirrors real-world distributed airline systems.

---

## Roles & Access Control

| Role           | Scope                                            |
| -------------- | ------------------------------------------------ |
| Admin          | System configuration, flights, aircraft, reports |
| Operations     | Delays, gate changes, aircraft swaps             |
| Check-in Staff | Passenger check-in, seat changes                 |
| Gate Agents    | Boarding validation                              |
| Baggage Staff  | Baggage registration & tracking                  |
| Crew           | Schedule & duty overview                         |
| Passenger      | Booking, check-in, boarding pass                 |

RBAC is enforced at **API, service, and UI levels**.

---

## Operational Dashboards

Real-time dashboards provide:

* Live flight boards
* Occupancy & load factors
* Delay monitoring
* Crew utilization
* Route performance

Updates are delivered using **WebSockets / Server-Sent Events**.

---

## Engineering & System Design Practices Demonstrated

This project explicitly demonstrates:

* Domain-Driven Design (DDD)
* State machine modeling
* Event-driven architecture
* Idempotent operations
* Failure-aware workflows
* Role-based access control
* Scalability & caching strategies
* Architecture Decision Records (ADRs)
* Clear separation of concerns

Design documentation is included under `/docs`.

---

## Tech Stack

### Backend

* Node.js (ExpressJS)
* PostgreSQL
* Redis (caching + queues)
* BullMQ / Redis Streams (events)

### Frontend

* Next.js (App Router)
* Tailwind CSS
* React Query
* Framer Motion

### Infrastructure

* Docker
* Vercel
* Render

---

## Repository Structure
```
/ui
    /app
        /auth
            /sign-in
            /sign-up
        /(passenger)
            /search
            /flights
                /[id]
            /booking
                /[id]
                    /select-seats
                    /confirm
                    /payment
            /bookings
                /[id]
            /check-in
                /[id]
            /boarding
                /[id]
        /(admin)
            /dashboard
            /flights
                /create
                /[id]
                    /edit
            /aircraft
                /create
                /[id]
                    /edit
                    /maintenance
            /routes
                /create
                /[id]
                    /edit
            /airports
                /create
                /[id]
                    /edit
            /crew
                /create
                /[id]
                    /schedule
            /pricing
                /routes
                /classes
                /discounts
            /reports
            /users
                /create
                /[id]
            /settings
        /(operations)
            /dashboard
            /flights
                /[id]
                    /assign
                    /modify
            /schedules
                /daily
                /weekly
        /(check-in)
            /dashboard
            /search
            /bookings/[id]
                /check-in
                /baggage
                /print
                /modify
        /(gate)
            /dashboard
            /flights
                /[id]
                    /boarding
                    /manifest
                    /scan
        /(baggage)
            /dashboard
            /scan
            /track/[id]
            /reports
                /create
                /[id]
        /(crew)
            /dashboard
            /schedule
                /upcoming
                /history
            /flights/[id]
            /availability
        /account
            /profile
            /settings
            /notifications
            /history
    /components
        /ui
        /layout
    /lib
        /api
        /utils
        /hooks
        /constants
        /types
    /styles
        /globals.css
        /themes
    
    /public
        /images
        /icons
/api
    /prisma
        schema.prisma
        /migrations
        /seed
            /data
    /shared
        /middleware
        /utils
        /config
        /constants
            roles.js
            flightStatus.js
            bookingStatus.js
            baggageStatus.js
            errorCodes.js
    /domains
        /auth
        /flights
        /bookings
        /check-in
        /boarding
        /baggage
        /aircraft
        /crew
        /airports
        /pricing
        /notifications
            /templates
        /reports
        /operations
    /tests
        /unit
            /domains
        /integration
        /e2e
    
    app.js
    index.js
/docs
    overview.md
    domains.md
    api.md
    schema.md
    authentication.md
    deployment.md
    roles.md

.gitignore
package.json
README.md

```


```
/ui
    /app
        /account
            /settings
            /security
            /preferences
        /auth
            /user
                /sign-up
            /sign-in
        /search
        /flight
            /[id]
        /booking
            /[id]
        /(admin)
            /dashboard
                /flight
                    /[id]
                        /edit
                /flights
                    /create
                /aircraft
                    /create
                    /[id]
                        /edit
                /crew
                    /manage
                    /[id]
                /reports
                /users
        /(operations)
            /dashboard
            /flights
            /flight
                /[id]
                    /modify
        /(check-in)
            /dashboard
            /flight
                /[id]
                    /bookings
                    /booking
                        /[id]
                            /process 
        /(gate)
            /dashboard
            /flights
            /flight
                /[id]
                    /board
                    /manifest
        /(baggage)
            /dashboard
                /scan
                /track
                    /[id]
                /reports
        /(crew)
            /dashboard
                /schedule
                /flights
                /availability
        /account
            /settings
            /history
            /notifications
        /components
            /ui
            /layout
        /lib
            /api
            /utils
            /hooks
            /constants
            /types
/api
    /prisma
    /shared
    /domains
        /auth
        /flight
        /booking
        /check-in
        /boarding
        /baggage
        /aircraft
        /crew
        /operations
        /notifications
/docs
  overview.md
  domains.md
```

---

## Project Intent

This project is intentionally built to:

* Reflect **real production systems**, not toy examples
* Demonstrate **backend engineering maturity**
* Show **clear architectural thinking**
* Serve as a foundation for future expansion (cargo, loyalty, multi-airline)

---

## Explicit Non-Goals (Current Scope)

* Global flight aggregation
* External ticket resale
* Cargo logistics
* Full loyalty program

These are intentionally excluded to maintain architectural focus.

---

## Author

**Ammar Sarhan**
Frontend / System Engineer
Backend / System Engineer

---

## 📎 License

MIT License
