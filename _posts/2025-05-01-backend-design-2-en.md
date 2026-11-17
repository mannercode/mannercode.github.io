---
layout: post
title: Backend Service Analysis and Design (2)
lang: en
translation_key: backend-design-2
---

In the previous article, we drew a use case diagram for the `Movie Booking System`. Producing a use case diagram is a successful start to software analysis and design.

Two use cases appear to involve relatively complex procedures: creating showtimes and purchasing tickets. We will analyze creating showtimes first and cover purchasing tickets in a later article.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
    package tickets {
        usecase "Purchase tickets" as PurchaseTickets #yellow
        usecase "Generate tickets" as GenerateTickets
    }

    package showtimes {
        usecase "Create showtimes" as CreateShowtimes #yellow
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

## 1. Which Use Case Should We Analyze First?

Should we start with creating showtimes or purchasing tickets? I usually begin with a use case that **creates data**, because queries only become meaningful once the data exists.

Here, tickets must be generated before they can be purchased, so we will analyze creating showtimes first.

## 2. Specifying the Create Showtimes Use Case

We ask the domain expert what steps are required to create showtimes and organize their answer as follows.

**Goal**: Create showtimes for a movie.

**Actor**: Admin. From here on, we will shorten `administrator` to `Admin`.

**Preconditions**:

- The administrator must be logged in.
- The movies and theaters must already be registered in the system.

**Trigger**:

- The administrator opens the page for creating movie showtimes.

**Main flow**:

1. The system displays the registered movies.
2. The administrator selects the movie for which to create showtimes.
3. The system displays the registered theaters.
4. The administrator selects the theaters for which to create showtimes.
5. The system displays the existing showtimes.
6. The administrator enters showtimes for each theater.
7. The administrator submits the showtimes.
8. The system checks whether the submitted showtimes overlap with existing ones.
9. The system saves the showtimes and displays a success message.

**Alternative flow**:

- If any showtimes overlap with existing ones:
  1. The system displays a failure message and identifies the overlapping showtimes.
  2. The flow returns to step 5 of the main flow.

**Postconditions**:

- The movie's showtimes must be successfully registered.
- Tickets for those showtimes must be generated.

We have defined the trigger that starts `CreateShowtimes` and the main flow that follows. The alternative flow and postconditions also help us understand what the `Movie Booking System` needs to do.

## 3. A Sequence Diagram for Creating Showtimes

Let us turn the use case specification into a sequence diagram to make it easier to read.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs:  Open the showtime creation page
Admin <-- mbs:  Display movies

Admin -> mbs:  Select movie
Admin <-- mbs: Display theaters

Admin -> mbs:  Select theaters
Admin <-- mbs: Display showtimes

Admin -> Admin:  Select showtimes
Admin -> mbs:  Request showtime creation

mbs -> mbs:  Showtime validation succeeds

Admin <-- mbs: Showtime creation success screen

@enduml
{% endplantuml %}

This diagram includes the actor, trigger, and main flow, but leaves out the alternative flow.

### 3.1. Expressing the Alternative Flow with `alt`

Let us add the alternative flow. Since it is an *alternative* flow, the `alt` operator seems appropriate.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs:  Open the showtime creation page
Admin <-- mbs:  Display movies

Admin -> mbs:  Select movie
Admin <-- mbs: Display theaters

Admin -> mbs:  Select theaters
Admin <-- mbs: Display showtimes

Admin -> Admin:  Select showtimes
Admin -> mbs:  Request showtime creation

alt No overlap
    mbs -> mbs:  Showtime validation succeeds
    Admin <-- mbs: Showtime creation success screen
else Overlapping showtimes
    mbs -> mbs:  Showtime validation fails

    Admin <-- mbs: Show failure and overlapping showtimes
    Admin <-- mbs: Display showtimes (return to main flow step 5)
end

@enduml
{% endplantuml %}

Using `alt` is reasonable, but “provide showtimes (return to step 5 of the main flow)” does not seem particularly intuitive in the diagram.

### 3.2. Expressing Retries with `loop`

Returning to step 5 means repeating showtime entry, so the `loop` operator seems appropriate.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs:  Open the showtime creation page
Admin <-- mbs:  Display movies

Admin -> mbs:  Select movie
Admin <-- mbs: Display theaters

Admin -> mbs:  Select theaters

loop Retry if showtimes overlap
    Admin <-- mbs: Display showtimes

    Admin -> Admin:  Select showtimes
    Admin -> mbs:  Request showtime creation

    alt No overlap
        mbs -> mbs:  Showtime validation succeeds
        Admin <-- mbs: Showtime creation success screen
    else Overlapping showtimes
        mbs -> mbs:  Showtime validation fails

        Admin <-- mbs: Show failure and overlapping showtimes
    end
end
@enduml
{% endplantuml %}

The loop improves the representation of the alternative flow. However, the nested frames make it look complicated for a document produced during analysis.

### 3.3. Showing Only the Alternative Flow

As we have seen, nested frames make the diagram look complex. The best approach depends on the project, but here it seems better to show the alternative flow separately.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs:  Open the showtime creation page
Admin <-- mbs:  Display movies

Admin -> mbs:  Select movie
Admin <-- mbs: Display theaters

Admin -> mbs:  Select theaters

loop Retry if showtimes overlap
    Admin <-- mbs: Display showtimes

    Admin -> Admin:  Select showtimes
    Admin -> mbs:  Request showtime creation

    mbs -> mbs:  Showtime validation fails

    Admin <-- mbs: Show failure and overlapping showtimes
end
@enduml
{% endplantuml %}

When you are new to UML, you may want to create elaborate diagrams using all its different operators. But design is different from implementation. A design document does not need to reproduce the requirements with the same detail as code.

### 3.4. Does the Alternative Flow Need a Sequence Diagram?

A design only needs to contain enough information for implementation. “Enough” is somewhat ambiguous because it depends on the team. Skilled developers may need only a simple design. If the designer and implementer work far apart and cannot communicate closely, the design may need more detail.

We drew sequence diagrams for this simple alternative flow to illustrate the options. In an actual project, I would not have drawn them.

## 4. Designing the REST API

A product planner or UI designer might not need to extend the sequence diagram any further. Our focus is the backend, however, so we will extend it to design the REST API.

### 4.1. Shallow Routing

{% plantuml %}
@startuml
actor Admin

Admin -> Frontend: Open the showtime creation page
    Frontend -> Backend:Request movies\nGET /movies?orderby=releaseDate:desc
    Frontend <-- Backend: movies[]
Admin <-- Frontend: Display movies

Admin -> Frontend: Select movie
    Frontend -> Backend:Request theaters\nGET /theaters?orderby=name:asc
    Frontend <-- Backend: theaters[]
Admin <-- Frontend: Display theaters

Admin -> Frontend: Select theaters
    Frontend -> Backend: Request showtimes\nGET /showtimes?theaterIds=[]
    Frontend <-- Backend: showtimes[]
Admin <-- Frontend: Display showtimes

Admin -> Admin: Select showtimes

Admin -> Frontend: Request showtime creation
    Frontend -> Backend: Request showtime creation\nPOST /showtimes
        note right
        CreateShowtimesDto {
            movieId,
            theaterIds,
            startTimes,
            durationInSeconds
        }
        end note
    Frontend <-- Backend: Created(201)
Admin <-- Frontend: Showtime creation success screen
@enduml
{% endplantuml %}

This is a typical shallow routing design. Keeping URIs short and flat is a practical choice that reduces the work involved in evolving and operating a service.

### 4.2. Adding a Namespace

Shallow routing has some drawbacks. Requests are simple early in the project, but APIs may change frequently as development progresses and requirements become more specific. For example:

```sh
GET /movies?orderby=releaseDate:desc&includes=showtime-summary
GET /theaters?orderby=name:asc&includes=showtime-count
```

As API query conditions grow more complex, so does the backend's implementation burden. The frontend also has to understand the API specification and implement its use correctly.

Software development values flexibility because requirements keep changing. But providing flexibility in an API also makes it harder to implement and use.

For a service intended for a broad, unspecified audience, providing flexibility and leaving the specific implementation to consumers—the frontend in this case—may be the right choice. Here, however, we know that these requests serve a clear purpose: creating showtimes. It is reasonable for the API to express that purpose.

```sh
GET /showtime-creation/movies
GET /showtime-creation/theaters
```

With this definition, the API should not need to change unless the requirements for creating showtimes change substantially.

Some people seem to call this a context controller pattern, but there does not appear to be a standard name. I am not sure it needs to be called a pattern at all, so here I will simply call `/showtime-creation` a namespace.

### 4.3. Bottom-Up vs. Top-Down

When implementation comes before design, the thought process often looks like this.

{% plantuml %}
@startuml
title Example of bottom-up thinking
|Developer|
start
:Identify domain concepts (movies, theaters, tickets);
fork
  :Implement ticket CRUD;
fork again
  :Implement theater CRUD;
fork again
  :Implement movie CRUD;
end fork
:A requirement to create showtimes appears;
if (Can existing APIs handle it?) then (Yes)
    :Provide existing APIs to the frontend;
else (No)
    :Modify or extend APIs, then provide them;
endif
:Update API documentation;
stop
@enduml
{% endplantuml %}

A bottom-up approach, starting from data and implementation, **first defines DDL around the tables currently understood**, then creates CRUD APIs that expose that schema. When new requirements appear, the developer looks for solutions within the existing implementation. As a result, a higher-level concept such as **creating showtimes** can become scattered across several APIs, weakening cohesion.

A top-down approach, starting from concepts, **begins with the use case—the domain concept—of creating showtimes**. It identifies the steps involved and designs endpoint paths around that flow. This makes a namespace such as `/showtime-creation` a natural choice.

Both approaches have advantages and disadvantages. From the perspective of [Essence-Based Interpretation (EBI)]({% post_url 2024-05-04-ebi-en %}), however, a top-down approach makes it easier to keep domain concepts and API structure consistent.

### 4.4. APIs with Long Query Parameters

Let us revisit the top-priority requirements from the previous article.

```txt
Top-priority requirements

1. Support at least 4,000 theaters
2. Prevent double-booking of seats
3. Migrate existing data
```

Supporting at least 4,000 theaters could be a problem for any API that accepts `theaterIds`.

```sh
GET /showtime-creation/showtimes?theaterIds=[]
```

We will define APIs expected to receive such long query parameters as POST requests.

```sh
POST /showtime-creation/showtimes/search
{
    theaterIds:[]
}
```

### 4.5. The Final REST API Design for `CreateShowtimes`

Let us redraw the sequence diagram using the design guidelines discussed so far.

{% plantuml %}
@startuml
actor Admin
Admin -> Frontend: Open the showtime creation page
    Frontend -> Backend: Request movies\nGET /showtime-creation/movies
    Frontend <-- Backend: movies[]
Admin <-- Frontend: Display movies

Admin -> Frontend: Select movie
    Frontend -> Backend: Request theaters\nGET /showtime-creation/theaters
    Frontend <-- Backend: theaters[]
Admin <-- Frontend: Display theaters

Admin -> Frontend: Select theaters
    Frontend -> Backend: Request showtimes\nPOST /showtime-creation/showtimes/search
        note right
            SearchShowtimesDto {
                theaterIds,
            }
        end note

    Frontend <-- Backend: showtimes[]
Admin <-- Frontend: Display showtimes

Admin -> Admin: Select showtimes

Admin -> Frontend: Request showtime creation
    Frontend -> Backend: Request showtime creation\nPOST /showtime-creation/showtimes
        note right
            CreateShowtimesDto {
                movieId,
                theaterIds,
                startTimes,
                durationInSeconds
            }
        end note
    Frontend <-- Backend: Created(201)
Admin <-- Frontend: Showtime creation success screen

@enduml
{% endplantuml %}

## 5. Designing the Services

Now that the REST API is defined, we can design the services behind it.

### 5.1. Introducing Microservices Architecture

Before designing individual services, we need to choose an overall architecture that suits the project and development team. Here, we will use microservices architecture (MSA).

Its defining feature is that small services work together to provide the system's functionality. A key constraint is that these services do not share databases.

In this respect, a microservice resembles a class in object-oriented programming.

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

MSA therefore shares some conceptual characteristics with object-oriented design.

### 5.2. Designing Services for MSA

Let us now design the services accordingly. For clarity, we will omit the `Admin` actor.

{% plantuml %}
@startuml
Frontend -> Gateway: Request movies\nGET /showtime-creation/movies
    Gateway -> MoviesService: searchMovies()
    Gateway <-- MoviesService: movies[]
Frontend <-- Gateway: movies[]

Frontend -> Gateway: Request theaters\nGET /showtime-creation/theaters
    Gateway -> TheatersService: searchTheaters()
    Gateway <-- TheatersService: theaters[]
Frontend <-- Gateway: theaters[]

Frontend -> Gateway: Request showtimes\nPOST /showtime-creation/showtimes/search
    note right
        SearchShowtimesDto {
            theaterIds,
        }
    end note
    Gateway -> ShowtimesService: searchShowtimes(searchDto)
    Gateway <-- ShowtimesService: showtimes[]
Frontend <-- Gateway: showtimes[]

Frontend -> Gateway: Request showtime creation\nPOST /showtime-creation/showtimes
    note right
        CreateShowtimesDto {
            movieId,
            theaterIds,
            startTimes,
            durationInSeconds
        }
    end note
    Gateway -> ShowtimesService: createShowtimes(createDto)
        ShowtimesService -> MoviesService: moviesExist(movieId)
        ShowtimesService <-- MoviesService: true

        ShowtimesService -> TheatersService: theatersExist(theaterIds)
        ShowtimesService <-- TheatersService: true

        ShowtimesService -> ShowtimesService: saveShowtimes(createDto)
    Gateway <-- ShowtimesService: showtimes[]
Frontend <-- Gateway: Created(201)

@enduml
{% endplantuml %}

The most involved part of this sequence is that `ShowtimesService.createShowtimes()` calls `MoviesService.moviesExist()` and `TheatersService.theatersExist()` for validation.

### 5.3. Circular Dependencies Between Microservices

In object-oriented programming, mutual references between two objects are discouraged because they can cause problems such as memory leaks in environments that use reference counting. More important than that technical issue, however, is the tight coupling between the objects.

If classes A and B reference each other, changing A affects B, and changing B in response affects A again. This relationship effectively binds A and B into a single object.

{% plantuml %}
@startuml

class A
class B
A -> B : uses
B -> A : uses

@enduml
{% endplantuml %}

Interfaces might help address the problem, but the best approach is to avoid creating the circular dependency in the first place.

Since MSA has characteristics similar to OOP, it should avoid circular dependencies too. The microservices we just designed are likely to develop this problem: it would be easy to add a feature to `MoviesService` that references `ShowtimesService`.

{% plantuml %}
@startuml
Frontend -> Gateway: Request showtime creation
    Gateway -> ShowtimesService: createShowtimes(createDto)
        ShowtimesService -> MoviesService: moviesExist(movieId)
        ShowtimesService <-- MoviesService: true
    Gateway <-- ShowtimesService: showtimes[]
Frontend <-- Gateway: Created(201)

Frontend -> Gateway: Request movies showing after 23:00
    Gateway -> MoviesService: searchMovies()
        MoviesService -> ShowtimesService: searchShowtimes()
        MoviesService <-- ShowtimesService: showtimes[]
    Gateway <-- MoviesService: movies[]
Frontend <-- Gateway: movies[]
@enduml
{% endplantuml %}

As this diagram illustrates, allowing services to reference other services means that circular dependencies may eventually emerge as features are added.

### 5.4. Service-oriented Layered Architecture (SoLA)

SoLA resolves the tension between service collaboration and prohibiting circular dependencies by separating services into layers. It adds a rule of **one-way dependencies**: a microservice may reference only services in lower layers.

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

1. **No dependencies within the same layer**
2. Only higher layers may reference lower layers
3. Application → Core → Infrastructure
end note
@enduml
{% endplantuml %}

In this project, we will divide services into `Application`, `Core`, and `Infrastructure` layers.

- **Application Service**:
  - Coordinates user scenarios, such as order → payment → notification.
  - May call only Core and Infrastructure services.
  - Leads transaction management.
- **Core Service**:
  - Handles fundamental domain logic, such as managing movies and theaters.
  - May call only Infrastructure services.
- **Infrastructure Service**:
  - Integrates with external systems such as payment providers and storage.

Just as we might organize objects within a microservice into Application, Domain, and Infrastructure layers, we can organize the microservices themselves in a similar way.

Let us redesign the system using SoLA.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

frontend -> gateway: Request movies\nGET /showtime-creation/movies
    gateway -> creation: searchMovies()
        creation -> movies: searchMovies()
        creation <-- movies: movies[]
    gateway <-- creation: movies[]
frontend <-- gateway: movies[]

frontend -> gateway: Request theaters\nGET /showtime-creation/theaters
    gateway -> creation: searchTheaters()
        creation -> theaters: searchTheaters()
        creation <-- theaters: theaters[]
    gateway <-- creation: theaters[]
frontend <-- gateway: theaters[]

frontend -> gateway: Request showtimes\nPOST /showtime-creation/showtimes/search
    note right
        SearchShowtimesDto {
            theaterIds,
        }
    end note
    gateway -> creation: searchShowtimes(searchDto)
        creation -> showtimes: searchShowtimes(searchDto)
        creation <-- showtimes: showtimes[]
    gateway <-- creation: showtimes[]
frontend <-- gateway: showtimes[]

frontend -> gateway: Request showtime creation\nPOST /showtime-creation/showtimes
    note right
        CreateShowtimesDto {
            movieId,
            theaterIds,
            startTimes,
            durationInSeconds
        }
    end note
    gateway -> creation: createShowtimes(createDto)
        creation -> movies: moviesExist(movieId)
        creation <-- movies: true

        creation -> theaters: theatersExist(theaterIds)
        creation <-- theaters: true

        creation -> showtimes: createShowtimes(createDto)
        creation <-- showtimes: showtimes[]
    gateway <-- creation: showtimes[]
frontend <-- gateway: Created(201)

@enduml
{% endplantuml %}

We created `ShowtimeCreationService` to correspond to the `/showtime-creation` namespace. The REST API and services now have similar structures, making the system easier to understand.

> Analysis, design, implementation, and verification should flow naturally into one another.

## 6. Conclusion

We analyzed the Create Showtimes use case by writing a use case specification, visualizing it as a sequence diagram, and extending that sequence to design the services.

We chose MSA as the overall architecture and addressed circular service dependencies with Service-oriented Layered Architecture (SoLA). This also produced a natural correspondence between the REST API and the service layers.

The final design still lacks ticket generation and validation for overlapping showtimes. In the next article, we will complete those parts of the design. Testing will follow in a later article.

---

Previous: [Backend Service Analysis and Design (1)]({% post_url 2025-04-01-backend-design-1-en %})

Next: [Backend Service Analysis and Design (3)]({% post_url 2025-06-01-backend-design-3-en %})
