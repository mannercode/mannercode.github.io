---
layout: post
title: 백엔드 서비스 분석과 설계 (3)
---

지난 시간에 REST API의 namespace와 SoLA 구조를 적용해서 `상영시간 생성하기` 시퀀스 다이어그램을 그렸다.

이번 시간에는 부족했던 설계를 보완하고 테스트를 작성해 보자.

## 1. `상영시간 생성 요청` 설계의 문제점

지난 시간에 `상영시간 생성하기`에서 `상영시간 생성 요청`을 아래처럼 설계했다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
    gateway -> creation: createShowtimes(createDto)
        creation -> movies: moviesExist(movieId)
        creation -> theaters: theatersExist(theaterIds)
        creation -> showtimes: createShowtimes(createDto)
    gateway <-- creation: showtimes[]
frontend <-- gateway: Created(201)
@enduml
{% endplantuml %}

이 설계에서 가장 우려되는 점은 생성 요청이 동기식이라는 것이다.

하나의 영화에 대해서 4,000개의 극장에 상영 시간을 등록한다고 가정하자. 그러면 생성해야 하는 데이터는 다음과 같다.

```txt
showtimes = 4,000 * 60(상영일) * 8(일일 상영 횟수) = 1,920,000 개
tickets = showtimes 수 * 500(좌석 수) = 960,000,000 개
```

즉, 한 번 영화를 등록할 때 마다 960,000,000 개의 티켓을 생성해야 한다. 이것은 시간이 오래 걸리는 작업이기 때문에 즉각 응답할 수 없다.

작업 시간이 오래 걸리기 때문에 동시성 문제도 커진다. 만약 관리자 두 명이 동시에 `상영시간 생성하기`를 하면 어떻게 될까? 충돌하는 상영시간이 생기고 결국 좌석이 중복 예약되는 최악의 상황이 될 것이다. `좌석 중복 예약` 문제는 최우선 요구사항으로 정의할 만큼 중요한 문제다.

그 외에도, 등록하려는 상영시간이 기존 상영시간과 충돌하는지 검사하는 부분과 티켓을 생성하는 부분도 빠져있다.

여러모로 부족한 설계인 만큼 `상영시간 생성 요청` 부분을 처음부터 다시 설계해 보자.

## 2. 큐 기반 비동기 처리 설계

작업이 오래 걸리는 문제와 동시성 문제는 큐를 도입해서 해결할 수 있다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant Queue as queue

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
    gateway -> creation: requestShowtimeCreation(createDto)
        note right
        CreateShowtimeBatchDto {
            "movieId": "movie#1",
            "theaterIds": ["theater#1","theater#2"],
            "durationMinutes": 90,
            "startTimes": [202012120900, 202012121100]
        }
        end note

        creation -> creation: transactionId
        creation -> queue: enqueue { createDto, transactionId }
    gateway <-- creation: transactionId
frontend <-- gateway: Accepted(202)
...
queue -> creation: dequeue { createDto, transactionId }
    creation -> creation: <b>validateRequest(createDto)</b>
    creation -> creation: <b>createShowtimeBatch(createDto, transactionId)</b>
    creation -> creation: <b>createTicketBatch(showtimes, transactionId)</b>
gateway <<- creation: ShowtimeCreationStatus(Succeeded)
frontend <<- gateway: SSE(Succeeded)
@enduml
{% endplantuml %}

관리자가 작업을 요청하면 시스템은 작업을 `Queue`에 넣고 `transactionId`를 돌려준다. `transactionId`는 이후 작업을 추적하는데 사용된다.

`Queue`는 입력된 작업을 `transactionId`와 함께 순차적으로 내보내기 때문에 동시성 문제도 해결할 수 있다.

`ShowtimeCreationService`가 `dequeue`로 작업을 받으면 아래 함수를 차례로 실행하는데 하나씩 살펴보자.

1. validateRequest
1. createShowtimeBatch
1. createTicketBatch

## 3. validateRequest 함수 설계

### 3.1. 충돌 검사 알고리즘

상영시간을 생성하기 전에 기존 상영시간과 충돌하는지 검사해야 하는데 간단하게 Set을 이용하기로 한다.

1. 생성하려는 상영시간을 10분 단위의 timeslots(Set)으로 등록한다.
2. 기존에 생성된 showtimes의 startTime과 endTime이 timeslots에 존재하는지 확인한다.

