---
layout: post
title:  Backend Service Design - Movie Booking System (2)
---

Last time, we drew a use case diagram for the `Movie Booking System`. If you've drawn a use case diagram during the software analysis/design process, it can be called a successful start.

This time, we’ll dive into two of the more complex use cases: `PurchaseTickets` and `CreateShowtimes`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
package tickets {
usecase PurchaseTickets #yellow
usecase GenerateTickets
}

package showtimes {
    usecase CreateShowtimes #yellow
}

package theaters {
}

package movies {
}

package customers {
}

}

administrator --> CreateShowtimes
customer -> PurchaseTickets
PurchaseTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets

@enduml
{% endplantuml %}

## 1. Which use case to analyze first?

Which one is better to analyze first, `CreateShowtimes` or `PurchaseTickets`? I usually start with use cases that **create** data. This is because query functions can only be understood meaningfully when there is prerequisite data.

Here, since tickets need to be generated before they can be purchased, we will analyze the `CreateShowtimes` use case first.

## 2. `CreateShowtimes` Use Case Specification

We ask the domain expert what procedures are necessary to create showtimes and then summarize it as follows:

**Goal**: Create showtimes for a single movie in multiple theaters.

**Actor**: Admin

**Preconditions**:

- The administrator must be logged into the system.
- Movies and theaters must be registered in the system.

**Trigger**:

- The administrator visits the Showtime Creation page.

**Basic Flow**:

1. The system displays a list of currently registered movies.
2. The administrator selects the movie for which to register showtimes.
3. The system displays a list of currently registered theaters.
4. The administrator selects the theaters for which to register showtimes.
5. The administrator inputs the showtimes for each theater.
6. The administrator registers the showtimes.
7. The system checks if the registered showtimes overlap with existing showtimes.
8. If there is no overlap, the system registers the showtimes and displays a message indicating that showtime registration is complete.

**Alternative Flow**:

- If the showtime overlaps with an existing showtime:
    1. The system displays a message that showtime registration failed, along with information about which showtimes overlapped.
    2. Return to step 5 of the basic flow.

**Postconditions**:

- Showtimes for the selected movie at the selected theaters must be successfully registered.
- Tickets corresponding to the showtimes must be generated.

We've defined the `Trigger` which is the starting condition for CreateShowtimes, and organized the corresponding `Basic Flow`. Looking at other elements like `Alternative Flow` and `Postconditions`, we can get a sense of what tasks the `Movie Booking System` needs to perform.

## 3. `CreateShowtimes` Sequence Diagram

Let's draw a sequence diagram to make the use case specification easier to read.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs: (Trigger) Visits showtime creation page
Admin <-- mbs: (1) Provides movie list

Admin -> mbs: (2) Selects movie
Admin <-- mbs: (3) Provides theater list

Admin -> mbs: (4) Selects theaters
Admin <-- mbs: (5) Provides showtime list (for selected theaters/movie implicitly)

Admin -> mbs: (6) Selects/Inputs showtimes

Admin -> mbs: (7) Requests showtime registration
Admin <-- mbs: (8) Showtime registration success screen

@enduml
{% endplantuml %}

The sequence diagram above contains the details for the `Trigger`, `Basic Flow`, and `Postconditions`, while the `Alternative Flow` is omitted. I judged that the `Alternative Flow` is simple enough to be handled during the implementation phase.

> Design should contain just enough information to proceed with implementation. The expression **enough** here can be somewhat ambiguous, as it depends on the team's situation. If the developers are highly skilled, a simple design might suffice. If the designer and implementer are far apart and close communication is difficult, the design will need to be more meticulous.

If you were to represent the `Alternative Flow` in a sequence diagram, it could be expressed as follows:

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

alt successful
Admin -> mbs: Showtime registration successful
else failure
Admin -> mbs: Showtime registration failed
end
@enduml
{% endplantuml %}

However, it's often better to separate the `Alternative Flow` into a different diagram in sequence diagrams. This is because `Alternative Flow` tends to complicate the diagram and gradually pull the design down to the implementation level.

## 4. REST API Design

If you were a screen planner or designer, there would probably be no need to further expand the `CreateShowtimes` sequence diagram. However, since we are targeting the backend, let's expand the sequence diagram to design the REST API.

### 4.1. Shallow Routing

