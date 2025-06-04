---
layout: post
title: Backend Service Design - Movie Booking System (1)
---

Software is complex, so it's crucial to implement it with a systematic design approach. That's why I try to create a proper design every time I start a new project. However, when I actually try to write a design document, expressing my ideas concretely is harder than I expected.

To overcome this difficulty, I learn UML and even draw sequence diagrams, but it's still hard to see the benefits of the design. It often feels no different from coding directly.

In this article, I intend to specifically address these concerns by actually designing a movie booking system.

While the main topic of this article is software design, I will also cover Test-Driven Development (TDD). Modern development environments inherently support testing tools, and even famous open-source projects have a certain level of testing infrastructure. This underscores how important and widespread testing has become.

However, in reality, many cases lack even proper test automation, let alone TDD. Writing meaningful tests first without any preparation is by no means easy, as it requires complementary software design capabilities. Therefore, I decided it would be more effective to discuss design and TDD together.

## 1. Setting Goals

We have our first meeting with a domain expert. The domain expert tells us a lot about the system we need to build. Summarizing the main points:

1. There are many theaters. About 4,000 nationwide. Of course, this number could increase in the future.
2. Currently, it only supports movie booking, but there are plans to add functionality for booking large-scale events in the future.
3. Seat reservations must not overlap. They had a lot of trouble with customer service because of this issue in the past.
4. Existing data must be maintained. There's a lot of accumulated data, like movie information and reviews.
5. Other inconveniences they’ve encountered while operating the current system...

The domain expert has conveyed as much information as they deem important, but from a developer's perspective, additional confirmation is needed.

1. When is the large-scale event booking feature scheduled to be added? Should it be included in the scope of this project?
2. Does maintaining existing data mean we can't change the DB system? Are there other services using the DB?

The domain expert responds:

1. There's no concrete schedule for large-scale events yet. However, it would be good to consider it to some extent in this project to facilitate future upgrades.
2. There are no other services using the DB. It's only necessary that the existing data is maintained.

By repeating such conversations, we can summarize the requirements as follows:

```txt
Top Priority Requirements

1. Support at least 4,000 theaters
2. Prevention of duplicate seat reservations is essential
3. Existing data migration is essential
```

The part about large-scale events was omitted from the document because it's not within the project scope and the requirements aren't clear. We don't know when it will be needed, so we can revisit it when the requirement becomes concrete.

Thus, we can start the project by interpreting and organizing the information provided by the domain expert from a developer's perspective.

> Even if not documented, don't forget to tell the domain expert that you will also carefully consider 'large-scale events'.

## 2. Choosing a Project Name

Once the project goals are somewhat established with the domain expert, it's time to choose a project name.

First, let's ask the domain expert for their opinion. The domain expert naturally suggests the name `영화 예매 시스템` (Movie Booking System).

{% plantuml %}
@startuml
left to right direction

package "영화 예매 시스템" {
usecase " "
}
@enduml
{% endplantuml %}

From the domain expert's point of view, the Korean name `영화 예매 시스템` might be more familiar and clear. However, from a developer's perspective, all terms, including the project name, are directly implemented in code, so defining them in English is advantageous in many ways.

Therefore, we can fully explain this point to the domain expert and suggest the name `Movie Booking System`.

{% plantuml %}
@startuml
left to right direction

package "Movie Booking System" {
usecase " "
}
@enduml
{% endplantuml %}

If we have already communicated well that we will also pay attention to the 'large-scale event booking' feature, the domain expert will readily accept the name `Movie Booking System`.

> Perhaps a developer with a pure and honest heart might feel guilty about the fact that they don't plan to worry about 'large-scale events'. But don't worry. If 'large-scale events' were really that important, the domain expert wouldn't have suggested 'Movie Booking System' as the project name in the first place. They probably would have suggested a name like 'Ticket Booking System' or a more generic 'Booking System'. So, in the current situation, the 'large-scale event' requirement can be taken as just a light mention.

## 3. Users

Once the project name is decided, it's time to find out who uses the `Movie Booking System`.

Of course, the domain expert will have this information, and so we learn about the existence of `customer` and `administrator`.

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

One element that is easy to miss in the early stages of design is external dependencies.

External dependencies could be existing legacy systems or payment gateways. Such dependencies can greatly influence the overall system design, so it's best to identify them clearly at an early stage if possible.

Fortunately, elements like `Payment Gateway` or `Legacy System` are already in use by the existing system, so they can be identified relatively easily.

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

Besides these, there are external environmental factors that are often overlooked. For example, if theaters distributed nationwide are located in different time zones, our `Movie Booking System` will naturally be affected by the environmental factor of `Time Zone`.

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

These elements are easy to miss if not directly asked of the domain expert. The domain expert might consider this part so obvious that they omit the explanation.

Depending on the developer, putting `Time Zone` in a use case diagram might feel unnatural. There's no need to strictly regulate how UML should be used. Any method that is easy for everyone to understand in expressing the dependencies of the system to be developed is perfectly acceptable.

> To express abstract thoughts in a physical form, the tool must be sufficiently flexible.

Note that the diagram above is actually a context diagram. Focusing too much on terminology itself seems to make it easy to neglect the essence. So, in the following explanations, I will try to minimize the use of technical terms.

## 5. Use Cases

Now that we have a rough idea of the development scope by specifying dependencies, let's focus on the internals of the `Movie Booking System`.

For convenience, let's hide the dependencies and leave only the users.

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

The question that arises here is what `customer` and `administrator` do in the `Movie Booking System`. After all, that will be the functionality the `Movie Booking System` needs to provide.

### 5.1. Customer's Use Cases