예를 들면,

아래와 같이 요청이 오면

```ts
CreateShowtimeBatchDto {
    "movieId": "movie#1",
    "theaterIds": ["theater#1","theater#2"],
    "durationMinutes": 30,
    "startTimes": [0930, 1200]
}
```

`startTimes`와 `durationMinutes`으로 timeslots을 생성하면 아래와 같다.

```ts
Set<number> timeslots = [0930, 0940,0950,1200,1210,1220]
```

그 후, 기존에 등록된 상영시간을 10단 단위로 쪼개서 timeslots에 등록된 값인지 비교하면 된다.

### 3.2. 충돌 검사 수도코드

지금까지 설명한 알고리즘의 수도코드다.

```ts
// 타임슬롯 등록
const timeslots = new Set<number>()

for startTime of startTimes {
    const endTime = startTime + durationMinutes

    for(timeslot = startTime; timeslot <= endTime; timeslot+=10) {
        timeslots.set(timeslot)
    }
}

// 기존 상영시간 가져오기
const showtimes = getShowtimes(theaterId)

// 기존 상영시간이 타임슬롯과 충돌하는지 체크
for (showtime in showtimes) {
    const {startTime, endTime} = showtime

    for (timeslot = startTime; timeslot < endTime; timeslot+=10) {
        if (timeslots.exists(timeslot)) {
            // conflict
        }
    }
}
```

이 알고리즘은 얼핏 중첩 루프로 보이기 때문에 시간 복잡도가 O(M * N)처럼 보인다.

그러나 중첩된 루프는 입력에 비례하는 것이 아니라 duration 만큼 반복되는 거의 고정된 값이다. 따라서 시간 복잡도는 O(M + N)이 된다.

```txt
새로 추가할 상영 시간 수 = M
기존 상영 시간 수 = N
시간 복잡도 = O(M + N)
```

### 3.3. 충돌 검사 다이어그램

위의 수도코드를 UML로 그려보면 어떨까?

{% plantuml %}
@startuml
' 액티비티 다이어그램
start
:timeslots = new Set;

' 1차 루프 – 시작 시간별로 timeslot 채우기
while (startTime in startTimes?) is (있음)
  :endTime = startTime + durationMinutes;
  :timeslot = startTime;
  while (timeslot <= endTime?) is (예)
    :timeslots.add(timeslot);
    :timeslot += 10;
  endwhile (아님)
endwhile (없음)

' 상영 시간 조회
:getShowtimes(theaterId);

' 2차 루프 – 기존 상영 시간과 충돌 여부 검사
while (showtime in showtimes?) is (있음)
  :timeslot = showtime.startTime;
  while (timeslot < showtime.endTime?) is (예)
    if (timeslots.contains(timeslot)?) then (충돌)
      :// conflict 처리;
    endif
    :timeslot += 10;
  endwhile (아님)
endwhile (없음)

stop
@enduml
{% endplantuml %}

알고리즘은 복잡하기 때문에 이해하기 쉽게 그림으로 그리는 게 좋다고 생각할지 모르겠다. 그러나 코드에 익숙한 개발자는 역시 코드가 이해하기 쉬운 것 같다.

UML을 처음 접하면 모든 것을 다이어그램으로 표현하고 싶은 유혹에 빠지기 쉽다. 그러나 UML이 만능 표현법이 아님을 주의해야 한다.

### 3.4.시퀀스 다이어그램으로 정리하기

지금까지 알고리즘이 간단함에도 불구하고 설명을 위해서 수도코드와 다이어그램으로 알고리즘을 표현해 봤다. 그러나 실제 프로젝트라면 보통은 아래 시퀀스 다이어그램 정도로 설계를 마무리할 것이다.

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

findConflictingShowtimes() 함수에는 지금까지 설명한 충돌 검사 알고리즘을 구현하면 된다.

### 3.5. 기타 충돌 검사 알고리즘들

혹시 아래처럼 시작과 끝을 비교해서 검사하는 게 더 빠르지 않냐고 생각할지도 모르겠다. 그러나 아래 코드는 시간 복잡도가 O(M * N)이 된다. 반면에 위의 timeslots 알고리즘은 M 부분을 Set으로 만들었기 때문에 시간 복잡도가 O(M + N)이 된다.

