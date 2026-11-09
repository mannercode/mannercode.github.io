# AI 코딩 2편

2편 작업 원고는 상위 폴더의 `aicode/part2.md`에 작성하고, 이 폴더에서는 첨부물을 관리한다. 원고 제목은 「AI 코딩의 어려움과 개발 전략」이다.

| 위치 | 내용 |
| --- | --- |
| [2편 작업 원고](../part2.md) | AI 코딩의 어려움, 개발 전략과 개발자의 학습·성장을 다루는 원고 |
| [집필·확인 메모](../derived/materials/03_pending.md#part2-draft-2026-10-26) | 초안의 편집 방향, 대조한 자료와 남은 사실 확인 항목 |
| [책 표지](./attachments/microsoft-macro-assembler-bible-cover.jpg) | 『마이크로소프트 매크로 어셈블러 바이블』. 2편과 보관한 경험담 초안에서 함께 사용 |
| [설계 검토와 구현 흐름](./attachments/top-down-ai-development.svg) | 설계를 검토한 뒤 구현을 맡기는 흐름과 구현 결과를 보고 반복 수정하는 흐름의 비교 |
| [주택 설계도 비유](./attachments/house-blueprint-ai-delegation.png) | 설계도를 전달한 경우와 막연한 요청으로 엉뚱한 집이 만들어진 경우의 비교 |

새 첨부물은 이 폴더의 `attachments/`에 둔다. 검토 보고서는 [공통 참고 자료](../references/README.md), 집필 기준과 전체 자료 위치는 [상위 README](../README.md)에서 확인한다.

## 주택 설계도 비교 그림

[house-blueprint-ai-delegation.png](./attachments/house-blueprint-ai-delegation.png)는 1.1에 추가한 비유 그림이다. 주택 설계도를 전달해 그에 맞는 집이 완성된 경우와, “집 지어 줘”라는 요청에 AI가 기묘한 집을 짓고 “이렇게요?”라고 묻는 경우를 비교한다. 각 장면에 집을 하나씩 배치하고, 큰 제목 없이 대화로 차이를 보여준다. 실제 프로젝트 사례를 재현한 그림은 아니다. 기존 SVG는 유지하고 PNG를 추가했다.

내장 이미지 생성 도구로 제작했다. 최종 파일은 1536 × 1024 PNG다.

<details>
<summary>생성과 수정에 사용한 프롬프트</summary>

생성 프롬프트:

```text
Use case: illustration-story.
Asset type: a polished PNG comparison illustration embedded in a Korean article about delegating software implementation to AI.
Primary request: use HOUSE CONSTRUCTION as a metaphor. Compare giving an AI builder a house blueprint before construction with asking it vaguely to build a house and then repeatedly requesting changes after seeing the result.

Composition: wide landscape canvas, roughly 3:2, with TWO clearly separated horizontal rows. Each row reads left to right. Large, readable Korean headings and speech bubbles. White background, generous space, thin clean outlines, restrained teal and warm gray accents. Professional editorial illustration for adults, friendly but not childish. Simple architectural perspective. The same human and the same unbranded robot builder appear in both rows; put only "AI" on the robot's chest so its role is unmistakable.

TOP ROW:
Heading, verbatim: "설계도를 주고 맡긴다"
A human hands a large recognizable architectural BLUEPRINT to the AI builder. It must show a proper house floor plan and elevation, white architectural lines on blue paper, not a mere requirements checklist. The blueprint depicts the same modest two-story home that is built at the right of the row. A clear one-way arrow connects the blueprint handoff / robot reading the plan to the finished house.
The human's speech bubble, verbatim: "이 설계대로 지어 줘"
Emphasize a clear handoff of the defined design to the AI builder.

BOTTOM ROW:
Heading, verbatim: "결과를 보고 다시 지시한다"
At the left, the same human has no blueprint and speaks to the AI builder. Speech bubble, verbatim: "집 지어 줘"
In the middle, the AI has built a plausible modest house based on its own decisions.
At the right, show that house being revised with limited scaffolding and an added room / relocated window, while the human requests changes.
The feedback speech bubble contains these two lines verbatim:
"방을 하나 더 만들고,"
"창문도 옮겨 줘"
A conspicuous curved feedback arrow returns from the human's feedback toward the AI and house. Label the loop, verbatim: "수정 반복"
The tone is calm: ordinary rework caused by unstated expectations, not a catastrophe or an incompetent robot.

Typography and constraints: all Korean text must be correctly spelled, unclipped, and large enough to read in an article. Use only the exact headings, speech bubbles, the loop label, and "AI" specified above; no extra captions, fake tiny text, numerical annotations, English titles, or logos. Do NOT label the rows Top-down or Bottom-up; the illustration compares delegation flows, not formal definitions of those approaches. No cars, no castles, no skyscrapers, no explosions, no angry caricatures, no watermark. The blueprint and finished top-row house must visibly correspond. Output one complete opaque PNG illustration.
```

대화 수정 프롬프트:

```text
Use case: text-localization.
Input image: the supplied PNG is the EDIT TARGET.
Make one targeted edit to the LOWER ROW ONLY. Keep the entire top row, both headings, the blueprint, all houses, white background, illustration style, characters' identities, row layout, arrows, the left speech bubble "집 지어 줘", and the loop label "수정 반복" unchanged.

In the bottom row, replace the large central feedback bubble that currently says "방을 하나 더 만들고, 창문도 옮겨 줘" with TWO separate compact, clearly readable Korean speech bubbles over the human-and-robot pair:
- The robot asks, exactly: "이렇게요?"
- The human replies, exactly: "아니, 아니…"

CRITICAL: bubble tails must point to the correct speakers. In this pair the human is on the LEFT and the robot is on the RIGHT. Place the human's reply bubble over the human and the robot's question bubble over the robot, without colliding with the heading or houses. The robot is showing its built result and asking for confirmation; the human is rejecting that result and making it try again. You may adjust only this human's gesture slightly to a gentle head-shake / open-hand correction if needed. Keep their expressions calm. Preserve the rework loop so the exchange clearly repeats.
No additional text or changes elsewhere. Keep an opaque PNG with the original composition and dimensions.
```

최종 수정 프롬프트:

```text
Use case: precise-object-edit.
Input image: the provided PNG is the edit target.
Simplify this Korean editorial comparison illustration. Preserve the illustration style, the same human character, the same AI robot builder wearing a hard hat, the white background, and the TWO horizontal rows.

REMOVE both oversized title banners completely. There must be NO headings or panel titles, large or small. Remove all process arrows, the feedback-loop arrow, the label "수정 반복", all scaffolding, duplicate character appearances within a row, and the human reply "아니, 아니…". Redistribute the artwork into the space left by removing the headings; keep a thin unobtrusive divider between the rows.

TOP ROW: Show exactly ONE human, ONE AI robot, and ONE finished ordinary two-story house. The human hands a recognizable blue architectural blueprint with floor plan and house elevation to the robot. The finished house visibly matches that blueprint. The human's speech bubble says, verbatim: "이 설계대로 지어 줘". Keep this scene coherent and calm. The blueprint is a prop, not a second scene.

BOTTOM ROW: Show exactly ONE human, ONE AI robot, and ONE finished house — no before/after house sequence. The human has no blueprint and says, verbatim: "집 지어 줘". The robot proudly presents the ONE bizarre, eccentric house it built and asks, verbatim: "이렇게요?".
Make this house visibly strange and unlike the sensible upper house: awkwardly stacked asymmetric rooms, several mismatched rooflines, round and square windows at odd heights, and an absurdly placed upper-floor entrance. It should read instantly as an overcomplicated, peculiar HOUSE, not a castle, ruin, pile of rubble, or normal house with one small defect. The robot points toward its odd creation. The human is mildly puzzled. Humor comes from the mismatch, not anger or disaster.

Composition: balanced, simple two-row comparison, with human/AI interaction on the left and the single house on the right in each row. Keep generous whitespace and make the houses and speech bubbles easy to read. No tiny inset houses, no repeated stages, no extra people, no extra objects. No arrows are needed.
Text constraints: the ONLY visible text should be the upper bubble "이 설계대로 지어 줘", the lower human bubble "집 지어 줘", the lower AI bubble "이렇게요?", and "AI" on each robot's chest. Bubble tails must point to their correct speakers. Spell Korean exactly, without clipping.
Return a single opaque PNG in the original 1536 × 1024 landscape dimensions.
```

</details>
