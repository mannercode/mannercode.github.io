---
layout: post
title: 백엔드 서비스 분석과 설계 (4)
---

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

component "웹브라우저" as User

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

많은 개발자들이 처음 구현을 시작할 때 DB 테이블부터 생성하는 `bottom-up` 방식을 선호한다. `중고차 거래 서비스`를 개발한다면 car 테이블에 몇 개의 필드를 정의하고 여기에 계속 살을 붙여가는 것이다. 개발자들이 이 방식을 선택한 여러 이유가 있겠지만 가장 큰 이유는 설계의 부재일 것이다.

![car-trade](/assets/images/car-trade.png)

설계의 어려움은 여러가지 있겠지만 기술적인 측면에서 가장 큰 어려움은 도메인 전문가의 머리속에 있을(도메인 전문가도 막연한 생각 뿐, 구체적인 생각은 없을 수도 있다.) 추상적인 생각을 구체화 하는 것이 어렵기 때문이다.
그러니 가장 구체적인 혹은 형태가 명확한 테이블 생성을 기반으로 기능을 확장해 나가는 것이다.

![car-bike](/assets/images/car-bike.png)

이런 `bottom-up` 방식은 개발자가 도메인 전문가의 요구사항을 파악하는 것이 아니라, 도메인 전문가가 구현 세부 사항을 파악하게 만든다. 다시 말해서 요구사항을 구현하는 것이 아니라, 구현에 요구사항을 맞추게 된다는 뜻이다.
이런 상황에서 도메인 전문가는 구현 상황을 고려해서 스스로 요구사항을 조정하여 개발팀에 전달하고 개발팀이 기술적인 문제로 요구사항을 수용할 수 없다고 하면 다시 한 번 구현 세부 사항을 파악하고 수긍하거나 포기하게 된다.

`bottom-up` 방식은 실행과 검증도 어렵다. 테이블을 생성했다면 여기에 어떻게 데이터를 삽입하고 읽을 수 있을까? 코드를 구현하면 되는데 그러면 그 코드는 또 어떻게 실행할 수 있을까?
이 문제를 해결하기 위해서 개발하는 동안 많은 임시적인 실행 코드를 만들고 삭제한다. 또 검증하기 위해서 정말 많은 실행을 하게 된다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "???" as RunnerC
component "???" as RunnerV

note left of RunnerV
  // TicketsService를 실행하기 위한 임시 코드
  main()
  {
    const db = new MySQL("127.0.0.1:3389")
    db.connect()
    const service = new TicketsService(db)
    const result = service.createTickets(dtos)

    console.log(result)
  }
end note

note right of RunnerC
  // ShowtimesService를 실행하기 위한 임시 코드
  main()
  {
    const db = new MySQL("127.0.0.1:3389")
    db.connect()
    const service = new ShowtimesService(db)
    const result = service.createShowtimes(dtos)

    console.log(result)
  }
end note

package "cores" {
component "ShowtimesService" as CShowtimes
component "TicketsService" as CTickets
}

database "ShowtimesDB" as SDB
database "TicketsDB" as TDB

RunnerC --> CShowtimes :  createShowtimes
RunnerV --> CTickets :  createTickets
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

**(이하 실습)**
1. curl로 실행하는 가장 간단한 프로젝트
2. ShowtimeCreationService 추가
3. curl 재실행
4. GET /tickets 구현
5. curl 실행
6. shell 스크립트로 전체 실행
7. jest로 전체 실행 실행


---

## 테스트 자동화에 대한 오해

이 과정에서 ShowtimeCreationService를 직접 호출해서 테스트 하지 않았다. 테스트에 대한 오해 중 하나가 모든 함수에 대해서 유닛 테스트를 작성해야 한다는 것이다.

특히 bottom-up 방식의 개발을 하면 이런 함정에 빠지기 쉽다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "???" as RunnerC

