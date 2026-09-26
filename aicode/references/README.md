# 참고 자료

원고의 근거로 읽는 보고서와 사례 연구, 참고용 이미지·영상 원본을 모았다. 본문용 첨부물은 [1편](../part1/attachments/README.md)과 [2편](../part2/README.md)의 각 폴더에, 이 자료들을 정제한 집필 메모는 [derived/materials/](../derived/materials/)에 있다.

## 검토 보고서와 사례 연구

| 자료 | 내용 |
| --- | --- |
| [DB_SCHEMA_COMPLEXITY.md](./DB_SCHEMA_COMPLEXITY.md) | 운영 DB 구조의 변화·복잡성 원인·근거와 영상 구성 자료 |
| [PROJECT_REVIEW_2026-09-04.md](./PROJECT_REVIEW_2026-09-04.md) | 프로젝트 전체와 테스트에 대한 검토 기록 |
| [k6 설치 사례](./k6-installation-case-study.md) | Dev Container 설치에서 Docker 실행으로 바뀐 과정과 판단 |
| [NATS JetStream 테스트 경합 사례](./nats-jetstream-test-race.md) | 테스트 실패를 조사하며 전제와 검증 범위를 교정한 과정 |
| [프로젝트 기술 위험 평가](./platform-risk-assessment/project-risk-assessment.md) | 위험 평가 요약. [HTML 보고서](./platform-risk-assessment/report.html)와 [JSON 자료](./platform-risk-assessment/artifact.json)를 같은 폴더에 보관 |

사례 연구 본문의 `apps/`, `tests/`, `deploy/` 같은 코드 경로는 사례가 다루는 원본 프로젝트를 기준으로 한다.

## 도식

| 자료 | 내용 |
| --- | --- |
| [SYSTEM_USE_CASES.puml](./diagrams/SYSTEM_USE_CASES.puml) · [SVG](./diagrams/SYSTEM_USE_CASES.svg) | 전시 운영 시스템 유스케이스의 PlantUML 원본과 그림 |
| [system-use-cases-original.svg](./diagrams/system-use-cases-original.svg) · [PNG](./diagrams/system-use-cases-original.png) | 기존에 긴 자동 생성 파일명으로 보관하던 유스케이스 그림 |

## 이미지와 영상

| 자료 | 내용 |
| --- | --- |
| [almost-solved-cube.png](./images/almost-solved-cube.png) | 본문에 사용하지 않은 큐브 삽화 시안. [생성 기록](./images/almost-solved-cube.prompt.md) |
| [ai-agent-collaboration.png](./images/ai-agent-collaboration.png) | GitHub 이슈로 작업을 주고받는 AI 에이전트 화면. 기존 `IMG_2018.png` |
| [github-projects-original.png](./images/github-projects-original.png) | GitHub Projects 원본 캡처. 2026-08-25 18:10:58 |
| [github-issue-local-validation.png](./images/github-issue-local-validation.png) | 로컬 서버·앱 연결과 검증 조건을 기록한 이슈. 2026-08-25 18:11:32 |
| [external-channel-integration.png](./images/external-channel-integration.png) | 외부 판매 채널 연동의 구현 상태를 확인한 대화. 2026-08-26 19:04:50 |
| [영상 원본·후보 자료](./videos/README.md) | 《하얀거탑》 전체 클립과 대사 발췌, 편집 영상의 출처 |

본문의 GitHub Projects 이미지는 [저자가 편집한 첨부물](../part1/attachments/github-projects.png)을 사용한다.
