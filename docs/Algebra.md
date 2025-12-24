# Relational Algebra Queries - Airline Management System

## 1. Basic Selection Queries

### 1.1 Find all active flights departing today
```
σ_(status='SCHEDULED' ∧ scheduledDepart >= '2025-12-24' ∧ scheduledDepart < '2025-12-25')(Flight)
```

### 1.2 Find all confirmed bookings
```
σ_(status='CONFIRMED')(Booking)
```

### 1.3 Find all cancelled tickets
```
σ_(ticketStatus='CANCELLED')(Ticket)
```

### 1.4 Find all active passengers
```
σ_(status='ACTIVE')(User ⋈_(User.id=Passenger.userId) Passenger)
```

### 1.5 Find all aircraft in maintenance
```
σ_(status='MAINTENANCE')(Aircraft)
```

### 1.6 Find all economy class seats
```
σ_(class='ECONOMY')(Seat)
```

### 1.7 Find all completed payments
```
σ_(status='COMPLETED')(Payment)
```

### 1.8 Find all lost baggage
```
σ_(status='LOST')(Baggage)
```

## 2. Basic Projection Queries

### 2.1 Get passenger names and passport numbers
```
π_(firstName, lastName, passportNumber)(User ⋈_(User.id=Passenger.userId) Passenger)
```

### 2.2 Get all flight numbers and their status
```
π_(flightNumber, status)(Flight)
```

### 2.3 Get all airport codes and names
```
π_(iataCode, name, city)(Airport)
```

### 2.4 Get booking PNR codes and total fares
```
π_(pnrCode, totalFare)(Booking)
```

### 2.5 Get staff names and roles
```
π_(firstName, lastName, role)(User ⋈_(User.id=Staff.userId) Staff)
```

## 3. Simple Join Queries

### 3.1 Get all tickets with passenger information
```
π_(ticketNumber, firstName, lastName, email)(
  Ticket ⋈_(Ticket.passengerId=Passenger.id) Passenger 
         ⋈_(Passenger.userId=User.id) User
)
```

### 3.2 Get bookings with payment details
```
Booking ⋈_(Booking.id=Payment.bookingId) Payment
```

### 3.3 Get flights with aircraft information
```
π_(flightNumber, aircraftNumber, model, capacity)(
  Flight ⋈_(Flight.aircraftId=Aircraft.id) Aircraft
)
```

### 3.4 Get tickets with seat information
```
π_(ticketNumber, seatNumber, class)(
  Ticket ⋈_(Ticket.seatId=Seat.id) Seat
)
```

### 3.5 Get gates with terminal information
```
π_(gateNumber, terminalName, airportId)(
  Gate ⋈_(Gate.terminalId=Terminal.id) Terminal
)
```

## 4. Complex Join Queries

### 4.1 Find flights with departure and arrival airports
```
π_(flightNumber, D.name as departAirport, A.name as arriveAirport, scheduledDepart, scheduledArrive)(
  Flight ⋈_(Flight.routeId=Route.id) Route
         ⋈_(Route.departAirportId=D.id) (ρ_D(Airport))
         ⋈_(Route.arriveAirportId=A.id) (ρ_A(Airport))
)
```

### 4.2 Get complete booking information with passenger and flight details
```
π_(pnrCode, firstName, lastName, flightNumber, scheduledDepart, totalFare)(
  Booking ⋈_(Booking.userId=User.id) User
          ⋈_(Booking.id=Ticket.bookingId) Ticket
          ⋈_(Ticket.flightId=Flight.id) Flight
)
```

### 4.3 Find passengers who have checked in with their seat assignments
```
π_(firstName, lastName, flightNumber, seatNumber)(
  User ⋈_(User.id=Passenger.userId) Passenger
       ⋈_(Passenger.id=CheckIn.passengerId) CheckIn
       ⋈_(CheckIn.seatId=Seat.id) Seat
       ⋈_(CheckIn.flightId=Flight.id) Flight
)
```

### 4.4 Get crew assignments with pilot and copilot names
```
π_(Crew.name as crewName, P.firstName as pilotFirstName, P.lastName as pilotLastName, 
    C.firstName as copilotFirstName, C.lastName as copilotLastName)(
  Crew ⋈_(Crew.pilotId=Pilot.id) Pilot
       ⋈_(Pilot.staffId=PS.id) (ρ_PS(Staff))
       ⋈_(PS.userId=PU.id) (ρ_PU(User))
       ⋈_(Crew.copilotId=Copilot.id) Copilot
       ⋈_(Copilot.staffId=CS.id) (ρ_CS(Staff))
       ⋈_(CS.userId=CU.id) (ρ_CU(User))
)
```

