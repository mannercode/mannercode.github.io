---
layout: post
title: 백엔드 서비스 분석과 설계 (4)
---

## 0. 지금까지

우리는 지금까지 유스케이스 다이어그램과 시퀀스 다이어그램을 이용해서 요구사항을 분석하고 설계를 해왔습니다.

처음엔 간단한 다이어그램으로 시작했다.

{% plantuml %}
@startuml
left to right direction
actor customer

package "Movie Booking System" as mbs {
    usecase "영화 상세보기" as MovieDetails
    usecase "영화 검색하기" as SearchMovies
    usecase "티켓 구매하기" as PurchaseTickets
    usecase "티켓 환불하기" as RefundTickets
}

customer --> mbs
@enduml
{% endplantuml %}

요구사항을 구체화 하면서 유스케이스가 점점 세분화 됐습니다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
    package theaters {
        usecase "극장 추가하기" as AddTheaters
        usecase "극장 검색하기" as SearchTheaters
    }

    package movies {
        usecase "영화 추가하기" as AddMovies
        usecase "영화 상세보기" as MovieDetails
        usecase "영화 검색하기" as SearchMovies
    }

    package customers {
        usecase "고객 검색하기" as SearchCustomers
        usecase "고객 등록하기" as RegisterCustomer
        usecase "고객 로그인" as LoginCustomer

    }

    package showtimes {
        usecase "상영시간 생성하기" as CreateShowtimes
        usecase "상영시간 검색하기" as SearchShowtimes
    }

    package tickets {
        usecase "티켓 구매하기" as PurchaseTickets
        usecase "티켓 환불하기" as RefundTickets
        usecase "티켓 생성하기" as GenerateTickets
        usecase "티켓 검색하기" as SearchTickets
    }
}

administrator --> AddTheaters
administrator --> AddMovies
administrator --> SearchCustomers
administrator --> CreateShowtimes

customer --> RegisterCustomer
customer --> LoginCustomer

PurchaseTickets ..> PaymentGateway
RefundTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets

@enduml
{% endplantuml %}

이 유스케이스 중 비교적 복잡해 보이는 `상영시간 생성` 케이스를 시퀀스 다이어그램으로 정리했다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
    package tickets {
        usecase "티켓 구매하기" as PurchaseTickets
        usecase "티켓 생성하기" as GenerateTickets
    }

    package showtimes {
        usecase "상영시간 생성하기" as CreateShowtimes #yellow
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

시퀀스 다이어그램도 시작은 미미했다.

{% plantuml %}
@startuml
actor Admin
Admin -> Frontend: 상영시간 생성 페이지를 방문
    Frontend -> Backend: 영화 목록 요청\nGET /showtime-creation/movies
    Frontend <-- Backend: movies[]
Admin <-- Frontend: 영화 목록 제공

Admin -> Frontend: 영화 선택
    Frontend -> Backend: 극장 목록 요청\nGET /showtime-creation/theaters
    Frontend <-- Backend: theaters[]
Admin <-- Frontend: 극장 목록 제공

Admin -> Frontend: 극장 선택
    Frontend -> Backend: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
        note right
            SearchShowtimesDto {
                theaterIds,
            }
        end note

    Frontend <-- Backend: showtimes[]
Admin <-- Frontend: 상영시간 목록 제공

Admin -> Admin: 상영시간 선택

Admin -> Frontend: 상영시간 생성 요청
    Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
        note right
            CreateShowtimesDto {
                movieId,
                theaterIds,
                startTimes,
                durationInSeconds
            }
        end note
    Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 생성 성공 화면

@enduml
{% endplantuml %}

그러나 설계를 진행할수록 점점 복잡해졌다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

frontend -> gateway: 영화 목록 요청\nGET /showtime-creation/movies
    gateway -> creation: searchMovies()
        creation -> movies: searchMovies()
        creation <-- movies: movies[]
    gateway <-- creation: movies[]
frontend <-- gateway: movies[]

frontend -> gateway: 극장 목록 요청\nGET /showtime-creation/theaters
    gateway -> creation: searchTheaters()
        creation -> theaters: searchTheaters()
        creation <-- theaters: theaters[]
    gateway <-- creation: theaters[]
frontend <-- gateway: theaters[]

frontend -> gateway: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
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

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
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

결국 `상영시간 생성` 요구사항을 처리하는 ShowtimeCreationService가 지나치게 복잡해졌는데 ShowtimeCreationService에서 시작되는 메소드 호출이 얼마나 많은지 보면 복잡성을 가늠할 수 있다.

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
    creation -> creation: sagaId
    creation -> queue: enqueue { createDto, sagaId }
gateway <-- creation: sagaId
...
queue -> creation: dequeue { createDto, sagaId }
    creation -> creation: validateRequest
    activate creation
    creation -> movies: moviesExist(movieId)
    creation -> theaters: theatersExist(theaterIds)
    creation -> showtimes: getShowtimes(theaterIds)
    creation -> creation: findConflictingShowtimes()
    creation --> creation: conflictingShowtimes
    deactivate creation

    creation -> creation: bulkCreateShowtimes(createDto, sagaId)
    activate creation
        loop theaterId in createDto.theaterIds
            loop startTime in createDto.startTimes
                creation -> creation: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
            end
        end

        creation -> showtimes: createShowtimes\n(createShowtimeDtos, sagaId)
        creation <-- creation: showtimes
    deactivate creation

    creation -> creation: bulkCreateTickets(showtimes, sagaId)
    activate creation
        loop showtime in showtimes
            creation -> theaters: getTheater(showtime.theaterId)
            creation <-- theaters: theater
            loop seat in theater.seats
                creation -> creation: createTicketCreateDto(seat, showtime.id)
            end
            creation -> tickets: createTickets(ticketCreateDtos,sagaId)
            creation <-- tickets: tickets
        end
    deactivate creation

gateway <<- creation: ShowtimeCreationStatus(Succeeded)

@enduml
{% endplantuml %}

그래서 ShowtimeCreationService의 중요 기능을 Worker, Creator, Validator로 분산했다.

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
     create(createDto, sagaId)
}

