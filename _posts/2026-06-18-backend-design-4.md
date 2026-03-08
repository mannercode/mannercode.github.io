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
  duration
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

### bottom-up 구현

많은 개발자들이 처음 구현을 시작할 때 DB 테이블부터 생성하는 `bottom-up` 방식을 선호한다. 위 다이어그램으로 예를 들면 `showtimes` 테이블에 movieId, theaterId, startTime, duration 필드를 정의하고 여기에 계속 살을 붙여가는 것이다.

위 다이어그램의 일부만 뽑아서 간단히 구현해 보자.

```ts
// Step 1. DB에 가장 가까운 곳부터 시작한다.
class ShowtimesService {
    find(theaterId, startTime, duration) {
        return this.db.showtimes.find({ theaterId, startTime, duration })
    }
    save(movieId, theaterId, startTime, duration) {
        return this.db.showtimes.save({ movieId, theaterId, startTime, duration })
    }
}

async function main() {
    const db = new MySQL("127.0.0.1:3306")
    await db.connect()
    const showtimesService = new ShowtimesService(db)

    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
    console.log('showtimes:', showtimes)

    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
    console.log('saved:', saved)
}
main()
```

```ts
// Step 2. 한 단계 위 레이어로 올라간다.
class ValidatorService {
    validate(theaterId, startTime, duration) {
        const conflicts = this.showtimesService.find(theaterId, startTime, duration)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

async function main() {
    // ... Step 1 코드 ...

    const validator = new ValidatorService(showtimesService)
    await validator.validate(1, '2026-01-01 10:00', 120)
    console.log('validation passed')
}
main()
```

```ts
// Step 3. 또 한 단계 위로 올라간다.
class CreatorService {
    create(movieId, theaterId, startTime, duration) {
        this.validator.validate(theaterId, startTime, duration)
        this.showtimesService.save(movieId, theaterId, startTime, duration)
    }
}

async function main() {
    // ... Step 1~2 코드 ...

    const creator = new CreatorService(validator, showtimesService)
    await creator.create(1, 1, '2026-01-01 10:00', 120)
    console.log('creation done')
}
main()
```

지금까지 작성한 전체 코드를 보자.

```ts
class ShowtimesService {
    find(theaterId, startTime, duration) {
        return this.db.showtimes.find({ theaterId, startTime, duration })
    }
    save(movieId, theaterId, startTime, duration) {
        return this.db.showtimes.save({ movieId, theaterId, startTime, duration })
    }
}

class ValidatorService {
    validate(theaterId, startTime, duration) {
        const conflicts = this.showtimesService.find(theaterId, startTime, duration)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

class CreatorService {
    create(movieId, theaterId, startTime, duration) {
        this.validator.validate(theaterId, startTime, duration)
        this.showtimesService.save(movieId, theaterId, startTime, duration)
    }
}

async function main() {
    const db = new MySQL("127.0.0.1:3306")
    await db.connect()
    const showtimesService = new ShowtimesService(db)

    // Step 1: ShowtimesService
    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
    console.log('showtimes:', showtimes)

    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
    console.log('saved:', saved)

    // Step 2: ValidatorService
    const validator = new ValidatorService(showtimesService)
    await validator.validate(1, '2026-01-01 10:00', 120)
    console.log('validation passed')

    // Step 3: CreatorService
    const creator = new CreatorService(validator, showtimesService)
    await creator.create(1, 1, '2026-01-01 10:00', 120)
    console.log('creation done')
}
main()
```

함수를 하나 작성할 때마다 main()에 실행 코드가 추가돼서 길어졌다. 보통은 함수가 완성되면 이런 임시 코드는 삭제하겠지만 여기서는 굳이 남겨놨다.

### 테스트 코드

생각해보면 main()에 작성한 코드는 결국 "이 함수가 잘 동작하는지 확인하는 코드"다. 그렇다면 이걸 함수로 분리하면 어떨까?

```ts
async function test_ShowtimesService_find(showtimesService) {
    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
    console.log('showtimes:', showtimes)
}

async function test_ShowtimesService_save(showtimesService) {
    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
    console.log('saved:', saved)
}

async function test_ValidatorService_validate(validator) {
    await validator.validate(1, '2026-01-01 10:00', 120)
    console.log('validation passed')
}

async function test_CreatorService_create(creator) {
    await creator.create(1, 1, '2026-01-01 10:00', 120)
    console.log('creation done')
}

async function main() {
    const db = new MySQL("127.0.0.1:3306")
    await db.connect()
    const showtimesService = new ShowtimesService(db)
    const validator = new ValidatorService(showtimesService)
    const creator = new CreatorService(validator, showtimesService)

    await test_ShowtimesService_find(showtimesService)
    await test_ShowtimesService_save(showtimesService)
    await test_ValidatorService_validate(validator)
    await test_CreatorService_create(creator)
}
main()
```