### 4.5 Find all refunded bookings with passenger details
```
π_(pnrCode, firstName, lastName, amount, reason)(
  Booking ⋈_(Booking.id=Refund.bookingId) Refund
          ⋈_(Booking.userId=User.id) User
  WHERE Refund.status='COMPLETED'
)
```

## 5. Aggregation Queries

### 5.1 Count total passengers per flight
```
_{flightId} ℱ_(COUNT(passengerId) as passengerCount)(Ticket)
```

### 5.2 Calculate total revenue per flight
```
_{flightId} ℱ_(SUM(totalFare) as totalRevenue)(
  Booking ⋈_(Booking.id=Ticket.bookingId) Ticket
)
```

### 5.3 Find average ticket price per seat class
```
_{class} ℱ_(AVG(price) as avgPrice)(Seat)
```

### 5.4 Count number of bookings per passenger
```
_{passengerId} ℱ_(COUNT(*) as bookingCount)(Booking)
```

### 5.5 Calculate total baggage weight per flight
```
_{flightId} ℱ_(SUM(weight) as totalWeight)(Baggage)
```

### 5.6 Count available seats per aircraft
```
_{aircraftId} ℱ_(COUNT(*) as availableSeats)(
  σ_(isBlocked=false)(Seat)
)
```

### 5.7 Find maximum fare for each route
```
_{Flight.routeId} ℱ_(MAX(totalFare) as maxFare)(
  Booking ⋈_(Booking.id=Ticket.bookingId) Ticket
          ⋈_(Ticket.flightId=Flight.id) Flight
)
```

### 5.8 Count staff members by role
```
_{role} ℱ_(COUNT(*) as staffCount)(Staff)
```

### 5.9 Calculate average flight duration per route
```
_{routeId} ℱ_(AVG(duration) as avgDuration)(Route)
```

### 5.10 Count pending payments
```
ℱ_(COUNT(*) as pendingCount)(σ_(status='PENDING')(Payment))
```

## 6. Queries with Multiple Conditions

### 6.1 Find business class seats that are not blocked
```
σ_(class='BUSINESS' ∧ isBlocked=false)(Seat)
```

### 6.2 Find flights departing from JFK and arriving at LAX
```
π_(flightNumber, scheduledDepart)(
  Flight ⋈_(Flight.routeId=Route.id) Route
         ⋈_(Route.departAirportId=D.id) (ρ_D(σ_(iataCode='JFK')(Airport)))
         ⋈_(Route.arriveAirportId=A.id) (ρ_A(σ_(iataCode='LAX')(Airport)))
)
```

### 6.3 Find passengers with confirmed wheelchair requests
```
π_(firstName, lastName, email)(
  User ⋈_(User.id=Passenger.userId) Passenger
       ⋈_(Passenger.id=SSR.passengerId) SSR
  WHERE SSR.requestType='WHEELCHAIR' ∧ SSR.status='CONFIRMED'
)
```

### 6.4 Find oversized baggage that has been checked in
```
σ_(isOversized=true ∧ status='CHECKED_IN')(Baggage)
```

### 6.5 Find delayed or cancelled flights
```
σ_(status='DELAYED' ∨ status='CANCELLED')(Flight)
```

### 6.6 Find active pilots who are not on leave
```
π_(firstName, lastName)(
  User ⋈_(User.id=Staff.userId) Staff
       ⋈_(Staff.id=Pilot.staffId) Pilot
  WHERE Staff.status='ACTIVE' ∧ Staff.role='PILOT'
)
```

### 6.7 Find high-value bookings (over $1000) that are confirmed
```
σ_(totalFare > 1000 ∧ status='CONFIRMED')(Booking)
```

### 6.8 Find exit row seats in economy class
```
σ_(isExitRow=true ∧ class='ECONOMY')(Seat)
```

## 7. Set Operations

### 7.1 Union: Find all users who are either staff or passengers
```
π_(userId)(Staff) ∪ π_(userId)(Passenger)
```