{% plantuml %}
@startuml
actor Admin

Admin -> Frontend: Visits showtime creation page
Frontend -> Backend: Request movie list\nGET /movies?orderby=releaseDate:desc
Frontend <-- Backend: movies[]
Admin <-- Frontend: Provides movie list

Admin -> Frontend: Selects movie
Frontend -> Backend: Request theater list\nGET /theaters?orderby=name:asc
Frontend <-- Backend: theaters[]
Admin <-- Frontend: Provides theater list

Admin -> Frontend: Selects theaters
Frontend -> Backend: Request showtime list\nGET /showtimes?theaterIds=[]
Frontend <-- Backend: showtimes[]
Admin <-- Frontend: Provides showtime list

Admin -> Frontend: Selects/Inputs showtimes

Admin -> Frontend: Requests showtime registration
Frontend -> Backend: Create showtime request\nPOST /showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationMinutes
}
end note
Frontend <-- Backend: Created(201)
Admin <-- Frontend: Showtime registration success screen
@enduml
{% endplantuml %}

This is a typical Shallow Routing design that keeps routes short, which is a practical choice that maintains short and flat URIs, reducing the burden of service evolution and maintenance.

### 4.2. Adding Namespace

The Shallow Routing approach has some drawbacks. Currently, requests are simple because it's the initial stage of the project, but as the project progresses and requirements become more specific, the API may change frequently. For example, like this:

```sh
GET /movies?orderby=releaseDate:desc&includes=showtime-summary
GET /theaters?orderby=name:asc&includes=showtime-count
```

As API conditions become more complex, the implementation burden on the backend that needs to handle this increases. The frontend using the API also faces the burden of understanding and implementing the API specs.

Software development emphasizes flexibility because requirements continually change. However, providing flexibility in an API means it becomes that much harder to use and implement.

For a service targeting an unspecified majority, increasing flexibility and entrusting specific implementation to the user (here, the frontend) would be the right choice. However, we are in a situation where we know it's a request with a clear purpose: `showtime creation`. In that case, it would be reasonable to define the API to reflect this situation well.

```sh
GET /showtime-creation/movies
GET /showtime-creation/theaters
```

Defined this way, there will be no need to change the API unless the requirements for `showtime creation` change significantly.

Someone might call this approach a Context-Controller pattern, but there doesn't seem to be a standard name for it. I'm hesitant to even attach the name "pattern" to this method, so here I'll just define `/showtime-creation` as a `namespace`.

### 4.3. API for Long Query Parameters

Reviewing the top-priority requirements defined last time, we have:

```txt
Top Priority Requirements

1. At least 4,000 theaters
2. Prevention of duplicate seat reservations is essential
3. Existing data migration is essential
```

It's stated that there are at least 4,000 theaters, which can be problematic for any API that accepts `theaterIds`.

```sh
GET /showtime-creation/showtimes?theaterIds=[]
```

For endpoints that may receive long parameter lists, prefer POST with a request body.

```sh
POST /showtime-creation/showtimes/search
{
    "theaterIds":[]
}
```

### 4.4. Final REST API Design (CreateShowtimes)

Let's redraw the sequence diagram reflecting the design guidelines explained so far.

{% plantuml %}
@startuml
actor Admin
Admin -> Frontend: Visits showtime creation page
Frontend -> Backend: Request movie list\nGET /showtime-creation/movies
Frontend <-- Backend: movies[]
Admin <-- Frontend: Provides movie list

Admin -> Frontend: Selects movie
Frontend -> Backend: Request theater list\nGET /showtime-creation/theaters
Frontend <-- Backend: theaters[]
Admin <-- Frontend: Provides theater list

Admin -> Frontend: Selects theaters
Frontend -> Backend: Request showtime list\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesDto {
theaterIds
}
end note

Frontend <-- Backend: showtimes[]

Admin <-- Frontend: Provides showtime list

Admin -> Frontend: Selects/Inputs showtimes

Admin -> Frontend: Requests showtime registration
Frontend -> Backend: Create showtime request\nPOST /showtime-creation/showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationMinutes
}
end note
Frontend <-- Backend: Created(201)
Admin <-- Frontend: Showtime registration success screen

@enduml
{% endplantuml %}

## 5. Service Design

Once the REST API is defined, let's design the services that connect to it.

