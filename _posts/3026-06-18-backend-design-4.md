---
layout: post
title: 백엔드 서비스 분석과 설계 (4)
lang: ko
---

지금까지의 설계를 어떻게 구현할지 알아보자.

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
component "ShowtimeBulkValidatorService" as AValidator
component "ShowtimeBulkCreatorService" as ACreator

AService --> AWorker : <b><color:red> 3. requestShowtimeCreation</color></b>
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

편의를 위해 아래처럼 호출구조를 단순화해서 설명하겠다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "CreatorService\n--\ncreate(movieId, theaterId, startTime, duration)" as ACreator
component "ValidatorService\n--\nvalidate(theaterId, startTime, duration)" as AValidator

ACreator --> AValidator : validate

component "ShowtimesService\n--\nfind(theaterId, startTime, duration)\nsave(movieId, theaterId, startTime, duration)" as CShowtimes

database "ShowtimesDB" as SDB

ACreator --> CShowtimes : save
AValidator --> CShowtimes : find
CShowtimes --> SDB
@enduml
{% endplantuml %}

### 1.1. bottom-up: DB부터 시작해서 위로 올라간다

많은 개발자들이 처음 구현을 시작할 때 DB 테이블부터 생성하는 `bottom-up` 방식을 선호한다. 위 다이어그램으로 예를 들면 `showtimes` 테이블에 movieId, theaterId, startTime, duration 필드를 정의하고 여기에 계속 살을 붙여가는 것이다.

```ts
// Step 1. DB에 가장 가까운 곳부터 시작한다.
class ShowtimesService {
    constructor(private db: MySQL) {}

    find(theaterId: number, startTime: string, duration: number) {
        return this.db.find({ theaterId, startTime, duration })
    }
    save(movieId: number, theaterId: number, startTime: string, duration: number) {
        return this.db.save({ movieId, theaterId, startTime, duration })
    }
}

async function main() {
    const db = new MySQL("127.0.0.1:3306")
    await db.connect()
    const showtimesService = new ShowtimesService(db)

    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
    console.log('saved:', saved)

    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
    console.log('showtimes:', showtimes)
}
main()
```

```ts
// Step 2. 한 단계 위 레이어로 올라간다.
class ValidatorService {
    constructor(private showtimesService: ShowtimesService) {}

    async validate(theaterId: number, startTime: string, duration: number) {
        const conflicts = await this.showtimesService.find(theaterId, startTime, duration)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

async function main() {
    // ... Step 1 코드 ...

    const validatorService = new ValidatorService(showtimesService)
    await validatorService.validate(1, '2026-01-01 13:00', 120)
    console.log('validation passed')
}
main()
```

> 시간이 겹치는 상영시간을 찾으려면 실제로는 구간 겹침 조건의 범위 검색이 필요하다. 여기서는 설명을 위해 `find`를 완전 일치 조회로 단순화했다.

```ts
// Step 3. 또 한 단계 위로 올라간다.
class CreatorService {
    constructor(private validatorService: ValidatorService, private showtimesService: ShowtimesService) {}

    async create(movieId: number, theaterId: number, startTime: string, duration: number) {
        await this.validatorService.validate(theaterId, startTime, duration)
        await this.showtimesService.save(movieId, theaterId, startTime, duration)
    }
}

async function main() {
    // ... Step 1~2 코드 ...

    const creator = new CreatorService(validatorService, showtimesService)
    await creator.create(1, 1, '2026-01-01 15:00', 120)
    console.log('creation done')
}
main()
```

지금까지 작성한 전체 코드를 보자.

```ts
class ShowtimesService {
    constructor(private db: MySQL) {}

    find(theaterId: number, startTime: string, duration: number) {
        return this.db.find({ theaterId, startTime, duration })
    }
    save(movieId: number, theaterId: number, startTime: string, duration: number) {
        return this.db.save({ movieId, theaterId, startTime, duration })
    }
}

class ValidatorService {
    constructor(private showtimesService: ShowtimesService) {}

    async validate(theaterId: number, startTime: string, duration: number) {
        const conflicts = await this.showtimesService.find(theaterId, startTime, duration)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

class CreatorService {
    constructor(private validatorService: ValidatorService, private showtimesService: ShowtimesService) {}

    async create(movieId: number, theaterId: number, startTime: string, duration: number) {
        await this.validatorService.validate(theaterId, startTime, duration)
        await this.showtimesService.save(movieId, theaterId, startTime, duration)
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
    const validatorService = new ValidatorService(showtimesService)
    await validatorService.validate(1, '2026-01-01 13:00', 120)
    console.log('validation passed')

    // Step 3: CreatorService
    const creator = new CreatorService(validatorService, showtimesService)
    await creator.create(1, 1, '2026-01-01 15:00', 120)
    console.log('creation done')
}
main()
```