### 7.2 Difference: Passengers with bookings but no checked baggage
```
π_(passengerId)(Booking) - π_(passengerId)(Baggage)
```

### 7.3 Intersection: Flights that are scheduled and have assigned gates
```
π_(id)(σ_(status='SCHEDULED')(Flight)) ∩ 
π_(id)(σ_(gateId IS NOT NULL)(Flight))
```

### 7.4 Find passengers who have booked but not checked in
```
π_(passengerId)(Ticket) - π_(passengerId)(CheckIn)
```

### 7.5 Find aircraft that are active and not currently assigned to flights
```
π_(id)(σ_(status='ACTIVE')(Aircraft)) - 
π_(aircraftId)(σ_(status IN ('SCHEDULED','BOARDING','DEPARTED','IN_FLIGHT'))(Flight))
```

### 7.6 Find users who are both operations managers and have bookings
```
π_(userId)(OperationsManager) ∩ π_(userId)(Booking)
```

### 7.7 Find airports with departures but no arrivals today
```
π_(departAirportId)(
  Flight ⋈_(Flight.routeId=Route.id) Route
  WHERE scheduledDepart >= '2025-12-24' ∧ scheduledDepart < '2025-12-25'
) - 
π_(arriveAirportId)(
  Flight ⋈_(Flight.routeId=Route.id) Route
  WHERE scheduledArrive >= '2025-12-24' ∧ scheduledArrive < '2025-12-25'
)
```

## 8. Division Queries

### 8.1 Find passengers who have booked tickets on all routes from JFK
```
π_(passengerId, routeId)(
  Ticket ⋈_(Ticket.flightId=Flight.id) Flight
) ÷ 
π_(id)(
  Route ⋈_(Route.departAirportId=Airport.id) Airport
  WHERE Airport.iataCode='JFK'
)
```

### 8.2 Find passengers who have used all payment methods
```
π_(userId, method)(
  Booking ⋈_(Booking.id=Payment.bookingId) Payment
) ÷ 
π_(method)(PaymentMethod)
```

### 8.3 Find staff who have worked on all aircraft types
```
π_(staffId, aircraftId)(
  Crew ⋈_(Crew.id=Flight.flightCrewId) Flight
       ⋈_(Flight.aircraftId=Aircraft.id) Aircraft
  WHERE staffId IN (SELECT id FROM Pilot)
) ÷ 
π_(id)(Aircraft)
```

## 9. Subquery-Style Queries (Using Rename and Nested Operations)

### 9.1 Find passengers with more than 3 bookings
```
π_(Passenger.id, firstName, lastName)(
  (_{passengerId} ℱ_(COUNT(*) as bookingCount)(Booking)) ⋈_(passengerId=Passenger.id) Passenger
                                                          ⋈_(Passenger.userId=User.id) User
  WHERE bookingCount > 3
)
```

### 9.2 Find flights with above-average revenue
```
ρ_AvgRev(_{*} ℱ_(AVG(revenue) as avgRevenue)(Flight))

π_(flightNumber, revenue)(
  Flight × AvgRev
  WHERE Flight.revenue > AvgRev.avgRevenue
)
```

### 9.3 Find most expensive seat for each aircraft
```
ρ_MaxPrice(_{aircraftId} ℱ_(MAX(price) as maxPrice)(Seat))

π_(aircraftNumber, seatNumber, price)(
  Seat ⋈_(Seat.aircraftId=MaxPrice.aircraftId ∧ Seat.price=MaxPrice.maxPrice) MaxPrice
       ⋈_(Seat.aircraftId=Aircraft.id) Aircraft
)
```

### 9.4 Find passengers who have spent more than average
```
ρ_AvgSpending(_{passengerId} ℱ_(SUM(totalFare) as totalSpent)(Booking))
ρ_OverallAvg(_{*} ℱ_(AVG(totalSpent) as avgSpent)(AvgSpending))

π_(firstName, lastName, totalSpent)(
  AvgSpending ⋈_(AvgSpending.passengerId=Passenger.id) Passenger
              ⋈_(Passenger.userId=User.id) User
              × OverallAvg
  WHERE AvgSpending.totalSpent > OverallAvg.avgSpent
)
```

