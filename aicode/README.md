# AI 코딩 문서

메인 문서는 아래 두 파일이다. 각 편의 원고와 첨부물은 `part1/`, `part2/` 안에서 함께 관리한다. 공통 참고 자료와 집필 메모는 별도 폴더에 둔다.

| 메인 문서 | 용도 |
| --- | --- |
| [ai_coding_part1.md](./part1/ai_coding_part1.md) | 1편 원고 |
| [ai_coding_part2_notes.md](./part2/ai_coding_part2_notes.md) | 2편 원고와 집필 메모 |

## 폴더 구조

```text
aicode/
├── README.md
├── part1/
│   ├── ai_coding_part1.md
│   ├── attachments/   # 1편 원고·발표용 이미지와 동영상
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
| [1편 문서와 첨부물](./part1/README.md) | 원고, 이미지·영상과 제작 기록, 영상 구성안 |
| [2편 문서와 첨부물](./part2/README.md) | 2편 원고·집필 메모와 첨부 이미지 |
| [참고 자료 안내](./references/README.md) | DB·프로젝트 검토, 기술 사례, 위험 평가 보고서, 도식, 캡처, 영상 원본 |
| [정제한 집필 자료](./derived/materials/) | 경험과 사례, 개발 원칙, 확인할 내용, 문장 검토 기록 |
| [영상 구성안](./part1/presentation/ai_coding_part1_storyboard.md) | 1편을 바탕으로 정리한 화면 내용과 대사 |
| [세미나 발표](./part1/seminar/README.md) | 개발자와 대표를 대상으로 한 30분 경험담 공유 자료 |
| [후속 글 초안](./derived/AI_AFTER_SOFTWARE.md) | AI 이후 소프트웨어 산업과 아키텍처 |
| [집필·편집 지침](./derived/WRITING_GUIDE.md) | 기존 README의 문체·용어·사실 확인 기준과 자료별 설명 |
| [이전 초안](./archive/) | 경험담 원문, 통합 초안, 기존 원칙 초안 |

블로그 발행본은 [_posts/2026-09-20-ai-coding-part1.md](../_posts/2026-09-20-ai-coding-part1.md)에 있다. 원고를 수정할 때는 [집필·편집 지침](./derived/WRITING_GUIDE.md)을 함께 확인한다. 편집 중에는 원고만 수정하고, 블로그 발행본은 저자가 반영을 요청할 때 변경 사항을 한 번에 모아 갱신한다.

## 자료를 추가할 때

- 각 편의 원고는 해당 `part1/`, `part2/`에, 이미지·영상은 그 안의 `attachments/`에 둔다. 원고와 블로그에서 같은 파일을 참조한다.
- 첨부파일 이름은 내용과 용도를 나타내는 영문 소문자와 하이픈으로 짓는다. 예: `white-tower-control-remake.mp4`, `microsoft-macro-assembler-bible-cover.jpg`.
- 특정 편에서 파생된 영상 구성안은 해당 편의 `presentation/`에 두고, 같은 편의 첨부물을 참조한다.
- 세미나 발표용 PPT와 발표자 노트는 해당 편의 `seminar/`에 두고, 이미지·영상 원본은 같은 편의 `attachments/`에서 관리한다.
- 근거로 읽는 문서, 참고용 캡처, 사용하지 않은 이미지·영상 후보는 `references/`에 둔다.
- 두 편에 걸친 집필 메모·편집 지침과 별도 후속 글은 `derived/`에, 이전 초안 원문은 `archive/`에 둔다.
- 파일을 옮기거나 이름을 바꾸면 원고·집필 메모·구성안·발행본의 링크와 해당 폴더의 안내도 함께 수정한다.