```ts
const showtimes = getShowtimes(theaterId)

for (showtime of showtimes) {
    for (startTime of startTimes) {
        const endTime = startTime + durationMinutes

        if (
            (showtime.startTime <= startTime && startTime <= showtime.endTime) ||
            (showtime.startTime <= endTime && endTime <= showtime.endTime)
        ) {
            // conflict
        }
    }
}
```

그 외에, 이진 탐색 알고리즘을 응용하여 구현하는 방법도 있다. 이것은 timeslots 방식 보다 시간을 좀 더 단축시킬 수 있으나 차이가 크지 않고 구현 난이도가 증가하는 단점이 있어서 채택하지 않았다.

## 4. createShowtimeBatch와 createTicketBatch 함수 설계

createShowtimeBatch와 createTicketBatch 함수는 아래처럼 설계했다.

{% plantuml %}
@startuml
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "Tickets\nService" as tickets

creation -> creation: createShowtimeBatch(createDto, transactionId)
activate creation
    loop theater in createDto.theaters
        loop startTime in createDto.startTimes
            creation -> creation: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
        end
    end

    creation -> showtimes: createShowtimes\n(createShowtimeDtos, transactionId)
    creation <-- creation: showtimes
deactivate creation

creation -> creation: createTicketBatch(showtimes, transactionId)
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

사용자가 입력한 값을 바탕으로 showtimes를 생성하고, 생성된 showtimes로 tickets를 생성한다.

이 설계에서 마음에 걸리는 것은 showtime이나 ticket 생성이 중간에 실패하는 경우 어떻게 하면 되는지 언급이 없다는 것이다.

이것은 Saga 패턴으로 해결할 수 있는데 추후 다른 글에서 다시 다루도록 하겠다.

## 5. 전체 시퀀스 다이어그램

지금까지 설계를 하나로 합쳐보자. 미리 얘기하자면 다이어그램이 복잡하다.

{% plantuml %}
@startuml
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant Queue as queue
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

    creation -> creation: createShowtimeBatch(createDto, transactionId)
    activate creation
        loop theater in createDto.theaters
            loop startTime in createDto.startTimes
                creation -> creation: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
            end
        end

        creation -> showtimes: createShowtimes\n(createShowtimeDtos, transactionId)
        creation <-- creation: showtimes
    deactivate creation

    creation -> creation: createTicketBatch(showtimes, transactionId)
    activate creation
        loop showtime in showtimes
            creation -> theaters: getTheater(showtime.theaterId)
            creation <-- theaters: theater
            loop seat in theater.seats
                creation -> creation: createTicketCreateDto(seat, showtime.id)
            end
            creation -> tickets: createTickets(ticketCreateDtos,transactionId)
            creation <-- tickets: tickets
        end
    deactivate creation

gateway <<- creation: ShowtimeCreationStatus(Succeeded)

@enduml
{% endplantuml %}

언뜻 봐도 다이어그램이 복잡한데, 특히 `ShowtimeCreationService`에 많은 기능이 몰려있다.

1. queue 관리
1. 상영시간 생성 요청 검사
1. 상영시간 생성
1. 티켓 생성

그리고 이 다이어그램에 드러나지 않았지만 `searchMovies`, `searchTheaters`, `searchShowtimes` 함수도 `ShowtimeCreationService`에서 구현해야 한다.

## 6. `ShowtimeCreationService` 리팩토링

`ShowtimeCreationService`가 하는 일이 많고 복잡해서 리팩토링이 필요해 보인다.

여기서는 `ShowtimeCreationService`의 기능을 3개의 클래스로 분산시킬 것이다.

1. 상영시간 생성 작업을 관리하는 `ShowtimeCreationWorkerService`
1. 상영시간 생성 요청을 검사하는 `ShowtimeBatchValidatorService`
1. 상영시간과 티켓을 생성하는 `ShowtimeBatchCreatorService`

{% plantuml %}
@startuml
class ShowtimeCreationService {
    requestShowtimeCreation(createDto)
}

class ShowtimeCreationWorkerService {
     requestShowtimeCreation(createDto)
     processNextJob()
}

class ShowtimeBatchValidatorService {
     validate(createDto)
}

class ShowtimeBatchCreatorService {
     create(createDto, transactionId)
}

