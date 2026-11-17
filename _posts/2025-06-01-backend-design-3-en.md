---
layout: post
title: Backend Service Analysis and Design (3)
lang: en
translation_key: backend-design-3
---

In the previous article, we drew a sequence diagram for creating showtimes using a REST API namespace and the SoLA structure.

Now we will fill in the gaps in that design.

## 1. Problems with the Showtime Creation Request

This was our previous design for creating showtimes.

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

frontend -> gateway: Request theaters\nGET /showtime-creation/theaters
    gateway -> creation: searchTheaters()
        creation -> theaters: searchTheaters()

frontend -> gateway: Request showtimes\nPOST /showtime-creation/showtimes/search
    gateway -> creation: searchShowtimes(searchDto)
        creation -> showtimes: searchShowtimes(searchDto)

frontend -> gateway: Request showtime creation\nPOST /showtime-creation/showtimes
    gateway -> creation: createShowtimes(createDto)
        creation -> movies: moviesExist(movieId)
        creation -> theaters: theatersExist(theaterIds)
        creation -> showtimes: createShowtimes(createDto)
    gateway <-- creation: showtimes[]
frontend <-- gateway: Created(201)
@enduml
{% endplantuml %}

The main concern is that the showtime creation request is synchronous.

Suppose we register showtimes for one movie across 4,000 theaters. We would need to create the following data:

```txt
showtimes = 4,000 * 60 (days) * 8 (screenings per day) = 1,920,000
tickets = number of showtimes * 500 (seats) = 960,000,000
```

That means generating 960,000,000 tickets each time we register a movie's showtimes. This is a lengthy operation, so we cannot return a result immediately.

A long-running operation also increases concurrency concerns. What happens if two administrators create showtimes at the same time? We could end up with conflicting showtimes and, ultimately, double-booked seats—the worst outcome. Preventing double-booking is important enough to be one of our top-priority requirements.

The design also lacks both the check for conflicts with existing showtimes and ticket generation.

With so much missing, let us redesign the showtime creation request from the beginning.

## 2. Defining the Entities

The request creates `Showtime` and `Ticket` entities. We need to define those entities before designing the request.

{% plantuml %}
@startuml
class Movie {
    id: ObjectId
    title: string
    genres: MovieGenre[] {Action, Horror, ... }
    releaseDate: Date
    plot: string
    durationInSeconds: number
    director: string
    rating: MovieRating { PG13, R, NC17 }
    imageIds: ObjectId[]
}

class Theater {
    id: ObjectId
    name: string
    location: TheaterLocation
    seatmap: Seatmap
}
note left of Theater::seatmap
Seatmap {
    blocks:[{
        name: 'A',
        rows:[{
            name: '1',
            seats: 'OOOOXXOOOO'
            }]
        }]
}
end note

class Showtime {
    id: ObjectId
    startTime: Date
    endTime: Date
    theaterId: ObjectId
    movieId: ObjectId
}

class Ticket {
    id: ObjectId
    showtimeId: ObjectId
    theaterId: ObjectId
    movieId: ObjectId
    status: TicketStatus { Available, Sold}
    seat: Seat { block: string, row: string, seatNumber: number }
}

Ticket "*" --> "1" Showtime
Ticket "*" --> "1" Movie
Ticket "*" --> "1" Theater
Showtime "*" --> "1" Movie
Showtime "*" --> "1" Theater
@enduml
{% endplantuml %}

### 2.1. The `Movie` Entity

The domain expert can tell us most of the attributes of `Movie`.

`imageIds` contains the IDs of image files associated with the movie. A real project would distinguish several kinds of images, such as posters and galleries, but we have simplified them here.

### 2.2. The `Theater` Entity

The `location` property contains the theater's latitude and longitude. The name may seem vague for coordinates, but as requirements expand, it could also include an address or other location information.

`seatmap` represents the theater's seats, organized into blocks and rows. In the `Seatmap` example shown in the note, neither blocks nor rows have IDs. The seats are simply represented by O or X to indicate whether a seat exists.

Is it all right for seats to have no ID? Each physical seat is unique and may even have a serial number attached to it. Should we not assign and manage an ID in the database too?

But this project is a movie booking system. Customers find their seats using the block, row, and number printed on their tickets. They do not need a seat ID.

In other words, `seatmap` is needed to generate tickets; it is not itself something we need to manage independently.

