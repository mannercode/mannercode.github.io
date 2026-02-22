---
layout: post
title: 백엔드 서비스 분석과 설계 (4)
---

지금까지 도메인 전문가의 요구사항을 분석해, 구체적인 유스케이스 다이어그램을 만들었다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
    package tickets {
        usecase "티켓 구매하기" as PurchaseTickets #yellow
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

그리고 이 유스케이스 중 특히 복잡한 `상영시간 생성`을 중심으로 상세 설계를 진행했다.

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

`상영시간 생성`을 구체화하면서, `ShowtimeCreationService` 내부를 여러 역할 서비스로 분리해 설계했다.

이전 글에서는 시퀀스 다이어그램으로 동작 순서에 집중했다. 이번에는 그 결과를 바탕으로 서비스 간 전체 관계를 먼저 정리한다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

package "gateway" {
component "ShowtimeCreationController\n(POST /showtime-creation/showtimes)" as GController
}

package "applications" {
component "ShowtimeCreationService" as AService
component "ShowtimeCreationWorkerService" as AWorker
component "ValidatorService" as AValidator
component "CreatorService" as ACreator

AService --> AWorker : <b><color:red>enqueueShowtimeCreationJob</color></b>
AWorker --> AValidator : <b><color:red>validate</color></b>
AWorker --> ACreator : <b><color:red>create</color></b>
}

package "cores" {
component "ShowtimesService" as CShowtimes
component "TicketsService" as CTickets
}

GController --> AService : <b><color:red>requestShowtimeCreation</color></b>
ACreator --> CTickets : <b><color:red>createTickets</color></b>
AValidator --> CShowtimes : <b><color:red>findConflicts</color></b>
@enduml
{% endplantuml %}

이번 글에서는 지금까지의 설계를 실제 구현 순서로 어떻게 옮길지 다룬다.

## 1. 무엇부터 구현해야 할까?

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

##
