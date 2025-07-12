---
layout: post
title: 백엔드 서비스 분석과 설계 (4)
---

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

그 현상은 **“Anemic Domain Model(빈약한 도메인 모델)”**이라고 부릅니다.
도메인 객체에 규칙과 행위가 거의 없고, 서비스(또는 트랜잭션 스크립트) 쪽으로 비즈니스 로직이 몰려가면서 모델이 단순 데이터 구조만 남는 상태를 가리키는 DDD 관점의 안티패턴입니다.

```
마틴 파울러가 **“Anemic Domain Model(ADM)”**을 처음 ‘안티패턴’으로 규정한 글(2003)에서 이미 이런 문장을 남겼습니다.

“많은 기술(특히 J2EE Entity Bean 같은 원격/분산 환경)이 도메인 객체 안에 행위를 두지 못하게 강요하면서 ADM이 더 흔해지고 있다.”
martinfowler.com
즉 **네트워크 경계가 전제로 되는 현대적 아키텍처(SOA·REST API·메시징 파이프라인 등)**는
“행위가 이동(serialize)하기 어렵다 → 객체는 DTO처럼 얇아진다 → 서비스 계층이나 트랜잭션 스크립트에 로직이 몰린다” 는 흐름을 ‘자연스레’ 만들 수 있다고 지적합니다. 위키피디아도 같은 대목을 인용하며, ADM이 서비스 지향 시스템에서 흔히 나타난다고 정리합니다.
```

내 생각에 ADM은 MSA에서 자연스럽다. 영화와 관련된 규칙을 Movie 엔티티나 Movie 서비스에 모두 몰아넣는게 좋은 구조일까? 규칙을 세분화 해서 각 서비스에서 처리하는 게 더 나은 구조일 것이다.

클래스 수준에서 올바른 구조를 추구하지 말고 서비스 레벨에서 올바른 구조를 생각하는게 좋다.

여기서는 최상위 아키텍처가 SoLA다. SoLA에서는 서비스를 하나의 클래스로 본다. 특별히 복잡한 도메인 규칙이 있다면 이 규칙을 담당하는 코어 서비스를 만들면 된다. 코어 서비스는 다른 서비스를 참조하지 않기 때문에 애플리케이션 서비스로 만들어야 할지도 모르겠다. 이건 특별한 도메인 규칙이 무엇인지에 따라 달라질 것 같다. 지금은 구체적인 예가 없기 때문에 확신할 수 없다.

그래도 아마 코어 서비스로 만들고 이벤트 기반으로 의존 역전을 구현하지 않을까 싶다. 서비스가 수백~수천개가 되는 상황이라면 이렇게 복잡성을 관리해야 할 것이다. Layered Arch에서 도메인 레이어와 유사하게 말이다.