함수를 하나 작성할 때마다 main()에 실행 코드가 추가돼서 길어졌다. 보통은 함수가 완성되면 이런 임시 코드는 삭제하겠지만 여기서는 굳이 남겨놨다.

생각해보면 main()에 작성한 코드는 결국 "이 함수가 잘 동작하는지 확인하는 코드"다. 그렇다면 이걸 함수로 분리하면 어떨까?

```ts
async function test_ShowtimesService_find(showtimesService: ShowtimesService) {
    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
    console.log('showtimes:', showtimes)
}

async function test_ShowtimesService_save(showtimesService: ShowtimesService) {
    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
    console.log('saved:', saved)
}

async function test_ValidatorService_validate(validatorService: ValidatorService) {
    await validatorService.validate(1, '2026-01-01 13:00', 120)
    console.log('validation passed')
}

async function test_CreatorService_create(creator: CreatorService) {
    await creator.create(1, 1, '2026-01-01 15:00', 120)
    console.log('creation done')
}

async function main() {
    const db = new MySQL("127.0.0.1:3306")
    await db.connect()
    const showtimesService = new ShowtimesService(db)
    const validatorService = new ValidatorService(showtimesService)
    const creator = new CreatorService(validatorService, showtimesService)

    await test_ShowtimesService_find(showtimesService)
    await test_ShowtimesService_save(showtimesService)
    await test_ValidatorService_validate(validatorService)
    await test_CreatorService_create(creator)
}
main()
```

main()에서 임시로 작성했던 코드가 그대로 테스트 코드가 된다. 이것을 Jest나 JUnit으로 잘 정리하면 훌륭한 유닛 테스트가 될 것 같다.

함수마다 테스트가 있으니 제대로 동작할 거라고 안심하게 된다. 실제로 이 방식에는 장점이 있다. 테스트가 실패하면 어떤 함수에 문제가 있는지 즉시 알 수 있을 것처럼 보인다. `test_ValidatorService_validate`가 실패하면 ValidatorService에 문제가 있다는 뜻이니까.

테스트 코드의 길이는 어느 정도가 적당하냐고 물으면 꼭 정해진 건 없지만 보통 본문 코드만큼이면 적절한 것 같다고 흔히 얘기하는데 마침 길이도 비슷해 보인다.

좋은 유닛 테스트의 조건 중 하나가 "테스트가 실패하면 실패 지점을 바로 알 수 있어야 한다"는 것인데, 이 원칙에도 부합하는 것 같다.

### 1.2. bottom-up의 함정: 함수마다 작성한 테스트

그러면 이번에는 요구사항이 변경되어 `duration` 대신 `endTime`을 받게 되었다고 하자. 상위 인터페이스의 변경은 아래로 전파된다.

```ts
class CreatorService {
    constructor(private validatorService: ValidatorService, private showtimesService: ShowtimesService) {}

    async create(movieId: number, theaterId: number, startTime: string, endTime: string) {
        await this.validatorService.validate(theaterId, startTime, endTime)
        await this.showtimesService.save(movieId, theaterId, startTime, endTime)
    }
}

class ValidatorService {
    constructor(private showtimesService: ShowtimesService) {}

    async validate(theaterId: number, startTime: string, endTime: string) {
        const conflicts = await this.showtimesService.find(theaterId, startTime, endTime)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

class ShowtimesService {
    constructor(private db: MySQL) {}

    find(theaterId: number, startTime: string, endTime: string) {
        return this.db.find({ theaterId, startTime, endTime })
    }
    save(movieId: number, theaterId: number, startTime: string, endTime: string) {
        return this.db.save({ movieId, theaterId, startTime, endTime })
    }
}
```

`duration`이 `endTime`으로 바뀌면서 4개 함수가 모두 수정됐다. 그러면 테스트 코드는?