In a facilities management service that records maintenance history for each seat, I would assign seat IDs. Here, however, the seat map acts as a template for generating tickets, so treating it as a **value object** is the right choice.

The frontend also uses `seatmap` to draw a seating plan. The current `Seatmap` structure reflects that requirement as well.

### 2.3. The `Showtime` Entity

`Showtime` represents a screening: when it takes place (`startTime`, `endTime`), where (`theaterId`), and what is shown (`movieId`).

### 2.4. The `Ticket` Entity

`Ticket` contains `showtimeId`, `movieId`, and `theaterId`. But `movieId` and `theaterId` already exist in `Showtime`. Is duplicating this data acceptable?

We are designing a microservices system, where services do not share databases. Without `movieId` and `theaterId` in `Ticket`, we would need to call `ShowtimesService` to find the movie and theater associated with a ticket. That would be inconvenient and inefficient.

Monolithic systems can make extensive use of table joins, so thorough normalization is common. In microservices, however, it is better to prioritize reducing coupling between services and the performance of core workflows over data normalization.

As discussed for `Theater`, the `seat` property does not reference a seat ID. It stores the seat's block, row, and number as a value object.

## 3. Designing Asynchronous Processing with a Queue

A queue can address both the duration of the showtime creation operation and its concurrency problems.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
Queue Queue as queue

frontend -> gateway: Request showtime creation\nPOST /showtime-creation/showtimes
    gateway -> creation: requestShowtimeCreation(createDto)
        creation -> creation: transactionId
        creation -> queue: enqueue { createDto, transactionId }
    gateway <-- creation: transactionId
frontend <-- gateway: Accepted(202)
...
queue -> creation: dequeue { createDto, transactionId }
    creation -> creation: <b>validateRequest(createDto)</b>
    creation -> creation: <b>bulkCreateShowtimes(createDto, transactionId)</b>
    creation -> creation: <b>bulkCreateTickets(showtimes, transactionId)</b>
@enduml
{% endplantuml %}

When an administrator submits a request, `ShowtimeCreationService` places the job in the `Queue` and returns a `transactionId`. This ID is used to track the job afterward.

The queue releases jobs sequentially, allowing us to address the concurrency problem as well.

When `ShowtimeCreationService` receives a job through `dequeue`, it runs these functions in order:

1. `validateRequest`
2. `bulkCreateShowtimes`
3. `bulkCreateTickets`

Let us look at each one.

## 4. Designing `validateRequest`

### 4.1. The Conflict Detection Algorithm

Before creating showtimes, we need to check for overlaps with existing ones. We will use a simple algorithm based on a set.

1. Divide the requested showtimes into ten-minute slots and add them to the `timeslots` set.
2. Divide each existing showtime's interval, from `startTime` to `endTime`, into ten-minute slots and check whether any of those slots are in `timeslots`.

For example, suppose we receive this request:

```ts
BulkCreateShowtimesDto {
    "movieId": "movie#1",
    "theaterIds": ["theater#1","theater#2"],
    "durationInMinutes": 30,
    "startTimes": [0930, 1200]
}
```

The previous article used `durationInSeconds`. Entering showtime durations in minutes is more natural, so we have changed it to `durationInMinutes`.

Using `startTimes` and `durationInMinutes`, we create the following `timeslots`:

```txt
Set<number> timeslots = [0930,0940,0950,1200,1210,1220]
```

Suppose an existing showtime is defined as follows:

```ts
const showtimes = [{id:1, startTime:1100, endTime:1230 }]
```

We split it into ten-minute slots—`1100, 1110, 1120, 1130, 1140, 1150, 1200, 1210, 1220`—and check whether those values are already in `timeslots`.

### 4.2. Conflict Detection Pseudocode

Here is pseudocode for the algorithm.

```ts
// Register time slots
const timeslots = new Set<number>()

for startTime of startTimes {
    const endTime = addMinutes(startTime, durationInMinutes)

    for(timeslot = startTime; timeslot < endTime; timeslot = addMinutes(timeslot, 10)) {
        timeslots.add(timeslot)
    }
}

// Fetch existing showtimes
const showtimes = getShowtimes(theaterId)

// Check whether existing showtimes overlap the time slots
for (showtime of showtimes) {
    const {startTime, endTime} = showtime

    for (timeslot = startTime; timeslot < endTime; timeslot = addMinutes(timeslot, 10)) {
        if (timeslots.contains(timeslot)) {
            // conflict
        }
    }
}
```

