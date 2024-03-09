---
layout: post
title:  "객체 지향 프로그래밍의 이해"
---

객체 지향 프로그래밍은 데이터와 함수를 하나의 '객체'로 그룹화해서 응집성과 의존성을 관리하는 프로그래밍 패러다임이다.

## 절차식 코드 소개

버퍼에서 문서를 읽어서 한 글자씩 출력하는 함수를 작성해 보자.

```ts
/* 버퍼에서 읽기 */
function main() {
  const buffer = "Hello, World!";

  printDocument(buffer);
}

function printDocument(buffer: string) {
  for (let i = 0; i < buffer.length; i++) {
    const char = buffer.charAt(i);

    console.log(char);
  }
}
```

여기에 파일에서 문서를 읽어서 한 글자씩 출력하는 기능을 추가해 보자.

```ts
function main() {
  /* 버퍼에서 읽기 */
  const buffer = "Hello, World!";
  printDocument(buffer);

  /* 파일에서 읽기 */
  const file = new File("test.txt");
  printDocument(file);
  file.close();
}

function printDocument(doc: string | File) {
  /* 버퍼에서 읽기 */
  if (typeof doc === "string") {
    for (let i = 0; i < doc.length; i++) {
      const char = doc.charAt(i);

      console.log(char);
    }
  } else if (doc instanceof File) {
    /* 파일에서 읽기 */
    let char = doc.getChar();

    while (char != EOF) {
      console.log(char);

      char = doc.getChar();
    }
  }
}
```

이것이 전형적인 절차식이다. 절차식의 특징 중 하나는 if가 자주 나온다는 것이다.

## 절차식 코드의 문제점

만약 여기에 REST API로 읽는 기능을 추가해야 한다면 어떻게 될까? main()함수는 물론이고 printDocument() 함수도 변경되어야 한다.

```ts
function main() {
  /* 버퍼에서 읽기 */
  const buffer = "Hello, World!";
  printDocument(buffer);

  /* 파일에서 읽기 */
  const file = new File("test.txt");
  printDocument(file);
  file.close();

  /* REST API 요청 */
  const request = new HttpRequest("https://test.com/api");
  printDocument(request);
}

function printDocument(doc: string | File | HttpRequest) {
  /* 버퍼에서 읽기 */
  if (typeof doc === "string") {
    for (let i = 0; i < doc.length; i++) {
      const char = doc.charAt(i);

      console.log(char);
    }
  } else if (doc instanceof File) {
    /* 파일에서 읽기 */
    let char = doc.getChar();

    while (char != EOF) {
      console.log(char);

      char = doc.getChar();
    }
  } else if (doc instanceof HttpRequest) {
    /* REST API 요청 */
    const body = doc.body();

    for (let i = 0; i < body.length; i++) {
      const char = body.charAt(i);

      console.log(char);
    }
  }
}
```

지금처럼 printDocument() 함수 하나만 변경하는 것이라면 문제가 되지 않는다. 그러나 printDocument() 외에 다른 함수가 있다면? 변경해야 하는 함수가 그 만큼 늘어난다. 실제 프로젝트는 이것보다 더 길고 복잡한 코드인 경우가 많다. 이런 환경에서 관련된 모든 함수를 찾아서 변경하는 것은 쉽지 않다.

```ts
function main() {
    const buffer = "Hello, World!"
    printDocument(buffer)
    updateDocument(buffer, "new contents")
    clearDocument(buffer)

    const file = new File("test.txt")
    printDocument(file)
    updateDocument(file, "new contents")
    // clear 하려면 close 해야 한다는 규칙을 알아야 한다.
    file.close()
    clearDocument(file)
}

function updateDocument(doc: string | File, contents: string) {
    if(typeof doc === 'string') {
        doc = contents
    }
    else if(doc instanceof File){
        doc.write(contents)
    }
    else if(doc instanceof HttpRequest){
        ...
    }
}

function clearDocument(doc: string | File) {
    if(typeof doc === 'string') {
        doc = ""
    }
    else if(doc instanceof File){
        doc.delete()
    }
    else if(doc instanceof HttpRequest){
        ...
    }
}

function printDocument(doc: string | File) {
    if(typeof doc === 'string') {
        for (let i = 0; i < doc.length; i++) {
            const char = doc.charAt(i)

            console.log(char)
        }
    }
    else if(doc instanceof File){
        let char = doc.getChar()

        while (char != EOF) {
            console.log(char)

            char = doc.getChar()
        }
    }
    else if(doc instanceof HttpRequest){
        ...
    }
}
```