### 9.5 Find flights with the highest number of special service requests
```
ρ_SSRCount(_{flightId} ℱ_(COUNT(*) as requestCount)(SSR))
ρ_MaxSSR(_{*} ℱ_(MAX(requestCount) as maxRequests)(SSRCount))

π_(flightNumber, requestCount)(
  Flight ⋈_(Flight.id=SSRCount.flightId) SSRCount
         × MaxSSR
  WHERE SSRCount.requestCount = MaxSSR.maxRequests
)
```

## 10. Complex Business Queries

### 10.1 Find fully booked flights
```
ρ_SeatCount(_{aircraftId} ℱ_(COUNT(*) as totalSeats)(Seat))
ρ_TicketCount(_{flightId} ℱ_(COUNT(*) as bookedSeats)(
  σ_(ticketStatus NOT IN ('CANCELLED','REFUNDED'))(Ticket)
))

π_(flightNumber, scheduledDepart)(
  Flight ⋈_(Flight.aircraftId=SeatCount.aircraftId) SeatCount
         ⋈_(Flight.id=TicketCount.flightId) TicketCount
  WHERE TicketCount.bookedSeats = SeatCount.totalSeats
)
```

### 10.2 Find passengers with baggage but no check-in
```
π_(firstName, lastName, passportNumber)(
  (π_(passengerId)(Baggage) - π_(passengerId)(CheckIn)) ⋈_(passengerId=Passenger.id) Passenger
                                                         ⋈_(Passenger.userId=User.id) User
)
```

### 10.3 Find routes with the highest demand (most bookings)
```
ρ_RouteBookings(_{routeId} ℱ_(COUNT(*) as bookingCount)(
  Ticket ⋈_(Ticket.flightId=Flight.id) Flight
))
ρ_MaxBookings(_{*} ℱ_(MAX(bookingCount) as maxCount)(RouteBookings))

π_(D.name as departure, A.name as arrival, bookingCount)(
  RouteBookings ⋈_(RouteBookings.routeId=Route.id) Route
                ⋈_(Route.departAirportId=D.id) (ρ_D(Airport))
                ⋈_(Route.arriveAirportId=A.id) (ρ_A(Airport))
                × MaxBookings
  WHERE RouteBookings.bookingCount = MaxBookings.maxCount
)
```

### 10.4 Find passengers with multiple active waitlist entries
```
π_(firstName, lastName, email)(
  (_{passengerId} ℱ_(COUNT(*) as waitlistCount)(
    σ_(status='ACTIVE')(Waitlist)
  )) ⋈_(passengerId=Passenger.id) Passenger
     ⋈_(Passenger.userId=User.id) User
  WHERE waitlistCount > 1
)
```

### 10.5 Find flights with crew but no assigned gate
```
π_(flightNumber, scheduledDepart)(
  σ_(flightCrewId IS NOT NULL ∧ gateId IS NULL)(Flight)
)
```

### 10.6 Calculate seat utilization rate per aircraft
```
ρ_BookedSeats(_{aircraftId} ℱ_(COUNT(DISTINCT seatId) as bookedCount)(
  Ticket ⋈_(Ticket.flightId=Flight.id) Flight
  WHERE ticketStatus NOT IN ('CANCELLED','REFUNDED')
))
ρ_TotalSeats(_{aircraftId} ℱ_(COUNT(*) as totalCount)(Seat))

π_(aircraftNumber, (bookedCount/totalCount)*100 as utilizationRate)(
  Aircraft ⋈_(Aircraft.id=BookedSeats.aircraftId) BookedSeats
           ⋈_(Aircraft.id=TotalSeats.aircraftId) TotalSeats
)
```

### 10.7 Find passengers who have cancelled all their bookings
```
ρ_AllBookings(_{passengerId} ℱ_(COUNT(*) as totalBookings)(Booking))
ρ_CancelledBookings(_{passengerId} ℱ_(COUNT(*) as cancelledCount)(
  σ_(status='CANCELLED')(Booking)
))

π_(firstName, lastName, email)(
  (AllBookings ⋈_(AllBookings.passengerId=CancelledBookings.passengerId ∧ 
                   AllBookings.totalBookings=CancelledBookings.cancelledCount) CancelledBookings)
  ⋈_(passengerId=Passenger.id) Passenger
  ⋈_(Passenger.userId=User.id) User
)
```