At first glance, the nested loops may suggest a time complexity of O(M × N).

However, the number of inner-loop iterations is determined by the duration, which is nearly fixed, rather than by the number of input showtimes. The resulting time complexity is therefore O(M + N).

```txt
Number of requested showtimes = M
Number of existing showtimes = N
Time complexity = O(M + N)
```

### 4.3. A Conflict Detection Diagram

What would the pseudocode look like as a UML diagram?

{% plantuml %}
@startuml
start
:timeslots = new Set;

while (startTime in startTimes?) is (Yes)
  :endTime = addMinutes(startTime, durationInMinutes);
  :timeslot = startTime;
  while (timeslot < endTime?) is (Yes)
    :timeslots.add(timeslot);
    :timeslot = addMinutes(timeslot, 10);
  endwhile (No)
endwhile (No)

:getShowtimes(theaterId);

while (showtime in showtimes?) is (Yes)
  :timeslot = showtime.startTime;
  while (timeslot < showtime.endTime?) is (Yes)
    if (timeslots.contains(timeslot)?) then (Conflict)
      :// Handle conflict;
    endif
    :timeslot = addMinutes(timeslot, 10);
  endwhile (No)
endwhile (No)

stop
@enduml
{% endplantuml %}

You might expect a picture to make a complex algorithm easier to understand. Developers accustomed to code, however, may find the code easier to follow.

When you first learn UML, it is tempting to express everything in diagrams. Remember that UML is not the best representation for everything.

### 4.4. A Practical Design for `validateRequest`

We expressed this simple algorithm in pseudocode and an activity diagram for the sake of explanation. In a real project, I would usually finish the design with a sequence diagram like this.

{% plantuml %}
@startuml
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

creation -> creation: validateRequest
activate creation
creation -> movies: moviesExist(movieId)
creation -> theaters: theatersExist(theaterIds)
creation -> showtimes: getShowtimes(theaterIds)
creation -> creation: findConflictingShowtimes()
creation --> creation: conflictingShowtimes
deactivate creation
@enduml
{% endplantuml %}

The `findConflictingShowtimes()` function can implement the conflict detection algorithm described above.

How detailed should a design be?

It depends on the situation. If the designer and implementer are different people and the implementer is less experienced, more detail may be necessary. If the implementer can devise and write the algorithm themselves, the designer need not do that work.

One thing is clear: we should design because it makes development more efficient. We should design before implementing when that process is more efficient. If implementing without a separate design is more efficient, we should skip the separate design.

“Efficient” is also somewhat ambiguous here: reliability, development costs, and other factors all need to be considered. In general, I find that design becomes more worthwhile the longer a project continues.

### 4.5. Other Conflict Detection Algorithms

You might wonder whether comparing start and end times directly, as below, would be faster. But the following code has O(M × N) time complexity. The earlier `timeslots` algorithm turns the M side of the comparison into a set, giving it O(M + N) complexity.

```ts
const showtimes = getShowtimes(theaterId)

for (showtime of showtimes) {
    for (startTime of createDto.startTimes) {
        const endTime = addMinutes(startTime, durationInMinutes)

        if (startTime < showtime.endTime && showtime.startTime < endTime) {
            // conflict
        }
    }
}
```

An approach based on binary search is another option. It could be somewhat faster than the `timeslots` approach, but I did not choose it because the improvement is small and implementation is harder.

## 5. Designing `bulkCreateShowtimes` and `bulkCreateTickets`

The two functions are designed as follows.

{% plantuml %}
@startuml
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "Tickets\nService" as tickets

creation -> creation: bulkCreateShowtimes(createDto, transactionId)
    note right
        BulkCreateShowtimesDto {
            "movieId": "movie#1",
            "theaterIds": ["theater#1","theater#2"],
            "durationInMinutes": 90,
            "startTimes": [202012120900, 202012121100]
        }
    end note

activate creation
    loop theaterId in createDto.theaterIds
        loop startTime in createDto.startTimes
            creation -> creation: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
        end
    end

    creation -> showtimes: createShowtimes\n(createShowtimeDtos, transactionId)
    creation <-- creation: showtimes
deactivate creation

creation -> creation: bulkCreateTickets(showtimes, transactionId)
activate creation
    loop showtime in showtimes
        creation -> theaters: getTheater(showtime.theaterId)
        creation <-- theaters: theater
        loop seat in theater.seats
            creation -> creation: buildCreateTicketDto(seat, showtime.id)
        end
        creation -> tickets: createTickets(createTicketDtos,transactionId)
        creation <-- tickets: tickets
    end
