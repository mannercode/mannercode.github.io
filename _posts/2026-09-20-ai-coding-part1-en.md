---
layout: post
title: "Understanding AI Coding (1): How AI Changed the Development Environment"
lang: en
description: "From rescuing a legacy system to solo development with AI and a nondeveloper CEO taking the lead: eight months of experience with verification, collaboration, and the developer's role."
modified_date: 2026-11-18
translation_key: ai-coding-part1
---

## Introduction

I want to begin this discussion of AI coding with eight months of project experience. I worked on rescuing a legacy system, developing several applications on my own with AI, and eventually working on a project where the CEO used AI to lead development. Along the way, the division of work, decision-making process, and my role as a developer changed several times. Who implemented, who decided, and who verified the results changed too.

Given how quickly AI changes, I should mention that the models I used during this period ranged from Opus 4.6 to 5.0.

In this article, I distinguish two ways of coding:

- **Manual coding**: developers write and modify the implementation themselves.
- **AI coding**: people describe requirements and delegate writing and modifying code to AI.

Part 1 looks back at the positions each participant, including me, worked from and what we experienced with AI coding. [Part 2]({% post_url 2026-11-18-ai-coding-part2-en %}) draws on that experience to discuss the difficulties of AI coding and strategies for development.

## 1. Joining the Development Team

### 1.1. The Situation When I Joined

I joined a team developing a ticketing service for exhibitions and events. Before hiring a development team lead, the CEO had commissioned agencies and freelancers, but neither arrangement had led to a launch. Eight years of spending had produced no released service.

There were four weeks left before delivery to an art museum and the start of production use. Delivery had already been postponed several times. Missing the deadline again could cost the company an important contract.

From our first meeting, I could tell that the CEO was under considerable pressure. His distrust extended beyond the team lead to developers in general.

### 1.2. Basic Failures Appeared as Soon as I Ran It

The CEO said development was almost finished.

For some reason, hearing “almost finished” always makes me feel discouraged. Despite that claim, meetings still began by trying to establish what was done and what was not.

I ran the existing system (`legacy`) myself to assess its progress. As expected, even basic functionality such as authentication immediately failed.

Work had been done, but it had not been done properly. It was like a house supposedly nearing completion with water still leaking through the ceiling.

<figure>
  <video controls muted playsinline preload="none" width="960" height="540" style="width:100%;height:auto;aspect-ratio:16/9;background:#111;" aria-label="Silent video showing water leaks and construction defects" aria-describedby="leaking-house-caption">
    <source src="{{ '/assets/aicode/part1/leaking-house-defects.mp4' | relative_url }}" type="video/mp4">
    <a href="{{ '/assets/aicode/part1/leaking-house-defects.mp4' | relative_url }}">Watch the construction defects video</a>
  </video>
  <figcaption id="leaking-house-caption">A compilation of water leaks and unfinished construction. Silent, approximately 1 minute 7 seconds. <a href="https://www.youtube.com/watch?v=_HjdVs9gjX4&amp;t=164s">Original video</a></figcaption>
</figure>

The system was also far too complex for the size of the team. One lead and two developers were building all eight applications and servers shown below.

<div style="max-width:100%;overflow-x:auto;" role="region" aria-label="Legacy system architecture" tabindex="0" markdown="1">

{% plantuml %}
@startuml
left to right direction
skinparam componentStyle rectangle
skinparam shadowing false

package "Five user apps and dedicated terminals" {
    component "iOS user app\n(Native iOS)" as UserAppIOS
    component "Android user app\n(Native Android)" as UserAppAndroid
    component "Admission kiosk\n(Native iOS)" as EntranceKiosk
    component "POS\n(Native Android)" as Pos
    component "Ticketing kiosk\n(Android WebView)" as TicketKiosk
}

package "Three server applications" {
    component "Service backend\n(Java)" as Backend
    component "Ticketing page server\n(JSP)" as TicketServer
    component "Back office\n(JSP)" as Backoffice
}