```ts
// ❌ duration으로 조회했다
async function test_ShowtimesService_find(showtimesService: ShowtimesService) {
    const showtimes = await showtimesService.find(1, '2026-01-01 10:00', 120)
}

// ❌ duration으로 저장했다
async function test_ShowtimesService_save(showtimesService: ShowtimesService) {
    const saved = await showtimesService.save(1, 1, '2026-01-01 10:00', 120)
}

// ❌ duration으로 검증했다
async function test_ValidatorService_validate(validatorService: ValidatorService) {
    await validatorService.validate(1, '2026-01-01 13:00', 120)
}

// ❌ duration으로 생성했다
async function test_CreatorService_create(creator: CreatorService) {
    await creator.create(1, 1, '2026-01-01 15:00', 120)
}
```

4개의 테스트가 모두 컴파일 에러로 깨진다. 코드는 정상적으로 수정됐지만 테스트만 옛날 인터페이스를 호출하고 있기 때문이다.

함수마다 테스트를 작성하면 하나의 요구사항 변경이 여러 함수의 인터페이스를 연쇄적으로 바꾸고, 그에 딸린 테스트까지 모두 수정해야 한다. 테스트가 기능을 검증하는 게 아니라 인터페이스 변경을 따라다니는 짐이 되는 것이다.

이 경험이 몇 번 반복되면 테스트를 유지하는 비용이 테스트의 이점을 넘어서고 결국 테스트를 포기하게 된다.

여기서 혼란에 빠지게 된다. "테스트가 실패하면 실패 지점을 바로 알 수 있어야 한다"고 했으니까 함수마다 테스트를 작성하는 게 옳은 것 같다. 그런데 이렇게 하면 작은 인터페이스 변화에도 많은 테스트가 깨진다. 그렇다고 해서 '유닛 테스트는 함수를 테스트하는 것'이라는 생각이 틀린 것 같지도 않다. 그렇다면 TDD 자체가 비현실적인 방법론이 아닌가?

이 혼란의 원인은 unit test의 "unit"을 함수 단위로 해석하는 데 있다. unit은 함수가 아니라 **하나의 동작(behavior)**이다. bottom-up 개발에서 함수를 작성할 때마다 만든 임시 실행 코드를 테스트로 남기면 자연스럽게 이 함정에 빠지게 된다. 이에 대해서는 뒤에서 더 자세히 다룬다.

bottom-up에는 또 다른 문제도 있다. 실행과 검증이 어렵다는 점이다. 테이블을 만들었으면 데이터를 넣고 읽어봐야 하는데, 그러려면 코드를 작성해야 하고, 그 코드를 실행하려면 또 임시 코드가 필요하다. 앞서 본 main() 함수가 바로 그 임시 코드다.

### 1.3. top-down: REST API부터 시작해서 아래로 내려간다

왜 많은 개발자들이 bottom-up 방식을 선택할까? 가장 큰 이유는 설계의 부재일 것이다.

![car-trade](/assets/images/car-trade.png)

도메인 전문가의 머릿속에 있는 추상적인 생각을 구체화하는 것은 어려운 일이다. 도메인 전문가 스스로도 막연한 생각만 있을 뿐, 구체적인 형태를 갖추지 못한 경우가 많다. "상영시간을 관리하고 싶다"는 생각은 있지만 "어떤 데이터가 필요하고, 어떤 흐름으로 동작해야 하는지"는 대화를 통해 끌어내야 한다.

이 과정이 어렵기 때문에 개발자는 자연스럽게 가장 구체적인 것, 즉 형태가 명확한 DB 테이블부터 만들고 거기에 기능을 붙여나가게 된다. 그 결과 요구사항을 구현하는 것이 아니라, 구현에 요구사항을 맞추게 된다.

다행히 우리는 지금까지 'top-down' 방식으로 요구사항을 분석하고 설계했다.

{% plantuml %}
@startuml
left to right direction
actor administrator
actor customer

rectangle "Use Cases" {
    usecase "상영시간 생성하기" as UC1
    usecase "티켓 구매하기" as UC2
    usecase "티켓 환불하기" as UC3
}

rectangle "REST API" {
    component "/showtime-creation/*" as API1
    component "/purchases/*" as API2
    component "/refunds/*" as API3
}

