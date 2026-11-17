---
layout: post
title: Backend Service Analysis and Design (1)
lang: en
translation_key: backend-design-1
---

Software is complex, so it is important to build it on a systematic design. Whenever we start a project, we try to design it properly. Yet when we sit down to write a design document, expressing the ideas in our heads turns out to be harder than expected.

We study UML and draw sequence diagrams to overcome this difficulty, but the benefits of design can still be hard to see. It may feel little different from writing the code directly.

In this article, we will work through these difficulties by designing a movie booking system.

Although the main subject is software design, we will also cover test-driven development (TDD). Modern development environments generally provide testing tools, and well-known open-source projects have established testing infrastructure. This reflects how important and useful testing has become.

In practice, however, many projects lack even automated tests, let alone TDD. Writing meaningful tests first, without any preparation, is difficult: it requires the ability to design software as well. That is why I think it makes sense to discuss design and TDD together.

## 1. Defining the Goal

We begin with our first meeting with a domain expert. They tell us a great deal about the system we need to build. The main points are:

1. There are many theaters: about 4,000 across the country, with more potentially opening in the future.
2. The system currently supports movie bookings, but bookings for large live performances will be added later.
3. Seats must not be double-booked. This caused considerable trouble for customer support in the past.
4. Existing data must be retained. There is already a large collection of movie information, reviews, and other data.
5. There are various other difficulties they have encountered while operating the current system.

The domain expert has shared as much information as they consider important, but we need to clarify a few things as developers.

1. When will bookings for large live performances be added? Should they be included in this project's scope?
2. Does retaining existing data mean we cannot change the database system? Do other services use the database?

The domain expert replies:

1. There is no specific schedule for live performances yet. Still, it would be good to take them into account so that a future upgrade will be easier.
2. No other services use the database. The existing data simply needs to be preserved.

Through further conversations like this, we can organize the requirements as follows.

```txt
Top-priority requirements

1. Support at least 4,000 theaters
2. Prevent double-booking of seats
3. Migrate existing data
```

Live performances are left out of this document because they are outside the project's scope and their requirements are unclear. We do not know when they will be needed; we can revisit them when that happens.

We can start a project by interpreting and organizing the domain expert's information from a developer's perspective.

> Even if we leave live performances out of the document, we should not forget to tell the domain expert that we will take them into account.

## 2. Naming the Project

Once we have established the project's goals with the domain expert, it is time to give it a name.

We first ask for their opinion. They naturally suggest `영화 예매 시스템`, Korean for “Movie Booking System.”

{% plantuml %}
@startuml
left to right direction

package "영화 예매 시스템" {
    usecase " "
}
@enduml
{% endplantuml %}

To the domain expert, the Korean name may feel more familiar and clear. From a developer's perspective, however, terms—including the project's name—will appear directly in code. Defining them in English has several advantages.

We can explain this and propose the English name `Movie Booking System`.

{% plantuml %}
@startuml
left to right direction

package "Movie Booking System" {
    usecase " "
}
@enduml
{% endplantuml %}

If we have already reassured the domain expert that we will consider bookings for large live performances, they will probably accept the name `Movie Booking System` without hesitation.

> A particularly earnest developer might feel guilty about having no plans to address live performances now. There is no need to worry. If they were truly important, the domain expert would not have proposed “Movie Booking System” in the first place. They would probably have suggested “Ticket Booking System,” or simply “Booking System.” In this situation, we can treat live performances as a passing mention rather than a firm requirement.

## 3. Users

Now that we have named the project, we need to find out who uses the `Movie Booking System`.

The domain expert knows this, of course. We learn that there are two kinds of users: `customer` and `administrator`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator

package "Movie Booking System" as mbs {
    usecase " "
}

customer --> mbs
administrator --> mbs
@enduml
{% endplantuml %}

## 4. External Dependencies

External dependencies are easy to overlook early in design.

They might include a legacy system or a payment gateway. These dependencies can significantly affect the design of the entire system, so we should identify them clearly as early as possible.

Fortunately, components such as the `Payment Gateway` and `Legacy System` are already used by the existing system, making them relatively easy to identify.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as payment
rectangle "Legacy System" as legacy

package "Movie Booking System" as mbs {
    usecase " "
}

customer --> mbs
administrator --> mbs
mbs --> payment
mbs --> legacy
@enduml
{% endplantuml %}