ShowtimeCreationService --> ShowtimeCreationWorkerService : worker
ShowtimeCreationWorkerService --> ShowtimeBatchValidatorService : validator
ShowtimeCreationWorkerService --> ShowtimeBatchCreatorService : creator

@enduml
{% endplantuml %}

이렇게 분산한 시퀀스 다이어그램은 아래와 같다.

### 6.1. `ShowtimeCreationService`

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
    gateway <-- creation: movies[]
frontend <-- gateway: movies[]

frontend -> gateway: 극장 목록 요청\nGET /showtime-creation/theaters
    gateway -> creation: searchTheaters()
        creation -> theaters: searchTheaters()
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
    gateway <-- creation: showtimes[]
frontend <-- gateway: showtimes[]

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
    note right
        CreateShowtimeBatchDto {
            "movieId": "movie#1",
            "theaterIds": ["theater#1","theater#2"],
            "durationMinutes": 90,
            "startTimes": [202012120900, 202012121100]
        }
    end note
    gateway -> creation: requestShowtimeCreation(createDto)
        creation -> worker: requestShowtimeCreation(createDto)
        creation <-- worker: transactionId
    gateway <-- creation: transactionId
frontend <-- gateway: Accepted(202)
@enduml
{% endplantuml %}

### 6.2. `ShowtimeCreationWorkerService`

{% plantuml %}
@startuml
participant "ShowtimeCreation\nService" as creation
participant "ShowtimeCreationWorker\nService" as worker
participant Queue as queue
participant "ShowtimeBatchValidator\nService" as validator
participant "ShowtimeBatchCreator\nService" as creator

creation -> worker: requestShowtimeCreation(createDto)
worker -> worker: createTransactionId
worker -> queue: enqueueJob { createDto, transactionId }
creation <-- worker: transactionId
[-> worker:processNextJob()
worker -> queue: dequeueJob { createDto, transactionId }
worker -> validator: validate(createDto)
worker -> creator: create(createDto, transactionId)
[<<- worker  : ShowtimeBatchCreateStatus(succeeded)

@enduml
{% endplantuml %}

### 6.3. `ShowtimeBatchValidatorService`

{% plantuml %}
@startuml
participant "ShowtimeCreationWorker\nService" as worker
participant "ShowtimeBatchValidator\nService" as validator
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

worker -> validator: validate
validator -> movies: moviesExist(movieId)
validator -> theaters: theatersExist(theaterIds)
validator -> showtimes: getShowtimes(theaterIds)
validator -> validator: findConflictingShowtimes()
worker <-- validator: conflictingShowtimes
@enduml
{% endplantuml %}

### 6.4. `ShowtimeBatchCreatorService`

{% plantuml %}
@startuml
participant "ShowtimeCreationWorker\nService" as worker
participant "ShowtimeBatchCreator\nService" as creator
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes
participant "Tickets\nService" as tickets

worker -> creator: create(createDto, transactionId)
creator -> creator: createShowtimeBatch(createDto, transactionId)
activate creator
    loop theater in createDto.theaters
        loop startTime in createDto.startTimes
            creator -> creator: buildCreateShowtimeDto\n({theaterId, movieId, startTime, duration})
        end
    end

    creator -> showtimes: createShowtimes\n(createShowtimeDtos, transactionId)
    creator <-- creator: showtimes
deactivate creator

creator -> creator: createTicketBatch(showtimes, transactionId)
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

## 7. 클래스 다이어그램

moviesservice 등 전체 클래스 메소드 정리

## 8. Entities

내가 처음 이 프로젝트를 진행했을 때 아직 엔티티의 속성이나 관계를 정의하기 전이었다.
지금까지 설명했던 것처럼 티켓을 생성하는 프로세스에만 집중했을 뿐이다.

누군가는 엔티티를 더 일찍 파악했어야 하는 게 아니냐고 생각할 수 있다. 1인 프로젝트라는 전제 하에 엔티티 정의는 뒤로 미뤄도 괜찮은 것 같다. 지금처럼 유스케이스를 파악하고 시퀀스 다이어그램을 그리면 엔티티 사이의 관계가 구체적으로 드러난다. 그 후에 정리해도 충분하다.

여기서는 티켓을 생성할 때 showtime.id와 seat 정보를 같이 전달한다. 티켓 엔티티는 이 두 정보를 포함해야 하는 것이다.

### 8.1 Seatmap은 value? entity?

## 9. 테스트 코드 작성