### 5.1. Microservice Architecture (MSA)

Before starting service design, the top-level architecture must be decided considering the project and development team's situation. Here, Microservice Architecture (MSA) was chosen.

The biggest characteristic of MSA is that small services collaborate to provide a service. An important point here is that services do not share databases.

This characteristic of microservices can be seen as similar to classes in object-oriented programming.
{% plantuml %}
@startditaa
+----------------------+        +----------------------+
|         Class        |<------>|    Microservice      |
+----------------------+        +----------------------+
|                      |        |                      |
| - Property           |<------>| - Database           |
|                      |        |                      |
+----------------------+        +----------------------+
|                      |        | + API                |
| + Method()           |<------>|   + GET /resource    |
|                      |        |   + POST /resource   |
+----------------------+        +----------------------+
@endditaa
{% endplantuml %}

Ultimately, MSA structurally has similarities to the object-oriented approach.

Now, let's design the services according to MSA. For convenience, the `Admin` actor is omitted.

{% plantuml %}
@startuml
Frontend -> Backend: Request movie list\nGET /showtime-creation/movies
Backend -> MoviesService: searchMovies()
Backend <-- MoviesService: movies[]
Frontend <-- Backend: movies[]

Frontend -> Backend: Request theater list\nGET /showtime-creation/theaters
Backend -> TheatersService: searchTheaters()
Backend <-- TheatersService: theaters[]
Frontend <-- Backend: theaters[]

Frontend -> Backend: Request showtime list\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesDto {
theaterIds
}
end note
Backend -> ShowtimesService: searchShowtimes(searchDto)
Backend <-- ShowtimesService: showtimes[]
Frontend <-- Backend: showtimes[]

Frontend -> Backend: Create showtime request\nPOST /showtime-creation/showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationMinutes
}
end note
Backend -> ShowtimesService: createShowtimes(createDto)
ShowtimesService -> MoviesService: moviesExist(movieId)
ShowtimesService <-- MoviesService: true

    ShowtimesService -> TheatersService: theatersExist(theaterIds)
    ShowtimesService <-- TheatersService: true

    ShowtimesService -> ShowtimesService: createShowtimes(createDto) // Internal call or delegate
Backend <-- ShowtimesService: showtimes[] // Assuming this returns the created showtimes

Frontend <-- Backend: Created(201)

@enduml
{% endplantuml %}

In this sequence diagram, the relatively complex part is that ShowtimesService's createShowtimes() function calls MoviesService.moviesExist() and TheatersService.theatersExist() for validation.

### 5.2. Circular Dependency Problem in Microservices

In Object-Oriented Programming (OOP), it's said that if two objects refer to each other, it should be avoided because it can cause problems like memory management. However, more important than such technical issues is that the two objects become tightly coupled.

For example, if classes A and B refer to each other, changing A affects B, and changing B in turn affects A. Such a relationship is like A and B being effectively bundled as a single object.

{% plantuml %}
@startuml

class A
class B
A -> B : uses
B -> A : uses

@enduml
{% endplantuml %}

Interfaces could be considered to solve this problem, but the best solution is not to create circular dependencies in the first place.

Just as MSA has characteristics similar to OOP, MSA should also avoid circular dependencies. However, the microservices designed above have a high probability of encountering circular dependency problems. This is because functionality that makes MoviesService reference ShowtimesService can easily be added.

{% plantuml %}
@startuml
Frontend -> Backend: Create showtime request
Backend -> ShowtimesService: createShowtimes(createDto)
ShowtimesService -> MoviesService: moviesExist(movieId)
ShowtimesService <-- MoviesService: true
Backend <-- ShowtimesService: showtimes[]
Frontend <-- Backend: Created(201)

Frontend -> Backend: Request movie list showing after 11 PM
Backend -> MoviesService: searchMovies()
MoviesService -> ShowtimesService: searchShowtimes()
MoviesService <-- ShowtimesService: showtimes[]
Backend <-- MoviesService: movies[]
Frontend <-- Backend: movies[]
@enduml
{% endplantuml %}

As can be seen in the sequence diagram above, the fact that a service can refer to other services means that as functionality expands, it can someday develop into a mutual reference relationship.

### 5.3. 3-Layer Structure of Microservices