## 절차식 코드의 개선 방법#1

관련된 모든 함수를 찾아서 문서 타입을 판별하는 if 문을 변경하는 것은 쉽지 않다. 그러면 if 문을 피하는 방법은 없을까?

printDocument()를 세분화 하는 방법을 생각할 수 있다.

```ts
function main() {
  const buffer = "Hello, World!";
  printBufferDocument(buffer);

  const file = new File("test.txt");
  printFileDocument(file);
}

function printBufferDocument(doc: string) {
  for (let i = 0; i < doc.length; i++) {
    const char = doc.charAt(i);

    console.log(char);
  }
}

function printFileDocument(doc: File) {
  let char = doc.getChar();

  while (char != EOF) {
    console.log(char);

    char = doc.getChar();
  }
}
```

그런데 보통은 아래처럼 연결된 함수를 중첩해서 호출하기 마련이다.

```ts
function main() {
    const buffer = "Hello, World!"
    printBufferWeeklyReport(buffer)

    const file = new File("test.txt")
    printFileWeeklyReport(file)
}

function printBufferWeeklyReport(doc: string){
    /* report를 생성하는 코드*/
    ...

    printBufferDocument(report)
}

function printFileWeeklyReport(doc: File){
    /* report를 생성하는 코드*/
    ...

    printFileDocument(report)
}
```

확실히 if 문이 사라지긴 했다. 그러나 if를 피하기 위해서 'report를 생성하는 코드'를 반복하게 된다. 이럴거면 차라리 if를 사용하는 것이 낫다.

if는 코드의 복잡도를 증가시키고 개발을 어렵게 한다. 그렇다고 if문을 제거하면 더 큰 부작용이 발생한다.

if는 없앨 수 없는 것일까?

## 절차식 코드의 개선 방법#2

printDocument()에서 if를 제거할 수 없는 근본 원인은 main() 함수에서 printDocument()에 필요한 데이터만 전달할 뿐, 그 데이터를 사용하는 방법은 전달하지 않기 때문이다.

그래서 printDocument()는 데이터의 유형에 따라서 실행해야 하는 코드를 판별해야 하는 것이다.

그렇다면 실행해야 하는 코드도 같이 전달하면 어떨까?

```ts
function main() {
  const buffer = "Hello, World!";
  let position = 0;
  const getCharFromBuffer = (doc: string) => {
    if (position == doc.length) return;

    return doc.charAt(position++);
  };

  printDocument(buffer, getCharFromBuffer);

  const file = new File("test.txt");
  const getCharFromFile = (doc: File) => {
    const char = doc.getChar();

    return char == EOF ? null : char;
  };

  printDocument(file, getCharFromFile);
  file.close();
}

function printDocument(doc: any, getChar: Func) {
  let char = getChar(doc);

  while (char != null) {
    console.log(char);

    char = getChar(doc);
  }
}
```

비록 main() 함수는 더 복잡해졌지만 printDocument()는 if 문이 필요없고 어떤 형식이 오더라도 변경하지 않아도 된다.

이제 어떻게 하면 main() 함수를 깔끔하게 정리할 수 있을까?

## 객체 지향 코드

main() 함수를 깔끔하게 정리하기 위해서 우리는 클래스를 사용할 수 있다.