database "Shared database" as Database

UserAppIOS --> Backend : REST API
UserAppAndroid --> Backend : REST API
EntranceKiosk --> Backend : REST API
Pos --> Backend : REST API
TicketKiosk --> TicketServer : Display web pages

Backend --> Database
TicketServer --> Database : Direct access
Backoffice --> Database : Direct access
@enduml
{% endplantuml %}

</div>

When I first analyzed it, the legacy system was not a monorepo. Including the database, it had nine repositories.

The technologies were too fragmented for the team size and launch schedule. The same user-app features had to be implemented separately for iOS and Android, and the dedicated terminals were also split between the two platforms. The service backend, ticketing page server, and back office each accessed the same database directly. Changing one feature required checking several applications and data flows. Three people had to finish and operate all these products, built with different technologies, at the same time.

We also needed to prepare for launch while handling a handover. The team lead was about to leave, and the two developers divided responsibility for the backend, several mobile apps, and kiosks.

The existing system already had many screens and APIs. Some features worked, but they were not connected into an end-to-end user experience. The kiosks and point-of-sale system were closer to prototypes than products ready for production.

The CEO thought the project was in its final stages. I saw several prototypes that still needed to be connected into a single service. We could not discard everything and start over, nor could we fix every structural problem in the four weeks remaining.

### 1.3. My First Conversation with the Team Lead

The CEO also complained that the team lead did not use AI coding. He said the lead did not trust AI-generated code and did not consider it proper development. I could understand those concerns about AI coding.

On my first day, I asked the team lead to introduce the project. He replied that this was not a developer's job. When I asked for other explanations, he repeatedly told me to ask the CEO. I concluded that continuing the conversation would be difficult and stopped.

When the CEO returned after briefly stepping out, the team lead went into a meeting room with him. A little later, the CEO called me in.

He said the lead had spoken very negatively about me: I was a developer who did not even know Java, and the CEO should think carefully about hiring me. The CEO asked whether there really was a problem and whether I could use Java.

I did not want to answer. It was frustrating that the CEO, who had just been criticizing the lead, now doubted my ability based on what the lead said. He seemed unable to trust anyone and lacked a basis for deciding whom to trust.

I referred to the saying, “Do not employ someone you distrust; once you employ them, do not distrust them.” I also asked how we could work together if a single remark could shake his confidence so easily.

He asked again whether I could use Java. I said that I could adapt quickly to unfamiliar technologies and that my résumé showed what I had worked on and which technologies I had used.

Building trust seemed essential if we were to recover the project.

## 2. AI Changed How We Developed

### 2.1. Analyzing the Existing System with AI

On the evening of my first day, I began investigating the existing system (`legacy`) with AI.

First, I had it list the implemented REST APIs and group them by function. I asked it to analyze each API's role and trace the relevant code to clarify request arguments I did not understand. By connecting database tables, APIs, and the applications that called them, I mapped the implemented functionality and missing flows.

It took one day to understand the system's overall functionality. Based on my experience, doing the same work by opening files one at a time would probably have taken about a week.

The analysis was not entirely accurate, of course. As development progressed, I found that some APIs listed as implemented had actually been abandoned partway through. In other cases, AI had inferred the wrong purpose from an API's name.

The investigation showed that the backend contained a great deal of functionality. However, table names, field names, and API names did not clearly convey responsibilities or relationships, and similar data was handled differently across APIs. Some requests used additional encryption and decryption, but the criteria for applying it were inconsistent. Even when an individual API worked, the structure made integration with other applications and tracing errors difficult.

Once the initial analysis was complete, I began defining the minimum requirements.

When I asked the CEO which features were essential, he mixed immediate needs with things that might be needed someday. Peer-to-peer ticket trading, for example, was described as essential, yet it was nowhere to be found when I wrote this eight months later.

Time was limited. Opus 4.6 had just been released, and until then I had not believed AI could take the lead in coding. I repeatedly cut back features labeled essential, but even after reducing the scope, I thought we could barely implement it within four weeks.

