---
layout: post
title: 백엔드 서비스 분석과 설계 (4)
---

지난 시간에 `상영시간 생성하기`의 설계를 완료했다.

이번 시간에는 이 설계를 바탕으로 구현을 해보자.

## 1. 설계에서 구현으로

지난 시간에 설계한 서비스는 아래와 같다. 이 중에서 무엇부터 구현하면 좋을까?

{% plantuml %}
@startuml
package "Application Services" {
    class ShowtimeCreationService{
        searchMovies()
        searchTheaters()
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

`Application Services`에 있는 `ShowtimeCreationService`를 구현하려면 `Core Services`가 준비돼야 한다. `Core Services`를 mock으로 만들어서 구현하는 방법도 있지만 그것은 `Core Services`를 다른 개발자나 팀이 개발하는 경우에 유용한다. 여기서는 모든 서비스를 한 명의 개발자가 개발한다고 가정한다.

지금까지 설계에서 `Core Services`는 다른 서비스를 참조하지 않기 때문에 제일 먼저 구현하기 좋을 것 같다.

그렇다면 4개의 서비스(`MoviesService`, `TheatersService`, `ShowtimesService`, `TicketsService`)  중에서 무엇부터 구현하면 좋을까?

{% plantuml %}
@startuml
class Movie {
    id: ObjectId
}

class Theater {
    id: ObjectId
}

class Showtime {
    id: ObjectId
    theaterId: ObjectId
    movieId: ObjectId
}

class Ticket {
    id: ObjectId
    showtimeId: ObjectId
    theaterId: ObjectId
    movieId: ObjectId
}

Ticket --> Showtime
Ticket --> Movie
Ticket --> Theater
Showtime --> Movie
Showtime --> Theater
@enduml
{% endplantuml %}

엔티티의 관계를 보면 `Movie`와 `Theater` 엔티티가 독립적이어서 제일 먼저 구현하면 좋을 것 같다.

그러면 `Movie`와 `Theater` 중에서 비교적 구조가 단순한 `Movie`부터 구현해 보자.

## 2. `MoviesService`의 설계

### 2.1. 서비스의 아키텍쳐

우리가 최상위 아키텍쳐로 마이크로서비스 아키텍쳐를 선택했듯이 하나의 서비스를 구현하기 위한 아키텍쳐를 선택해야 한다.

물론, 고민할 것도 없이 레이어 아키텍쳐(Layered Architecture)를 사용하도록 한다.

![layered arch.](/assets/images/layered-arch.png)

이 그림은 DDD에서의 레이어 아키텍처인데 `Domain Model Layer`를 중심으로 구성되는 것을 볼 수 있다.

그러나 이런 도메인 중심 구조는 많은 추가 작업이 필요하기 때문에 도메인이 복잡한 경우에 고려할 만 하다.

이 프로젝트에서는 이 정도로 복잡한 도메인은 다루지 않기 때문에 위와 같은 도메인 중심 구조의 설계는 없을 것 같다.

### 2.2 `MoviesService` 패키지의 구성

레이어 아키텍쳐 이용해서 `MoviesService`를 설계하면 아래처럼 된다.

{% plantuml %}
@startuml
class MoviesController {
    searchMovies(query)
    moviesExist(movieIds)
}
note right of MoviesController
외부 호출 인터페이스- REST API 또는 RPC 엔드포인트
end note

class MoviesService {
    searchMovies(query)
    moviesExist(movieIds)
}
note right of MoviesService
애플리케이션 계층 – 트랜잭션·오케스트레이션 담당
end note

class MoviesRepository {
}
note right of MoviesRepository
인프라스트럭처 계층 – 데이터베이스 접근 및 CRUD 수행
end note

class Movie {
    id: ObjectId
    ...
}
note right of Movie
도메인 계층 – 도메인의 핵심 비즈니스 규칙 보유
end note

MoviesController --> MoviesService
MoviesService    --> MoviesRepository
MoviesService    --> Movie
Movie <-- MoviesRepository
@enduml
{% endplantuml %}

DDD에서는 `Movie` 객체에 비즈니스 로직을 구현하는 것을 권장하고 있다.

그러나 이 프로젝트에서는 `Movie`와 같은 도메인 객체에 규칙이나 행위는 정의하지 않고 단순 데이터만 남기게 될 것이다.

이것은 DDD에서 `Anemic Domain Model(빈약한 도메인 모델)`'이라 부르는 안티패턴이지만, MSA에서는 어쩔 수 없는 흐름인 듯하다.

이에 대한 자세한 설명은 다음 시간에 다루겠다.

## 3. `MoviesService`의 구현

`MoviesService`를 구현하기에 충분한 설계가 갖춰졌으니 본격적으로 구현을 시작해 보자.

### 3.1. 전통적인 구현 방법

가장 먼저 `MoviesController`를 구현해야 한다. 그래야 실행을 하고 테스트를 해볼 수 있으니까 말이다.

```ts
@Controller('movies')
class MoviesController {
    @Post()
    createMovie(@Body() createDto: CreateMovieDto) {
        return { message: 'ok' }
    }
}
```

이제 각자의 방법으로 실행을 하고 결과를 확인해 보자. 여기서는 curl을 사용한다.

```sh
curl -X POST http://localhost:3000/movies \
    -H "Content-Type: application/json" \
    -d '{"name":"John","age":30}'
```

curl을 실행하니 `MoviesController.createMovie()`에서 반환하는 값이 정상적으로 출력된다. 성공이다!

```sh
{ message: 'ok' }
```

사실 `MoviesController.createMovie()`는 curl이 잘 동작하는지 테스트하기 위해서 더미 데이터를 반환하고 있다.

실제로 구현은 아래와 같다.

```ts
@Controller('movies')
class MoviesController {
    @Post()
    createMovie(@Body() createDto: CreateMovieDto) {
        return this.service.createMovie(createDto)
    }
}

class MoviesService {
    createMovie(createDto: CreateMovieDto) {
        const movie = this.repository.createMovie(createDto)
        return movie
    }
}

class MoviesRepository {
    createMovie(createDto: CreateMovieDto) {
        const movie = this.newDocument()
        movie.title = createDto.title
        movie.durationInSeconds = createDto.durationInSeconds

        return movie.save()
    }
}

```

curl에서 보낼 데이터도 정확하게 다시 만들어서 실행을 해보자.

```sh
curl -X POST http://localhost:3000/movies \
    -H "Content-Type: application/json" \
    -d '{"title":"movie title", "durationInSeconds": 720}'
```

curl을 실행하니 생성된 Movie 엔티티를 정상적으로 반환하고 있다.

```sh
{"id": "1234", "title":"movie title", "durationInSeconds": 720}
```

### 3.2. 테스트 자동화

테스트를 먼저 작성하는 방법 소개

```
TDD가 설계를 유도하기도 한다는 양방향 관계를 짚어 주면 표현이 더 균형 잡힙니다.
Repository는 이렇게 설계한다.
```

탑다운으로 구현하기 때문에 자연스럽게 설계를 병행하게 된다.
바텀업은 설계가 완료되어 있어야 한다. 즉, 구현해야 하는 인터페이스가 정해져야 한다.

### 3.3. 테스트 작성하기

CRUD의 단순 테스트다. 탑다운으로 일단 컨트롤러에 더미 데이터를 넣는다. 그리고 케이스를 늘려가며 컨트롤러 구현한다.

### 3.3. 레이어 테스트

레이어 테스트에 대한 제로스(?)의 문서 소개. mock은 팀 단위로 나뉠 때 유용. 그러나 mock은 테스트를 위해 코드를 작성해야 하니까 가급적 지양. 테스트가 깨지기 쉽다.

### 3.4. 프론트엔드에서 테스트

설계를 하고 인터페이스를 정의했기 때문에 TDD가 가능한 것이다. 프론트엔드는 검증을 눈으로 해야 한다. 검증을 코드로 한다는 것은 청소하기 위해서 쓰레기를 만드는 것과 비슷한 행위다.

물론 예외가 있을 수 있다. 그러나 적어도 GUI를 대상으로 TDD를 하는 것은 정교한 노가다라고 부를 수 있다.

```
프론트엔드에서도 TDD는 ‘가능’하기보다 ‘필요’해질 때가 많다. 인터페이스가 먼저 정의돼 있으면 테스트 대상이 명확해지고, 반대로 테스트 작성 과정을 통해 인터페이스가 더욱 정제되기도 한다.
다만 GUI 컴포넌트는 궁극적으로 사람이 눈으로 확인해야 할 영역이므로, 테스트 코드만으로 모든 품질을 담보하기는 어렵다. 지나치게 세밀한 DOM 스냅샷이나 픽셀 단위 비교는 개발 속도를 오히려 늦추고, 유지보수 비용을 키울 위험이 있다.
따라서 프론트엔드 테스트 전략은
로직·상태 관리는 단위 테스트(Jest 등)로,
사용자 흐름은 E2E 테스트(Cypress, Playwright 등)로,
시각 변화는 시각 회귀 도구(Chromatic, Percy 등)로
각각 필요 최소한을 확보하는 방향이 바람직하다.
이러한 균형을 맞추지 못하면, 테스트 코드가 “청소하려고 만든 쓰레기”가 되어 버릴 수 있다.
```

프론트엔드에서 TDD로 어떤 이득이 있는가? 난 모르겠다.