```ts
function main() {
  const bufferDocument = new BufferDocument("Hello, World!");
  printDocument(bufferDocument);

  const fileDocument = new FileDocument("test.txt");
  printDocument(fileDocument);
}

function printDocument(reader: DocumentReadable) {
  let char = reader.getChar();

  while (char != null) {
    console.log(char);
    char = reader.getChar();
  }

  reader.close();
}

interface DocumentReadable {
  getChar(): string | null;
  close(): void;
}

class BufferDocument implements DocumentReadable {
  private position: number;

  constructor(private buffer: string) {
    this.position = 0;
  }

  public getChar(): string | null {
    if (this.position === this.buffer.length) return null;

    return this.buffer.charAt(this.position++);
  }
}

class FileDocument implements DocumentReadable {
  private stream: ReadStream;

  constructor(filename: string) {
    this.stream = new File(filename);
  }

  public getChar(): string | null {
    const char = this.stream.getChar();
    return char !== EOF ? char : null;
  }

  public close(): void {
    this.stream.close();
  }
}
```

위의 객체 지향 방식에서의 printDocument()에는 문서 타입을 판별하는 if 문이 없다. main()에서 객체를 처음 생성할 때 필요한 것들이 모두 정해진다. printDocument()는 주어진 객체를 사용하기만 하면 되는 것이다.

> 코드에 if 문이 보인다면 이것이 절차식은 아닌지? 객체 지향으로 개선할 수 없는지 고민해 보기를 바란다.

앞서 절차식은 printDocument()에 필요한 데이터만 전달할 뿐, 그 데이터를 사용하는 구체적인 방법(함수)은 전달하지 않는다고 했다. 객체 지향 방식은 데이터와 그 데이터를 사용하는 함수를 객체로 묶어서 전달한다. 이것이 가장 크고 두드러지는 차이점이다.

## 좋은 객체의 특징

코드를 클래스 다이어그램으로 표현해 보자.

{% plantuml %}
@startuml

interface DocumentReadable {
    +getChar() : string | null
    +close() : void
}

class BufferDocument {
    -buffer : string
    -position : number
    +constructor(buffer : string)
    +getChar() : string | null
}

class FileDocument {
    -stream : ReadStream
    +constructor(filename : string)
    +getChar() : string | null
    +close() : void
}

package printDocument <<Cloud>> {
}

printDocument --> DocumentReadable : uses
DocumentReadable <|.. BufferDocument
DocumentReadable <|.. FileDocument

@enduml
{% endplantuml %}

### 관심사 분리

`printDocument()` 함수는 `DocumentReadable` 인터페이스를 사용하기만 한다.\
`BufferDocument`나 `FileDocument`는 `DocumentReadable` 인터페이스에 맞춰서 각자 기능을 제공하기만 한다.

그러니까 `printDocument()`, `BufferDocument`, `FileDocument`가 아는 것은 `DocumentReadable` 인터페이스 뿐이고 서로에 대해서는 알지 못한다. 이것은 즉, `DocumentReadable` 인터페이스가 변경되지 않는 한 각 클래스 혹은 함수를 변경할 필요가 없다는 뜻이다.

다시 설명하자면 인터페이스를 변경하지 않는다면 각 부분을 어떻게 변경하든 다른 부분에는 영향을 미치지 않는다는 것이다. 이것이 객체 지향 프로그래밍이 점진적인 개발을 가능하게 하는 방법이다. 이렇게 인터페이스와 구현을 분리하는 매커니즘은 자연스럽게 응집성이 높아지면서 의존성이 낮아지는 결과가 된다.