Other aspects of the external environment are easier to miss. For example, if theaters across the country are in different time zones, the `Movie Booking System` will necessarily depend on the environmental factor `Time Zone`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as payment
rectangle "Legacy System" as legacy
rectangle "Time Zone" as timezone

package "Movie Booking System" as mbs {
    usecase " "
}

customer --> mbs
administrator --> mbs
mbs --> payment
mbs --> legacy
mbs --> timezone
@enduml
{% endplantuml %}

We may overlook such details unless we ask the domain expert directly. They may consider them so obvious that they do not mention them.

Some developers may find it unnatural to include `Time Zone` in a use case diagram. We do not need rigid rules for how UML must be used. If a representation makes the system's dependencies easy for everyone to understand, it is acceptable.

> A tool needs enough flexibility to give abstract ideas a concrete form.

Incidentally, the diagrams above are actually context diagrams. Focusing on terminology can distract us from the substance, so I will keep technical terminology to a minimum in the rest of the discussion.

## 5. Use Cases

By identifying the dependencies, we have established the rough scope of development. Now we can focus on what happens inside the `Movie Booking System`.

For convenience, we will hide the dependencies and leave only the users.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator

package "Movie Booking System" as mbs {
    usecase " "
}

customer --> mbs
administrator --> mbs
@enduml
{% endplantuml %}

What do the `customer` and `administrator` do in this system? Those activities are ultimately the capabilities it needs to provide.

### 5.1. Customer Use Cases

We ask the domain expert what the `customer` does in the `Movie Booking System`. They give us this list:

- Search for movies
- View movie details
- Select a showtime
- Select seats
- Book a movie
- View booking history
- Cancel a booking

We ask a few follow-up questions:

- Are selecting a showtime and selecting seats steps within booking a movie?
- Do booking a movie and canceling a booking ultimately mean buying tickets and getting refunds?

The domain expert confirms both. We can therefore organize the use cases as follows.

{% plantuml %}
@startuml
left to right direction
actor customer

package "Movie Booking System" as mbs {
    usecase "View movie details" as MovieDetails
    usecase "Search movies" as SearchMovies
    usecase "Purchase tickets" as PurchaseTickets
    usecase "Refund tickets" as RefundTickets
}

customer --> mbs
@enduml
{% endplantuml %}

We are not domain experts. How could we know to ask whether selecting a showtime and selecting seats are part of booking a movie?

For “select a showtime,” for example, we could ask:

1. What does selecting a showtime involve?
2. What needs to appear on the screen?
3. It sounds as though a movie must already be selected. What other preconditions are there?

Examining the actions exchanged with the user in each case helps us organize the use cases. We may need to repeat this process several times, depending on the project. Taking time to analyze it carefully reduces trial and error during design and implementation.

We have used a verbal discussion here, but we could also use other diagrams to organize the information. Choose the tools that suit the situation.

### 5.2. Administrator Use Cases

What does the `administrator` do? They manage things, naturally. But what do they manage?

1. Movies
2. Theaters
3. Customers
4. Tickets
5. Showtimes

{% plantuml %}
@startuml
left to right direction
actor administrator

package "Movie Booking System" as mbs {
    usecase MoviesManage
    usecase TheatersManage
    usecase CustomersManage
    usecase TicketsManage
    usecase ShowtimesManage
}

administrator --> mbs
@enduml
{% endplantuml %}

I am cautious about the word “manage” in software development. It is so broad that it leaves the actual work unclear. That is the problem here: we do not know what managing these things involves. Let us break it down with the domain expert.

{% plantuml %}
@startuml
left to right direction
actor administrator
rectangle "Payment Gateway" as PaymentGateway

package "Movie Booking System" as mbs {
    package theaters {
        usecase "Add theaters" as AddTheaters
    }

    package movies {
        usecase "Add movies" as AddMovies
    }

    package customers {
        usecase "Search customers" as SearchCustomers
    }

    package showtimes {
        usecase "Create showtimes" as CreateShowtimes
    }

    package tickets {
        usecase "Purchase tickets" as PurchaseTickets
        usecase "Refund tickets" as RefundTickets
        usecase "Generate tickets" as GenerateTickets
    }

    PurchaseTickets ..> PaymentGateway
    RefundTickets ..> PaymentGateway
    CreateShowtimes ..> GenerateTickets
}