### 2.2. Rebuilding the Back Office

The first part I worked on was the existing system's back office. The team lead had been building it with JSP, but even the basic functionality was unfinished. I would rebuild the UI in Next.js, while a team member would create new backend APIs.

The last time I had manually coded a back office was two years earlier, also with Next.js. To save time, I had bought a paid React template, learned its structure, and adapted it to the screens we needed. At the time, that had been quite efficient.

This time, I told AI which menus we needed and supplied a document describing the REST API requests and responses. It quickly built the back office's basic structure and main screens from that material.

The schedule was too tight to spend much time on visual polish, but the result already looked good enough that we did not need a paid template.

At least for this back office's screens and basic structure, clearly communicating the requirements led to a quick implementation.

### 2.3. Giving the Backend Developer the Back Office Too

Back-office development went smoothly—until we connected the backend APIs.

The backend developer had three years of experience. I thought he had implemented previous requirements reasonably well, so I expected him to handle these APIs without difficulty. But APIs he reported as complete did not work when called. After he said they were fixed, I would find another error or omission. This happened three times while integrating a single API.

I asked whether he had reviewed AI's API design himself. He said he had neither reviewed the design nor tested it. He was entering my requirements into AI and passing along its completion reports.

Most back-office features were simple: display data returned by an API and update values. Rather than split the API and UI between people, explain the requirements again, and wait for fixes, I thought it would be better for one person to handle both.

I decided to give the backend developer responsibility for the back office as well. At first, he said he did not want to work on the frontend; he wanted to become a backend specialist. I understood that. Knowing one technology well is better than having a shallow grasp of several.

But building this back office with AI had convinced me that he could handle the screens too. He agreed that keeping the API and UI together would be more efficient and took over the back office. From then until delivery to the museum, I focused on managing development.

### 2.4. Defining Requirements with a Working App

In early March, we finally managed to launch the existing service. The four weeks I had been told about when I joined had already passed.

With the immediate crisis behind us, I left the remaining work and maintenance to the CEO and team members. I began rebuilding the entire system.

I chose Flutter for the user app (`pointman`). I had never used it before, but after building the back office with AI, I thought Flutter would be manageable too.

Initially, I gave AI the designer's Figma file and asked it to reproduce the design. The result neither matched the design nor worked properly. Converting the designs to PDF or SVG did not help much.

<figure>
  <a href="{{ '/assets/aicode/part1/figma-user-app-design.png' | relative_url }}">
    <img src="{{ '/assets/aicode/part1/figma-user-app-design.png' | relative_url }}" alt="User-app screen designs arranged on a Figma canvas" width="480" loading="lazy" style="max-width:100%;height:auto;">
  </a>
  <figcaption>Figma designs for the user app (Korean interface). Click to view at full size.</figcaption>
</figure>

The designs themselves also needed substantial changes. I was not proficient enough in Figma to make those changes easily, and I had no time to learn it.

After about an hour of trying different approaches, I realized we did not need to reproduce the designs exactly. What if, as with the back office, I described the required features and asked AI to create a working first version?

A few sentences describing what we needed produced a draft that exceeded my expectations. The screens looked good, and they actually worked.

Previously, the designer turned the CEO's descriptions into mockups, which the developers then implemented. If we found a missing button or ambiguous behavior during implementation, we went back to the CEO and revised both the mockups and code.

Now, the CEO and I could look at a working app, decide what to change, ask AI to make the changes on the spot, and check the result.

<a id="ai-completion-reports"></a>

## 3. Delegating Increasingly Large Tasks to AI

Development of the new backend (`marksman`), alongside the user app, was also going smoothly. I gave AI a NestJS starter project I had built earlier. It adapted basic features such as users and authentication to the new backend and updated the existing tests.

At first, I verified the APIs myself. I checked whether AI had covered up problems with fallbacks or workarounds and whether its verification methods were sound.