> 절차식 사고에 익숙하면 이렇게 기능을 응집시키고 그 부분에만 집중하는 방법 자체에 서투른 경우를 보게 된다. 그것은 코드 뿐만이 아니라 업무를 분담하고 협업하는 등의 일상적인 업무에서도 나타난다.
>
> 예를 들면, 프론트엔드와 백엔드 개발자가 REST API를 정의하고 각자 개발을 진행한다. 그러다 기존에 정의한 REST API를 만족시키지 못하는 오류가 백엔드에서 발생한다. 디버깅을 해보니 백엔드에서 코드를 수정하는 것보다 REST API를 변경하고 프론트엔드에서 코드를 수정하는 것이 더 간단한 상황이다. 백엔드 개발자는 프론트엔드 개발자에게 코드를 수정해 달라고 요청하고 프론트엔드 개발자도 기꺼이 동의한다.
>
> REST API를 설계했을 때의 원칙을 저버리는 것은 큰 문제다. 더군다나 백엔드의 문제를 프론트엔드까지 끌어들이면서 백엔드와 프론트엔드는 그 만큼 더 강하게 결합하게 된다.
>
> 이 정도 사소한 변경이 그렇게 큰 문제일까 싶은 의문이 들지도 모르겠다. 코딩하는 당시에는 대수롭지 않겠지만 시간이 지나고 다른 개발자가 코드를 분석하려고 할 때 장애가 된다.
>
> "각자의 작업 영역은 엄격하게 지켜야 한다."
>
> 절차식 사고에 익숙한 개발자는 이 말을 이기적이고 냉정한 것으로 받아들이는 경우가 있다. 그러나 이것은 지극히 기술적인 접근일 뿐이다.

### 접근 제어

함수들은 변수를 통해서 서로 연결된다고 볼 수 있다.

전역변수를 생각해 보자. 흔히 전역변수를 사용하면 안 된다고 한다. 왜냐하면 하나의 전역변수를 사용하는 모든 함수들은 서로 연결되는 것이다. 소스코드가 10만 라인이 넘어가는 상황에서 다른 함수들이 내가 생각한 규칙대로 움직인다고 어떻게 보장할 수 있을까?
이것은 복잡도를 엄청나게 상승시킨다.

> 코드를 변경할 때 그 영향이 어디까지 미치는 것인지 파악이 안 된다면 거의 반드시 버그를 만들고 있는 것이다.

아래의 그림에서 count 변수를 사용하는 read(), write(), change(), reset() 함수들은 서로 연결되어 있다. 특히 값을 변경하는 change(), reset() 함수는 다른 모든 함수에 직접적인 영향을 끼친다.

{% plantuml %}
@startmindmap
* let count = 0
** function read() { return count }
** function write() { console.log(count) }
** function change() { count++ }
** function reset() { count = 0 }
@endmindmap
{% endplantuml %}

반면에 `BufferDocument`의 `buffer`나 `position`을 사용하는 함수는 `BufferDocument` 클래스에만 존재할 수 있다.
왜냐하면 두 프로퍼티(변수)가 비공개이기 때문에 외부에서의 접근이 원천적으로 차단되기 때문이다.

이것이 프로퍼티를 public으로 직접 노출하지 말라는 이유이다. 외부에서 프로퍼티를 변경할 수 있다면 프로퍼티와 관련된 코드를 변경할 때 그 영향이 어디까지 미칠지 알 수 없게 된다. 잠재적으로 전역변수와 다를바 없게 되는 것이다.

## 객체 지향의 응용

객체 지향 방식의 관심사 분리를 통한 복잡도 관리 및 변화에 의한 영향을 최소화 하는 특징은 다른 분야에도 영향을 끼친다.

### Microservices Architecture

MSA는 구조적으로 객체 지향 방식과 유사한 면이 많다.

객체 지향의 핵심은 데이터와 함수를 하나의 객체로 묶는 것이다. MSA에서 서비스도 DB와 API를 하나로 묶어서 관리하고 각 서비스의 내부 구현과 DB는 외부에 노출되지 않는다. 이것은 서비스 내부의 변화가 외부에 영향을 미치지 않도록 하면서 유지보수성과 확장성에 큰 장점이 된다.

{% plantuml %}
@startditaa
+-----------------+        +----------------------+
|      Class      |        |    Microservice      |
+-----------------+        +----------------------+
|                 |        |                      |
| + Property      |<------>| + Database           |
|                 |        |                      |
+-----------------+        +----------------------+
|                 |        | + API                |
| + Method()      |<------>|   + GET /resource    |
|                 |        |   + POST /resource   |
+-----------------+        +----------------------+
@endditaa
{% endplantuml %}

OOP와 MSA가 구조적으로 유사하다는 사실에서 알 수 있듯이, OOP를 제대로 이해하지 못하면 MSA와 같은 아키텍처를 이해하고 올바르게 설계하는 것은 많이 어려운 일이 될 것이다.