MSA resolves the conflict between 'inter-service collaboration' and 'prohibition of circular dependencies' through layer separation. That is, microservices add a `unidirectional dependency` rule, meaning they can only refer to lower layers.

{% plantuml %}
@startuml
package "Application Services" {
[ShowtimeCreationService]
}

package "Core Services" {
[MoviesService]
[TheatersService]
[ShowtimesService]
[TicketsService]
}

package "Infrastructure Services" {
[PaymentsService]
}

[ShowtimeCreationService] --> [MoviesService]
[ShowtimeCreationService] --> [TheatersService]
[ShowtimeCreationService] --> [ShowtimesService]
[ShowtimeCreationService] --> [TicketsService]

[TicketsService] --> [PaymentsService]

note top of [ShowtimeCreationService]
**Circular dependencies are strictly prohibited**

1. **No references between services in the same layer**
2. Upper layers can only reference lower layers
3. Application → Core → Infrastructure
    end note
    @enduml
    {% endplantuml %}

In this project, we decide to categorize services into `Application`, `Core`, and `Infrastructure`.

- **Application Service**:
  - Assembles user scenarios (e.g., Order → Payment → Notification).
  - Only allowed to call Core/Infra services.
  - Leads transaction management.
- **Core Service**:
  - Responsible for the basic logic of the domain (e.g., movie management, theater management).
  - Only allowed to call Infra services.
- **Infrastructure Service**:
  - Responsible for integration with external systems like DB, payment, storage.

Just as objects are classified into `Application`, `Domain`, and `Infrastructure` layers when designing a single microservice, microservices themselves are similarly divided.

Now, let's redesign by applying the 3-Layer structure.

{% plantuml %}
@startuml
Frontend -> Backend: Request movie list\nGET /showtime-creation/movies
Backend -> ShowtimeCreationService: searchMovies()
ShowtimeCreationService -> MoviesService: searchMovies()
ShowtimeCreationService <-- MoviesService: movies[]
Backend <-- ShowtimeCreationService: movies[]
Frontend <-- Backend: movies[]

Frontend -> Backend: Request theater list\nGET /showtime-creation/theaters
Backend -> ShowtimeCreationService: searchTheaters()
ShowtimeCreationService -> TheatersService: searchTheaters()
ShowtimeCreationService <-- TheatersService: theaters[]
Backend <-- ShowtimeCreationService: theaters[]
Frontend <-- Backend: theaters[]

Frontend -> Backend: Request showtime list\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesDto {
theaterIds
}
end note
Backend -> ShowtimeCreationService: searchShowtimes(searchDto)
ShowtimeCreationService -> ShowtimesService: searchShowtimes(searchDto)
ShowtimeCreationService <-- ShowtimesService: showtimes[]
Backend <-- ShowtimeCreationService: showtimes[]
Frontend <-- Backend: showtimes[]

Frontend -> Backend: Create showtime request\nPOST /showtime-creation/showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationMinutes
}
end note
Backend -> ShowtimeCreationService: createShowtimes(createDto)
ShowtimeCreationService -> MoviesService: moviesExist(movieId)
ShowtimeCreationService <-- MoviesService: true

    ShowtimeCreationService -> TheatersService: theatersExist(theaterIds)
    ShowtimeCreationService <-- TheatersService: true

    ShowtimeCreationService -> ShowtimesService: createShowtimes(createDto)
    ShowtimeCreationService <-- ShowtimesService: showtimes[] // Assuming this returns the created showtimes
Backend <-- ShowtimeCreationService: showtimes[]

Frontend <-- Backend: Created(201)

@enduml
{% endplantuml %}

A `ShowtimeCreationService` service was created to match the `/showtime-creation` namespace.
This has the added benefit of making the structure easier to understand as the REST API and service structure become similar.

> Software development should flow naturally like water through analysis/design/implementation/verification.

## 6. Conclusion

In this article, for the `CreateShowtimes` use case, we (1) created a use case specification, (2) visualized it with a sequence diagram, and (3) expanded the sequence for service design.

By choosing MSA as the top-level architecture and resolving the inter-service circular dependency problem with a 3-Layer (Service) structure, we confirmed the effect of the REST API and service layer corresponding naturally.

In the next article, we will finalize and supplement the incomplete design of `CreateShowtimes` and write related tests.