note right of RunnerC
  // 자연스럽게 작성하게 되는 테스트 코드
  test('createShowtimes')
  {
    const db = new MySQL("127.0.0.1:3389")
    db.connect()

    const service = new ShowtimesService(db)
    const result = service.createShowtimes(dtos)
  }
end note

package "cores" {
component "ShowtimesService" as CShowtimes
}

database "ShowtimesDB" as SDB

RunnerC --> CShowtimes :  createShowtimes
CShowtimes --> SDB :  find/save
@enduml
{% endplantuml %}

아래에서 위로 올라가면서 자연스럽게 작성하게 되는 테스트 코드를 그대로 남기면 각 단계별 테스트를 작성하게 되는 것이니 이것이 옳다고 생각하기 쉽다. 그러나 다른 함수를 호출하는 단순한 함수까지 모두 직접 테스트하는 것은 비효율적이다. 인터페이스는 언제든지 바뀔 수 있는데 그 때 마다 의미없는 테스트까지 모두 고쳐야 하기 때문이다.

그렇다고 bottom-up 방식이라고 테스트를 작성하지 않을 수는 없는 것 같은 불안함이 있을지도 모르겠다. 내 경험에 bottom-up 방식의 개발은 효율적인 테스트 코드를 유지하는 데 늘 어려움이 있었다.

그러나 유닛 테스트는 내부 코드가 복잡해서 통합 테스트로 다루기에 어려운 경우에만 선별적으로 구현하는 것이 좋다.

**(nest-msa에서 추천 알고리즘 소개, commonlib의 테스트 소개)**

테스트를 유닛테스트/통합테스트/e2e테스트 이렇게 구분하려는 시도가 프로젝트를 망치게 하는 주범인 것 같다. 함수를 작성하면 유닛 테스트를 작성해야 하고 여러 클래스와 모듈을 작성하면 통합테스트를 추가해야 한다고 생각한다.

그런데 이럴 시간이 있나? 시간이 있다고 해도 이게 의미가 있는가? 중복 테스트가 많고 이런 경우 테스트 코드의 종속성이 커져서 본문 코드를 조금만 바꿔도 다수의 테스트 코드를 변경해야 하는 경우가 생긴다. 몇 번 이 과정을 거치면 테스트를 버리게 된다. 아마 tdd를 시도했던 많은 개발자가 이 단계에서 좌절했으리라.

그러나 테스트는 유닛테스트/통합테스트/e2e테스트를 명확하게 나눌 수 없다. 애자일과 폭포수 방법론이 그러하듯이 얼마나 유닛테스트에 가까운가. 또 얼마나 통합테스트에 가까운가로 표현하는 것이 옳을 것이다.

알고리즘이 복잡한 함수라면 유닛 테스트가 유리하다. 코드가 간단하고 여러 모듈에 걸쳐서 동작하는 기능이라면 통합테스트가 유리하다.

```ts
// 유닛 테스트가 유리한 함수의 예
```

특히 우리가 선택한 레이어 아키텍처는 기능과 책임을 레이어 별로 분리하는 만큼 각 각 객체의 역할은 작고 분명하다. 이런 메소드까지 모두 유닛 테스트를 작성하는 것은 극히 비효율적이라는 얘기다.


## 엑스칼리버를 얻었다면

jest라는 강력한 테스트 도구는 성검이 아니라 마검이다. 잘 쓰면 약이지만 못 쓰면 독이 되는데 대체로 독이 된다.
마검인 이유는 jest가 제공하는 다양한 기능을 모두 사용하려는 경향이 있기 때문이다.

또 테스트 자동화를 다룬 기술 서적이나 글에서 온갖 상황에 맞는 이야기를 하기 때문에 이걸 그대로 받아들여 적용하는 과정에서 오버엔지니어링이 되는 경향이 있다.

그래서 정확히는 성검으로 태어났으나 우리가 마검으로 바꾼다고 할 수 있다.

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
