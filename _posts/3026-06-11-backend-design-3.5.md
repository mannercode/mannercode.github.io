---
layout: post
title: 백엔드 서비스 분석과 설계 (3.5)
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
