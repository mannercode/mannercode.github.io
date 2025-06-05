---
layout: post
title:  백엔드 서비스 분석과 설계 (3)
---

우리는 지난 시간에 `Movie Booking System`의 유스케이스 다이어그램을 그렸다. 소프트웨어 분석/설계 과정에서 유스케이스 다이어그램을 그렸다면, 이는 성공적인 출발이라 할 수 있다.

이번 시간에는 여러 유스케이스 중에서 절차가 복잡해 보이는 두 유스케이스인 `CreateShowtimes`와 `PurchaseTickets`에 대해서 좀 더 분석해 보도록 하겠다.

{% plantuml %}
@startuml
Frontend -> Backend: 영화 목록 요청\nGET /showtime-creation/movies
    Backend -> ShowtimeCreationService: searchMovies()
        ShowtimeCreationService -> MoviesService: searchMovies()
    Backend <-- ShowtimeCreationService: movies[]
Frontend <-- Backend: movies[]

Frontend -> Backend: 극장 목록 요청\nGET /showtime-creation/theaters
    Backend -> ShowtimeCreationService: searchTheaters()
        ShowtimeCreationService -> TheatersService: searchTheaters()
    Backend <-- ShowtimeCreationService: theaters[]
Frontend <-- Backend: theaters[]

Frontend -> Backend: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
    note right
        SearchShowtimesDto {
            theaterIds,
        }
    end note
    Backend -> ShowtimeCreationService: searchShowtimes(searchDto)
        ShowtimeCreationService -> ShowtimesService: searchShowtimes(searchDto)
        ShowtimeCreationService <-- ShowtimesService: showtimes[]
    Backend <-- ShowtimeCreationService: showtimes[]
Frontend <-- Backend: showtimes[]

Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
    note right
        CreateShowtimesDto {
            movieId,
            theaterIds,
            startTimes,
            durationMinutes
        }
    end note
    Backend -> ShowtimeCreationService: createShowtimes(createDto)
        ShowtimeCreationService -> MoviesService: moviesExist(movieId)
        ShowtimeCreationService <-- MoviesService: true

        ShowtimeCreationService -> TheatersService: theatersExist(theaterIds)
        ShowtimeCreationService <-- TheatersService: true

        ShowtimeCreationService -> ShowtimesService: createShowtimes(createDto)
        ShowtimeCreationService <-- ShowtimesService: showtimes[]
    Backend <-- ShowtimeCreationService: showtimes[]
Frontend <-- Backend: Created(201)

@enduml
{% endplantuml %}

`/showtime-creation` 네임스페이스에 맞춰서 `ShowtimeCreationService` 서비스를 만들었다.
REST API와 서비스의 구조가 유사해지면서 구조 파악이 쉬워지는 장점까지 생겼다.

> 소프트웨어 개발은 분석/설계/구현/검증이 물 흐르듯이 자연스럽게 흘러가야 한다.