main()에서 임시로 작성했던 코드가 그대로 테스트 코드가 된다. 이것을 Jest나 JUnit으로 잘 정리하면 훌륭한 유닛테스트가 될 것 같다.

### 깨지기 쉬운 테스트

모든 함수 마다 테스트가 있으니 함수들이 제대로 잘 동작할 거라는 안심이 든다.

이렇게 안정된 상황에서 요구사항이 변경되어 `duration` 대신 `endTime`을 받도록 바뀌었다고 하자. 상위 인터페이스의 변경은 아래로 전파된다.

```ts
class CreatorService {
    create(movieId, theaterId, startTime, endTime) {
        this.validator.validate(theaterId, startTime, endTime)
        this.showtimesService.save(movieId, theaterId, startTime, endTime)
    }
}

class ValidatorService {
    validate(theaterId, startTime, endTime) {
        const conflicts = this.showtimesService.find(theaterId, startTime, endTime)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

class ShowtimesService {
    find(theaterId, startTime, endTime) {
        return this.db.showtimes.find({ theaterId, startTime, endTime })
    }
    save(movieId, theaterId, startTime, endTime) {
        return this.db.showtimes.save({ movieId, theaterId, startTime, endTime })
    }
}
```

`duration`이 `endTime`으로 바뀌면서 4개 함수가 모두 수정됐다. 그러면 테스트 코드는?

```ts
// ❌ duration으로 조회했다
async function test_ShowtimesService_find(showtimesService) {
    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
}

// ❌ duration으로 저장했다
async function test_ShowtimesService_save(showtimesService) {
    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
}

// ❌ duration으로 검증했다
async function test_ValidatorService_validate(validator) {
    await validator.validate(1, '2026-01-01 10:00', 120)
}

// ❌ duration으로 생성했다
async function test_CreatorService_create(creator) {
    await creator.create(1, 1, '2026-01-01 10:00', 120)
}
```

모든 함수마다 테스트를 작성하면 상위 요구사항의 변경이 하위 함수의 인터페이스를 연쇄적으로 바꾸고, 그 결과 하위 테스트까지 모두 수정해야 한다. 설계를 잘 해서 인터페이스 변경을 최소화한다고 해도 리팩토링 과정에서 함수 변경을 피하기는 어렵다. 이것이 `깨지기 쉬운 테스트(Fragile Test)`다. 불필요한 테스트가 유지보수 비용을 뻥튀기하는 것이다. 이 경험이 몇 번 반복되면 테스트를 유지하는 비용이 테스트의 이점을 넘어서고 결국 테스트를 포기하게 된다. 많은 개발자들이 테스트 코드에 도전하고 좌절하는 지점이 바로 여기인 것 같다.

흔히 unit test의 "unit"을 함수 단위로 해석한다. 그래서 함수를 작성하면 그 함수의 유닛 테스트를 작성해야 한다고 생각한다. 하지만 unit은 함수가 아니라 **하나의 동작(behavior)** 이다. "상영시간을 생성한다"가 하나의 unit이지, find, save, validate 각각이 unit이 아니다. bottom-up 개발에서 함수를 작성할 때마다 만든 임시 실행 코드를 테스트로 남기면 자연스럽게 이 함정에 빠지게 된다.

실행과 검증도 어렵다. 테이블을 만들었으면 데이터를 넣고 읽어봐야 하는데, 그러려면 코드를 작성해야 하고, 그 코드를 실행하려면 또 임시 코드가 필요하다. 앞서 본 main() 함수가 바로 그 임시 코드다.

이렇게 단점이 많은데도 왜 많은 개발자들이 bottom-up 방식을 선택할까? 가장 큰 이유는 설계의 부재일 것이다.

![car-trade](/assets/images/car-trade.png)

도메인 전문가의 머리속에 있는 추상적인 생각을 구체화하는 것은 어려운 일이다. 도메인 전문가 스스로도 막연한 생각만 있을 뿐, 구체적인 형태를 갖추지 못한 경우가 많다. "상영시간을 관리하고 싶다"는 있지만 "어떤 데이터가 필요하고, 어떤 흐름으로 동작해야 하는지"는 대화를 통해 끌어내야 한다. 이 과정이 어렵기 때문에 개발자는 자연스럽게 가장 구체적인 것, 즉 형태가 명확한 DB 테이블부터 만들고 거기에 기능을 붙여나가게 된다. 그 결과 요구사항을 구현하는 것이 아니라, 구현에 요구사항을 맞추게 된다.

### top-down 구현

다행히 우리는 지금까지 'top-down' 방식으로 요구사항을 분석하고 설계했다.

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

여기서 소개한 상영시간 생성 기능은 설계 과정이 길었다. 작은 규모의 프로젝트에 작은 팀이라면 이 정도 설계 과정은 드물 것이다.
그렇다면 설계 없이 개발하는 프로젝트에서는 이런 방식의 개발을 할 수 없다는 것인가? 물론 아니다. 중요한 것은 설계가 우선되어야 하는 것이 아니라 top-down 방식이어야 한다는 것이다.
설계가 없어도 rest api 부터 테스트 코드를 작성하고 구현해 나간다면 자연스럽게 tdd가 된다.