deactivate creation

@enduml
{% endplantuml %}

We create `showtimes` from the user's input, then create `tickets` from those showtimes.

This design does not yet explain what happens if creating showtimes or tickets fails partway through. The Saga pattern can address this; I will cover it in another article.

## 6. The Complete Sequence Diagram

Let us combine the design so far. Be warned: the diagram is complex.

{% plantuml %}
@startuml
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
Queue Queue as queue
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "Tickets\nService" as tickets

gateway -> creation: requestShowtimeCreation(createDto)
    creation -> creation: transactionId
    creation -> queue: enqueue { createDto, transactionId }
gateway <-- creation: transactionId
...
queue -> creation: dequeue { createDto, transactionId }
    creation -> creation: validateRequest
    activate creation
    creation -> movies: moviesExist(movieId)
    creation -> theaters: theatersExist(theaterIds)
    creation -> showtimes: getShowtimes(theaterIds)
    creation -> creation: findConflictingShowtimes()
    creation --> creation: conflictingShowtimes
    deactivate creation

    creation -> creation: bulkCreateShowtimes(createDto, transactionId)
    activate creation
        loop theaterId in createDto.theaterIds
            loop startTime in createDto.startTimes
                creation -> creation: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
            end
        end

        creation -> showtimes: createShowtimes\n(createShowtimeDtos, transactionId)
        creation <-- creation: showtimes
    deactivate creation

    creation -> creation: bulkCreateTickets(showtimes, transactionId)
    activate creation
        loop showtime in showtimes
            creation -> theaters: getTheater(showtime.theaterId)
            creation <-- theaters: theater
            loop seat in theater.seats
                creation -> creation: buildCreateTicketDto(seat, showtime.id)
            end
            creation -> tickets: createTickets(createTicketDtos,transactionId)
            creation <-- tickets: tickets
        end
    deactivate creation

gateway <<- creation: ShowtimeCreationStatus(Succeeded)

@enduml
{% endplantuml %}

The complexity is obvious, particularly the amount of functionality concentrated in `ShowtimeCreationService`:

1. Managing the queue
2. Validating showtime creation requests
3. Creating showtimes
4. Creating tickets

Although they are not shown here, `ShowtimeCreationService` also needs to implement `searchMovies`, `searchTheaters`, and `searchShowtimes`.

## 7. Refactoring `ShowtimeCreationService`

`ShowtimeCreationService` has too many responsibilities and has become complicated enough to need refactoring.

We will distribute its responsibilities across three classes:

1. `ShowtimeCreationWorkerService`, which manages showtime creation jobs
2. `ShowtimeBulkValidatorService`, which validates showtime creation requests
3. `ShowtimeBulkCreatorService`, which creates showtimes and tickets

{% plantuml %}
@startuml
class ShowtimeCreationService {
    requestShowtimeCreation(createDto)
}

class ShowtimeCreationWorkerService {
     requestShowtimeCreation(createDto)
     processNextJob()
}

class ShowtimeBulkValidatorService {
     validate(createDto)
}

class ShowtimeBulkCreatorService {
     create(createDto, transactionId)
}

ShowtimeCreationService --> ShowtimeCreationWorkerService : worker
ShowtimeCreationWorkerService --> ShowtimeBulkValidatorService : validator
ShowtimeCreationWorkerService --> ShowtimeBulkCreatorService : creator

@enduml
{% endplantuml %}

The resulting sequence diagrams follow.

### 7.1. `ShowtimeCreationService`

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "ShowtimeCreationWorker\nService" as worker

frontend -> gateway: Request movies\nGET /showtime-creation/movies
    gateway -> creation: searchMovies()
        creation -> movies: searchMovies()

frontend -> gateway: Request theaters\nGET /showtime-creation/theaters
    gateway -> creation: searchTheaters()
        creation -> theaters: searchTheaters()

frontend -> gateway: Request showtimes\nPOST /showtime-creation/showtimes/search
    note right
        SearchShowtimesDto {
            theaterIds
        }
    end note
    gateway -> creation: searchShowtimes(searchDto.theaterIds)
        creation -> showtimes: searchShowtimes\n({ theaterIds, endTimeRange: { start: now }})