I was amazed at how well it understood even poorly worded instructions. I would cautiously hand it a task, thinking, “Surely it can't do this too,” and then see the result and think, “It actually can.” I began to believe AI could replace a team member, and the tasks I assigned grew larger.

Before long, I was delegating two or three large tasks in succession without checking the intermediate results. My wishful thinking was running at full power: surely it would handle everything again this time.

But when I inspected the results a few hours later, problems were everywhere. Features I had not requested had been added, while necessary ones were missing. In the name of stronger security, AI sometimes imposed so many restrictions that a minor exception could halt the system.

Once, it built a UI for searching payment records by card number while storing all card numbers in masked form. The screen looked polished, but the stored values made the search impossible. Even so, when I asked AI to test the full feature, it repeatedly reported that everything worked.

When asked to fix a problem, it sometimes used tricks or elaborate workarounds and then reported success. AI could work with astonishing enthusiasm in entirely the wrong direction.

## 4. Moving to Solo Development with AI

### 4.1. Managing the Team's Work

While I developed the new backend (`marksman`) and user app (`pointman`), the team's feature work and bug fixes continued to drag. Each developer interpreted the CEO's requests independently, and the CEO repeatedly said that the results were not what he wanted. The CEO and development team were in different cities, making it difficult to look at the same screens and discuss things whenever needed.

I tried GitHub Projects to bring requirements and results together. The CEO would register tasks, and developers would work on them and leave results and relevant information in comments.

<figure>
  <a href="{{ '/assets/aicode/part1/github-projects.png' | relative_url }}"><img src="{{ '/assets/aicode/part1/github-projects.png' | relative_url }}" alt="GitHub Projects board with tasks organized as Todo, In progress, and Done" width="480" loading="lazy" style="max-width:100%;height:auto;"></a>
  <figcaption>GitHub Projects, used to keep requirements and task results in one place. Task descriptions are in Korean.</figcaption>
</figure>

That arrangement lasted about a day. The CEO went back to sending requirements through multiple channels, and developers stopped recording results on the tasks.

I ended up getting involved in every task to reconcile the requirements with the implementation, leaving progressively less time to develop the new backend.

### 4.2. Assigning Four Apps to One Developer

Shortly after the March launch, the iOS developer's contract ended. I planned to hand his iOS kiosk and user app to the newly hired Android developer. Together with the Android kiosk and user app he already handled, that meant four applications.

When I raised it, he strongly objected. He was already responsible for two apps; how could he handle four? I expected that reaction. If the work meant learning each platform and manually writing all the code, it was hardly a small request.

But the workload I had experienced building the back office and Flutter app with AI was different. Although iOS and Android differed as platforms, much of the functionality was the same. I believed that organizing the shared requirements and delegating platform-specific implementation to AI would reduce the burden of manually repeating everything from scratch.

After I explained how AI had changed development, he accepted my reasoning and took on the work. I later advised him several times to adapt quickly to AI coding.

I thought of it as advice, but he may have heard it as a warning. Before his probation review, he announced that he would leave.

I knew I should speak more gently. But AI was rapidly changing the development environment, and the company had little room to wait for everyone to adapt.

### 4.3. Repeated Completion Reports Without Verification

The problems I had encountered while integrating the back-office APIs continued. Features reported as complete still produced errors, followed by more requests for fixes and more checking.

Immediately after launch, I had left maintenance to the CEO and team while concentrating on the new system, so I had not realized how serious the problem was.

The backend was supposedly finished, yet the Android developer seemed to struggle with each feature. I assumed he was adjusting to unfamiliar work. By the standards of manual coding, his pace was reasonable, so I did not see it as a problem.

Then the back office's sales statistics remained consistently wrong, and the CEO's frustration grew. I could no longer leave it alone, so I investigated.

The backend developer was running three or four AI agents simultaneously on one application. He had not divided their work, and there was no process for reviewing and integrating their changes. He was not checking whether existing features still worked either.