ShowtimeCreationService --> ShowtimeCreationWorkerService : worker
ShowtimeCreationWorkerService --> ShowtimeBulkValidatorService : validator
ShowtimeCreationWorkerService --> ShowtimeBulkCreatorService : creator

@enduml
{% endplantuml %}

그랬더니 `ShowtimeCreationService`가 단순해졌다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "ShowtimeCreationWorker\nService" as worker

frontend -> gateway: 영화 목록 요청\nGET /showtime-creation/movies
    gateway -> creation: searchMovies()
        creation -> movies: searchMovies()

frontend -> gateway: 극장 목록 요청\nGET /showtime-creation/theaters
    gateway -> creation: searchTheaters()
        creation -> theaters: searchTheaters()

frontend -> gateway: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
    note right
        SearchShowtimesDto {
            theaterIds
        }
    end note
    gateway -> creation: searchShowtimes(searchDto.theaterIds)
        creation -> showtimes: searchShowtimes\n({ theaterIds, endTimeRange: { start: now }})

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
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
        creation <-- worker: sagaId
    gateway <-- creation: RequestShowtimeCreationResponse\n{ sagaId }
frontend <-- gateway: Accepted(202)

frontend ->> gateway: 상영시간 생성 모니터링\nSSE /showtime-creation/event-stream
gateway <<- worker: { status: ShowtimeCreationStatus.Succeeded, sagaId }
frontend <<- gateway: { Succeeded, sagaId }
@enduml
{% endplantuml %}

Worker는 큐를 사용해서 사용자의 요청을 순차적으로 처리하도록 job을 관리한다.

{% plantuml %}
@startuml
participant "ShowtimeCreation\nService" as creation
participant "ShowtimeCreationWorker\nService" as worker
Queue Queue as queue
participant "ShowtimeBulkValidator\nService" as validator
participant "ShowtimeBulkCreator\nService" as creator