frontend -> gateway: Request showtime creation\nPOST /showtime-creation/showtimes
    note right
        BulkCreateShowtimesDto {
            "movieId": "movie#1",
            "theaterIds": ["theater#1","theater#2"],
            "durationInMinutes": 90,
            "startTimes": [202012120900, 202012121100]
        }
    end note
    gateway -> creation: requestShowtimeCreation(createDto)
        creation -> worker: requestShowtimeCreation(createDto)
        creation <-- worker: transactionId
    gateway <-- creation: RequestShowtimeCreationResponse\n{ transactionId }
frontend <-- gateway: Accepted(202)

frontend ->> gateway: Monitor showtime creation\nSSE /showtime-creation/event-stream
gateway <<- worker: { status: ShowtimeCreationStatus.Succeeded, transactionId }
frontend <<- gateway: { Succeeded, transactionId }
@enduml
{% endplantuml %}

With most functionality delegated to classes such as `ShowtimeCreationWorkerService`, `ShowtimeCreationService` can focus on orchestration: transforming data, controlling the asynchronous flow, and mapping results.

#### Naming

For request DTOs (Data Transfer Objects), such as `SearchShowtimesDto`, we use the function name followed by `Dto`. Some projects prefer names such as `SearchShowtimesRequest` and `SearchShowtimesResponse`, but I find that convention less flexible.

The `requestShowtimeCreation` function takes a `BulkCreateShowtimesDto`. Why is it not called `RequestShowtimeCreationDto`, following the apparent pattern of `SearchShowtimesDto`?

`requestShowtimeCreation` only forwards the request. The function that actually processes it is `bulkCreateShowtimes`.

The response from `requestShowtimeCreation` is a `RequestShowtimeCreationResponse` DTO. A query usually returns the requested data directly, so it does not need a separate response DTO. There are fewer cases that need an explicitly defined response DTO, like `RequestShowtimeCreationResponse`, than you might expect.

This is why I do not automatically name DTOs after each function using pairs such as `SearchShowtimesRequest` and `SearchShowtimesResponse`.

### 7.2. `ShowtimeCreationWorkerService`

{% plantuml %}
@startuml
participant "ShowtimeCreation\nService" as creation
participant "ShowtimeCreationWorker\nService" as worker
Queue Queue as queue
participant "ShowtimeBulkValidator\nService" as validator
participant "ShowtimeBulkCreator\nService" as creator