### 10.8 Find airports with the most flight delays
```
ρ_DelayCount(_{departAirportId} ℱ_(COUNT(*) as delayCount)(
  Flight ⋈_(Flight.routeId=Route.id) Route
  WHERE Flight.status='DELAYED'
))

π_(name, city, delayCount)(
  DelayCount ⋈_(DelayCount.departAirportId=Airport.id) Airport
  ORDER BY delayCount DESC
)
```

### 10.9 Find staff members who work as multiple roles
```
π_(firstName, lastName)(
  User ⋈_(User.id=Staff.userId) Staff
  WHERE Staff.id IN (
    π_(staffId)(Pilot) ∪ π_(staffId)(CheckInAgent) ∪ 
    π_(staffId)(GateAgent) ∪ π_(staffId)(BaggageHandler)
  )
  GROUP BY Staff.id
  HAVING COUNT(DISTINCT role) > 1
)
```

### 10.10 Calculate refund rate per payment method
```
ρ_TotalPayments(_{method} ℱ_(COUNT(*) as totalCount)(Payment))
ρ_RefundedPayments(_{method} ℱ_(COUNT(*) as refundCount)(
  Payment ⋈_(Payment.bookingId=Refund.bookingId) Refund
  WHERE Refund.status='COMPLETED'
))

π_(method, (refundCount/totalCount)*100 as refundRate)(
  TotalPayments ⋈_(TotalPayments.method=RefundedPayments.method) RefundedPayments
)
```

## 11. Temporal Queries

### 11.1 Find flights departing in the next 24 hours
```
σ_(scheduledDepart >= '2025-12-24' ∧ scheduledDepart <= '2025-12-25')(Flight)
```

### 11.2 Find bookings created in the last 7 days
```
σ_(createdAt >= '2025-12-17')(Booking)
```

### 11.3 Find flights with actual departure different from scheduled
```
σ_(actualDepart IS NOT NULL ∧ actualDepart ≠ scheduledDepart)(Flight)
```

### 11.4 Calculate average delay time per route
```
π_(routeId, AVG(actualDepart - scheduledDepart) as avgDelay)(
  σ_(actualDepart > scheduledDepart)(Flight)
  GROUP BY routeId
)
```

### 11.5 Find staff hired in the last year
```
σ_(hireDate >= '2024-12-24')(Staff)
```

## 12. Status Tracking Queries

### 12.1 Find all status changes for a specific flight
```
π_(oldStatus, newStatus, changedAt)(
  σ_(flightId='xyz')(FlightStatusHistory)
  ORDER BY changedAt
)
```

### 12.2 Find flights that transitioned from scheduled to cancelled
```
π_(Flight.flightNumber, Flight.scheduledDepart)(
  Flight ⋈_(Flight.id=FlightStatusHistory.flightId) FlightStatusHistory
  WHERE FlightStatusHistory.oldStatus='SCHEDULED' ∧ 
        FlightStatusHistory.newStatus='CANCELLED'
)
```

### 12.3 Track baggage through all statuses
```
π_(tagNumber, status, flightNumber)(
  Baggage ⋈_(Baggage.flightId=Flight.id) Flight
  ORDER BY Baggage.id, status
)
```

## 13. Crew and Staff Management Queries

### 13.1 Find crews with their complete member information
```
π_(Crew.name, P.firstName || ' ' || P.lastName as pilot,
    C.firstName || ' ' || C.lastName as copilot)(
  Crew ⋈_(Crew.pilotId=Pilot.id) Pilot
       ⋈_(Pilot.staffId=PS.id) (ρ_PS(Staff))
       ⋈_(PS.userId=PU.id) (ρ_PU(User))
       ⋈_(Crew.copilotId=Copilot.id) Copilot
       ⋈_(Copilot.staffId=CS.id) (ρ_CS(Staff))
       ⋈_(CS.userId=CU.id) (ρ_CU(User))
)
```

### 13.2 Count flight attendants per crew
```
_{crewId} ℱ_(COUNT(*) as attendantCount)(
  Crew ⋈_(Crew.id=FlightAttendant.crewId) FlightAttendant
)
```

### 13.3 Find staff members without crew assignments
```
(π_(staffId)(σ_(role='PILOT')(Staff)) - π_(staffId)(Pilot)) ∪
(π_(staffId)(σ_(role='COPILOT')(Staff)) - π_(staffId)(Copilot))
```

