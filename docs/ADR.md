# Architectural Design & System Specification: Airline Management

## 1. Executive Summary
This document outlines the architectural decisions for the Airline Management System based on the Prisma schema. The system is designed for high consistency, ensuring physical assets (seats, aircraft) are synchronized with digital transactions (bookings, payments).

---

## 2. Core Data Entities & Attributes

### 2.1 Identity and Access Management (IAM)
The system separates core authentication from operational personas using a 1:1 relational extension pattern.

* **User**: Central identity store. Includes `firstName`, `lastName`, `email` (Unique), `phone` (Array), `password`, and `birthDate`. Statuses include `ACTIVE`, `INACTIVE`, and `SUSPENDED`.
* **Passenger**: Extends `User`. Tracks `passportNumber` (Unique) and `nationality`. Links to `Baggage`, `SSRs`, and `Waitlists`.
* **Staff**: Extends `User`. Tracks `ssn` (Unique) and `hireDate`. It serves as the parent for specialized roles:
    * **Flight Operations**: `Pilot`, `Copilot`, `FlightAttendant`.
    * **Ground Operations**: `CheckInAgent`, `GateAgent`, `BaggageHandler`.

### 2.2 Flight & Logistics Engine
The system distinguishes between the geographic route and the scheduled instance.

* **Route**: Defines `departAirportId` and `arriveAirportId` with `distance` and `duration`.
* **FlightSchedule**: The blueprint for recurring flights. Includes `recurrenceType` (Daily, Weekly, Monthly) and validity dates.
* **Flight**: The concrete instance. Includes `flightNo`, `scheduledDepart`, `actualDepart`, and links to a specific `Aircraft` and `Gate`.
* **FlightStatusHistory**: An audit log tracking transitions from `SCHEDULED` to `ARRIVED` or `CANCELLED`.

### 2.3 Inventory and Assets
* **Aircraft**: Tracks `model`, `capacity`, and `status`.
* **Seat**: Highly granular. Includes `seatNumber`, `SeatClass` (Economy to First Class), `price`, and safety flags like `isExitRow` or `isBlocked`.
* **Airport Infrastructure**: Hierarchical mapping from `Airport` → `Terminal` → `Gate`.

---

## 3. Financial and Booking Integrity
To prevent data loss and ensure financial auditability, the following attributes are enforced:

* **Precision Pricing**: All currency fields (`totalFare`, `amount`, `basePrice`) use `Decimal(10, 2)` to avoid floating-point errors.
* **PNR & Ticketing**: 
    * `Booking` generates a unique `pnrCode`.
    * `Ticket` generates a unique `ticketNo`. 
    * A booking acts as a container for multiple tickets (Group Bookings).
* **Payment & Refund**: 1:1 relations to bookings ensure that a transaction cannot be orphaned.

---

## 4. Automation Strategy: Redis & BullMQ

The system utilizes **Redis** as a message broker and **BullMQ** as the task coordinator for time-sensitive airline operations.



### 4.1 Scheduled Tasks (Cron Jobs)
**Job: `flight-generation-service`**
* **Schedule**: Runs daily at 00:00 UTC.
* **Logic**: 
    1.  Scans `FlightSchedule` for active records.
    2.  Calculates the next occurrences based on `recurrenceType`.
    3.  Checks `Aircraft` and `Crew` availability.
    4.  Bulk inserts new `Flight` records into the database for a 30-day rolling window.

### 4.2 Delayed Tasks (Booking Watchdogs)
**Job: `pnr-expiry-watchdog`**
* **Trigger**: Triggered on `Booking` creation.
* **Delay**: 30 minutes.
* **Logic**: 
    1.  Wakes up after 30 mins to check `BookingStatus`.
    2.  If status is still `PENDING`, it updates to `CANCELLED`.
    3.  Triggers a sub-job to release the `Seat` and notify the `User`.

### 4.3 High-Priority Events
**Job: `ops-alert-system`**
* **Trigger**: Change in `FlightStatus` (e.g., `DELAYED`) or `BaggageStatus` (e.g., `LOST`).
* **Logic**: Immediately pushes notifications to the `Passenger` via their `User.phone` or `User.email`.

---

## 5. Constraints & Data Safety

| Model | Constraint | Rationale |
| :--- | :--- | :--- |
| **User** | `@@index([email])` | Optimizes login speed. |
| **Seat** | `@@unique([aircraftId, seatNumber])` | Prevents duplicate physical seat assignments. |
| **CheckIn** | `@@unique([passengerId, flightId])` | Enforces "One Person, One Seat" per flight. |
| **Route** | `@@unique([departAirportId, arriveAirportId])` | Prevents redundant route definitions. |
| **Booking** | `@@index([pnrCode])` | Facilitates rapid check-in searches. |

---

## 6. Future Extensibility
* **Loyalty Points**: Can be added as a relation to the `User` model.
* **Maintenance Logs**: Can be linked to `Aircraft` via a new `MaintenanceRecord` model.
* **Multi-segment Flights**: Supported by linking multiple `Flight` IDs to a single `Ticket`.