When we ask the domain expert what a `customer` does in the `Movie Booking System`, they tell us:

- Search for movies
- View movie details
- Choose a showtime
- Choose seats
- Book a movie
- Check booking details
- Cancel booking

We confirm with the domain expert:

- Are `Choose a showtime` and `Choose seats` part of the `Book a movie` process?
- Aren't `Book a movie` and `Cancel booking` ultimately about purchasing and refunding tickets?

The domain expert confirms that the developer's understanding is correct. So, we can organize the use cases as follows:

{% plantuml %}
@startuml
left to right direction
actor customer

package "Movie Booking System" as mbs {
usecase MovieDetails
usecase SearchMovies
usecase BuyTickets
usecase RefundTickets
}

customer --> mbs
@enduml
{% endplantuml %}

We are not domain experts. So how could we ask if `Choose a showtime` and `Choose seats` are part of the `Book a movie` process?

For example, regarding `Choose a showtime`, we can ask the domain expert:

1. What is "Choose a showtime"?
2. What should be on the screen?
3. It seems like a movie needs to be selected; are there any other preconditions?

Documenting the user interaction for each case like this helps clarify the process. Depending on the project situation, this process might be repeated several times, but the more patiently and meticulously you analyze, the fewer trial-and-error instances you'll have in the design and implementation phases.

Right now, we've had a verbal Q&A, but there might be ways to organize it using other diagrams. You can use tools appropriate for the situation.

### 5.2. Administrator's Use Cases

What does an administrator do? As administrators, their primary role is management—but exactly what do they manage?

1. Manage movies
2. Manage theaters
3. Manage customers
4. Manage tickets
5. Manage showtimes

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

Personally, I tend to be cautious with the word "Manage" in development. "Manage" is too broad an expression, making it ambiguous what tasks are involved. It's the same here; it's unclear how things are specifically managed. Let's break it down further with the domain expert.

{% plantuml %}
@startuml
left to right direction
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
package theaters {
usecase AddTheaters
}

package movies {
    usecase AddMovies
}

package customers {
    usecase SearchCustomers
}

package showtimes {
    usecase CreateShowtimes
}

package tickets {
    usecase PurchaseTickets
    usecase RefundTickets
    usecase GenerateTickets
}

PurchaseTickets --> PaymentGateway
RefundTickets --> PaymentGateway
CreateShowtimes ..> GenerateTickets
}

administrator --> mbs
@enduml
{% endplantuml %}

In a real project, there would be many more use cases than this, but it's simplified here. Nevertheless, a significant number of important concepts are revealed.

What's noteworthy here is that we can see that when a showtime is created, tickets must also be generated. And it's mentioned that interaction with the `PaymentGateway` is needed when purchasing or refunding tickets.

### 5.3. Overall Use Cases

Let's combine the use cases for `customer` and `administrator`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
package theaters {
usecase AddTheaters
}

package movies {
    usecase AddMovies
usecase MovieDetails
usecase SearchMovies
}

package customers {
    usecase SearchCustomers
}

package showtimes {
    usecase CreateShowtimes
}

package tickets {
    usecase PurchaseTickets
    usecase RefundTickets
    usecase GenerateTickets
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

Looking at the overall use cases like this, something feels missing. There's `AddTheaters`, but something like `SearchTheaters` isn't visible. The same goes for `customers`. Wouldn't `RegisterCustomer` or `LoginCustomer` also be necessary?

Omitted use cases are usually things that should obviously be there. From the domain expert's perspective, since there's a lot to explain, they might try to omit such obvious use cases. Then, what about from the developer's perspective? Wouldn't omitting simple use cases like `SearchTheaters` be more helpful for document management?

This article mainly focuses on backend design, so it might be okay to omit simple use cases like `SearchTheaters`. However, in a real project, all such use cases are important. Especially from a planner's perspective, such use cases serve as a good starting point. Now the planner can think about under what conditions and how users should be able to search for theaters.

> Combining all use cases like this makes it complex. A real project would have been much more complex. In such cases, there's no need to force a combination. Here, I combined them to show that there are missing use cases.

Let's fill in all the missing use cases. For convenience, some actor-use case relationships are omitted.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
package theaters {
usecase AddTheaters
usecase SearchTheaters
}

package movies {
    usecase AddMovies
    usecase MovieDetails
    usecase SearchMovies
}

package customers {
    usecase SearchCustomers
    usecase RegisterCustomer
    usecase LoginCustomer

}

package showtimes {
    usecase CreateShowtimes
    usecase SearchShowtimes
}

package tickets {
    usecase PurchaseTickets
    usecase RefundTickets
    usecase GenerateTickets
    usecase SearchTickets
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

### 5.4. If There Are Many Use Cases

It's fine now because it's a small project, but if the project is large and complex, the domain expert might be at a loss as to where to begin their explanation.
In such cases, let's re-examine if we had enough actors. Initially, we said `administrator`, but perhaps it can be subdivided by role. And there might be external services that use the `Movie Booking System`.

{% plantuml %}
@startuml
left to right direction
actor customer
actor "Call Center Agent" as admin1
actor "Ticket Checker" as admin2
actor "Movie Statistics Service" as service

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

By subdividing actors like this, the domain expert can then provide information in a more structured way.

Of course, this is just one example of analyzing a complex domain. There could be many other good methods.

## 6. Conclusion

In this article, we used use-case diagrams to establish project goals and carry out the initial analysis. Personally, I think the beginning is the most difficult part of the entire development process. This is because it requires organizing the most abstract and ambiguous concepts.

In the next article, we will explore how to analyze the main use cases derived here in greater detail.