### 13.4 Find most active pilots (by number of flights)
```
ρ_PilotFlights(_{pilotId} ℱ_(COUNT(*) as flightCount)(
  Crew ⋈_(Crew.id=Flight.flightCrewId) Flight
))

π_(firstName, lastName, flightCount)(
  PilotFlights ⋈_(PilotFlights.pilotId=Pilot.id) Pilot
               ⋈_(Pilot.staffId=Staff.id) Staff
               ⋈_(Staff.userId=User.id) User
  ORDER BY flightCount DESC
)
```

## 14. Revenue and Financial Queries

### 14.1 Calculate total revenue by payment method
```
_{method} ℱ_(SUM(amount) as totalRevenue)(
  σ_(status='COMPLETED')(Payment)
)
```

### 14.2 Find highest revenue generating route
```
ρ_RouteRevenue(_{routeId} ℱ_(SUM(revenue) as totalRevenue)(
  Flight WHERE revenue IS NOT NULL
))

π_(D.name as departure, A.name as arrival, totalRevenue)(
  RouteRevenue ⋈_(RouteRevenue.routeId=Route.id) Route
               ⋈_(Route.departAirportId=D.id) (ρ_D(Airport))
               ⋈_(Route.arriveAirportId=A.id) (ρ_A(Airport))
  ORDER BY totalRevenue DESC
  LIMIT 1
)
```

### 14.3 Calculate refund amount by reason
```
_{reason} ℱ_(SUM(amount) as totalRefunded, COUNT(*) as refundCount)(
  σ_(status='COMPLETED')(Refund)
)
```

### 14.4 Find passengers with highest total spending
```
ρ_PassengerSpending(_{passengerId} ℱ_(SUM(totalFare) as totalSpent)(Booking))

π_(firstName, lastName, totalSpent)(
  PassengerSpending ⋈_(PassengerSpending.passengerId=Passenger.id) Passenger
                    ⋈_(Passenger.userId=User.id) User
  ORDER BY totalSpent DESC
  LIMIT 10
)
```

## 15. Capacity and Availability Queries

### 15.1 Find available seats for a specific flight
```
π_(seatNumber, class, price)(
  Seat ⋈_(Seat.aircraftId=Flight.aircraftId) Flight
  WHERE Flight.id='xyz' ∧ Seat.isBlocked=false ∧ Seat.id NOT IN (
    π_(seatId)(σ_(flightId='xyz' ∧ ticketStatus NOT IN ('CANCELLED','REFUNDED'))(Ticket))
  )
)
```

### 15.2 Calculate occupancy rate per flight
```
ρ_Capacity(_{aircraftId} ℱ_(COUNT(*) as totalSeats)(Seat))
ρ_Booked(_{flightId} ℱ_(COUNT(*) as bookedSeats)(
  σ_(ticketStatus NOT IN ('CANCELLED','REFUNDED'))(Ticket)
))

π_(flightNumber, (bookedSeats/totalSeats)*100 as occupancyRate)(
  Flight ⋈_(Flight.aircraftId=Capacity.aircraftId) Capacity
         ⋈_(Flight.id=Booked.flightId) Booked
)
```

### 15.3 Find gates currently in use
```
π_(gateNumber, terminalName, flightNumber)(
  σ_(status='OCCUPIED')(Gate) ⋈_(Gate.id=Flight.gateId) Flight
                               ⋈_(Gate.terminalId=Terminal.id) Terminal
)
```

### 15.4 Find aircraft with available capacity
```
π_(aircraftNumber, model, capacity)(
  Aircraft WHERE id NOT IN (
    π_(aircraftId)(σ_(status IN ('SCHEDULED','BOARDING','DEPARTED','IN_FLIGHT'))(Flight))
  ) ∧ status='ACTIVE'
)
```

## Notation Reference

- **σ** (sigma): Selection (filtering rows)
- **π** (pi): Projection (selecting columns)
- **⋈** (bowtie): Natural Join
- **×** (times): Cartesian Product
- **∪** (union): Union
- **∩** (intersect): Intersection
- **-** (minus): Difference
- **÷** (divide): Division
- **ρ** (rho): Rename
- **ℱ** (script F): Aggregation with grouping
- **∧** (and): Logical AND
- **∨** (or): Logical OR
- **≠** (not equal): Not equal to
- **≥** (greater equal): Greater than or equal to
- **≤** (less equal): Less than or equal to