요즘은 MSA가 유행인 것 같다. 그리고 많은 개발자들이 API gateway나 gRPC, 메시지 브로커 등 MSA 구성 요소들의 사용법을 익히는 데만 열중하는 것 같다. 그러나 가장 중요하고 기본적인 것은 OOP에 대한 깊은 이해이다.

> 현대적인 소프트웨어 개발 방법의 근간에는 OOP가 있다.

### 애자일 방법론

디자이너, 개발자, 기획자 등 관련자들이 한 팀을 이뤄 긴밀하게 협력하는 작업 방식은 객체 지향 프로그래밍(OOP)의 핵심 원칙인 높은 응집성과 낮은 결합도에 비유할 수 있다. 이러한 접근 방식은 소프트웨어 개발 뿐만 아니라, 조직 구성과 팀워크에서도 생산성과 효율성을 높이는 데 중요한 역할을 한다.

애자일 팀의 구성 자체가 데이터와 함수를 하나로 묶는 객체와 동일한 구조는 아니다. 그러나 애자일 팀에서는 기획자가 요구사항이라는 데이터를 생산하고, 개발자가 이를 구현한다는 점에서 데이터의 생산과 소비 주체가 함께 있다는 유사성을 찾을 수 있다. 이는 마치 객체 내부에서 데이터(속성)와 함수(메서드)가 밀접하게 연관되어 있는 것과 같은 맥락으로 볼 수 있다.

한편, 애자일 방법론의 중요 원칙인 점진적인 개발을 반복하는 프로세스는 객체 지향 설계의 관심사 분리를 기반으로 가능한 것이다. 객체 지향 프로그래밍은 시스템을 독립적인 객체들의 상호작용으로 모델링하므로, 각 객체를 개별적으로 개발하고 테스트할 수 있게 해준다. 이는 애자일 방법론이 지향하는 작은 단위의 개발과 피드백 반영을 원활히 하는 데 도움이 된다. 결과적으로 OOP는 애자일 소프트웨어 개발의 기반이 되는 주요 기법 중 하나로 자리매김하고 있다.

## 결론

이 글의 시작은 이랬다.

> 객체 지향 프로그래밍은 데이터와 함수를 하나의 '객체'로 그룹화해서 응집성과 의존성을 관리하는 프로그래밍 패러다임이다.

그렇다. 데이터와 함수를 하나의 객체로 그룹화 한다는 것이 객체 지향의 핵심이다.
그러나 OOP를 설명하는 많은 글이나 영상은 OOP의 캡슐화, 은닉화, 다형성, 상속성이 무엇인지를 설명한다. OOP의 이 네 가지 기본 원칙은 데이터와 함수를 그룹화 할 때의 지침일 뿐이다. 가장 기본적이고 필수적인 것은 데이터와 함수의 그룹화이다.

그렇다면 데이터만 존재하는 객체가 있을 수 있을까? 반대로 함수만 존재하는 객체가 있을 수 있을까?
문법적으로 class를 사용해서 코드를 작성한다고 해도 그것은 객체가 아니다. 객체는 상태(프로퍼티)와 방법(메소드)이 함께해야 의미를 가진다.

지금 이 글을 읽고 뭔가를 알것 같은 느낌을 받았을지도 모른다. 그러나 실제로 자신의 코드를 객체지향으로 바꿔보기 전에는 막연히 뭔가 될 것 같은 느낌 정도일 것이다.
좋은 코드가 무엇인지 많은 고민과 연습이 필요하다.

현대적인 개발 방법론의 근간에는 OOP가 있다. OOP를 깊이있게 이해하지 못하면 TDD, DDD, 애자일, MSA 등 현대적인 개발 방법을 공부해도 올바르게 사용하기 어려울 것이다. 실제로 MSA를 적용한 프로젝트는 많지만 성공 사례가 적은 이유이다.

객체지향 프로그래밍에서 자주 사용하는 일반적인 패턴을 모아놓은 것이 디자인 패턴이다. 이것은 다음 기회에 다루겠다.