## 테스트 자동화에 대한 오해

### 유닛 테스트 vs 통합 테스트

이 과정에서 ShowtimeCreationService를 직접 호출해서 테스트 하지 않았다. 테스트에 대한 오해 중 하나가 모든 함수에 대해서 유닛 테스트를 작성해야 한다는 것이다.

특히 bottom-up 방식의 개발을 하면 이런 함정에 빠지기 쉽다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "???" as RunnerC

note left of RunnerC
  예제로 한 뎁스 더 작성
end note

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

### mock

jest라는 강력한 테스트 도구는 성검이 아니라 마검이다. 잘 쓰면 약이지만 못 쓰면 독이 되는데 대체로 독이 된다.
마검인 이유는 jest가 제공하는 다양한 기능을 모두 사용하려는 경향이 있기 때문이다.

또 테스트 자동화를 다룬 기술 서적이나 글에서 온갖 상황에 맞는 이야기를 하기 때문에 이걸 그대로 받아들여 적용하는 과정에서 오버엔지니어링이 되는 경향이 있다.

그래서 정확히는 성검으로 태어났으나 우리가 마검으로 바꾼다고 할 수 있다.
top-down 함정에 빠지기 쉬운 것 중에 하나는 mock이다. jest에서 mock을 기능을 제공하기 때문에 이것을 적극적으로 사용해야 올바른 코드가 된다고 착각하기 쉽다.
mock은 공짜가 아니다. mock을 구현하고 유지하기 위해서 추가적인 비용이 들어간다. mock으로 구현한 인터페이스가 바뀐다면 해당 mock도 모두 변경해야 한다.

mock은 언제 사용할까? 내가 생성하지 않은 객체를 조작해야 할 때다. 그것은 외부 라이브러리가 될 수도 있고 다른 팀의 모듈이 될 수도 있다.

```ts
// 여기에 mock의 위치를 나타내는 uml
```

누군가는 mock을 적극적으로 사용해서 외부 변화로부터 테스트를 격리해야 한다고 주장할 수도 있다. 그러나 mock 자체도 유지보수 비용이 들기 때문에, 격리의 이점이 유지보수 비용을 넘는 경우에만 사용하는 것이 바람직하다.

```ts
// 여기에 nest-msa에서 mock의 사용 사례
```

### 프론트에서 TDD

종종 React나 iOS 같은 모바일 앱에서 TDD를 한다고 얘기를 듣는다. 지금까지 TDD를 한 번도 언급하지 않았지만 top-down 설계와 구현은 자연스럽게 TDD와 유사한 흐름이 된다.

그런데 프론트에서도 자연스럽게 TDD가 될 수 있을까? 백엔드는 데이터 타입과 인터페이스가 명확하게 정의되기 때문에 TDD가 가능하다. `POST /showtimes` → `{ sagaId }` 같은 계약이 있으니 테스트를 먼저 작성할 수 있는 것이다.

프론트에서 TDD를 한다고 하면 대체로 두 가지 중 하나다. 첫째, 상태 관리나 데이터 변환, 유효성 검사 같은 로직을 테스트하는 경우다. 이건 TDD가 가능하지만 사실상 프론트에 있는 백엔드적 코드의 TDD다. 둘째, "버튼을 클릭하면 모달이 열린다" 같은 컴포넌트 동작을 테스트하는 경우다. 가능은 하지만 구현하면서 눈으로 확인하는 게 더 빠른 경우가 대부분이다.

결국 jest나 testing-library 같은 도구가 있으니까 써야 한다는 생각은 앞에서 말한 마검의 논리와 같다.

그렇다고 프론트에서 테스트 코드를 아예 안 작성할 수는 없다. 그렇다면 어떤 방식이 유효할까?

나는 React Native 프로젝트에서 jest의 스냅샷 기능으로 테스트 코드를 작성했다. 그러나 Chromatic이나 Percy 같은 더 발전된 visual regression 테스트가 있다고 한다. 이것은 실제 렌더링된 화면을 스크린샷으로 비교하는 방식이다. 프론트의 설계가 시각적 디자인이라면, 검증도 시각적으로 하는 것이 자연스럽다.

다만, React의 경우 뷰와 모델을 명확하게 나눠야 하는데 뷰에 모델이 포함된 경우가 대부분이다. 이렇게 되면 정상/오류 등 다양한 흐름을 테스트 하기 어렵다.

**(react native에서 VMR 코드 리뷰)**

## jest로 작성한 테스트 코드

**(nest-msa 테스트 코드 리뷰)**

## 동작하는 문서와 e2e 테스트

**(nest-msa e2e 코드 리뷰)**

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