creation -> worker: requestShowtimeCreation(createDto)
worker -> worker: createsagaId
worker -> queue: enqueueJob { createDto, sagaId }
[o<- worker  : ShowtimeCreationStatus.Waiting
creation <-- worker: sagaId
[o-> worker:processNextJob()
worker -> queue: dequeueJob { createDto, sagaId }
[o<- worker  : ShowtimeCreationStatus.Processing
worker -> validator: validate(createDto)
worker -> creator: create(createDto, sagaId)
[o<- worker  : ShowtimeCreationStatus.Succeeded

@enduml
{% endplantuml %}

Validator는 상영시간 생성 요청에 오류가 있는지 검사한다.

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
1. 생성하려는 상영시간을 10분 단위의 timeslots(Set)으로 등록한다.
2. 기존에 존재하는 showtimes의 `startTime`과 `endTime`이
   timeslots에 존재하는지 확인한다.
end note
worker <-- validator: conflictingShowtimes
@enduml
{% endplantuml %}

Creator는 상영시간과 티켓을 생성한다.

{% plantuml %}
@startuml
participant "ShowtimeCreationWorker\nService" as worker
participant "ShowtimeBulkCreator\nService" as creator
participant "Showtimes\nService" as showtimes
participant "Theaters\nService" as theaters
participant "Tickets\nService" as tickets

worker -> creator: create(createDto, sagaId)

activate creator
    creator -> creator: bulkCreateShowtimes(createDto, sagaId)

    loop theaterId in createDto.theaterIds
        loop startTime in createDto.startTimes
            creator -> creator: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
        end
    end

    creator -> showtimes: createShowtimes\n(createShowtimeDtos, sagaId)
    creator <-- creator: showtimes

    creator -> creator: bulkCreateTickets(showtimes, sagaId)

    loop showtime in showtimes
        creator -> theaters: getTheater(showtime.theaterId)
        creator <-- theaters: theater
        loop seat in theater.seats
            creator -> creator: buildCreateTicketDto(seat, showtime.id)
        end
        creator -> tickets: createTickets(createTicketDtos,sagaId)
        creator <-- tickets: tickets
    end
    worker <- creator: { createdShowtimeCount, createdTicketCount }
deactivate creator
@enduml
{% endplantuml %}

여기까지 1,2,3편에서 다뤘던 내용이다.

## 그런데 말입니다

여기서 ShowtimeCreator가 티켓까지 생성하는 것은 서비스 레벨의 단일 책임 원칙을 어기는 것이 아닌지 의아해 할지도 모르겠다.

상영시간 생성과 티켓 생성은 실제로 긴밀한 관계를 갖고 있다. 이것은 유스케이스를 보면 알 수 있다.

{% plantuml %}
@startuml
left to right direction
rectangle PaymentGateway
actor customer
actor administrator

package "Movie Booking System" as mbs {
    package tickets {
        usecase "티켓 생성하기" as GenerateTickets #yellow
        usecase "티켓 구매하기" as PurchaseTickets
    }

    package showtimes {
        usecase "상영시간 생성하기" as CreateShowtimes #yellow
    }

    package theaters {
    }

    package movies {
    }

    package customers {
    }
}

administrator --> CreateShowtimes
CreateShowtimes ..> GenerateTickets
customer --> PurchaseTickets
PurchaseTickets ..> PaymentGateway
@enduml
{% endplantuml %}

상영시간이 존재하면 티켓이 존재해야 하고 티켓이 존재한다는 것은 상영시간이 존재해야 한다.
이렇게 개념적으로 강하게 결합된 도메인을 설계와 구현에 그대로 반영하는 것이 최우선적으로 지켜야 할 원칙이다.(본질기반해석이란 얘기다)
OOP와 개발 방법론, 다양한 아키텍쳐의 원칙 같은 것은 그 다음 고려사항이다.

그럼에도 불구하고 개발자 본능을 거스를 수 없다면 리팩토링을 할 수 있다.

{% plantuml %}
@startuml
participant "ShowtimeCreationWorkerService" as worker
participant "ShowtimeBulkCreatorService" as SCreator
participant "ShowtimesService" as showtimes

worker -> SCreator: bulkCreateShowtimes(createDto, sagaId)

loop theaterId in createDto.theaterIds
    loop startTime in createDto.startTimes
        SCreator -> SCreator: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
    end
end

SCreator -> showtimes: createShowtimes\n(createShowtimeDtos, sagaId)
worker <-- SCreator: showtimes
@enduml
{% endplantuml %}

{% plantuml %}
@startuml
participant "ShowtimeCreationWorkerService" as worker
participant "TicketBulkCreatorService" as TCreator
participant "TheatersService" as theaters
participant "TicketsService" as tickets

worker -> TCreator: bulkCreateTickets(showtimes, sagaId)

loop showtime in showtimes
    TCreator -> theaters: getTheater(showtime.theaterId)
    TCreator <-- theaters: theater
    loop seat in theater.seats
        TCreator -> TCreator: buildCreateTicketDto(seat, showtime.id)
    end
    TCreator -> tickets: createTickets(createTicketDtos,sagaId)
    TCreator <-- tickets: tickets
end
worker <- TCreator: { createdShowtimeCount, createdTicketCount }
@enduml
{% endplantuml %}

고쳐놓고 보니 이게 더 적절해 보인다. 그러나 작업시간을 간과하면 안 된다. 작업시간은 한정되어 있는 귀중한 자원이다. 이 소중한 자원을 지금 당장 ShowtimeCreator의 리팩토링에 사용하는 것이 효율적일까? 아니면 다른 서비스를 구현하는 것이 효율적일까? 이것은 프로젝트 상황 마다 다르기 때문에 적절하게 판단해야 한다. 그러나 지금까지 경험으로는 대체로 시간은 항상 부족했다. 그래서 실제 프로젝트에서 이 정도 수준의 리팩토링은 쉽지 않을 수 있다는 것을 고려해야 한다.

그리고 시간이 허락해도 리팩토링은 여기까지만 해야 한다.

지금 설계에서 Worker–ShowtimeCreator–TicketCreator 는 동기식 통신을 하고 있어서 TheatersService가 응답을 못하는 장애가 발생하면 Worker–ShowtimeCreator–TicketCreator가 모두 영향을 받게 된다.

이렇게 서비스가 멈추는 상황은 일반적으로 피하고 싶을 것이다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle

title MSA에서 가장 간단한 비동기 서비스 호출

package "Service B" as SB {
  component "onCommandEvent()" as B_cons
}

package "Service A" as A {
  component "sendCommand()" as A_send
  component "onResponseEvent()" as A_resp
  database  "State DB" as A_db
}

A_send --> A_db : (1) PENDING
A_send --> B_cons : (2) Request
B_cons --> A_resp : (3) Response
A_resp --> A_db : (4) DONE/FAIL + result
@enduml
{% endplantuml %}

MSA에서는 이런 서비스 간 장애 전파를 줄이기 위해 메시지 브로커를 두고 이벤트 기반으로 통신(브로커 기반 비동기 메시징)하는 구조를 선택하기도 한다.
하지만 지금의 Worker–ShowtimeCreator–TicketCreator 사이에 이 방식을 그대로 끼워 넣는 것은 적절하지 않다.

{% plantuml %}
@startuml
left to right direction
rectangle PaymentGateway
actor customer
actor administrator

package "Movie Booking System" as mbs {
    package tickets {
        usecase "티켓 생성하기" as GenerateTickets #yellow
        usecase "티켓 구매하기" as PurchaseTickets
    }

    package showtimes {
        usecase "상영시간 생성하기" as CreateShowtimes #yellow
    }

    package theaters {
    }

    package movies {
    }

    package customers {
    }
}

administrator --> CreateShowtimes
CreateShowtimes ..> GenerateTickets
customer --> PurchaseTickets
PurchaseTickets ..> PaymentGateway
@enduml
{% endplantuml %}

앞서 도메인 전문가가 정의했듯 이 세 컴포넌트의 관계는 매우 긴밀하다. 상영시간 생성과 티켓 생성은 사실상 하나의 유스케이스로 묶여 있고, 한쪽이 실패하면 다른 쪽도 영향을 받는 것이 자연스럽다.

이런 강결합 유스케이스를 억지로 이벤트로 분리해 장애 전파를 “회피”하려 하면, 이득은 크지 않고 시스템 복잡도만 증가한다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle

title MSA에서 가장 간단한 동기식 서비스 호출

package "Service B" as SB {
  component "onCommandEvent()" as B_cons
}

package "Service A" as A {
  component "sendCommand()" as A_send
}

A_send --> B_cons : (1) Request
A_send <.. B_cons : (2) Response
@enduml
{% endplantuml %}

동기식은 이렇게 간단하게 호출할 수 있지만 장애 전파를 막겠다고 비동기식 호출을 도입한다면

{% plantuml %}
@startuml
skinparam componentStyle rectangle

title MSA에서 가장 간단한 비동기 서비스 호출

package "Service B" as SB {
  component "onCommandEvent()" as B_cons
}

package "Service A" as A {
  component "sendCommand()" as A_send
  component "onResponseEvent()" as A_resp
  database  "State DB" as A_db
}

A_send --> A_db : (1) PENDING
A_send --> B_cons : (2) Request
B_cons --> A_resp : (3) Response
A_resp --> A_db : (4) DONE/FAIL
@enduml
{% endplantuml %}

코드로 예를 들면 이렇다.

```ts
const {readFileSync, readFileAsync} = require("fs")

// readFileSync을 호출하면 syncText에 값이 할당된다.
const syncText = readFileSync("./example.txt")
// syncText를 가지고 편하게 다음 작업을 진행하면 된다.

let asyncText = ''

// readFileAsyncText()의 실행이 끝나도 asyncText에 값이 없다.
readFileAsyncText("./example.txt", (text) => {
    asyncText=text
})
// asyncText에 값이 없는데 다음 작업을 어쩌지??
// ...
```

가장 간단한 호출임에도 이렇게 복잡해진다. TheatersService같은 코어 서비스가 멈추는 상황이면 다른 서비스도 크게 영향 받는 게 자연스럽다. 이 상황에서 할 수 있는 최선은 친절한 말투로 사용자에게 장애가 발생했다고 알리는 것 뿐이다.

지금까지 진행한 설계는 1인 개발을 가정한 프로젝트 치고는 구체적인 편이다.
설계를 얼마나 자세하게 해야 하는지는 프로젝트 상황에 따라 다르다.
설계자와 구현자가 같거나 긴밀한 커뮤니케이션이 가능하다면 덜 구체적이어도 된다.
또 구현자의 실력과 경험이 높으면 알아서 잘 할테니까 간단히 설계해도 충분하다.
그 외에도 많은 요소를 고려해서 가장 효율적인 타협점을 찾으면 된다.

그러면 이제, 지금까지의 설계를 어떻게 구현할지 알아보자.

## 1. 무엇부터 구현해야 할까?

지금까지 작성한 시퀀스 다이어그램은 서비스의 호출 흐름을 파악하기에는 좋지만 서비스 간의 관계를 파악하기에는 부족함이 있다.

컴포넌트 다이어그램으로 의존관계와 호출 흐름을 표현해 보자.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "사용자(웹브라우저)" as User

package "gateway" {
component "ShowtimeCreationController" as GController
}

package "applications" {
component "ShowtimeCreationService" as AService
component "ShowtimeCreationWorkerService" as AWorker
component "ValidatorService" as AValidator
component "CreatorService" as ACreator

AService --> AWorker : <b><color:red> 3. enqueueShowtimeCreationJob</color></b>
AWorker --> AValidator : <b><color:red> 4. validate</color></b>
AWorker --> ACreator : <b><color:red> 7. create</color></b>
}

package "cores" {
component "ShowtimesService" as CShowtimes
component "TicketsService" as CTickets
}

database "ShowtimesDB" as SDB
database "TicketsDB" as TDB

note left of SDB
  movieId
  theaterId
  startTime
end note

note right of TDB
  showtimeId
  seatNumber
  status
end note

User --> GController : <b><color:red> 1. POST /showtime-creation/showtimes</color></b>
GController --> AService : <b><color:red> 2. requestShowtimeCreation</color></b>
AValidator --> CShowtimes : <b><color:red> 5. findConflicts</color></b>
ACreator --> CShowtimes : <b><color:red> 8. createShowtimes</color></b>
ACreator --> CTickets : <b><color:red> 10. createTickets</color></b>
CShowtimes --> SDB : <b><color:red> 6. find</color></b>
CShowtimes --> SDB : <b><color:red> 9. save</color></b>
CTickets --> TDB : <b><color:red> 11. save</color></b>
@enduml
{% endplantuml %}

크게 11개의 호출이 있다. 이 중에서 제일 먼저 구현해야 하는 것은 무엇일까?

많은 개발자들이 처음 구현을 시작할 때 DB 테이블부터 생성하는 `bottom-up` 방식을 선호한다. `중고 자동차 거래 서비스`를 개발한다면 car 테이블에 몇 개의 필드를 정의하고 여기에 계속 살을 붙여가는 것이다. 개발자들이 이 방식을 선택한 여러 이유가 있겠지만 가장 큰 이유는 설계의 부재일 것이다.

![car-trade](/assets/images/car-trade.png)

설계의 어려움은 여러가지 있겠지만 기술적인 측면에서 가장 큰 어려움은 도메인 전문가의 머리속에 있을(도메인 전문가도 막연한 생각 뿐, 구체적인 생각은 없을 수도 있다.) 추상적인 생각을 구체화 하는 것이 어렵기 때문이다.
그러니 가장 구체적인 혹은 형태가 명확한 테이블 생성을 기반으로 기능을 확장해 나가는 것이다.

![car-bike](/assets/images/car-bike.png)

이런 `bottom-up` 방식은 요구사항을 구현하는 것이 아니라, 구현에 요구사항을 맞추게 만든다. 무슨 말이냐 하면 도메인 전문가가 기능 요청을 해도 구현을 바꾸기 어렵다는 말로 요구사항을 변경하게 만들기 때문이다.

`bottom-up` 방식은 실행과 검증도 어렵다. 테이블을 생성했다면 여기에 어떻게 데이터를 삽입하고 읽을 수 있을까? 코드를 구현하면 되는데 그러면 그 코드는 또 어떻게 실행할 수 있을까?
이 문제를 해결하기 위해서 개발하는 동안 많은 임시적인 실행 코드를 만들고 삭제한다. 또 검증하기 위해서 정말 많은 실행을 하게 된다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "???" as Runner

note right of Runner
  // 상위 객체를 구현하면 삭제하게 되는 임시 실행 코드
  main()
  {
    const db = new MySQL("127.0.0.1:3389")
    db.connect()
    const service = new TicketsService(db)
    const result = service.createTickets(dtos)

    console.log(result)
  }
end note

package "cores" {
component "ShowtimesService" as CShowtimes
component "TicketsService" as CTickets
}

database "ShowtimesDB" as SDB
database "TicketsDB" as TDB

Runner --> CShowtimes :  createShowtimes
Runner --> CTickets :  createTickets
CShowtimes --> SDB :  find/save
CTickets --> TDB :  save
@enduml
{% endplantuml %}

이런 단점들 때문에 `bottom-up` 방식을 추천하지 않는데, 다행히 우리는 지금까지 'top-down' 방식으로 요구사항을 분석하고 설계했다.

{% plantuml %}
@startuml
left to right direction
actor administrator
actor customer

rectangle "Use Cases" {
    usecase "상영시간 생성하기" as UC1
    usecase "티켓 예매하기" as UC2
    usecase "티켓 구매하기" as UC3
}

rectangle "REST API" {
    component "/showtime-creation/*" as API1
    component "/booking/*" as API2
    component "/purchases/*" as API3
}

rectangle "Application Services" {
    component "ShowtimeCreationService" as SVC1
    component "BookingService" as SVC2
    component "PurchaseService" as SVC3
}

administrator --> UC1
customer --> UC2
customer --> UC3

UC1 ..> API1
UC2 ..> API2
UC3 ..> API3

API1 ..> SVC1
API2 ..> SVC2
API3 ..> SVC3
@enduml
{% endplantuml %}

{% plantuml %}
@startuml
    Frontend -> Backend: 영화 목록 요청\nGET /showtime-creation/movies
    Frontend <-- Backend: movies[]

    Frontend -> Backend: 극장 목록 요청\nGET /showtime-creation/theaters
    Frontend <-- Backend: theaters[]

    Frontend -> Backend: 기존 상영 시간 조회\nPOST /showtime-creation/showtimes/search
    Frontend <-- Backend: showtimes[]

    Frontend -> Backend: 상영 시간 생성 요청\nPOST /showtime-creation/showtimes
    Frontend <-- Backend: { sagaId }
@enduml
{% endplantuml %}

도메인 전문가의 `상영시간 생성하기` 요구사항을 유스케이스 다이어그램으로 시작해서 유스케이스 명세서와 시퀀스 다이어그램으로 구체화 할 수 있었다. 결과물로 구체적인 REST API를 정의할 수 있었기 때문에 이제는 이것을 구현하기만 하면 된다. 구현 후 실행은 curl 같은 많은 방법들이 있으니 문제가 없다.

무엇보다 좋은 것은 아래쪽 서비스로 구현이 진행돼도 실행 방법을 변경할 필요가 없다는 것이다. 인터페이스가 바뀌는 건 아니니까 말이다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "curl" as User

package "gateway" {
component "ShowtimeCreationController" as GController
}

package "applications" {
component "ShowtimeCreationService" as AService
component "ShowtimeCreationWorkerService" as AWorker
component "ValidatorService" as AValidator
component "CreatorService" as ACreator

AService --> AWorker
AWorker --> AValidator
AWorker --> ACreator
}

User --> GController : <b><color:red> POST /showtime-creation/showtimes</color></b>
GController --> AService
@enduml
{% endplantuml %}

물론 이 `top-down`도 단점은 있다. 실행을 하려면 의존하는 다른 객체가 있어야 한다.

그러니까 실제 구현을 한다면 코드는 대략 이런 형태가 된다. ShowtimeCreationController의 createShowtimes는 ShowtimeCreationService 클래스를 참조하는데 이제 막 구현을 시작했기 때문에 ShowtimeCreationService가 있을리 없다.

```ts
@Route('showtime-creation')
class ShowtimeCreationController{
    private service:ShowtimeCreationService

    @Post('showtimes')
    func createShowtimes(request:Request){
        return this.service.requestShowtimeCreation(request.body)
    }
}
```

다행히도 이런 문제는 쉽게 풀 수 있는데 ShowtimeCreationService를 빼고 그럴듯한 값을 반환하게 하면 된다. 올바른 동작은 아니더라도 실행은 가능하기 때문에 의존 서비스를 모두 구현해야 하는 문제를 해결할 수 있다. 일단 이렇게 실행이 되면 차분하게 ShowtimeCreationService를 구현하면 되는 것이다.

```ts
@Route('showtime-creation')
class ShowtimeCreationController{
    @Post('showtimes')
    func createShowtimes(){
        return { sagaId: 123 }
    }
}
```

ShowtimeCreationService를 구현할 때도 마찬가지다. 일단 간단한 값을 반환해서 실행은 되게 하고 요구사항에 맞춰서 하나씩 구현해 가면 된다.

눈치챘을지 모르겠지만 지금까지 설명한 것이 TDD의 기본이다.

---

설계 단계에서는 `top-down` 접근이 효과적이었다. 그럼 구현도 같은 방식이 좋을까?

예를 들어 `gateway`의 `ShowtimeCreationController`부터 만들고, 호출 순서대로 `ShowtimeCreationService`를 구현한다고 가정해 보자. 문제는 초반에 코드가 실행되지 않는다는 점이다. 상위 서비스가 의존하는 하위 서비스가 아직 없기 때문이다.

이때 임시로 mock을 둘 수는 있다. 하지만 지금처럼 한 사람이 전체 서비스를 구현하는 상황에서는 mock이 빠르게 부채가 된다. 만들고, 맞추고, 다시 지우는 비용이 반복되기 때문이다. 나는 이 경우 mock 사용을 최소화하는 편이 낫다고 본다.

그래서 구현 시작점은 `bottom-up`이 더 실용적이다. 즉, 가장 하위에 있는 `ShowtimesService`와 `TicketsService` 같은 코어 서비스부터 완성한다.

다만 여기서 오해하면 안 된다. `bottom-up`으로 시작한다고 해서 구현 전체가 비체계적이어야 하는 것은 아니다. 서비스 단위로 내려오면, 그 안에서는 다시 `top-down`으로 구현하면 된다. 예를 들어 인터페이스(컨트롤러/핸들러)부터 진입 경로를 만들고, 그 아래 로직과 저장소를 채워 나가는 방식이다.

정리하면 다음과 같다.

1. 요구사항 분석/설계: `top-down`
2. 서비스 구현 순서: `bottom-up`
3. 개별 서비스 내부 구현: 다시 `top-down`

이 기준을 적용하면 설계의 일관성과 구현의 실행 가능성을 동시에 확보할 수 있다.

## 검증은 어떻게 해야 할까?

TicketsService를 아래처럼 구현했다.

```ts
// 간단한 소스코드
```

그런데 이 소스코드를 어떻게 검증할 수 있을까? 이것은 백엔드 서비스이기 때문에 TicketsService를 실행하려면  rest api나 그에 준하는 인터페이스가 필요하다.
그러나 bottom-up 방식으로 개발하다보니 최상위 레이어에 존재하는 rest api가 구현되기를 기다리는 것은 너무 먼 이야기다.
타협점으로 TicketsService를 호출하는 상위 레벨의 서비스를 개발할 수 있는데 이 경우 creatorservice와 showtimecreationworkerservice, showtimecreaionservice 마지막으로 showtimecreationcontroller에서 필요한 메서드를 차례대로 구현해야 한다.

이렇게 구현했다 하더라도 curl을 호출해 가면서 구현이 제대로 됐는지 확인해야 한다. 그러다 기대와 다른 동작을 하면 로그를 추가하고 빌드하고 다시 curl을 호출하기를 반복한다.

## 검증 비용을 줄이려면 어떻게 해야 할까

이렇게 검증에 드는 큰 비용을 줄이면 개발은 더 효율적일 것이다. 어떻게 하면 좋을까?
검증 즉, 테스트를 자동화 해야 하는 필요성이 여기서 나온다. 테스트 자동화라고 해서 jest, mock 이런 거창한 도구나 개념을 떠올릴 필요는 없다. 지금의 불편함을 해소하려는 목적만 달성하면 된다.

```sh
# run.sh
curl localhost:3000/tickets
```

이제 run.sh만 실행하면 언제든지 검증할 수 있다. 그런데 이 코드는 실행을 편하게 도와주지만 검증은 눈으로 보고 직접 해야한다. 테스트가 한 개라면 문제없지만 호출하는 curl이 10개 100개라면 불편할 것이다. 그러면 검증도 자동으로 되면 더 좋지 않을까?

```sh
# run.sh
curl -w status localhost:3000/tickets
```

이제 status가 200이 아니면 에러를 출력하기 때문에 한결 편해졌다.

그런데 api라는 것이 시작은 미미해도 중간부터 창대하기 마련이라서 curl을 이용한 실행과 검증에 불편함이 따르기 시작한다.
그래서 jest 같은 테스트에 전문화된 프레임워크를 사용하게 된다.

```ts
```

이런 테스트 프레임워크는 개발툴(ide)와 잘 통합되어 있어서 실행도 간편하고 테스트 케이스도 보다 효율적으로 관리할 수 있게 한다.

## 엑스칼리버를 얻었다면

jest라는 강력한 테스트 도구는 성검이 아니라 마검이다. 잘 쓰면 약이지만 못 쓰면 독이 되는데 대체로 독이 된다.
마검인 이유는 jest가 제공하는 다양한 기능을 모두 사용하려는 경향이 있기 때문이다.

또 테스트 자동화를 다룬 기술 서적이나 글에서 온갖 상황에 맞는 이야기를 하기 때문에 이걸 그대로 받아들여 적용하는 과정에서 오버엔지니어링이 되는 경향이 있다.

그래서 정확히는 성검으로 태어났으나 우리가 마검으로 바꾼다고 할 수 있다.

## 테스트 자동화에 대한 오해

테스트를 유닛테스트/통합테스트/e2e테스트 이렇게 구분하려는 시도가 프로젝트를 망치게 하는 주범인 것 같다. 함수를 작성하면 유닛 테스트를 작성해야 하고 여러 클래스와 모듈을 작성하면 통합테스트를 추가해야 한다고 생각한다.

그런데 이럴 시간이 있나? 시간이 있다고 해도 이게 의미가 있는가? 중복 테스트가 많고 이런 경우 테스트 코드의 종속성이 커져서 본문 코드를 조금만 바꿔도 다수의 테스트 코드를 변경해야 하는 경우가 생긴다. 몇 번 이 과정을 거치면 테스트를 버리게 된다. 아마 tdd를 시도했던 많은 개발자가 이 단계에서 좌절했으리라.

그러나 테스트는 유닛테스트/통합테스트/e2e테스트를 명확하게 나눌 수 없다. 애자일과 폭포수 방법론이 그러하듯이 얼마나 유닛테스트에 가까운가. 또 얼마나 통합테스트에 가까운가로 표현하는 것이 옳을 것이다.

알고리즘이 복잡한 함수라면 유닛 테스트가 유리하다. 코드가 간단하고 여러 모듈에 걸쳐서 동작하는 기능이라면 통합테스트가 유리하다.

```ts
// 유닛 테스트가 유리한 함수의 예
```

특히 우리가 선택한 레이어 아키텍처는 기능과 책임을 레이어 별로 분리하는 만큼 각 각 객체의 역할은 작고 분명하다. 이런 메소드까지 모두 유닛 테스트를 작성하는 것은 극히 비효율적이라는 얘기다.

## 구현을 시작한다

테스트 자동화에 대한 기본 방향을 잡았으니까 이를 바탕으로 구현을 해보자. 먼저 TicketsService를 구현하자. 그 전에 알아둘 것은 지금은 아무 것도 구현하지 않은 상태라는 것이다.
구현한 것이 아무것도 없다고 했지 프로젝트 진행인 안 됐다고는 하지 않았다. 구현을 하려면 시작점이 필요한데 그게 설계문서다. 설계 문서를 보면서 단계별로 하나씩 구현해 나가는 것이다.
그렇다면 설계 문서의 시작은 어떻게 되어있을까? 다이어그램을 보면 가장 높은 곳에 `POST /showtime-creation/showtimes`이 있다.

```ts
@Route('showtime-creation')
class ShowtimeCreationController{
    @Post('showtimes')
    func createShowtimes(){
        return { status:200 }
    }
}
```

이러면 일단 실행은 된다. 그러면 이제 실제로 실행하고 검증을 하자. 하지만 어떻게?

```sh
npm run dev
curl -X POST localhost:3000
```

우리는 결과를 눈으로 확인하고 안심하게 된다.
이제 구현을 조금 더 진행을 해보자.

```ts
@Route('showtime-creation')
class ShowtimeCreationController{
    @Post('showtimes')
    func createShowtimes(request:Request){
        this.service.createShowtimes(request.body)
    }
}
```

여기서 request를 그대로 전달하지 않고 request.body를 전달한다. 옳은 선택일까? request를 그대로 전달하는게 좋은 것 아닐까? 혹시 실제 this.service에서 추가로 필요로 하는 정보가 request에 있으면 어쩌지?
예를 들면 request.headers 같은게 필요하다면 말이다. 그런 의미에서 request를 전달하는게 좋지 않을까?

우리는 기능을 레이어 별로 나눴음을 주의해야 한다. Request나 body 같은 것은 http와 rest api를 위한 형식이다. 이것은 controller에서 다뤄야 하는 것이고 service는 http와 무관하게 동작해야 한다. 그래야 rest api가 grpc 같은 다른 인터페이스로 변경되더라도 service는 영향을 받지 않을 수 있는 것이다. 이게 레이어로 나누는 의미다.