Most shocking was that he was still testing against the production database of a service used by real customers. There were not even automated backups, and test data was fully visible to users.

When AI finished a task, he did not verify the result or even ask how it should be verified. If the sales statistics kept being wrong, he should at least have asked for a verification plan and reviewed whether it made sense.

I thought I had warned him clearly enough during the earlier API integration. But once again, even minimal verification was missing.

My expression darkened and my words became terse. Noticing this, he said:

“Even at big companies, several product planners working together can't verify everything perfectly. How can a small company like this meet your standards?”

I was asking for a basic sense of responsibility, not a perfect program.

A month earlier, I had already told him he would be dismissed because of behavior I found unacceptable. He had acknowledged his mistake then, and knowing how difficult the job market was, I had not been able to bring myself to go through with it.

The earlier behavior was something I could choose to tolerate. But failing to perform even minimal verification, without recognizing the problem, was not.

After discussing it with the CEO, I notified him of his dismissal the next day.

### 4.4. Developing Alone with AI Agents

When the Android developer said he was leaving, part of me felt relieved. At that point, the cost of explaining context and intent between the CEO and developers, coordinating progress, and correcting mismatched results was too high. Everyone was unhappy, so advice and counseling also took time.

However I looked at it, delegating to AI myself and checking the results seemed more efficient. The Android developer agreed that I might be better off working alone with AI.

I proposed pausing recruitment and handling development myself. I did not know it then, but the CEO apparently worried that the development team was collapsing and that he might have to close the business.

By early April, I had taken over all the team's work and was developing alone. I was responsible for these applications:

1. The new backend under development (`marksman`)
2. The new user app under development (`pointman`)
3. A back-office and ticketing system for a three-day event in Busan (`events`)
4. The backend previously handled by a team member (`legacy`)
5. The back office previously handled by a team member (`partner-console`)
6. The Android ticketing kiosk (`ticketing`)
7. The ticketing kiosk's JSP server (`kiosk-server`)
8. The Android point-of-sale app (`pos-app`)
9. The iOS admission kiosk (`checkin`)

Even after stopping development of the old iOS and Android user apps and keeping only immediate needs, there were nine applications.

That would have been difficult to manage through manual coding. But my experience building the back office and user app with AI had substantially reduced the implementation burden. I thought I could handle this amount of work alone.

It took about two days to organize the development environment. I consolidated the inherited repositories into two monorepos, one for web projects and one for Android. Keeping related code together made delegation to AI easier.

I had wanted to put everything in one place, but I was using VS Code for web work and Android Studio to build and check the Android apps. I divided the repositories accordingly.

In retrospect, even that division was unnecessary. Giving AI agents instructions and checking their results did not require a dedicated IDE.

Once the environment was organized, I could feel productivity improving. I knew what needed doing, so I assigned one agent to each of four different projects and ran them in parallel. Unlike the team member who had several agents modifying one application without boundaries, I separated the work by project and verified the results myself.

The limit will vary by person and project, but four was nearly my limit then. By the time I had checked one agent's result, another was waiting for verification. I was the bottleneck. Rushing verification might have let me delegate more work, but I would have had less understanding of how the agents were actually working.

By the end of April, I had addressed the essential requirements of the existing system (`legacy`) and established a basic level of stability. I also built and launched the new service for the Busan event (`events`), which I had expected to be simple.

Pleased with the results, the CEO had begun treating the AI agents like company executives, addressing them as “Director Cl” and “Manager Co.”

## 5. The CEO Took the Lead in Development

### 5.1. Taking Over the System the CEO Had Built

In early May, with the urgent legacy problems under control, I could resume work on the new backend (`marksman`) and user app (`pointman`) after a month's pause.

Building the new system felt harder than rescuing the legacy system in April. Events and tickets came in many forms. The CEO talked at length about the service, but I could not determine its intended direction or which features should come first.