rectangle "Application Services" {
    component "ShowtimeCreationService" as SVC1
    component "PurchaseService" as SVC2
    component "RefundService" as SVC3
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

    Frontend -> Backend: 기존 상영시간 조회\nPOST /showtime-creation/showtimes/search
    Frontend <-- Backend: showtimes[]

    Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
    Frontend <-- Backend: { sagaId }
@enduml
{% endplantuml %}

도메인 전문가의 `상영시간 생성하기` 요구사항을 유스케이스 다이어그램으로 시작해서 유스케이스 명세서와 시퀀스 다이어그램으로 구체화할 수 있었다. 결과물로 구체적인 REST API를 정의할 수 있었기 때문에 이제는 이것을 구현하기만 하면 된다. 구현 후 실행은 curl 같은 많은 방법들이 있으니 문제가 없다.

무엇보다 좋은 것은 아래쪽 서비스로 구현이 진행돼도 실행 방법을 변경할 필요가 없다는 것이다. 인터페이스가 바뀌는 건 아니니까 말이다.

```ts
// Step 1. 가장 위에서 시작한다.
class CreatorService {
    async create(movieId: number, theaterId: number, startTime: string, duration: number) {
        // TODO: validate + save
        return { sagaId: 123 }
    }
}

@Route('showtime-creation')
class ShowtimeCreationController {
    constructor(private creator: CreatorService) {}

    @Post('showtimes')
    createShowtimes(body) {
        return this.creator.create(body.movieId, body.theaterId, body.startTime, body.duration)
    }
}
```

CreatorService 내부는 아직 스텁이지만 실행은 된다.

```sh
curl -X POST localhost:3000/showtime-creation/showtimes \
  -d '{"movieId":1,"theaterId":1,"startTime":"2026-01-01 10:00","duration":120}'
```

```ts
// Step 2. 한 단계 아래로 내려간다.
class ShowtimesService {
    constructor(private db: MySQL) {}

    find(theaterId: number, startTime: string, duration: number) {
        return this.db.find({ theaterId, startTime, duration })
    }
    save(movieId: number, theaterId: number, startTime: string, duration: number) {
        return this.db.save({ movieId, theaterId, startTime, duration })
    }
}

class ValidatorService {
    constructor(private showtimesService: ShowtimesService) {}

    async validate(theaterId: number, startTime: string, duration: number) {
        const conflicts = await this.showtimesService.find(theaterId, startTime, duration)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

class CreatorService {
    constructor(private validatorService: ValidatorService, private showtimesService: ShowtimesService) {}

    async create(movieId: number, theaterId: number, startTime: string, duration: number) {
        await this.validatorService.validate(theaterId, startTime, duration)
        const showtime = await this.showtimesService.save(movieId, theaterId, startTime, duration)
        return { sagaId: showtime.id }
    }
}
```

모든 구현이 완료됐다. 실행은?

```sh
curl -X POST localhost:3000/showtime-creation/showtimes \
  -d '{"movieId":1,"theaterId":1,"startTime":"2026-01-01 10:00","duration":120}'
```

2단계에 걸쳐 구현이 진행됐지만 실행 방법은 바뀌지 않는다.

물론 `duration`이 `endTime`으로 바뀌는 것처럼 REST API의 인터페이스 자체가 변경되면 curl도 수정해야 한다. 그러나 수정 지점은 curl 명령 1곳뿐이다. bottom-up에서 4개 함수의 테스트를 모두 고쳐야 했던 것과는 비용이 다르다.

## 2. 테스트는 어떻게 작성해야 할까?

### 2.1. unit은 함수가 아니라 동작이다

앞서 bottom-up의 함정에서 unit test의 "unit"을 함수 단위로 해석하면 문제가 생긴다고 했다.

사용자가 "상영시간을 생성해줘"라고 요청하면, 내부적으로 validate → find → save가 순서대로 실행된다. 사용자 입장에서 이건 하나의 동작이다. 이 동작 전체가 하나의 unit이지, find, save, validate 각각이 unit이 아니다.

테스트도 "상영시간 생성을 요청하면 생성된 결과가 돌아온다" 또는 "충돌이 있으면 에러가 돌아온다"처럼 동작 단위로 작성해야 한다. 그래야 내부 함수의 인터페이스가 바뀌어도 동작이 같으면 테스트는 깨지지 않는다.

top-down에서는 이것이 자연스럽다. 개발하면서 실행한 curl 명령들을 모아놓으면 그 자체가 동작 단위의 테스트 코드가 된다.

```sh
# test.sh
# 정상 생성
curl -X POST localhost:3000/showtime-creation/showtimes \
  -d '{"movieId":1,"theaterId":1,"startTime":"2026-01-01 10:00","duration":120}'

# 충돌 검증
curl -X POST localhost:3000/showtime-creation/showtimes \
  -d '{"movieId":2,"theaterId":1,"startTime":"2026-01-01 10:30","duration":120}'
```

### 2.2. curl 스크립트가 테스트 코드이자 API 문서가 된다

많은 개발자들이 Swagger나 Postman을 사용하지만 나는 curl 기반의 쉘 스크립트를 선호한다. 환경을 가리지 않고 어디서든 실행할 수 있고, 테스트 코드이자 동작하는 API 문서가 되기 때문이다.

<!-- TODO 이 부분 더 자세하게 쓰자. 스텁을 작성한다는 건 뭔가? 그림으로 표현하자 -->

실제로 내가 관리하는 프로젝트에서는 주니어 개발자라도 curl 스크립트를 먼저 작성하게 한다. 프론트엔드 개발자는 이 스크립트를 실행하는 것만으로 서버가 정상인지, 어떤 값을 보내고 받는지 파악할 수 있다. 백엔드 개발자는 이 스크립트가 성공하도록 스텁 코드부터 작성한다. 테스트를 먼저 작성하고, 그 테스트가 통과하도록 구현하는 것. 의식하지 않아도 자연스럽게 TDD가 된다.

아래는 실제 프로젝트에서 사용하는 curl 기반 테스트 스크립트의 일부다.

```sh
TEST "Create a movie" \
 201 POST /movies \
 -H 'Content-Type: application/json' \
 -d '{
   "title": "movie title",
   "genres": ["action", "drama"],
   "releaseDate": "2024-01-01T00:00:00.000Z",
   "plot": "movie plot for e2e flow",
   "durationInSeconds": 7200,
   "director": "e2e director",
   "rating": "PG13",
   "imageIds": []
  }'

MOVIE_ID=$(echo "${BODY}" | jq -r '.id')

TEST "Retrieve movies page" \
 200 GET /movies

TEST "Update movie by ID" \
 200 PATCH /movies/${MOVIE_ID} \
 -H 'Content-Type: application/json' \
 -d '{
   "plot": "updated movie plot",
   "director": "updated e2e director"
  }'
```

나는 이 스크립트에 주로 성공 흐름을 작성한다. 쉘 스크립트는 동작하는 문서 수준으로 유지하고, 실패 흐름이나 다양한 조건 검증은 아래처럼 테스트 프레임워크를 사용하는 게 효율적이다.

```ts
describe('MoviesService', () => {
    let fix: MoviesFixture

    beforeEach(async () => {
        const { createMoviesFixture } = await import('./movies.fixture')
        fix = await createMoviesFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies', () => {
        // 생성된 영화를 반환한다
        it('returns the created movie', async () => {
            const createDto = buildCreateMovieDto()

            await fix.httpClient
                .post('/movies')
                .body(createDto)
                .created({
                    ...omit(createDto, ['imageIds']),
                    id: expect.any(String),
                    imageUrls: []
                })
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
            // 기본값으로 생성된 영화를 반환한다.
            it('returns the created movie with defaults', async () => {
                await fix.httpClient
                    .post('/movies')
                    .body({})
                    .created({
                        genres: [],
                        id: expect.any(String),
                        imageUrls: [],
                        ...Rules.Movie.defaults
                    })
            })
        })
    })
})
```

쉘 스크립트는 e2e 테스트에도 유용하다. 백엔드 프로젝트와 관련 인프라를 컨테이너로 실행한 상태에서 스크립트를 돌리면, 프론트엔드나 외부 서비스에서 호출하는 것과 거의 동일한 방식으로 테스트할 수 있다.

<!-- TODO 여기에 github action에서 e2e 실행하는거 보여주자 -->

> 여기서 소개한 상영시간 생성 기능은 설계 과정이 길었다. 작은 규모의 프로젝트에 작은 팀이라면 이 정도 설계 과정은 드물 것이다.
> 그렇다면 설계 없이 개발하는 프로젝트에서는 이런 방식의 개발을 할 수 없다는 것인가? 물론 아니다. 중요한 것은 설계가 우선되어야 하는 것이 아니라 top-down 방식이어야 한다는 것이다.
> 설계가 없어도 REST API부터 테스트 코드를 작성하고 구현해 나간다면 자연스럽게 TDD가 된다.

### 2.3. 유닛 테스트는 언제 필요한가

테스트를 유닛 테스트/통합 테스트로 구분하려는 시도를 자주 본다. 그러나 테스트는 이렇게 명확하게 나눌 수 없다. 애자일과 폭포수 방법론이 그러하듯이 얼마나 유닛 테스트에 가까운가, 또 얼마나 통합 테스트에 가까운가로 표현하는 것이 옳을 것이다.

중요한 것은 테스트의 종류가 아니라 **비용 대비 효과**다. 그렇다면 별도의 유닛 테스트는 언제 필요할까?

- 다른 함수를 호출할 뿐인 단순한 함수 → 상위 테스트에서 이미 검증된다. **별도 테스트 불필요.**
- 자체적으로 복잡한 로직을 가진 함수 (알고리즘, 조건 분기가 많은 계산 등) → 상위 테스트만으로는 모든 경우를 다루기 어렵다. **유닛 테스트가 유리.**

우리가 만든 ValidatorService를 보자. `find` 결과가 있으면 에러를 던지고, 없으면 통과한다. 이건 상위 테스트에서 "충돌이 있는 경우"와 "없는 경우"를 각각 한 번씩 호출하면 충분하다. 별도 유닛 테스트를 작성할 이유가 없다.

특히 우리가 선택한 레이어 아키텍처는 기능과 책임을 레이어별로 분리하는 만큼 각각의 객체 역할은 작고 분명하다. 이렇게 단순한 메서드까지 모두 유닛 테스트를 작성하는 것은 극히 비효율적이다.

### 2.4. mock은 내가 만들지 않은 객체에만 쓴다

Jest는 성검이 아니라 마검이다. Jest가 제공하는 다양한 기능을 모두 사용하려는 경향이 있고, 테스트 관련 서적이나 글에서 다루는 온갖 기법을 그대로 적용하면서 오버엔지니어링이 되기 쉽다. 정확히는 성검으로 태어났으나 우리가 마검으로 바꾸는 것이다.

특히 빠지기 쉬운 함정이 mock이다. Jest에서 mock 기능을 제공하니까 적극적으로 사용해야 올바른 코드가 된다고 착각하기 쉽다. 그러나 mock은 공짜가 아니다. mock을 구현하고 유지하는 데 비용이 들고, mock으로 구현한 인터페이스가 바뀌면 해당 mock도 모두 변경해야 한다.

그렇다면 mock은 언제 사용할까? 내가 생성하지 않은 객체를 조작해야 할 때다. 외부 라이브러리가 될 수도 있고 다른 팀의 모듈이 될 수도 있다.

```ts
// Redis는 외부에서 주입받는 객체다. ping이 실패하는 상황을 재현하기 위해 mock한다.
describe('when an Error is thrown', () => {
    beforeEach(() => {
        jest.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('error'))
    })

    it('returns a down status with the error message', async () => {
        const healthStatus = await redisIndicator.isHealthy('key', redis)

        expect(healthStatus).toEqual({ key: { reason: 'error', status: 'down' } })
    })
})
```

### 2.5. 프론트엔드는 스냅샷으로 시각적으로 검증한다

지금까지의 논의는 백엔드에 집중되어 있었다. 그렇다면 프론트엔드에서는 어떻게 테스트해야 할까?

백엔드는 `POST /showtimes` → `{ sagaId }` 같은 명확한 입출력 계약이 있기 때문에 top-down으로 테스트를 먼저 작성하는 것이 자연스럽다. 프론트엔드에서도 상태 관리나 유효성 검사처럼 입출력이 명확한 로직은 테스트할 수 있지만, "버튼을 클릭하면 모달이 열린다" 같은 컴포넌트 동작은 구현하면서 눈으로 확인하는 게 더 효율적인 경우가 대부분이다.

Jest나 testing-library 같은 도구가 있으니까 써야 한다는 생각은 앞에서 말한 마검의 논리와 같다.

그러나 프론트엔드에서도 테스트 코드는 필요하다. 눈으로 확인하는 게 효율적이라면, 검증도 시각적으로 하는 것이 자연스럽다. 렌더링 결과를 스냅샷으로 저장하고, 이후 변경이 생기면 이전 스냅샷과 비교해서 의도한 변경인지 확인하는 방식이다.

다만 스냅샷 테스트를 효과적으로 하려면 뷰와 모델을 분리해야 한다. 뷰에 상태와 로직이 함께 있으면 "에러 상태일 때 화면이 어떻게 보이는가" 같은 다양한 흐름을 테스트하기 어렵다.

```tsx
// screen.tsx - 뷰만 담당한다. 로직은 useModel에 위임한다.
export function SignupStep1(P: Props) {
    const M = useModel(P)
    const S = useStyles()
    const T = useTexts()

    return (
        <View>
            <NavigationTitleBar onBackButton={M.goBack} title={T.title} />
            <EmailInput value={M.email} onChangeText={M.onEmailChanged} alerted={M.emailAlerted} />
            <Button title={T.continue} onPress={M.doContinue} disabled={!M.canContinue} />
        </View>
    )
}

// model.tsx - 상태와 로직을 담당한다.
export function useModel(P: Props) {
    const [email, setEmail] = React.useState('')
    const [policyAgreement, setPolicyAgreement] = React.useState(false)

    const emailAlerted = !isValidEmail(email)
    const canContinue = policyAgreement && isValidEmail(email)

    const doContinue = () => { P.navigation.navigate('SignupStep2', { email }) }
    const goBack = () => { P.navigation.navigate('Intro') }

    return { email, emailAlerted, canContinue, doContinue, goBack, onEmailChanged: setEmail }
}
```

뷰와 모델이 분리되어 있으면 모델을 mock해서 다양한 상태의 스냅샷을 테스트할 수 있다. 모델은 내가 만든 객체지만, 여기서 테스트 대상은 뷰 렌더링이고 모델은 그 경계 밖에 있으므로 mock해도 된다.

```tsx
// __tests__
jest.mock('../model', () => ({ useModel: () => mockModel }))

let mockModel: any
const mockProps = {} as any

describe('SignupStep1 screen', () => {
    function renderScreen(values: any) {
        mockModel = { emailAlerted: false, ...values }
        render(<SignupStep1 {...mockProps} />)
    }

    test('default states', async () => {
        renderScreen({})
        expect(screen.toJSON()).toMatchSnapshot()
    })

    test('error states', async () => {
        renderScreen({ emailAlerted: true })
        expect(screen.toJSON()).toMatchSnapshot()
    })
})
```

## 3. 결론

이번 글에서는 설계를 구현으로 옮기는 과정과 테스트 작성에 대해서 다뤘다.

bottom-up은 가장 구체적인 것(DB)부터 시작하기 때문에 쉽게 착수할 수 있지만, 함수마다 테스트를 작성하게 되고 인터페이스 변경이 테스트 수정의 연쇄를 일으킨다. top-down은 사용자의 요청(REST API)부터 시작하기 때문에 내부 구현이 바뀌어도 테스트는 그대로 유지된다. 개발하면서 자연스럽게 작성한 curl 명령이 그 자체로 테스트 코드이자 API 문서가 된다.

테스트도 마찬가지다. unit의 단위는 함수가 아니라 하나의 동작(behavior)이고, mock은 내가 만들지 않은 객체에만 쓰고, 프론트엔드는 시각적 결과물을 스냅샷으로 검증하는 것이 자연스럽다. 도구가 있으니까 써야 한다는 생각이 테스트를 마검으로 만든다.

결국 이번 시리즈에서 반복적으로 말하고 싶었던 것은 하나다. 분석, 설계, 구현, 테스트는 별개의 활동이 아니라 하나의 흐름이라는 것이다. 도메인 전문가와의 대화가 유스케이스가 되고, 유스케이스가 시퀀스 다이어그램이 되고, 시퀀스 다이어그램이 REST API가 되고, REST API가 테스트 코드가 되고, 테스트 코드가 구현을 이끈다. 이 흐름이 자연스러우면 TDD는 별도의 방법론이 아니라 개발 과정 그 자체가 된다.

> 소프트웨어 개발은 분석/설계/구현/검증이 물 흐르듯이 자연스럽게 흘러가야 한다.

---

이전 글: [백엔드 서비스 분석과 설계 (3.5)]({% post_url 3026-06-11-backend-design-3.5 %})