creation -> worker: requestShowtimeCreation(createDto)
worker -> worker: createTransactionId
worker -> queue: enqueueJob { createDto, transactionId }
[o<- worker  : ShowtimeCreationStatus.Waiting
creation <-- worker: transactionId
[o-> worker:processNextJob()
worker -> queue: dequeueJob { createDto, transactionId }
[o<- worker  : ShowtimeCreationStatus.Processing
worker -> validator: validate(createDto)
worker -> creator: create(createDto, transactionId)
[o<- worker  : ShowtimeCreationStatus.Succeeded

@enduml
{% endplantuml %}

`ShowtimeCreationWorkerService` generates and returns a `transactionId`, then executes the jobs in the queue one at a time.

The arrows for `ShowtimeCreationStatus.Waiting` and `ShowtimeCreationStatus.Processing` end at black dots. Here, these represent emitted events.

Conversely, `processNextJob()` represents an event received from elsewhere.

### 7.3. `ShowtimeBulkValidatorService`

{% plantuml %}
@startuml
participant "ShowtimeCreationWorker\nService" as worker
participant "ShowtimeBulkValidator\nService" as validator
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

worker -> validator: validate(createDto)
validator -> movies: moviesExist(createDto.movieId)
validator -> theaters: theatersExist(createDto.theaterIds)
validator -> showtimes: getShowtimes(createDto.theaterIds)
validator -> validator: findConflictingShowtimes()
note right
1. Add the requested showtimes to a set of ten-minute time slots.
2. Divide each existing showtime from startTime to endTime
   into ten-minute slots and check whether each slot exists in the set.
end note
worker <-- validator: conflictingShowtimes
@enduml
{% endplantuml %}

Although `ShowtimeBulkValidatorService` does something simple, its name ends in `Service`. When should we use that suffix?

In this project, a class is called a service if it calls other services and performs the necessary work itself to fulfill a request.

If it instead receives all the necessary data from its caller, processes it, and returns a result, as below, we would call it simply `ShowtimeBulkValidator`.

{% plantuml %}
@startuml
participant "ShowtimeCreationWorker\nService" as worker
participant "ShowtimeBulkValidator" as validator
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

worker -> movies: moviesExist(createDto.movieId)
worker -> theaters: theatersExist(createDto.theaterIds)
worker -> showtimes: getShowtimes(createDto.theaterIds)
worker -> validator ** : validate(showtimes)
validator -> validator: findConflictingShowtimes()
worker <-- validator: conflictingShowtimes
@enduml
{% endplantuml %}

### 7.4. `ShowtimeBulkCreatorService`

{% plantuml %}
@startuml
participant "ShowtimeCreationWorker\nService" as worker
participant "ShowtimeBulkCreator\nService" as creator
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "Tickets\nService" as tickets

worker -> creator: create(createDto, transactionId)
    note right
        BulkCreateShowtimesDto {
            "movieId": "movie#1",
            "theaterIds": ["theater#1","theater#2"],
            "durationInMinutes": 90,
            "startTimes": [202012120900, 202012121100]
        }
    end note

creator -> creator: bulkCreateShowtimes(createDto, transactionId)
activate creator
    loop theaterId in createDto.theaterIds
        loop startTime in createDto.startTimes
            creator -> creator: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
        end
    end

    creator -> showtimes: createShowtimes\n(createShowtimeDtos, transactionId)
    creator <-- creator: showtimes
deactivate creator

creator -> creator: bulkCreateTickets(showtimes, transactionId)
activate creator
    loop showtime in showtimes
        creator -> theaters: getTheater(showtime.theaterId)
        creator <-- theaters: theater
        loop seat in theater.seats
            creator -> creator: buildCreateTicketDto(seat, showtime.id)
        end
        creator -> tickets: createTickets(createTicketDtos,transactionId)
        creator <-- tickets: tickets
    end
deactivate creator
worker <- creator: { createdShowtimeCount, createdTicketCount }
@enduml
{% endplantuml %}

Calls to `createShowtimes` and `createTickets` include the `transactionId`.

To track and cancel work using this ID, we need to add a `transactionId` property to both `Showtime` and `Ticket`.

{% plantuml %}
@startuml
class Showtime {
    ...
    transactionId: ObjectId
}

class Ticket {
    ...
    transactionId: ObjectId
}
Ticket "*" --> "1" Showtime
@enduml
{% endplantuml %}

I will cover the Saga pattern using `transactionId` in a later article.

## 8. Service Overview

{% plantuml %}
@startuml
package "Application Services" {
    class ShowtimeCreationService{
        searchMovies()
        searchTheaters()
        searchShowtimes(searchDto)
        requestShowtimeCreation(createDto)
    }
}

package "Core Services" {
    class MoviesService{
        searchMovies()
        moviesExist(movieId)
    }

    class TheatersService{
        searchTheaters()
        theatersExist(theaterIds)
    }

    class ShowtimesService{
        searchShowtimes()
        getShowtimes(theaterIds)
        createShowtimes(createDtos, transactionId)
    }

    class TicketsService{
        createTickets(createDtos,transactionId)
    }
}

ShowtimeCreationService --> MoviesService
ShowtimeCreationService --> TheatersService
ShowtimeCreationService --> ShowtimesService
ShowtimeCreationService --> TicketsService

@enduml
{% endplantuml %}

This diagram summarizes the services based on our design and shows the functionality each service needs to expose.

Programmers can now implement each service. For `MoviesService`, for example, they would create a few classes like these.

{% plantuml %}
@startuml
left to right direction

package movies {
    class MoviesController{
        searchMovies()
        moviesExist(movieId)
    }
    class MoviesService
    class MoviesRepository
}

MoviesController --> MoviesService
MoviesService --> MoviesRepository
@enduml
{% endplantuml %}

## 9. Conclusion

We designed and refactored `ShowtimeCreationService`, establishing several naming conventions along the way.

We also defined the entities. Since the `Theater` entity's `seatmap` property serves as a template for generating tickets, we defined it as a value object.

This kind of judgment is still difficult for AI. When I asked ChatGPT o3 and Gemini 2.5 Pro to design entities for MSA, both modeled `Seat` as an entity. But making `Seat` an entity could put a substantial load on the database, potentially revealing performance problems late in the project.

In the next article, we will discuss testing `ShowtimeCreationService`.

---

Previous: [Backend Service Analysis and Design (2)]({% post_url 2025-05-01-backend-design-2-en %})