I also struggled to judge how extensible the database design should be. Accounting for every possible future requirement would make design and implementation unnecessarily complex. I needed to agree with the CEO on how far ahead to plan.

But frequent discussions were difficult. I worked in the Seoul office, while the CEO was usually in Daejeon or at external meetings. He came to Seoul about one day a week. We had plenty of ways to contact each other, but that was different from sitting nearby and being able to see when the other person was available.

While I was wrestling with these questions, the usually confident CEO approached me with a cautious smile and kept talking around the subject.

I felt a chill. This was not a good sign. He was clearly preparing to tell me something I would not like.

The CEO had been using AI to build his own version of the service (`superman`). While I was rescuing the existing system (`legacy`) and building the event service (`events`), he had spent about a month developing it. Following AI's recommendations, he used Supabase for the backend and built a Next.js back office deployed on Vercel.

He said the back office, sales statistics, and even the backend were all finished. All I needed to do was connect the kiosks used on site.

It was remarkable that someone with no development experience had implemented that many screens and features in a month with AI. But the number of screens and features did not establish that it was ready for production. I had only heard of Supabase and first needed to learn what it provided.

Above all, the problem was that he had worked alone for a month without telling me.

While writing this article, I called to ask why. He said he had not trusted developers at the time and would explain further another time. Even so, I struggled to understand why he had not shared his progress with the person who would have to work on it with him.

Running the supposedly finished new system (`superman`) reminded me of the legacy system I had examined when I first joined. It had many features, but it was difficult to consider it ready for actual operation. The screens looked plausible at a glance, yet features were not organized systematically, making menus hard to find. Even basic event registration produced several errors when the CEO and I checked it together.

He said they were minor issues he would fix. To me, the system needed more than changes to a few lines of code: its real operational flows needed to be reviewed.

Although the CEO had led development, I expected to be held responsible for the results. He said that would not happen. But I did not trust him either, and my concerns became reality.

### 5.2. Conflict over Technology Choices

The lack of prior discussion was not the only problem. I was even more reluctant to continue with a technology stack I considered unsuitable for this project.

The CEO had chosen Next.js and Supabase on AI's recommendation. Supabase provides backend capabilities such as a database, authentication, and APIs, reducing the amount of code developers need to write themselves.

But the CEO was going to use AI coding anyway. With the burden of producing code reduced, the value of tools that save manual coding also needed to be reconsidered. We needed to account for the technologies we would maintain and the ongoing server costs.

By those criteria, putting the server functionality in Next.js and using MongoDB could have simplified the system and reduced operating costs.

We also disagreed about the kiosk and user-app technologies. The CEO wanted freedom to deploy updates and intended to build both with React Native (RN), again following AI's recommendation.

For this project's kiosks, however, smooth operation on limited memory and slow CPUs, along with reliable support for printers and scanners, mattered more than deployment convenience. Since the kiosks only needed Android support, I considered RN's additional runtime memory and hardware integration complexity a burden.

RN was a possible choice for the user app because it needed both iOS and Android support. But minimizing development costs required consistent behavior across both operating systems from one codebase. In my experience with RN, behavior sometimes differed by OS. Given those conditions, I considered Flutter the better choice for the user app.

My guess is that, as a nondeveloper, the CEO had told AI only the requirements he recognized and left out other technical constraints. AI probably recommended technologies mechanically against those requirements, without asking about or accounting for the missing constraints.

I explained my reasoning. But the CEO trusted AI's proposals more than my judgment. Whatever I said, he asked AI again and compared the answers. He wanted to hear both sides' reasoning and make the final decision himself.

At our first meeting, I had asked him to trust me with the work. He still did not.

He continued making important technical decisions based on AI's suggestions. I had to explain every detail, including small issues that would not need explaining to another developer. I read the long AI responses he sent and had to rebut claims I considered unreasonable. The words “I quit” kept rising to my throat, but I managed to swallow them.

