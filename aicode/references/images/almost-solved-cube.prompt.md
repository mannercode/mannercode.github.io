# 큐브 삽화 생성 기록

- 생성일: 2026년 9월 10일
- 방식: 내장 image_gen 도구, 새 이미지 생성
- 이미지: [거의 맞춘 큐브](./almost-solved-cube.png)
- 용도: AI 코딩 1편에 사용할 삽화 시안
- 저자의 설명: “큐빅은 마지막 하나 맞추기가 가장 어렵듯이 프로젝트도 90%에서 99%로 가는게 어렵다는 걸 설명하고 싶었다.”
- 구성: 거의 맞춘 3×3 큐브에서 마지막 층의 일부 조각만 맞지 않은 모습. 남은 작업의 어려움을 설명하는 비유이며, 프로젝트 진척률이나 작업량을 측정한 그림은 아니다.
- 참고: [루빅스 공식 해법](https://www.rubiks.com/solution-guides)은 마지막 층의 코너 조각과 에지 조각을 맞추는 단계를 구분한다. 그림에서는 하나의 조각만 잘못된 상태로 단정하지 않고 마지막 몇 조각이 남은 상태로 표현했다.

## 최종 생성 프롬프트

```text
Use case: illustration-story
Asset type: a standalone illustration for a Korean blog essay about how difficult the final stage of a software project can be, even after it looks 90% complete.
Primary request: one almost-solved 3-by-3 twisty puzzle cube with just a few last-layer pieces out of place. It must look very close to completion, not half scrambled. The illustration should support the idea that finishing the remaining pieces requires manipulating the already assembled whole.
Scene/backdrop: plain white background, subtle soft contact shadow, no other objects.
Composition: one complete cube centered in a three-quarter view showing the top and two side faces clearly, generous but not excessive margins. Square image. All layers are aligned; the cube is intact.
Exact visible sticker layout: each visible face has exactly 3 rows and 3 columns. The top face has 9 white stickers. The front face has rows RED GREEN RED / RED RED RED / RED RED RED. The right face has rows GREEN ORANGE GREEN / GREEN GREEN GREEN / GREEN GREEN GREEN. This represents three cyclically displaced top-layer edges with a third mismatched sticker on the hidden back face. Match these grids precisely.
Style/medium: restrained, clean 3D editorial illustration with matte colored squares, a dark charcoal plastic frame, crisp geometry, lightly rounded edges and soft daylight. Keep the few mismatched colors easy to see at blog reading size.
Constraints: exactly one 3-by-3 cube. No missing or detached pieces, no additional panels, hands, people, tools, arrows, symbols, text, numbers, labels, logos or watermarks.
```
