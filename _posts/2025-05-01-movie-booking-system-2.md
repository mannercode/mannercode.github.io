---
layout: post
title:  소프트웨어 설계 - 영화 예매 시스템#2
---

우리는 지난 시간에 `Movie Booking System`의 유스케이스 다이어그램을 그렸다. 소프트웨어 분석/설계 과정에서 유스케이스 다이어그램을 그렸다면, 이는 성공적인 출발이라 할 수 있다.

이번 시간에는 여러 유스케이스 중에서 절차가 복잡해 보이는 두 유스케이스인 `PurchaseTickets`와 `CreateShowtimes`에 대해서 좀 더 분석해 보도록 하겠다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
    package tickets {
        usecase PurchaseTickets #yellow
        usecase GenerateTickets
    }

    package showtimes {
        usecase CreateShowtimes #yellow
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

## 1. 어떤 유스케이스를 먼저 분석할까?

`CreateShowtimes`와 `PurchaseTickets` 중 어떤 것을 먼저 분석하는 것이 좋을까? 나는 보통 정보를 **생성하는** 유스케이스부터 시작하는 편이다.
조회 관련 유스케이스는 전제 조건이 되는 데이터가 필요하지만, 생성을 하지 않으면 그게 무엇인지 파악하기 어렵기 때문이다.

여기서는 티켓을 생성해야 티켓을 구매할 수 있기 때문에 `CreateShowtimes` 유스케이스를 먼저 분석해 본다.

## 2. `CreateShowtimes` 유스케이스 명세서

우리는 도메인 전문가에게 상영시간을 생성하려면 어떤 절차가 필요한지 물어본 뒤, 아래와 같이 정리한다.

**목표**: 하나의 영화를 여러 극장에 상영시간 등록하기

**액터**: Admin

**선행 조건**:

- 관리자는 시스템에 로그인해야 합니다.
- 영화와 극장은 시스템에 등록되어 있어야 합니다.

**트리거**:

- 관리자가 영화 상영시간 생성 페이지를 방문합니다.

**기본 흐름**:

1. 시스템은 현재 등록된 영화 목록을 보여줍니다.
2. 관리자는 상영시간을 등록하려는 영화를 선택합니다.
3. 시스템은 현재 등록된 극장 목록을 보여줍니다.
4. 관리자는 상영시간을 등록하려는 극장들을 선택합니다.
5. 관리자는 각 극장에 대한 상영시간을 입력합니다.
6. 관리자는 상영시간을 등록합니다.
7. 시스템은 등록한 상영시간이 기존의 상영시간과 겹치는지 검사합니다.
8. 만약 겹치지 않는다면, 시스템은 상영시간을 등록하고, 상영시간 등록이 완료되었다는 메시지를 보여줍니다.

**대안 흐름**:

- 만약 상영시간이 기존의 상영시간과 겹친다면
    1. 시스템은 상영시간 등록에 실패했다는 메시지와 함께 어떤 상영시간이 겹쳤는지 정보를 보여줍니다.
    2. 기본 흐름 5단계로 돌아갑니다.

**사후 조건**:

- 선택한 극장에서 선택한 영화의 상영시간이 성공적으로 등록되어야 합니다.
- 상영시간에 해당하는 티켓이 생성되어야 한다.

CreateShowtimes의 시작 조건인 `트리거`를 정의하고, 그에 따른 `기본 흐름`을 정리했다. 그 외에 `대안 흐름`과 `사후 조건` 등을 보면 `Movie Booking System`에서 무슨 일을 해야 할지 가늠할 수 있다.

## 3. `CreateShowtimes` 시퀀스 다이어그램

유스케이스 명세서를 좀 더 읽기 쉽게 시퀀스 다이어그램으로 그려보자.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs: 상영시간 생성 페이지를 방문
Admin <-- mbs: 영화 목록 제공

Admin -> mbs: 영화 선택
Admin <-- mbs: 극장 목록 제공

Admin -> mbs: 극장 선택
Admin <-- mbs: 상영시간 목록 제공

Admin -> mbs: 상영시간 선택

Admin -> mbs: 상영시간 등록 요청
Admin <-- mbs: 상영시간 등록 성공 화면

@enduml
{% endplantuml %}

위의 시퀀스 다이어그램을 보면 `트리거`, `기본 흐름`, `사후 조건`에 대한 내용을 담고있고 `대안 흐름`은 빠져있다. `대안 흐름`은 내용이 간단하기 때문에 구현 단계에서 처리해도 충분하다고 판단했다.

> 설계는 구현을 하기에 충분한 정도의 정보를 담고 있으면 된다. 여기서 **충분하다**는 표현은 다소 모호할 수 있는데, 이는 팀의 상황에 따라 달라진다. 개발자의 실력이 높다면 설계를 간단하게 해도 충분할 것이다. 설계자와 구현자가 멀리 떨어져 있어서 긴밀한 커뮤니케이션이 어렵다면 설계를 좀 더 꼼꼼하게 해야 할 것이다.

만약 `대안 흐름`을 시퀀스 다이어그램에 표현하려고 한다면 아래처럼 `조건식`을 떠올릴지도 모르겠다.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

alt successful
    Admin -> mbs: 상영시간 등록 성공
else failure
    Admin -> mbs: 상영시간 등록 실패
end
@enduml
{% endplantuml %}

그러나 시퀀스 다이어그램에서 `조건식`을 사용하는 것보다는, `대안 흐름`을 별도의 다이어그램으로 분리하는 것이 좋다. `조건식`은 다이어그램을 복잡하게 만들고, 설계를 점차 구현 수준으로 끌어내리는 경향이 있기 때문이다.

## 4. REST API 설계

만약 화면 기획자나 디자이너라면 `CreateShowtimes` 시퀀스 다이어그램을 더 확장할 필요는 없을 것이다. 그러나 우리는 백엔드를 대상으로 하고 있으니까 시퀀스 다이어그램을 확장해서 REST API 설계를 해보자.

### 4.1. Shallow Routing

{% plantuml %}
@startuml
actor Admin
Admin -> Frontend: 상영시간 생성 페이지를 방문
    Frontend -> Backend:영화 목록 요청\nGET /movies?orderby=releaseDate:desc
    Frontend <-- Backend: movies[]
Admin <-- Frontend: 영화 목록 제공

Admin -> Frontend: 영화 선택
    Frontend -> Backend:극장 목록 요청\nGET /theaters?orderby=name:asc
    Frontend <-- Backend: theaters[]
Admin <-- Frontend: 극장 목록 제공

Admin -> Frontend: 극장 선택
    Frontend -> Backend: 상영시간 목록 요청\nGET /showtimes?theaterIds=[]
    Frontend <-- Backend: showtimes[]
Admin <-- Frontend: 상영시간 목록 제공

Admin -> Frontend: 상영시간 선택

Admin -> Frontend: 상영시간 등록 요청
    Frontend -> Backend: 상영시간 생성 요청\nPOST /showtimes
        note right
        ShowtimesCreateDto {
            movieId,
            theaterIds,
            startTimes,
            durationMinutes
        }
        end note
    Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 등록성공 화면

@enduml
{% endplantuml %}

이것은 경로를 짧게 가져가는 전형적인 Shallow Routing 설계로, URI를 짧고 평탄하게 유지해 주면서 서비스 진화·운용 부담을 덜어 주는 실용적 선택이다.

### 4.2. Namespace 추가

Shallow Routing 방식은 몇 가지 단점이 있다. 현재는 프로젝트 초기 단계이기 때문에 요청이 간단하지만 프로젝트가 진행되고 요구사항이 구체화될수록 API는 계속 변경될 것이다. 예를 들면 이렇게 말이다.

```sh
GET /movies?orderby=releaseDate:desc&includes=showtime-summary
GET /theaters?orderby=name:asc&includes=showtime-count
```

API의 조건이 복잡해질수록 이것을 처리해야 하는 백엔드의 구현 부담이 증가한다. API를 사용하는 프론트엔드도 API 스펙을 파악하고 구현해야 하는 부담이 생긴다.

소프트웨어 개발은 요구사항이 계속 변경되기 때문에 유연성을 중요시 한다. 그러나 API에서 유연성을 제공한다는 것은 그 만큼 사용과 구현이 어려워 진다는 뜻이다.

불특정 다수를 대상으로 하는 서비스라면 유연성을 높여서 구체적인 구현을 사용자(여기서는 프론트엔드)에게 맡기는 것이 옳은 선택일 것이다. 그러나 지금은 `상영시간 생성`이라는 명확한 목적을 가진 요청이라는 것을 알고있는 상황이다. 그렇다면 API도 이 상황을 잘 나타낼 수 있게 정의하는 것이 합리적일 것이다.

```sh
GET /showtime-creation/movies
GET /showtime-creation/theaters
```

이렇게 정의하면 이제 `상영시간 생성`의 요구사항이 크게 변경되지 않는 한 API를 변경할 필요는 없을 것이다.

변경된 API를 반영해서 시퀀스 다이어그램을 다시 그려보자.

{% plantuml %}
@startuml
actor Admin
Admin -> Frontend: 상영시간 생성 페이지를 방문
    Frontend -> Backend:영화 목록 요청\nGET /showtime-creation/movies
    Frontend <-- Backend: movies[]
Admin <-- Frontend: 영화 목록 제공

Admin -> Frontend: 영화 선택
    Frontend -> Backend:극장 목록 요청\nGET /showtime-creation/theaters
    Frontend <-- Backend: theaters[]
Admin <-- Frontend: 극장 목록 제공

Admin -> Frontend: 극장 선택
    Frontend -> Backend: 상영시간 목록 요청\nGET /showtime-creation/showtimes?theaterIds=[]
    Frontend <-- Backend: showtimes[]
Admin <-- Frontend: 상영시간 목록 제공

Admin -> Frontend: 상영시간 선택

Admin -> Frontend: 상영시간 등록 요청
    Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
        note right
        ShowtimesCreateDto {
            movieId,
            theaterIds,
            startTimes,
            durationMinutes
        }
        end note
    Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 등록성공 화면

@enduml
{% endplantuml %}

이런 방식을 누군가는 컨텍스트 컨트롤러 패턴이라고 부르는 것 같기는 한데 표준으로 정해진 이름은 없는 것 같다. 이런 방식에 패턴이라는 이름까지 붙여야 하나 싶은 생각이 있어서 여기서는 그냥 `네임스페이스`라고 정의한다.

### 4.3. 긴 query API