> A similar decision-making structure drew criticism at Samsung Electronics. In an [October 2024 interview with Dong-A Ilbo's Deep Dive](https://stibee.com/api/v1.0/emails/share/OfXIP-Gm1JSC7-0jDdf0nbQSQeFwMfU), a semiconductor engineer said reports to Chung Hyun-ho, then head of the Business Support Task Force, had to be written so that “even an elementary school student could understand.” He criticized a structure in which executives with limited technical understanding made decisions and risks raised by engineers were downplayed as reports moved up the hierarchy.

<figure>
  <a href="https://stibee.com/api/v1.0/emails/share/OfXIP-Gm1JSC7-0jDdf0nbQSQeFwMfU"><img src="{{ '/assets/aicode/part1/samsung-engineer-interview-excerpt.png' | relative_url }}" alt="Dong-A Ilbo Deep Dive asks: Do semiconductor engineers write internal reports at an elementary-school level?" width="630" height="52" loading="lazy" style="max-width:100%;height:auto;"></a>
  <figcaption><a href="https://stibee.com/api/v1.0/emails/share/OfXIP-Gm1JSC7-0jDdf0nbQSQeFwMfU">Dong-A Ilbo Deep Dive: A semiconductor engineer with twenty years of experience discusses concerns about Samsung Electronics</a> Excerpt, October 18, 2024. The Korean headline asks whether semiconductor engineers write internal reports at an elementary-school level.</figcaption>
</figure>

### 5.3. There Was Value in the CEO's Approach

When the CEO first raised the proposal, I could not accept it. He did not give up and brought it up again the following week.

He said he had no idea when my backend (`marksman`) and user app (`pointman`) would be finished. The company's money was running out, and he had nothing to show prospective customers.

He was not wrong. Although unfinished, the system he had built in a month (`superman`) looked like a service with many features. At least it could show what the service was trying to do.

I had also been struggling to understand what he wanted. Being able to see his version of the service reduced the burden of discovering the requirements.

Setting aside our personal conflict, the approach itself was efficient. The person who understood the domain and requirements best could now build screens and features directly with AI. Just as I had skipped making mockups in Figma, the CEO could skip explaining his ideas to a developer and waiting for implementation.

I disliked the situation intensely. Even so, for these reasons I accepted what the CEO himself called an “order.”

I discarded both the backend (`marksman`) and user app (`pointman`) I had been developing. From then on, the CEO led development.

<figure>
  <video controls playsinline preload="none" width="1232" height="736" style="width:100%;height:auto;aspect-ratio:1232/736;background:#111;" aria-label="Video adapted from White Tower: I will take control of the operation from here" aria-describedby="white-tower-caption">
    <source src="{{ '/assets/aicode/part1/white-tower-control-remake.mp4' | relative_url }}" type="video/mp4">
    <a href="{{ '/assets/aicode/part1/white-tower-control-remake.mp4' | relative_url }}">Watch my White Tower adaptation</a>
  </video>
  <figcaption id="white-tower-caption">“I will take control of the operation from here!” — A ten-second video I made based on a scene from the Korean drama White Tower. Korean audio. <a href="https://www.youtube.com/watch?v=ke-jgZMIU6A&amp;t=170s">Original MBC scene used as a reference</a></figcaption>
</figure>

### 5.4. The CEO Set the Development Schedule

The CEO wanted to replace the system running at the museum (`legacy`) with his new system (`superman`). That required migrating the existing data and rebuilding the Android apps for point of sale, admission, and ticket issuance.

The existing database was tangled enough that even the migration looked difficult. AI would implement the apps, but allowing time to verify API designs and implementation results, I estimated three weeks for app development.

Including migration, I said we needed four weeks. The CEO rejected that estimate and demanded completion within two.

I explained that AI might produce the implementation within two weeks, but the lack of verification time made failures likely. I also warned that the museum would complain about that level of quality. He said it would be fine.

The CEO had final responsibility. Having explained the risks and been told to proceed, I interpreted his decision as accepting those risks and agreed to work to the schedule.

But he never asked a single follow-up question about my warnings. I felt he was not taking them seriously and expected the responsibility to fall on me if something went wrong.

I delegated the migration to AI in stages. Because the old database's field names did not clearly explain the data, I first had it extract and organize the essential data into JSON with meaningful names and verify its consistency. After importing it into the new schema, I had it compare totals and other values between the old and new databases.

I also delegated the apps to AI. For the more complex point-of-sale UI, I asked the CEO to create the screens he wanted in HTML, then had AI implement them.

After development, the CEO and I checked the result and deployed it to the museum. He considered the UI rough but good enough.

The museum called the next morning. Staff strongly complained that the point-of-sale system lacked essential features and that functions available in the old service were missing. Within half a day, we took down the new system (`superman`) and restored the old one (`legacy`).

The rollback became entirely my fault. I was criticized for producing such problems despite having more than twenty years of development experience.

I believed the rushed schedule had left the system incomplete and inadequately verified, but I did not say so to the CEO. I did not want to sound as though I was making excuses.

### 5.5. Continuing to Add Features We Did Not Yet Need

The CEO said there was nothing left to develop, but soon began adding more features. When AI reported completion, he considered the work done without even running it.

This was exactly why I had dismissed the backend developer. Unfortunately, you cannot fire the CEO.

Once a feature exists, even one not needed yet, it becomes something to account for in operations and future development. Message billing attached to ticket delivery was one example.

This feature deducted a fee from a prepaid balance every time a message was sent. Yet the client companies had never actually been charged for those messages.

During an event, the balance ran out and the kiosk stopped working. We could not immediately identify the cause, and ticket issuance was interrupted for a while. A prepaid balance had become a condition for issuing tickets, even though we were not charging clients for the messages.

If message billing was added, the kiosk also needed to clearly explain when an insufficient balance stopped it. Every other screen that sent messages needed to be adapted to the billing conditions too.

The more fundamental problem was what was being billed. In this service, messages sent as part of a ticket purchase should not have been treated as a separately billable item. The CEO had focused on producing visible features without carefully considering what to charge for or how the feature would affect real operations and other functionality.

An application's features work together. Adding even a simple feature can require changes and verification across several others. Accumulating features without organizing the structure can increase the people needed for development and maintenance. Features that are not yet needed add maintenance costs before contributing any revenue.

Every time the CEO added a feature, I had to do the follow-up work. Both my efficiency and motivation fell sharply. Despite being paid a high salary, I struggled to put my abilities to use.

Even when I believe I am right, I do not tend to insist forcefully on getting my way. I may win one decision, but the concession I extract becomes a debt that constrains later decisions. On an important issue, I usually make a serious case a couple of times. If it is still rejected, I wait for the problem to reveal itself. In the long run, I consider that the most efficient approach.

I believed then that continuing to add features without verification would eventually create problems that were difficult to repair. Until the CEO experienced those problems himself, anything I said seemed likely to backfire.

## Closing Thoughts

Over eight months, AI coding changed not only implementation speed but also how people worked and related to one another. One person could handle several applications simultaneously, and the CEO could build his own vision and decide the direction of development.

With much of the coding delegated to AI, being able to write code quickly became less of a reason to keep a developer who was difficult to work with.

When I first joined, the system was “almost finished.” When I took over the CEO's system, it was “finished.” Yet running either one revealed failures in basic functionality. We still needed to question the basis for those completion claims and verify the actual behavior from beginning to end.

Trust failed to develop between the original team lead and the CEO, and between the CEO and me. Without a working partnership, we could not make full use of each person's abilities. Faster implementation did not automatically improve collaboration.

We need to respect each other's expertise. Developers must understand business needs, and the CEO must incorporate developers' technical judgment and verification results into decisions. A working partnership cannot be built by one side alone.

Next: [Understanding AI Coding (2): Challenges and Development Strategies]({% post_url 2026-11-18-ai-coding-part2-en %})
