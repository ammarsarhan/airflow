# Architecture Decision Record: Flight Management System

**Date:** December 24, 2025

**Context:** Design and implementation of a comprehensive airline flight management system with multi-role authentication, booking management, and operational workflows.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Authentication & Authorization Architecture](#authentication--authorization-architecture)
3. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
4. [Data Model Design Decisions](#data-model-design-decisions)
5. [Background Job Processing Architecture](#background-job-processing-architecture)
6. [Security Considerations](#security-considerations)
7. [Consequences](#consequences)

---

## Executive Summary

This ADR documents the architectural decisions for a flight management system supporting passenger bookings, flight operations, crew management, and multi-role staff coordination. The system employs JWT-based authentication with refresh token rotation, role-based authorization across 10 distinct user roles, and BullMQ/Redis for asynchronous job processing and automated expiry workflows.

---

## Authentication & Authorization Architecture

### Decision: JWT-Based Authentication with Dual Token Strategy

**Context:**  
The system requires secure, stateless authentication supporting multiple user roles across web and mobile platforms with varying session requirements.

**Decision:**  
Implement a dual-token JWT strategy with short-lived access tokens and long-lived refresh tokens.

#### Access Tokens
- **Type:** JWT (JSON Web Token)
- **Expiration:** 15 minutes
- **Storage:** Memory only
- **Payload Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "PASSENGER",
  "staffRole": "PILOT",
  "status": "ACTIVE",
  "iat": 1703462400,
  "exp": 1703463300
}
```

**Design Decisions:**
- **Short expiration (15 min):** Minimizes exposure window if token is compromised
- **Stateless verification:** No database lookup required for every request, improving performance
- **Role inclusion:** Enables immediate authorization checks without additional queries
- **Status field:** Allows real-time enforcement of account suspension

#### Refresh Tokens
- **Type:** Opaque token (UUID v4)
- **Expiration:** 30 days
- **Storage:** Secure HTTP-only cookie with SameSite=Strict
- **Database Persistence:** Required

**Schema Addition:**
```prisma
model RefreshToken {
  id          String   @id @default(cuid())
  token       String   @unique
  userId      String
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  revokedAt   DateTime?
  replacedBy  String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([token])
  @@index([userId])
}
```

**Design Decisions:**
- **Opaque tokens:** Cannot be decoded client-side, requiring server validation
- **Rotation on refresh:** Each refresh generates new access + refresh token, invalidating old refresh token
- **Revocation tracking:** `replacedBy` field creates audit trail for token chain
- **Family invalidation:** If compromised token is used, entire token family is revoked

#### Token Flow

```
1. Login
   ├─> Validate credentials
   ├─> Generate access token (15min)
   ├─> Generate refresh token (30d)
   ├─> Store refresh token in DB
   └─> Return tokens to client

2. API Request
   ├─> Extract access token from Authorization header
   ├─> Verify JWT signature
   ├─> Check expiration
   ├─> Validate user status (ACTIVE)
   └─> Authorize based on role

3. Token Refresh
   ├─> Extract refresh token from HTTP-only cookie
   ├─> Validate token exists in DB
   ├─> Check expiration and revocation status
   ├─> Generate new access + refresh token pair
   ├─> Revoke old refresh token (set revokedAt, replacedBy)
   └─> Return new tokens

4. Logout
   ├─> Revoke refresh token in DB
   └─> Clear HTTP-only cookie
```

**Alternatives Considered:**

1. **Session-based authentication:** Rejected due to scalability concerns and requirement for stateless API
2. **Single long-lived JWT:** Rejected due to security risk of token compromise
3. **Access token in localStorage:** Rejected due to XSS vulnerability
4. **Sliding session expiration:** Rejected due to complexity and potential for indefinite sessions

---

## Role-Based Access Control (RBAC)

### Decision: Hierarchical Multi-Role System with Granular Permissions

**Context:**  
The airline system requires 10 distinct roles with varying access levels, from passengers to operations managers, each requiring specific capabilities and data access.

### Role Hierarchy & Permissions

#### 1. ADMIN (UserRole.ADMIN)
**Scope:** System-wide administrative access

**Capabilities:**
- Create, read, update, delete all resources
- Manage user accounts and role assignments
- Access system configuration and settings
- View all financial data and reports
- Override booking and flight operations

**Design Decisions:**
- **No staff role required:** Admin is a separate concern from operational staff
- **Audit logging mandatory:** All admin actions logged for compliance
- **MFA required:** Additional security layer for privileged access

**Database Access Pattern:**
```typescript
// Unrestricted query access
await prisma.user.findMany() // No filters needed
```

---

#### 2. OPERATIONS (UserRole.OPERATIONS)
**Scope:** Flight operations and scheduling management

**Capabilities:**
- Create and modify flight schedules
- Assign aircraft and crews to flights
- Update flight statuses (SCHEDULED → BOARDING → DEPARTED, etc.)
- Manage gates and terminals
- Access operational reports and metrics
- Override booking constraints for operational needs

**Design Decisions:**
- **Separate from ADMIN:** Operations managers don't need user management access
- **Revenue visibility:** Can view revenue data for operational decisions
- **No direct passenger data access:** Must go through booking system

**Database Access Pattern:**
```typescript
// Can access all flight-related operations
await prisma.flight.update({
  where: { id: flightId },
  data: { status: 'DEPARTED', actualDepart: new Date() }
})
```

---

#### 3. STAFF (UserRole.STAFF + StaffRole variants)
**Scope:** Operational staff with specific functional responsibilities

The system implements a dual-role pattern for staff:
- **UserRole.STAFF:** Identifies user as staff member
- **StaffRole enum:** Specifies functional role (CHECK_IN, GATE_AGENT, etc.)

**Design Rationale:**
- **Separation of concerns:** User-level vs function-level roles
- **Audit trail:** Track who performed actions at both identity and function level
- **Flexible assignment:** Staff can potentially hold multiple certifications

#### 3a. CHECK_IN (StaffRole.CHECK_IN)
**Capabilities:**
- Process passenger check-ins
- Assign seats
- Process baggage check-in
- Verify passenger documents
- Handle SSRs (Special Service Requests)
- Issue boarding passes

**Design Decisions:**
- **Flight-scoped access:** Can only access data for flights within check-in window (24h-45min before departure)
- **Read-only passenger info:** Cannot modify passenger personal data
- **Baggage tracking:** Creates baggage records with status CHECKED_IN

**Access Control Logic:**
```typescript
// Can only check in passengers for flights in check-in window
const checkInWindow = {
  scheduledDepart: {
    gte: new Date(Date.now() + 45 * 60 * 1000), // 45 min from now
    lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  }
}
```

#### 3b. GATE_AGENT (StaffRole.GATE_AGENT)
**Capabilities:**
- Verify boarding passes
- Update ticket status to BOARDED
- Manage boarding queue
- Handle last-minute seat changes
- Coordinate with check-in for late passengers
- Update flight status to BOARDING/DEPARTED

**Design Decisions:**
- **Gate-scoped access:** Can only access flights assigned to their current gate
- **Status transition authority:** Can move flight from BOARDING to DEPARTED
- **Real-time coordination:** Requires up-to-date gate assignment data

**Access Control Logic:**
```typescript
// Can only access assigned gate's flights
where: {
  gateId: staff.assignedGateId,
  status: { in: ['SCHEDULED', 'BOARDING'] }
}
```

#### 3c. BAGGAGE_HANDLER (StaffRole.BAGGAGE_HANDLER)
**Capabilities:**
- Update baggage status throughout journey
- Report damaged or lost baggage
- Load/unload baggage from aircraft
- Transfer baggage between flights
- Scan baggage tags for tracking

**Design Decisions:**
- **Status-driven workflow:** Can transition baggage through CHECKED_IN → LOADED → IN_TRANSIT → ARRIVED → DELIVERED
- **Problem reporting:** Can mark baggage as LOST or DAMAGED
- **Limited passenger info:** Only sees name and flight info, not personal details

**Workflow States:**
```typescript
enum BaggageStatus {
  CHECKED_IN    // At check-in counter
  LOADED        // Loaded onto aircraft
  IN_TRANSIT    // On connecting flight
  ARRIVED       // At destination airport
  DELIVERED     // Handed to passenger
  LOST          // Cannot be located
  DAMAGED       // Damaged during handling
}
```

#### 3d. PILOT (StaffRole.PILOT)
**Capabilities:**
- View assigned flight details
- Access weather and route information
- View crew roster
- Update flight status (IN_FLIGHT, LANDED)
- Access aircraft maintenance status
- View passenger count and cargo weight

**Design Decisions:**
- **Flight-scoped access:** Can only access flights where assigned as pilot
- **Safety-critical info:** Has access to aircraft technical data
- **Limited passenger details:** Sees count and SSRs, not personal information
- **Crew coordination:** Can view full crew assignment

**Access Control Logic:**
```typescript
where: {
  flightCrew: {
    pilotId: pilot.id
  },
  scheduledDepart: {
    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past 24 hours
    lte: new Date(Date.now() + 48 * 60 * 60 * 1000)  // Next 48 hours
  }
}
```

#### 3e. COPILOT (StaffRole.COPILOT)
**Capabilities:**
- Identical to PILOT role
- Assists in flight operations
- Can update flight status
- Views same operational data

**Design Decisions:**
- **Parity with pilot:** No capability distinction for system access
- **Separate tracking:** Distinct for crew scheduling and regulatory compliance
- **Redundancy:** Either pilot or copilot can perform system updates

#### 3f. STAFF (StaffRole.STAFF)
**Capabilities:**
- General airline staff with basic operational access
- View flight schedules
- Access passenger counts
- Basic reporting

**Design Decisions:**
- **Fallback role:** For staff not fitting other categories
- **Read-mostly access:** Cannot modify critical operational data
- **Future extensibility:** Allows new staff types without schema changes

---

#### 4. PASSENGER (UserRole.PASSENGER)
**Scope:** Personal booking and travel management

**Capabilities:**
- Create and manage own bookings
- View and select flights
- Purchase tickets
- Request refunds
- Submit SSRs (wheelchair, special meals, etc.)
- Check-in online
- View boarding passes
- Track baggage status

**Design Decisions:**
- **Self-service model:** Maximum autonomy for common tasks
- **Data isolation:** Can only access own booking/flight data
- **Payment handling:** Processes payments through secure gateway
- **SSR workflow:** Requests go to REQUESTED status, require staff approval

**Access Control Logic:**
```typescript
// All queries must filter by userId
where: {
  userId: currentUser.id
}

// For viewing flights, only show bookable flights
where: {
  status: { in: ['SCHEDULED', 'BOARDING'] },
  scheduledDepart: { gte: new Date() }
}
```

**Data Isolation Rules:**
```typescript
// Can view own data only
booking: { where: { userId: currentUser.id } }
ticket: { where: { passenger: { userId: currentUser.id } } }
baggage: { where: { passenger: { userId: currentUser.id } } }
```

---

### Role Authorization Middleware

**Implementation Pattern:**
```typescript
const rolePermissions = {
  ADMIN: ['*'], // All resources
  OPERATIONS: [
    'flight:*',
    'aircraft:*',
    'crew:*',
    'gate:*',
    'schedule:*',
    'route:read'
  ],
  STAFF: {
    CHECK_IN: [
      'checkin:create',
      'seat:assign',
      'baggage:create',
      'ssr:read',
      'ticket:update'
    ],
    GATE_AGENT: [
      'boarding:manage',
      'ticket:board',
      'flight:status:update'
    ],
    BAGGAGE_HANDLER: [
      'baggage:read',
      'baggage:update',
      'baggage:status'
    ],
    PILOT: [
      'flight:read',
      'crew:read',
      'aircraft:read',
      'flight:status:update'
    ],
    COPILOT: [
      'flight:read',
      'crew:read',
      'aircraft:read',
      'flight:status:update'
    ],
    STAFF: [
      'flight:read',
      'schedule:read'
    ]
  },
  PASSENGER: [
    'booking:own',
    'ticket:own',
    'flight:public:read',
    'ssr:create',
    'checkin:own'
  ]
}

// Middleware implementation
async function authorizeRequest(req, resource, action) {
  const { role, staffRole } = req.user
  
  if (role === 'ADMIN') return true
  
  if (role === 'STAFF') {
    const permissions = rolePermissions.STAFF[staffRole]
    return permissions.includes(`${resource}:${action}`)
  }
  
  const permissions = rolePermissions[role]
  return permissions.some(p => 
    p === '*' || 
    p === `${resource}:*` || 
    p === `${resource}:${action}`
  )
}
```

---

## Data Model Design Decisions

### User & Identity Management

#### User Model Design
```prisma
model User {
  id        String     @id @default(cuid())
  firstName String
  lastName  String
  email     String     @unique
  phone     String[]
  password  String
  birthDate DateTime
  role      UserRole
  status    UserStatus @default(ACTIVE)
  createdAt DateTime   @default(now())
}
```

**Decision Rationale:**

1. **CUID for IDs (`@default(cuid())`):**
   - **Why not UUID:** CUIDs are collision-resistant, sortable by time, and more compact
   - **Why not auto-increment:** Exposes database size and insertion order
   - **Benefits:** URL-safe, distributed system friendly, no coordination needed

2. **Email as unique identifier:**
   - **Primary login credential:** Industry standard for airlines
   - **Unique constraint:** Prevents duplicate accounts
   - **Indexed:** Fast lookup during authentication

3. **Phone as array (`String[]`):**
   - **Multiple contacts:** Users may want home, mobile, emergency numbers
   - **International formats:** No format validation at DB level (handled in application)
   - **Notification channels:** Support SMS to any registered number

4. **Password storage:**
   - **Type:** String (stores bcrypt hash, never plaintext)
   - **Hashing:** bcrypt with cost factor 12
   - **Application-level enforcement:** Never expose password in queries
   ```typescript
   await prisma.user.create({
     data: {
       ...userData,
       password: await bcrypt.hash(password, 12)
     }
   })
   ```

5. **BirthDate requirement:**
   - **Regulatory compliance:** TSA requires birthdate for passenger verification
   - **Age restrictions:** Unaccompanied minor rules, senior discounts
   - **Identity verification:** Part of passenger matching algorithm

6. **Status enum:**
   - **ACTIVE:** Normal account state
   - **INACTIVE:** User-initiated deactivation (soft delete)
   - **SUSPENDED:** Admin/system-imposed restriction
   - **Access control:** Checked on every authentication attempt

7. **Embedded address vs separate table:**
   - **Decision:** Embedded (street, city, state, country as nullable fields)
   - **Rationale:** 
     - One address per user sufficient for airline use case
     - Avoids JOIN for common query (user profile)
     - Nullable for international users without structured address
   - **Alternative rejected:** Separate Address table would add complexity for minimal benefit

---

### Passenger Model

```prisma
model Passenger {
  id             String @id @default(cuid())
  userId         String @unique
  passportNumber String @unique
  nationality    String
}
```

**Decision Rationale:**

1. **Separate from User model:**
   - **Why:** Not all users are passengers (staff, operations, admins)
   - **1:1 relationship:** One user can have zero or one passenger profile
   - **Data isolation:** Passport data only exists for those who need to travel

2. **PassportNumber unique constraint:**
   - **Regulatory:** International travel requires passport verification
   - **Fraud prevention:** Prevents multiple accounts with same passport
   - **Edge case handling:** Passport renewals handled by update, not new record
   - **Limitation:** Doesn't handle users with multiple passports (future enhancement)

3. **Nationality as String:**
   - **Why not enum:** 195+ countries, frequent geopolitical changes
   - **Format:** ISO 3166-1 alpha-3 country codes (e.g., "USA", "GBR")
   - **Validation:** Application-level using ISO standard list

---

### Booking & Ticketing System

#### Booking Model
```prisma
model Booking {
  id            String        @id @default(cuid())
  pnrCode       String        @unique
  userId        String
  passengerId   String
  totalFare     Decimal       @db.Decimal(10, 2)
  status        BookingStatus @default(PENDING)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

**Decision Rationale:**

1. **PNR Code (Passenger Name Record):**
   - **Format:** 6-character alphanumeric (e.g., "A4B9X2")
   - **Generation:** Application-level using crypto-random generation
   - **Unique constraint:** Industry standard for booking reference
   - **Usage:** Customer-facing identifier for retrieving bookings
   ```typescript
   const generatePNR = () => {
     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
     return Array.from(crypto.getRandomValues(new Uint8Array(6)))
       .map(x => chars[x % chars.length])
       .join('')
   }
   ```

2. **Both userId and passengerId:**
   - **userId:** Who made the booking (can be travel agent, family member)
   - **passengerId:** Who is traveling
   - **Use case:** Corporate bookings where admin books for employee
   - **Access control:** User can manage their bookings, passenger can check-in

3. **Decimal(10, 2) for totalFare:**
   - **Why Decimal:** Financial calculations require exact precision
   - **Why not Float:** Floating-point arithmetic causes rounding errors
   - **Precision:** 10 digits total, 2 after decimal (up to $99,999,999.99)
   - **Currency:** Stored in system base currency (USD), conversion at display

4. **BookingStatus enum:**
   - **PENDING:** Created but payment not completed
   - **CONFIRMED:** Payment successful, tickets can be issued
   - **CANCELLED:** User or system cancelled booking
   - **COMPLETED:** Flight has departed, booking archived
   - **Workflow:** PENDING → CONFIRMED → COMPLETED or CANCELLED

5. **updatedAt auto-tracking:**
   - **Prisma feature:** Automatically updates on any modification
   - **Audit trail:** Track when booking was last changed
   - **Concurrency:** Can use for optimistic locking

---

#### Ticket Model
```prisma
model Ticket {
  id           String       @id @default(cuid())
  ticketNo     String       @unique
  bookingId    String
  passengerId  String
  flightId     String
  seatId       String?
  fareClassId  String
  ticketStatus TicketStatus @default(ISSUED)
  issuedAt     DateTime     @default(now())
}
```

**Decision Rationale:**

1. **Separate Ticket from Booking:**
   - **1:N relationship:** One booking can have multiple tickets (round-trip, multi-city)
   - **Individual lifecycle:** Each ticket has independent check-in, boarding status
   - **Refund granularity:** Can refund individual legs of journey

2. **TicketNo format:**
   - **Industry standard:** 13-digit numeric (airline code + ticket number)
   - **Example:** "176-2159832741" (176=Emirates, rest is sequence)
   - **Unique constraint:** No duplicate ticket numbers across entire system

3. **SeatId nullable:**
   - **Why:** Seat selection optional at booking, required at check-in
   - **Workflow:** Book → Select seat (optional) → Check-in (required)
   - **Free seating:** Some airlines don't do advance seat selection

4. **FareClassId relation:**
   - **Why separate table:** Fare classes change frequently (pricing strategy)
   - **Price snapshot:** Ticket stores fareClassId, not direct price
   - **Historical accuracy:** Can reconstruct what fare rules applied at time of booking
   - **Alternative rejected:** Storing price directly loses fare class context

5. **TicketStatus enum:**
   - **ISSUED:** Ticket created, not yet checked in
   - **CHECKED_IN:** Passenger checked in, boarding pass issued
   - **BOARDED:** Passenger boarded aircraft
   - **CANCELLED:** Ticket cancelled (triggers refund workflow)
   - **REFUNDED:** Money returned to passenger
   - **State machine:** Enforces valid transitions

---

### Flight Operations

#### Flight Model
```prisma
model Flight {
  id              String       @id @default(cuid())
  flightNo        String
  routeId         String
  aircraftId      String?
  scheduleId      String?
  scheduledDepart DateTime
  actualDepart    DateTime?
  scheduledArrive DateTime
  actualArrive    DateTime?
  status          FlightStatus @default(SCHEDULED)
  revenue         Decimal?     @db.Decimal(12, 2)
  gateId          String?
  flightCrewId    String?      @unique
}
```

**Decision Rationale:**

1. **FlightNo as String (not unique):**
   - **Why:** Same flight number reused daily (e.g., "AA100" operates daily)
   - **Uniqueness:** (flightNo + scheduledDepart) forms natural unique key
   - **Index:** Indexed for fast lookup in flight search
   - **Format:** Airline code + 1-4 digits (e.g., "UA1234")

2. **Scheduled vs Actual times:**
   - **scheduledDepart/Arrive:** Published schedule (never changes)
   - **actualDepart/Arrive:** Real departure/arrival (nullable until occurs)
   - **Why separate:** Track delays, analyze on-time performance
   - **Metrics:** `actualDepart - scheduledDepart = delay`

3. **AircraftId nullable:**
   - **Why:** Aircraft assigned closer to departure (tail swap handling)
   - **Flexibility:** Can change aircraft due to maintenance
   - **Workflow:** Schedule → Assign Aircraft → Assign Crew → Depart

4. **ScheduleId nullable:**
   - **Why:** Flights can be schedule-generated or one-off
   - **Use case:** Regular schedule (DailySchedule) vs charter/special flights
   - **Null means:** One-time flight, not part of recurring schedule

5. **Revenue tracking:**
   - **Decimal(12, 2):** Larger than booking totalFare (flight has many bookings)
   - **Nullable:** Not calculated until flight completes
   - **Calculation:** Sum of all ticket fares on flight
   - **Usage:** Financial reporting, route profitability analysis

6. **FlightStatus enum (8 states):**
   ```
   SCHEDULED → BOARDING → DEPARTED → IN_FLIGHT → LANDED → ARRIVED → (COMPLETED)
                    ↓
                CANCELLED
                    ↓
                DELAYED
   ```
   - **SCHEDULED:** Published, accepting bookings
   - **BOARDING:** Gate open, passengers boarding (45min-10min before departure)
   - **DEPARTED:** Aircraft left gate
   - **IN_FLIGHT:** Airborne (pilot updates)
   - **LANDED:** Touched down on runway
   - **ARRIVED:** At gate, doors open
   - **CANCELLED:** Flight not operating
   - **DELAYED:** Behind schedule but not cancelled

7. **GateId nullable:**
   - **Why:** Gates assigned 2-4 hours before departure
   - **Change frequency:** Gates can change due to operational needs
   - **Real-time updates:** Passengers notified of gate changes

8. **FlightCrewId unique:**
   - **One crew per flight:** Cannot assign same crew to multiple flights
   - **Validation:** Enforces crew availability
   - **Safety regulation:** Crew duty time limitations

---

#### FlightSchedule Model
```prisma
model FlightSchedule {
  id             String         @id @default(cuid())
  routeId        String
  recurrenceType RecurrenceType @default(NONE)
  startDate      DateTime
  endDate        DateTime?
  distance       Int?
  duration       Int?
  status         String         @default("ACTIVE")
}
```

**Decision Rationale:**

1. **RecurrenceType enum:**
   - **DAILY:** Flight operates every day
   - **WEEKLY:** Operates specific days of week (stored separately)
   - **MONTHLY:** Operates specific days of month
   - **NONE:** One-time or manual flight creation
   - **Use case:** Generate flights in batch for season scheduling

2. **StartDate & EndDate:**
   - **StartDate:** When schedule becomes effective
   - **EndDate:** When schedule expires (nullable for ongoing)
   - **Example:** Summer schedule (June 1 - Sept 30)

3. **Distance & Duration nullable:**
   - **Why:** Can be derived from Route model
   - **Denormalization:** Cached here for performance (avoid JOIN)
   - **Update strategy:** Recalculated if route changes

4. **Status as String (not enum):**
   - **Flexibility:** Can add schedule-specific statuses without migration
   - **Values:** "ACTIVE", "SUSPENDED", "EXPIRED"
   - **Design tradeoff:** Less type safety for more flexibility

---

### Payment & Financial System

#### Payment Model
```prisma
model Payment {
  id            String        @id @default(cuid())
  bookingId     String        @unique
  amount        Decimal       @db.Decimal(10, 2)
  method        PaymentMethod
  transactionId String?       @unique
  status        PaymentStatus @default(PENDING)
  timestamp     DateTime      @default(now())
}
```

**Decision Rationale:**

1. **1:1 with Booking:**
   - **bookingId unique:** One payment per booking
   - **Rationale:** Simplified payment flow (no split payments)
   - **Future enhancement:** Could allow multiple partial payments

2. **PaymentMethod enum:**
   - **CREDIT_CARD:** Online card payments
   - **CASH:** Airport counter payments
   - **Limited options:** Intentionally simple for MVP
   - **Excluded:** PayPal, wire transfer, airline miles (future)

3. **TransactionId nullable:**
   - **Why:** Generated by payment gateway, not known at creation
   - **Unique:** One transaction ID across all payments
   - **Usage:** Reference for refunds and disputes
   - **Null case:** CASH payments may not have transaction ID

4. **PaymentStatus workflow:**
   ```
   PENDING → COMPLETED
      ↓
   FAILED → (user retries)
      ↓
   REFUNDED ← (refund processed)
   ```
   - **PENDING:** Payment initiated, awaiting gateway response
   - **COMPLETED:** Money received, booking confirmed
   - **FAILED:** Payment declined or error
   - **REFUNDED:** Money returned to customer

5. **Amount matches Booking.totalFare:**
   - **Validation:** `payment.amount === booking.totalFare`
   - **Enforced:** Application-level constraint
   - **Why separate:** Payment is financial record, booking is commercial

---

#### Refund Model
```prisma
model Refund {
  id          String       @id @default(cuid())
  bookingId   String       @unique
  amount      Decimal      @db.Decimal(10, 2)
  reason      String
  status      RefundStatus @default(REQUESTED)
  createdAt   DateTime     @default(now())
  processedAt DateTime?
}
```

**Decision Rationale:**

1. **1:1 with Booking:**
   - **One refund per booking:** Simplifies refund tracking
   - **Full refund only:** Partial refunds handled through ticket cancellation
   - **Design tradeoff:** Less flexible but easier to manage

2. **Reason as free text:**
   - **Why not enum:** Too many possible cancellation reasons
   - **Examples:** "Flight cancelled", "Medical emergency", "Schedule change"
   - **Usage:** Customer service analysis, pattern detection

3. **RefundStatus workflow:**
   ```
   REQUESTED → PROCESSING → APPROVED → COMPLETED
                               ↓
                           REJECTED
   ```
   - **REQUESTED:** Passenger initiated refund
   - **PROCESSING:** Under review by operations
   - **APPROVED:** Refund authorized, sent to payment processor
   - **REJECTED:** Does not meet refund criteria
   - **COMPLETED:** Money transferred to customer

4. **ProcessedAt nullable:**
   - **Null:** Refund still pending
   - **Set:** Timestamp when refund completed
   - **SLA tracking:** Measure time from createdAt to processedAt

---

### Aircraft & Seating

#### Aircraft Model
```prisma
model Aircraft {
  id             String         @id @default(cuid())
  aircraftNumber String         @unique
  model          String
  capacity       Int
  status         AircraftStatus @default(ACTIVE)
  location       String?
}
```

**Decision Rationale:**

1. **AircraftNumber format:**
   - **Example:** "N12345" (US registration), "A6-EUA" (UAE)
   - **Unique:** Registration number unique worldwide
   - **Indexed:** Fast lookup for flight assignment

2. **Model as String:**
   - **Why not separate table:** Too few shared attributes
   - **Examples:** "Boeing 737-800", "Airbus A320"
   - **Usage:** Display to passengers, maintenance scheduling

3. **Capacity:**
   - **Total seats:** Sum of all seat rows
   - **Denormalized:** Could count Seat records, but cached for performance
   - **Validation:** Check capacity when creating seats

4. **AircraftStatus enum:**
   - **ACTIVE:** Available for flight assignment
   - **MAINTENANCE:** Scheduled or unscheduled maintenance
   - **RETIRED:** No longer in service (historical records)
   - **GROUNDED:** Safety issue, cannot fly
   - **Assignment rule:** Only ACTIVE aircraft can be assigned to flights

5. **Location nullable:**
   - **IATA code:** Current airport location (e.g., "JFK")
   - **Null:** Aircraft in flight (location tracked via Flight.status)
   - **Update trigger:** Set when flight status reaches ARRIVED

---

#### Seat Model (Continued)
```prisma
model Seat {
  id         String    @id @default(cuid())
  aircraftId String
  seatNumber String
  class      SeatClass
  price      Decimal   @db.Decimal(10, 2)
  isExitRow  Boolean   @default(false)
  isBlocked  Boolean   @default(false)
}
```

**Decision Rationale:**

1. **SeatNumber format:**
   - **Example:** "12A", "34F" (row number + letter)
   - **Unique per aircraft:** Same seat numbers reused across different aircraft
   - **Composite unique:** `(aircraftId, seatNumber)` ensures no duplicates per aircraft
   - **Validation:** Application-level format check (1-99 + A-K)

2. **SeatClass enum:**
   - **ECONOMY:** Standard seating
   - **PREMIUM:** Economy plus with extra legroom
   - **BUSINESS:** Lie-flat or angled seating
   - **FIRST_CLASS:** Private suites, premium service
   - **Pricing strategy:** Higher classes command premium prices

3. **Price at seat level:**
   - **Why:** Same class can have different prices (exit row premium, bulkhead)
   - **Dynamic pricing:** Prices can vary by demand (stored in FareClass)
   - **Base + modifier:** Seat.price is the seat-specific component
   - **Alternative rejected:** Single price per class too inflexible

4. **isExitRow flag:**
   - **Regulatory:** Exit row seats have special requirements
   - **Restrictions:** Passengers must be able-bodied, no children
   - **Premium:** Often priced higher due to extra legroom
   - **Check-in validation:** Agent must verify passenger eligibility

5. **isBlocked flag:**
   - **Use cases:** Broken seat, crew rest, maintenance
   - **Temporary:** Can unblock when issue resolved
   - **Booking prevention:** Blocked seats not shown in availability
   - **Revenue tracking:** Reduces available inventory

---

#### FareClass Model
```prisma
model FareClass {
  id        String    @id @default(cuid())
  class     SeatClass
  basePrice Decimal   @db.Decimal(10, 2)
}
```

**Decision Rationale:**

1. **Separate from Seat:**
   - **Why:** Fare rules change frequently, seats are static
   - **Flexibility:** Can have multiple fare classes per seat class (Economy Basic, Economy Flex)
   - **Historical tracking:** Tickets reference fare class at time of purchase

2. **BasePrice:**
   - **Foundation:** Starting price before route/demand multipliers
   - **Calculation:** `finalPrice = basePrice * routeMultiplier * demandFactor + seat.price`
   - **Simple model:** For MVP, keeping pricing straightforward

3. **Missing fields (future enhancement):**
   - Refund rules (non-refundable, flexible, etc.)
   - Change fee policies
   - Baggage allowance
   - Priority boarding rights
   - **Design decision:** Start simple, add complexity as needed

---

### Staff & Crew Management

#### Staff Model
```prisma
model Staff {
  id       String     @id @default(cuid())
  userId   String     @unique
  ssn      String     @unique
  role     StaffRole
  status   UserStatus @default(ACTIVE)
  hireDate DateTime   @default(now())
}
```

**Decision Rationale:**

1. **Separate from User:**
   - **Not all users are staff:** Passengers are users but not staff
   - **1:1 relationship:** One user can have zero or one staff profile
   - **Dual identity:** Staff members also have passenger profiles for personal travel

2. **SSN (Social Security Number):**
   - **Why unique:** Employment verification, payroll
   - **Regulatory:** FAA requires SSN for crew certification
   - **Security:** Encrypted at rest (application layer)
   - **International:** May need different identifiers per country (future)

3. **StaffRole vs UserRole:**
   - **UserRole.STAFF:** Identifies user as staff member (authentication level)
   - **StaffRole enum:** Specifies job function (authorization level)
   - **Access control:** Both checked for permission validation
   - **Example:** User with role=STAFF and staffRole=PILOT can only access pilot functions

4. **Status reuse:**
   - **Same as UserStatus:** ACTIVE, INACTIVE, SUSPENDED
   - **Why separate field:** Staff can be suspended without affecting user account
   - **Use case:** Pilot suspended for training but can still access personal bookings

5. **HireDate:**
   - **Seniority calculations:** Crew scheduling prioritizes senior staff
   - **Anniversary tracking:** Benefits eligibility, tenure rewards
   - **Audit trail:** Track how long staff member has been with airline

---

#### Specialized Staff Models

**Design Pattern: Role-Specific Extensions**

```prisma
model Pilot {
  id      String @id @default(cuid())
  staffId String @unique
  staff   Staff  @relation(fields: [staffId], references: [id])
  crews   Crew[]
}
```

**Decision Rationale:**

1. **Separate tables per role:**
   - **Why not single Staff table:** Different roles need different certifications/data
   - **Example:** Pilots need license numbers, check-in agents need terminal assignments
   - **Extensibility:** Can add role-specific fields without affecting others
   - **Performance:** Avoids sparse columns (many nulls in single table)

2. **1:1 with Staff:**
   - **staffId unique:** One staff member can only be one type
   - **Alternative rejected:** Multiple roles per person (too complex for MVP)
   - **Future enhancement:** Could allow cross-training (pilot who's also instructor)

3. **Timestamps on specialized models:**
   - **createdAt/updatedAt:** Track when certification was created/modified
   - **Separate from Staff.hireDate:** Person hired as gate agent, later became pilot
   - **Audit trail:** Certification history for regulatory compliance

4. **Missing fields (future enhancement):**
   - **Pilot:** License number, medical certificate expiry, flight hours, certifications
   - **FlightAttendant:** Safety training expiry, language skills
   - **CheckInAgent:** Terminal assignment, shift schedule
   - **Design decision:** Start minimal, add as operational needs emerge

---

#### Crew Model
```prisma
model Crew {
  id        String @id @default(cuid())
  name      String
  pilotId   String
  copilotId String
  flight    Flight?
  attendants FlightAttendant[]
}
```

**Decision Rationale:**

1. **Crew as composite entity:**
   - **Why separate model:** Crew is assigned as unit, not individual roles
   - **Reusability:** Same crew can operate multiple flights in sequence
   - **Regulatory:** FAA requires crew composition documentation

2. **Required pilot + copilot:**
   - **Non-nullable:** Every crew must have both
   - **Safety regulation:** Commercial flights require two pilots
   - **Validation:** Enforced at database level

3. **Variable attendants:**
   - **M:N relationship:** Crew has many attendants, attendant can be on many crews
   - **Count requirement:** Determined by aircraft capacity (1 per 50 passengers)
   - **Application-level validation:** Check attendant count against aircraft size

4. **Name field:**
   - **Purpose:** Human-readable identifier ("Morning Crew A", "JFK-LAX-001")
   - **Not unique:** Multiple crews can have similar names
   - **Usage:** Operations dashboard, crew scheduling display

5. **Flight relationship (1:1, nullable):**
   - **Nullable:** Crew exists before flight assignment
   - **Unique on Flight side:** One crew per flight
   - **Workflow:** Create crew → Assign to flight → Execute flight → Crew released

---

### Special Services & Requests

#### SSR (Special Service Request) Model
```prisma
model SSR {
  id          String    @id @default(cuid())
  passengerId String
  flightId    String
  requestType SSRType
  description String?
  status      SSRStatus @default(REQUESTED)
  createdAt   DateTime  @default(now())
}
```

**Decision Rationale:**

1. **SSRType enum:**
   - **WHEELCHAIR:** Various mobility assistance levels (WCHR, WCHS, WCHC)
   - **SPECIAL_MEAL:** Dietary restrictions (vegetarian, kosher, halal, etc.)
   - **EXTRA_SPACE:** Obesity accommodation, comfort seating
   - **UNACCOMPANIED_MINOR:** Children traveling alone
   - **PET_ACCOMODATION:** In-cabin pet travel
   - **MEDICAL_EQUIPMENT:** Oxygen, CPAP, insulin
   - **OTHER:** Catch-all for unusual requests
   - **Why enum:** Standard IATA SSR codes mapped to readable types

2. **Description nullable:**
   - **Required for OTHER:** Free-text explanation
   - **Optional for standard types:** Type is self-explanatory
   - **Example:** SPECIAL_MEAL description: "Vegan, no nuts due to allergy"
   - **Customer service:** Provides context for staff

3. **SSRStatus workflow:**
   ```
   REQUESTED → CONFIRMED → COMPLETED
                    ↓
                DENIED
   ```
   - **REQUESTED:** Passenger submitted request
   - **CONFIRMED:** Operations approved and will provide service
   - **DENIED:** Cannot accommodate (no wheelchair lift, no meal option)
   - **COMPLETED:** Service delivered on flight

4. **Per-flight requests:**
   - **Why flightId:** Same passenger may have different needs per flight
   - **Example:** Wheelchair on outbound, not on return
   - **Booking flow:** Request added during booking or later modification

5. **No pricing field:**
   - **Design decision:** SSRs are free (included in ticket price)
   - **Alternative:** Some airlines charge for special meals (future enhancement)
   - **Regulatory:** Mobility assistance must be free (ADA compliance)

---

#### Baggage Model
```prisma
model Baggage {
  id          String        @id @default(cuid())
  passengerId String
  flightId    String
  weight      Decimal       @db.Decimal(5, 2)
  isOversized Boolean       @default(false)
  status      BaggageStatus @default(CHECKED_IN)
  tagNumber   String?       @unique
}
```

**Decision Rationale:**

1. **Weight precision:**
   - **Decimal(5, 2):** Up to 999.99 kg (2,204 lbs)
   - **Why precise:** Baggage fees often by weight (per kg over limit)
   - **Unit:** Stored in kilograms, converted for display
   - **Validation:** Max 32kg per bag for handling safety

2. **isOversized flag:**
   - **Definition:** Exceeds dimensions (length + width + height > 158cm)
   - **Impact:** Requires special handling, may incur fees
   - **Examples:** Golf clubs, skis, musical instruments
   - **Additional fee:** Typically $50-150 per item

3. **BaggageStatus lifecycle:**
   ```
   CHECKED_IN → LOADED → IN_TRANSIT → ARRIVED → DELIVERED
                   ↓              ↓        ↓
                LOST ←──────────────────────
                   ↓
               DAMAGED
   ```
   - **CHECKED_IN:** Accepted at counter, tag issued
   - **LOADED:** Scanned onto aircraft
   - **IN_TRANSIT:** On connecting flight
   - **ARRIVED:** Scanned at destination airport
   - **DELIVERED:** Handed to passenger at carousel
   - **LOST:** Cannot be located (triggers compensation claim)
   - **DAMAGED:** Physical damage discovered

4. **TagNumber nullable and unique:**
   - **Nullable:** Not generated until check-in completes
   - **Unique:** 10-digit barcode, globally unique
   - **Format:** Airline code (3) + flight number (4) + sequence (3)
   - **Example:** "176-1234-567"
   - **Tracking:** Scanned at multiple points in journey

5. **No carrier information:**
   - **Design tradeoff:** Assumed passenger carries own bags
   - **Future enhancement:** Add carrier field for transfer bags
   - **Interline bags:** Bags transferring between airlines (complex scenario)

---

#### CheckIn Model
```prisma
model CheckIn {
  id          String   @id @default(cuid())
  passengerId String
  flightId    String
  seatId      String
  checkinTime DateTime @default(now())
  
  @@unique([passengerId, flightId])
}
```

**Decision Rationale:**

1. **Unique constraint:**
   - **Combination:** (passengerId, flightId) is unique
   - **Why:** Passenger can only check in once per flight
   - **Prevents:** Double check-in, which would cause boarding issues
   - **Error handling:** Return 409 Conflict if attempting duplicate

2. **Required seat assignment:**
   - **seatId non-nullable:** Must select seat at check-in
   - **Business rule:** Cannot complete check-in without seat
   - **Exception handling:** If no seats available, add to waitlist instead
   - **Alternative rejected:** Allowing check-in without seat (gate assignment)

3. **CheckinTime tracking:**
   - **Default now():** Automatic timestamp when record created
   - **Compliance:** Airlines must report check-in times to authorities
   - **Analytics:** Track check-in patterns (early vs last-minute)
   - **Cut-off enforcement:** Must check in 45min+ before departure

4. **No boarding pass data:**
   - **Design decision:** Boarding pass generated on-demand from CheckIn record
   - **Alternative rejected:** Storing QR code/barcode (would require updates)
   - **Generation:** Create PDF/image with passenger + flight + seat + barcode
   - **Barcode format:** Aztec 2D barcode with IATA standard data

5. **Relationship to Ticket:**
   - **Implicit:** CheckIn has passengerId + flightId, Ticket has same
   - **No direct FK:** Allows checking in with PNR without ticket ID
   - **Validation:** Application verifies ticket exists before allowing check-in
   - **Status update:** Checking in triggers Ticket.status → CHECKED_IN

---

#### Waitlist Model
```prisma
model Waitlist {
  id           String         @id @default(cuid())
  passengerId  String
  flightId     String
  waitlistRank Int
  status       WaitlistStatus @default(ACTIVE)
  createdAt    DateTime       @default(now())
}
```

**Decision Rationale:**

1. **WaitlistRank:**
   - **Purpose:** Order in which passengers will be confirmed
   - **Calculation:** Based on createdAt, then frequent flyer status
   - **Not unique:** Multiple passengers can have same rank (tie-breaking logic)
   - **Updates:** Recalculated when passenger confirmed or cancelled

2. **WaitlistStatus enum:**
   ```
   ACTIVE → CONFIRMED (seat became available)
      ↓
   EXPIRED (flight departed)
      ↓
   CANCELLED (passenger cancelled)
   ```
   - **ACTIVE:** Waiting for availability
   - **CONFIRMED:** Seat assigned, can now complete booking
   - **EXPIRED:** Flight departed without confirmation
   - **CANCELLED:** Passenger removed self from waitlist

3. **No ticket relationship:**
   - **Why:** Waitlist exists before ticket purchased
   - **Workflow:** Join waitlist → Seat available → Purchase ticket
   - **Alternative:** Standby passengers (have ticket, waiting for seat)
   - **Future enhancement:** Add ticketId for standby scenario

4. **Automatic clearing:**
   - **Background job:** Check for cancelled bookings, free seats
   - **Notification:** Email/SMS when seat becomes available
   - **Time limit:** 24 hours to purchase after confirmation
   - **Re-ranking:** If passenger doesn't purchase, offer to next in line

---

### Airport Infrastructure

#### Airport Model
```prisma
model Airport {
  id       String @id @default(cuid())
  iataCode String @unique
  name     String
  city     String
  country  String
}
```

**Decision Rationale:**

1. **IATA code primary identifier:**
   - **Format:** 3-letter code (JFK, LAX, DXB)
   - **Globally unique:** Assigned by International Air Transport Association
   - **Indexed:** Fast lookup for flight search
   - **Display:** Show code + name in UI (e.g., "JFK - John F. Kennedy")

2. **City and Country separate:**
   - **Why not embedded:** Need to filter/group by city (all NYC airports)
   - **Multiple airports per city:** JFK, LGA, EWR all serve New York
   - **Country filtering:** Domestic vs international routes
   - **Format:** ISO country codes for consistency

3. **Missing fields (future enhancement):**
   - Latitude/longitude for distance calculations
   - Timezone for local time display
   - Contact information (phone, website)
   - **Design decision:** Minimal data for MVP

---

#### Terminal Model
```prisma
model Terminal {
  id           String @id @default(cuid())
  airportId    String
  terminalName String
  gates        Gate[]
}
```

**Decision Rationale:**

1. **TerminalName as String:**
   - **Why not number:** Many airports use letters (Terminal A, Tom Bradley)
   - **Examples:** "Terminal 1", "Terminal B", "International"
   - **No unique constraint:** Different airports can have "Terminal 1"
   - **Composite unique:** (airportId, terminalName) would be more robust (future)

2. **Cascade delete:**
   - **onDelete: Cascade:** Deleting terminal deletes all gates
   - **Use case:** Airport renovation, terminal demolition
   - **Safety:** Requires admin privileges to delete
   - **Alternative:** Soft delete with status field (better for historical data)

---

#### Gate Model
```prisma
model Gate {
  id         String     @id @default(cuid())
  terminalId String
  gateNumber String
  status     GateStatus @default(AVAILABLE)
  
  @@unique([terminalId, gateNumber])
}
```

**Decision Rationale:**

1. **Composite unique key:**
   - **Constraint:** (terminalId, gateNumber) unique
   - **Why:** Gate "A5" exists in multiple terminals
   - **Prevents:** Duplicate gate assignments
   - **Example:** Terminal A Gate 12, Terminal B Gate 12 (both valid)

2. **GateStatus enum:**
   - **AVAILABLE:** Ready for flight assignment
   - **OCCUPIED:** Currently has active flight
   - **MAINTENANCE:** Under repair, cannot assign
   - **CLOSED:** Permanently or temporarily closed
   - **Real-time tracking:** Status updates as flights board/depart

3. **Assignment logic:**
   - **Constraint:** Only one OCCUPIED flight per gate at a time
   - **Buffer time:** Gate marked OCCUPIED from boarding to 30min after departure
   - **Reassignment:** Operations can change gate up to boarding time
   - **Passenger notification:** Push notifications on gate changes

---

### Supporting Models

#### GroupBooking Model
```prisma
model GroupBooking {
  id        String   @id @default(cuid())
  groupName String
  createdAt DateTime @default(now())
  bookings  Booking[]
}
```

**Decision Rationale:**

1. **Purpose:**
   - **Use case:** Tour groups, sports teams, corporate travel
   - **Benefits:** Manage multiple passengers as single unit
   - **Pricing:** Group discounts, negotiated rates
   - **Coordination:** Ensure all group members on same flight

2. **GroupName:**
   - **Free text:** Descriptive name for internal reference
   - **Example:** "ABC Corp Annual Conference", "University Band Tour"
   - **Not customer-facing:** Internal operations tool

3. **Relationship to Booking:**
   - **Optional:** groupBookingId nullable on Booking
   - **1:N:** One group has many individual bookings
   - **Individual tickets:** Each passenger still gets own ticket
   - **Payment:** Can be centralized or individual

---

#### FlightStatusHistory Model
```prisma
model FlightStatusHistory {
  id        String   @id @default(cuid())
  flightId  String
  oldStatus String
  newStatus String
  changedAt DateTime @default(now())
  
  @@index([flightId])
}
```

**Decision Rationale:**

1. **Audit trail purpose:**
   - **Compliance:** Regulatory requirement to track flight status changes
   - **Analytics:** Identify delay patterns, operational issues
   - **Customer service:** Explain what happened during irregular operations
   - **Dispute resolution:** Proof of when delays/cancellations occurred

2. **Status as String (not enum):**
   - **Flexibility:** Can log any status, even future ones not in enum
   - **Forward compatibility:** New statuses don't break historical records
   - **Tradeoff:** Less type safety for more durability

3. **Cascade delete:**
   - **onDelete: Cascade:** If flight deleted, delete history
   - **Use case:** Test flights, cancelled before execution
   - **Alternative:** No cascade keeps historical data even after flight deletion

4. **No user tracking:**
   - **Missing:** Who made the change (staffId)
   - **Design decision:** Keep simple for MVP
   - **Future enhancement:** Add staffId to track responsibility
   - **Workaround:** Application logs have this information

---

## Background Job Processing Architecture

### Decision: BullMQ with Redis for Asynchronous Job Processing

**Context:**  
The flight management system requires automated workflows that run independently of user requests, such as:
- Expiring pending bookings after payment timeout
- Confirming waitlist passengers when seats become available
- Sending notification emails/SMS
- Generating daily operational reports
- Updating flight statuses based on real-time data

**Decision:**  
Implement BullMQ (Redis-backed job queue) for background job processing with job priorities, retries, and failure handling.

**Rationale:**

#### BullMQ Architecture

**Core Components:**
```typescript
// Job Queue Setup
import { Queue, Worker, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: null
});

// Define job queues
const bookingQueue = new Queue('booking', { connection: redis });
const notificationQueue = new Queue('notification', { connection: redis });
const reportQueue = new Queue('report', { connection: redis });
```

**Why BullMQ:**
1. **Redis-backed:** Reliable, fast, persistent storage
2. **Job priorities:** Critical jobs (payment processing) over routine (reports)
3. **Retry mechanism:** Automatic retries with exponential backoff
4. **Delayed jobs:** Schedule jobs for future execution
5. **Concurrency control:** Limit concurrent workers per queue
6. **Observable:** Monitor job progress, success/failure rates

**Alternatives Considered:**
- **Cron jobs:** Too rigid, no retry logic, not scalable
- **AWS SQS:** Vendor lock-in, less feature-rich than BullMQ
- **RabbitMQ:** More complex setup, overkill for use case
- **Database polling:** Poor performance, high database load

---

#### Job Types & Workflows

##### 1. Booking Expiration Job

**Trigger:** Created when booking enters PENDING status  
**Delay:** 15 minutes from creation  
**Purpose:** Auto-cancel unpaid bookings to free inventory

```typescript
// Job creation (in booking controller)
await bookingQueue.add(
  'expire-booking',
  { bookingId: newBooking.id },
  { 
    delay: 15 * 60 * 1000, // 15 minutes
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
);

// Job processor
bookingWorker.process('expire-booking', async (job) => {
  const { bookingId } = job.data;
  
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId }
  });
  
  // Only expire if still pending
  if (booking.status === 'PENDING') {
    await prisma.$transaction([
      // Cancel booking
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' }
      }),
      
      // Release seat holds
      prisma.ticket.updateMany({
        where: { bookingId },
        data: { ticketStatus: 'CANCELLED' }
      }),
      
      // Notify waitlist
      ...triggerWaitlistCheck(booking.flightId)
    ]);
    
    await notificationQueue.add('booking-expired', { bookingId });
  }
});
```

**Design Decisions:**
- **15-minute window:** Balance between user convenience and inventory management
- **Transaction safety:** All-or-nothing booking cancellation
- **Idempotent:** Safe to run multiple times (checks current status)
- **Waitlist trigger:** Freed seats offered to waitlist passengers

---

##### 2. Waitlist Confirmation Job

**Trigger:** Seat becomes available (booking cancelled, flight upsized)  
**Immediate execution:** Priority job  
**Purpose:** Notify and confirm waitlist passengers

```typescript
// Job creation
await bookingQueue.add(
  'process-waitlist',
  { flightId, availableSeats: 1 },
  { 
    priority: 1, // Highest priority
    attempts: 5
  }
);

// Job processor
bookingWorker.process('process-waitlist', async (job) => {
  const { flightId, availableSeats } = job.data;
  
  const waitlistPassengers = await prisma.waitlist.findMany({
    where: {
      flightId,
      status: 'ACTIVE'
    },
    orderBy: [
      { waitlistRank: 'asc' },
      { createdAt: 'asc' }
    ],
    take: availableSeats
  });
  
  for (const waitlist of waitlistPassengers) {
    await prisma.waitlist.update({
      where: { id: waitlist.id },
      data: { status: 'CONFIRMED' }
    });
    
    await notificationQueue.add('waitlist-confirmed', {
      passengerId: waitlist.passengerId,
      flightId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    
    // Schedule expiration if not purchased within 24h
    await bookingQueue.add(
      'expire-waitlist-confirmation',
      { waitlistId: waitlist.id },
      { delay: 24 * 60 * 60 * 1000 }
    );
  }
});
```

**Design Decisions:**
- **Priority 1:** Ensures immediate processing
- **Rank-based selection:** Fair ordering (FIFO + status tiers)
- **24-hour window:** Confirmed passenger must purchase within timeframe
- **Cascade scheduling:** Confirmation expiration job automatically queued

---

##### 3. Flight Status Update Job

**Trigger:** Scheduled at flight creation  
**Schedule:** Multiple jobs at key milestones  
**Purpose:** Auto-update flight status based on schedule

```typescript
// Schedule status transitions
async function scheduleFlightStatusJobs(flight: Flight) {
  const jobs = [
    {
      name: 'start-boarding',
      delay: flight.scheduledDepart.getTime() - Date.now() - (45 * 60 * 1000),
      status: 'BOARDING'
    },
    {
      name: 'depart-flight',
      delay: flight.scheduledDepart.getTime() - Date.now(),
      status: 'DEPARTED'
    },
    {
      name: 'arrive-flight',
      delay: flight.scheduledArrive.getTime() - Date.now(),
      status: 'ARRIVED'
    }
  ];
  
  for (const job of jobs) {
    if (job.delay > 0) {
      await bookingQueue.add(
        job.name,
        { flightId: flight.id, newStatus: job.status },
        { delay: job.delay }
      );
    }
  }
}

// Job processor
bookingWorker.process('start-boarding', async (job) => {
  const { flightId, newStatus } = job.data;
  
  const flight = await prisma.flight.findUnique({
    where: { id: flightId }
  });
  
  // Only update if status progression is valid
  if (flight.status === 'SCHEDULED') {
    await prisma.$transaction([
      prisma.flight.update({
        where: { id: flightId },
        data: { status: newStatus }
      }),
      prisma.flightStatusHistory.create({
        data: {
          flightId,
          oldStatus: flight.status,
          newStatus,
          changedAt: new Date()
        }
      })
    ]);
    
    await notificationQueue.add('flight-status-change', {
      flightId,
      newStatus
    });
  }
});
```

**Design Decisions:**
- **Scheduled transitions:** Predictable status progression
- **Manual override possible:** Operations can still update manually
- **Idempotent checks:** Only update if current status allows
- **Historical logging:** Every change recorded
- **Passenger notifications:** All ticketed passengers notified

---

##### 4. Report Generation Job

**Trigger:** Cron schedule (daily at 2 AM)  
**Purpose:** Generate operational and financial reports

```typescript
// Daily scheduler
import { QueueScheduler } from 'bullmq';

const scheduler = new QueueScheduler('report', { connection: redis });

await reportQueue.add(
  'daily-operations-report',
  { date: new Date() },
  {
    repeat: {
      pattern: '0 2 * * *', // Daily at 2 AM
      tz: 'America/New_York'
    }
  }
);

// Job processor
reportWorker.process('daily-operations-report', async (job) => {
  const { date } = job.data;
  
  const metrics = await calculateDailyMetrics(date);
  const report = await generatePDFReport(metrics);
  
  await storageService.upload({
    key: `reports/operations/${date.toISOString()}.pdf`,
    body: report,
    contentType: 'application/pdf'
  });
  
  await notificationQueue.add('report-ready', {
    recipients: ['ops@airline.com'],
    reportType: 'daily-operations',
    downloadUrl: report.url
  });
});

async function calculateDailyMetrics(date: Date) {
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const [
    totalFlights,
    onTimeFlights,
    totalRevenue,
    totalBookings,
    cancelledFlights
  ] = await Promise.all([
    prisma.flight.count({
      where: {
        scheduledDepart: { gte: startOfDay, lte: endOfDay }
      }
    }),
    prisma.flight.count({
      where: {
        scheduledDepart: { gte: startOfDay, lte: endOfDay },
        actualDepart: {
          lte: prisma.flight.fields.scheduledDepart // On-time = actual <= scheduled + 15min
        }
      }
    }),
    prisma.flight.aggregate({
      where: {
        scheduledDepart: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { revenue: true }
    }),
    // ... more metrics
  ]);
  
  return {
    date,
    totalFlights,
    onTimePercentage: (onTimeFlights / totalFlights) * 100,
    totalRevenue,
    // ... more fields
  };
}
```

---

## Background Job Processing Architecture (Continued)

**Design Decisions:**
- **Cron scheduling:** Repeating job pattern
- **Off-peak execution:** 2 AM minimizes database load
- **Timezone aware:** Uses airline's primary timezone
- **Async generation:** Long-running report doesn't block API
- **Storage:** Reports stored in S3-compatible storage

---

#### Job Monitoring & Error Handling

**Monitoring Dashboard:**
```typescript
// Bull Board UI for monitoring
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(bookingQueue),
    new BullMQAdapter(notificationQueue),
    new BullMQAdapter(reportQueue)
  ],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
```

**Error Handling Strategy:**

1. **Retry Configuration:**
```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000 // 2s, 4s, 8s
  }
}
```

2. **Dead Letter Queue:**
```typescript
bookingWorker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await prisma.failedJob.create({
      data: {
        jobId: job.id,
        queueName: job.queueName,
        jobData: job.data,
        error: err.message,
        failedAt: new Date()
      }
    });
    
    await notificationQueue.add('alert-ops', {
      subject: 'Critical Job Failure',
      jobId: job.id,
      error: err.message
    });
  }
});
```

3. **Circuit Breaker Pattern:**
```typescript
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;

bookingWorker.on('failed', () => {
  consecutiveFailures++;
  
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    bookingQueue.pause();
    
    setTimeout(() => {
      consecutiveFailures = 0;
      bookingQueue.resume();
    }, 5 * 60 * 1000); // 5-minute pause
  }
});

bookingWorker.on('completed', () => {
  consecutiveFailures = 0;
});
```

**Design Decisions:**
- **Observable failures:** Every failure logged and monitored
- **Alerting:** Critical failures notify operations team
- **Circuit breaker:** Prevents cascade failures
- **Manual recovery:** Failed jobs can be retried manually via dashboard

---

## Security Considerations

### Authentication Security

#### Password Security
```typescript
import bcrypt from 'bcrypt';

// Registration
const hashedPassword = await bcrypt.hash(password, 12);

// Login
const isValid = await bcrypt.compare(password, user.password);
```

**Decisions:**
- **Bcrypt cost factor 12:** Balance security vs performance (increases with hardware)
- **Salted hashing:** Each password gets unique salt (prevents rainbow tables)
- **Never log passwords:** Even in error messages
- **Password requirements:** Min 8 chars, 1 uppercase, 1 number, 1 special

---

#### Token Security

**JWT Signing:**
```typescript
import jwt from 'jsonwebtoken';

const accessToken = jwt.sign(
  {
    sub: user.id,
    email: user.email,
    role: user.role,
    status: user.status
  },
  process.env.JWT_SECRET,
  { 
    expiresIn: '15m',
    algorithm: 'HS256'
  }
);
```

**Security Measures:**
1. **Secret key management:**
   - **Environment variable:** Never committed to version control
   - **Rotation schedule:** Rotate JWT secret every 90 days
   - **Length:** Minimum 256 bits (32 bytes)

2. **Refresh token storage:**
   - **HTTP-only cookie:** JavaScript cannot access
   - **SameSite=Strict:** CSRF protection
   - **Secure flag:** Only transmitted over HTTPS
   - **Domain restriction:** Only valid for main domain

3. **Token revocation:**
   - **Refresh tokens:** Database-backed, can be revoked immediately
   - **Access tokens:** Short-lived (15min), cannot be revoked
   - **Emergency revocation:** Change JWT secret to invalidate all access tokens

---

### Authorization Security

**Middleware Implementation:**
```typescript
async function authorize(requiredRole: UserRole, requiredPermissions?: string[]) {
  return async (req, res, next) => {
    const { role, staffRole, status } = req.user;
    
    // Check user status
    if (status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account suspended' });
    }
    
    // Check role hierarchy
    if (role === 'ADMIN') return next(); // Admin bypasses all
    
    if (role !== requiredRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check granular permissions
    if (requiredPermissions) {
      const hasPermission = checkPermissions(role, staffRole, requiredPermissions);
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    
    next();
  };
}

// Usage
app.post('/api/flights', 
  authenticate,
  authorize('OPERATIONS', ['flight:create']),
  createFlight
);
```

**Security Principles:**
- **Fail-safe defaults:** Deny by default, explicit allow
- **Least privilege:** Grant minimum necessary permissions
- **Defense in depth:** Multiple layers (authentication + authorization + validation)

---

### Data Access Security

**Row-Level Security Patterns:**

```typescript
// Passenger can only access own bookings
async function getBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId } // Enforced at query level
  });
}

// Staff can only access assigned flights
async function getAssignedFlights(pilotId: string) {
  return prisma.flight.findMany({
    where: {
      flightCrew: {
        pilotId
      }
    }
  });
}

// Operations sees all flights
async function getAllFlights() {
  return prisma.flight.findMany(); // No restrictions
}
```

**Design Decisions:**
- **Query-level filtering:** Security baked into data access layer
- **No client-side filtering:** Never trust client to filter sensitive data
- **Audit logging:** All data access logged for compliance

---

### Input Validation & Sanitization

**Validation Layers:**

1. **Schema validation (Zod):**
```typescript
import { z } from 'zod';

const bookingSchema = z.object({
  passengerId: z.string().cuid(),
  flightId: z.string().cuid(),
  seatIds: z.array(z.string().cuid()).min(1).max(10)
});

// Validate request
const result = bookingSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error });
}
```

2. **Business logic validation:**
```typescript
// Check flight availability
const flight = await prisma.flight.findUnique({
  where: { id: flightId }
});

if (flight.scheduledDepart < new Date()) {
  throw new Error('Cannot book past flights');
}

// Check seat availability
const bookedSeats = await prisma.ticket.count({
  where: { flightId, seatId: { in: seatIds } }
});

if (bookedSeats > 0) {
  throw new Error('Seats already booked');
}
```

3. **SQL injection prevention:**
   - **Parameterized queries:** Prisma handles this automatically
   - **No raw SQL:** Avoid `prisma.$queryRaw` except when necessary
   - **Input escaping:** Use Prisma's query builder

---

### Rate Limiting

**Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

// Strict limit for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

**Design Decisions:**
- **Per-IP limiting:** Prevents brute force attacks
- **Different limits per endpoint:** Auth stricter than general API
- **Skip successful requests:** Only failed logins count toward limit

---

### HTTPS & Transport Security

**Requirements:**
- **TLS 1.3 only:** Disable older protocols
- **HSTS header:** `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **Certificate pinning:** For mobile apps
- **No mixed content:** All resources over HTTPS

---

### Database Security

**Connection Security:**
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // postgres://user:pass@host:5432/db?sslmode=require
}
```

**Design Decisions:**
- **SSL/TLS required:** `sslmode=require` in connection string
- **Credential management:** Database credentials in environment variables
- **Least privilege:** Application user has only necessary permissions
- **Connection pooling:** Prevents connection exhaustion attacks

---

### Audit Logging

**Implementation:**
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  resource  String
  resourceId String?
  oldValue  Json?
  newValue  Json?
  ipAddress String
  userAgent String
  timestamp DateTime @default(now())
}
```

**Logged Actions:**
- Admin actions (user management, role changes)
- Payment transactions
- Booking cancellations and refunds
- Flight status changes
- SSR approvals/denials

**Design Decisions:**
- **Immutable:** Audit logs never deleted or modified
- **Comprehensive:** Include old and new values for updates
- **IP tracking:** Record source of all actions
- **Compliance:** Meets PCI-DSS and GDPR requirements

---

### PII Protection

**Sensitive Data:**
- Passport numbers
- Credit card information
- SSNs (for staff)
- Contact information

**Protection Measures:**

1. **Encryption at rest:**
```typescript
import crypto from 'crypto';

function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    process.env.ENCRYPTION_KEY,
    iv
  );
  // ... encryption logic
}
```

2. **Field-level encryption:**
   - Passport numbers encrypted before storage
   - Credit card data never stored (tokenized by payment gateway)
   - SSNs encrypted with separate key

3. **Access controls:**
   - PII only accessible by authorized roles
   - Masked in logs (show last 4 digits only)
   - Redacted in non-production environments

4. **GDPR compliance:**
   - Right to erasure (delete user data)
   - Data export functionality
   - Consent tracking
   - Retention policies (delete after 7 years)

---

## Consequences

### Positive

1. **Scalability:**
   - Stateless JWT authentication scales horizontally
   - Background jobs handle async workload without blocking API
   - Redis-backed queues can handle millions of jobs
   - Database design supports efficient indexing and queries

2. **Security:**
   - Multi-layered authentication (dual-token strategy)
   - Granular RBAC prevents unauthorized access
   - Audit trail for compliance and debugging
   - PII protection meets regulatory requirements

3. **Maintainability:**
   - Clear role hierarchy simplifies permission logic
   - Separation of concerns (User vs Staff vs Passenger)
   - Background jobs isolate complex workflows
   - Comprehensive logging aids troubleshooting

4. **User Experience:**
   - Fast authentication (JWT verification without database)
   - Automated workflows (booking expiration, waitlist confirmation)
   - Real-time status updates via background jobs
   - Reliable payment processing

5. **Operational Efficiency:**
   - Automated reporting reduces manual work
   - Waitlist management optimizes seat inventory
   - Flight status tracking reduces customer service load
   - Group bookings streamline corporate travel

---

### Negative

1. **Complexity:**
   - 10 user roles create complex permission matrix
   - Dual-role system (UserRole + StaffRole) adds cognitive load
   - Background job orchestration requires expertise
   - Multiple specialized staff tables increase schema complexity

2. **Infrastructure Requirements:**
   - Redis dependency for job queues (additional service to manage)
   - Database size growth from audit logging and status history
   - Background workers require separate processes/containers
   - Monitoring overhead for job queues

3. **Token Management Challenges:**
   - Refresh token rotation increases database writes
   - Token family tracking adds storage overhead
   - Emergency revocation requires JWT secret rotation (impacts all users)
   - Mobile apps need robust token refresh logic

4. **Data Consistency:**
   - Background jobs can fail, leaving inconsistent state
   - Distributed transactions (payment + booking confirmation) risk partial failures
   - Race conditions possible (double booking if not careful with locking)
   - Clock skew can affect JWT expiration and scheduled jobs

5. **Development Overhead:**
   - Authorization middleware for every endpoint
   - Extensive test coverage needed for permission combinations
   - Background job testing requires Redis test instance
   - Schema migrations more complex with 30+ tables

---

### Mitigations

1. **For Complexity:**
   - Comprehensive documentation (this ADR)
   - Role permission matrix reference sheet
   - Code generation for repetitive authorization checks
   - Training for development team

2. **For Infrastructure:**
   - Redis clustering for high availability
   - Database partitioning for audit logs (by date)
   - Separate worker processes with auto-scaling
   - Prometheus + Grafana for monitoring

3. **For Token Management:**
   - Automatic token refresh in client SDKs
   - Grace period for token rotation (5-minute overlap)
   - Staged JWT secret rotation (old + new both valid temporarily)
   - Token refresh retry logic with exponential backoff

4. **For Data Consistency:**
   - Database transactions for critical operations
   - Idempotency keys for payment processing
   - Optimistic locking for seat booking (check version before update)
   - Dead letter queue for failed jobs

5. **For Development:**
   - Reusable authorization decorators/middleware
   - Shared validation schemas
   - Test fixtures for common scenarios
   - Automated migration testing in CI/CD

---

### Future Considerations

1. **Multi-tenancy:**
   - System designed for single airline
   - Future: Support multiple airlines (add airlineId to all models)
   - Requires: Tenant isolation, separate databases or row-level security

2. **Mobile App Offline Support:**
   - Current: Online-only
   - Future: Offline boarding pass access, cached flight schedules
   - Requires: Local storage, sync protocols, conflict resolution

3. **Real-time Features:**
   - Current: Background jobs poll periodically
   - Future: WebSocket connections for live flight tracking
   - Requires: Socket.io or Server-Sent Events, message broker

4. **Machine Learning Integration:**
   - Predictive delay notifications
   - Dynamic pricing based on demand
   - Fraud detection for bookings
   - Requires: ML pipeline, feature store, model serving

5. **Internationalization:**
   - Multi-currency support (currently USD only)
   - Multi-language content
   - Regional compliance (GDPR, CCPA, etc.)
   - Requires: Currency conversion API, translation management

6. **Advanced Crew Management:**
   - Duty time tracking and legal compliance
   - Crew bidding system for desirable routes
   - Fatigue risk management
   - Requires: Complex scheduling algorithms, regulatory rule engine

7. **Enhanced Analytics:**
   - Real-time dashboards for operations
   - Predictive maintenance for aircraft
   - Revenue optimization algorithms
   - Requires: Data warehouse, BI tools, streaming analytics

8. **API Gateway & Microservices:**
   - Current: Monolithic architecture
   - Future: Break into microservices (booking, flight ops, crew, payments)
   - Requires: Service mesh, API gateway, event-driven architecture

---

## References

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [IATA Standards and Recommended Practices](https://www.iata.org/en/publications/)
- [PCI-DSS Compliance Guide](https://www.pcisecuritystandards.org/)
- [GDPR Developer Guide](https://gdpr.eu/developers/)
- [Redis Security Best Practices](https://redis.io/topics/security)

---

## Appendix A: Role Permission Matrix

| Resource | ADMIN | OPERATIONS | PASSENGER | CHECK_IN | GATE_AGENT | PILOT | BAGGAGE_HANDLER |
|----------|-------|------------|-----------|----------|------------|-------|-----------------|
| User Management | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Flight Create/Update | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Flight View | ✓ | ✓ | ✓ (public) | ✓ (assigned) | ✓ (gate) | ✓ (assigned) | ✗ |
| Booking Create | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Booking View | ✓ | ✓ | ✓ (own) | ✓ (flight) | ✗ | ✗ | ✗ |
| Check-in Process | ✓ | ✓ | ✓ (own) | ✓ | ✗ | ✗ | ✗ |
| Boarding | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Baggage Tracking | ✓ | ✓ | ✓ (own) | ✓ | ✗ | ✗ | ✓ |
| SSR Management | ✓ | ✓ | ✓ (request) | ✓ (confirm) | ✗ | ✓ (view) | ✗ |
| Financial Reports | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Appendix B: Database Schema Summary

**Total Tables:** 30

**Categories:**
- **Identity & Users:** User, Passenger, Staff, OperationsManager (4 tables)
- **Staff Specializations:** Pilot, Copilot, FlightAttendant, CheckInAgent, GateAgent, BaggageHandler (6 tables)
- **Bookings:** Booking, Ticket, GroupBooking, Payment, Refund (5 tables)
- **Flights:** Flight, FlightSchedule, Route, FlightStatusHistory, Crew (5 tables)
- **Airport Infrastructure:** Airport, Terminal, Gate (3 tables)
- **Aircraft:** Aircraft, Seat, FareClass (3 tables)
- **Passenger Services:** Waitlist, SSR, CheckIn, Baggage (4 tables)

**Total Enums:** 14

---

## Appendix C: API Endpoint Summary

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and receive tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and revoke refresh token

### Booking Endpoints
- `GET /api/bookings` - List bookings (filtered by role)
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking details
- `PATCH /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Flight Endpoints
- `GET /api/flights` - Search flights
- `POST /api/flights` - Create flight (OPERATIONS)
- `GET /api/flights/:id` - Get flight details
- `PATCH /api/flights/:id` - Update flight (OPERATIONS)
- `PATCH /api/flights/:id/status` - Update flight status

### Check-in Endpoints
- `POST /api/checkin` - Check-in passenger
- `GET /api/checkin/:passengerId/:flightId` - Get check-in details
- `GET /api/boarding-pass/:passengerId/:flightId` - Generate boarding pass

### Staff Endpoints
- `GET /api/staff/flights` - Get assigned flights (role-based)
- `PATCH /api/baggage/:id` - Update baggage status
- `POST /api/boarding` - Process boarding

---

**Document Version:** 1.0  
**Last Updated:** December 24, 2025  
**Author:** Ammar Yasser 
**Next Review:** March 24, 2026