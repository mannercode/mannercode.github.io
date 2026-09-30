# AI 코딩 문서

메인 문서는 아래 두 파일이다. 1편은 블로그 게시용 파일을 정본으로 삼고, 본문 첨부물은 `assets/aicode/part1/`에서 관리한다. 발표 자료와 후보 첨부물은 `aicode/part1/`에 둔다. 2편 원고와 첨부물은 `part2/`에, 공통 참고 자료와 집필 메모는 별도 폴더에 둔다.

| 메인 문서 | 용도 |
| --- | --- |
| [2026-09-20-ai-coding-part1.md](../_posts/2026-09-20-ai-coding-part1.md) | 1편 정본·블로그 원고 |
| [ai_coding_part2_notes.md](./part2/ai_coding_part2_notes.md) | 2편 원고와 집필 메모 |

## 폴더 구조

```text
assets/aicode/part1/   # 1편 블로그 본문 이미지·영상과 출처 안내

aicode/
├── README.md
├── part1/
│   ├── attachments/   # 발표용·후보 이미지와 동영상
│   ├── presentation/  # 1편 영상 구성안
│   └── seminar/       # 1편 세미나 PPT와 발표자 노트
├── part2/
│   ├── ai_coding_part2_notes.md
│   └── attachments/   # 2편 첨부물
├── references/    # 검토 보고서, 사례 연구, 참고 원본·후보 자료
├── derived/       # 공통 집필 자료, 후속 글, 편집 지침
└── archive/       # 이전 초안 원문
```

| 위치 | 내용 |
| --- | --- |
| [1편 본문 첨부물](../assets/aicode/part1/README.md) | 블로그 본문의 이미지·영상과 출처 |
| [1편 발표·후보 자료](./part1/) | 발표 자료, 후보 첨부물과 제작 기록 |
| [2편 문서와 첨부물](./part2/README.md) | 2편 원고·집필 메모와 첨부 이미지 |
| [참고 자료 안내](./references/README.md) | DB·프로젝트 검토, 기술 사례, 위험 평가 보고서, 도식, 캡처, 영상 원본 |
| [정제한 집필 자료](./derived/materials/) | 경험과 사례, 개발 원칙, 확인할 내용, 문장 검토 기록 |
| [영상 구성안](./part1/presentation/ai_coding_part1_storyboard.md) | 1편을 바탕으로 정리한 화면 내용과 대사 |
| [세미나 발표](./part1/seminar/README.md) | 개발자와 대표를 대상으로 한 30분 경험담 공유 자료 |
| [후속 글 초안](./derived/AI_AFTER_SOFTWARE.md) | AI 이후 소프트웨어 산업과 아키텍처 |
| [집필·편집 지침](./derived/WRITING_GUIDE.md) | 기존 README의 문체·용어·사실 확인 기준과 자료별 설명 |
| [이전 초안](./archive/) | 경험담 원문, 통합 초안, 기존 원칙 초안 |

1편의 본문 수정은 [_posts/2026-09-20-ai-coding-part1.md](../_posts/2026-09-20-ai-coding-part1.md)에 직접 반영한다. 별도의 작업용 본문을 두거나 두 파일을 동기화하지 않는다. 원고를 수정할 때는 [집필·편집 지침](./derived/WRITING_GUIDE.md)을 함께 확인한다.

## 자료를 추가할 때

- 1편 원고는 `_posts/2026-09-20-ai-coding-part1.md`에서, 본문 이미지·영상은 `assets/aicode/part1/`에서 관리한다. 2편 원고는 `part2/ai_coding_part2_notes.md`에, 첨부물은 `part2/attachments/`에 둔다.
- 첨부파일 이름은 내용과 용도를 나타내는 영문 소문자와 하이픈으로 짓는다. 예: `white-tower-control-remake.mp4`, `microsoft-macro-assembler-bible-cover.jpg`.
- 특정 편에서 파생된 영상 구성안과 발표 자료는 해당 편의 `presentation/` 또는 `seminar/`에 둔다. 1편 본문과 함께 쓰는 이미지·영상은 `assets/aicode/part1/`의 파일을 참조하고, 발표 전용 첨부물과 후보 자료는 `part1/attachments/`에서 관리한다.
- 근거로 읽는 문서, 참고용 캡처, 사용하지 않은 이미지·영상 후보는 `references/`에 둔다.
- 두 편에 걸친 집필 메모·편집 지침과 별도 후속 글은 `derived/`에, 이전 초안 원문은 `archive/`에 둔다.
- 파일을 옮기거나 이름을 바꾸면 원고·집필 메모·구성안·발행본의 링크와 해당 폴더의 안내도 함께 수정한다.