administrator --> mbs
@enduml
{% endplantuml %}

A real project would have more use cases, but we have simplified them here. Even so, several important concepts have emerged.

Notice that creating a showtime also requires generating tickets. We have also identified that purchasing and refunding tickets require interaction with the `Payment Gateway`.

### 5.3. All Use Cases

Let us combine the use cases for the `customer` and `administrator`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as PaymentGateway

package "Movie Booking System" as mbs {
    package theaters {
        usecase "Add theaters" as AddTheaters
    }

    package movies {
        usecase "Add movies" as AddMovies
        usecase "View movie details" as MovieDetails
        usecase "Search movies" as SearchMovies
    }

    package customers {
        usecase "Search customers" as SearchCustomers
    }

    package showtimes {
        usecase "Create showtimes" as CreateShowtimes
    }

    package tickets {
        usecase "Purchase tickets" as PurchaseTickets
        usecase "Refund tickets" as RefundTickets
        usecase "Generate tickets" as GenerateTickets
    }
}

administrator --> AddTheaters
administrator --> AddMovies
administrator --> SearchCustomers
administrator --> CreateShowtimes
administrator --> PurchaseTickets
administrator --> RefundTickets

customer --> MovieDetails
customer --> SearchMovies
customer --> PurchaseTickets
customer --> RefundTickets

PurchaseTickets ..> PaymentGateway
RefundTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets

@enduml
{% endplantuml %}

Looking at them together, something seems to be missing. We have `AddTheaters`, but nothing like `SearchTheaters`. The same applies to customers. Would we not also need `RegisterCustomer` and `LoginCustomer`?

The omitted use cases are usually things everyone assumes must exist. The domain expert has a lot to explain and may skip these obvious cases. But what about the developer? Would leaving out simple use cases such as `SearchTheaters` make the documentation easier to maintain?

Since this article focuses on backend design, omitting a simple use case such as `SearchTheaters` would be reasonable. In a real project, however, these use cases all matter. They are particularly useful starting points for product planners, who can now consider what search criteria to offer and how users should search for theaters.

> Combining all the use cases makes the diagram complex. A real project's diagram would be much more complex. There is no need to force everything into one diagram. We combined them here to reveal the missing use cases.

Let us fill in the missing cases. For clarity, some relationships between actors and use cases are omitted.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as PaymentGateway

package "Movie Booking System" as mbs {
    package theaters {
        usecase "Add theaters" as AddTheaters
        usecase "Search theaters" as SearchTheaters
    }

    package movies {
        usecase "Add movies" as AddMovies
        usecase "View movie details" as MovieDetails
        usecase "Search movies" as SearchMovies
    }

    package customers {
        usecase "Search customers" as SearchCustomers
        usecase "Register customer" as RegisterCustomer
        usecase "Log in customer" as LoginCustomer

    }

    package showtimes {
        usecase "Create showtimes" as CreateShowtimes
        usecase "Search showtimes" as SearchShowtimes
    }

    package tickets {
        usecase "Purchase tickets" as PurchaseTickets
        usecase "Refund tickets" as RefundTickets
        usecase "Generate tickets" as GenerateTickets
        usecase "Search tickets" as SearchTickets
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

### 5.4. When There Are Many Use Cases

Our project is small, but in a large, complex project, the domain expert may struggle to know where to begin. In that situation, reconsider whether you have identified enough actors. We started with a single `administrator`, but that actor may be divisible into more specific roles. There may also be external services that use the `Movie Booking System`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor "Call Center Agent" as admin1
actor "Ticket Checker" as admin2
actor "Movie Statistics Service" as service
actor administrator as admin

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
admin1 --> mbs
admin2 --> mbs
service --> mbs
admin ..> admin1
admin ..> admin2
@enduml
{% endplantuml %}

Breaking actors down this way can help the domain expert provide information more systematically.

Of course, this is only one way to analyze a complex domain. There are many other useful approaches.

## 6. Conclusion

In this article, we used use case diagrams to establish a project's goals and carry out the initial analysis. I find starting the hardest part of the development process because it requires organizing the most abstract and ambiguous concepts.

In the next article, we will look at how to analyze the main use cases in greater detail.

Next: [Backend Service Analysis and Design (2)]({% post_url 2025-05-01-backend-design-2-en %})
