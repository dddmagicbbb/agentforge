# 프로젝트 규칙

- 모든 답변과 문서는 한국어로 쓴다. 코드 식별자는 영어.
- 요구사항 기준은 docs/prd.md(기능 ID), 작업 배정은 docs/tasks.md.

## 개발 루틴
기획 → 분석 → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증
- 단계 전환은 사람이 한다. 관문 조건을 확인해 보고만 하고 다음 단계를 시작하지 않는다.

## 병렬 개발 기본 기준
- 각 개발자는 자기 worktree(feature/devN)에서만 작업한다. 브랜치를 바꾸거나 병합하지 않는다.
- 담당 범위는 .claude/devs/<에이전트>.paths. 범위 밖 변경이 필요하면 report에 적고 멈춘다.
- API 계약·공통 모듈은 읽기 전용. 변경은 리드가 develop에서만 한다.
- 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 커밋 메시지: [에이전트] 작업ID 요약
- 완료·요청은 신호 파일로 알린다: touch "$AF_SIGNALS/<신호>"

<!-- AGENTFORGE:PROJECT:BEGIN -->
(/forge-init 이 채움: 소개, 기술 스택, 명령어, 폴더 구조)
<!-- AGENTFORGE:PROJECT:END -->

<!-- AGENTFORGE:AGENTS:BEGIN -->
| 에이전트 | 단계 | 모델 |
| --- | --- | --- |
| planner | 기획 | OpenAI · gpt-5.5 |
| analyst | 분석 | Claude opus |
| architect | 시스템 설계 | Claude opus |
| common-dev | 공통 개발 | Claude sonnet |
| integrator | 통합 검증 | Claude opus |
<!-- AGENTFORGE:AGENTS:END -->

<!-- AGENTFORGE:DEVS:BEGIN -->
| 에이전트 | 도메인 | 담당 폴더 | 모델(개발 / 검증) |
| --- | --- | --- | --- |
| dev-1 / review-1 | ingest | src/ingest/ | Gemini · gemini-2.5-pro / Claude opus |
| dev-2 / review-2 | report | src/report/ tests/report/ | Ollama · qwen3.5:9b / OpenAI · gpt-5.5 |
<!-- AGENTFORGE:DEVS:END -->

<!-- AGENTFORGE:SKILLS:BEGIN -->
| 스킬 | 계층 | 사용 에이전트 |
| --- | --- | --- |
| conventions | 공통 | dev-* · review-* · common-dev |
| detail-design | 역할 | dev-* |
| code-review | 역할 | review-* · integrator |
| forge-init | 생성 | 사용자가 /forge-init 으로 실행 |
| forge-agents | 생성 | 사용자가 /forge-agents 로 실행 |
| dev1-ingest | 개발자 전용 | dev-1 · review-1 |
| dev2-report | 개발자 전용 | dev-2 · review-2 |
<!-- AGENTFORGE:SKILLS:END -->
