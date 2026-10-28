# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 프로젝트 규칙

- 모든 답변과 문서는 한국어로 쓴다. 코드 식별자는 영어, 코드 주석은 한국어.
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
## 프로젝트
AgentForge — Claude Code 멀티 에이전트 병렬 개발 환경 생성기. 설정값 → 에이전트·스킬·hook·스크립트를 결정적으로 렌더링해 ZIP/GitHub로 내보낸다. 앱은 AI를 호출하지 않는다.

| 문서 | 용도 |
| --- | --- |
| `docs/prd.md` | 요구사항(기능 ID: `REQ-01`, `RUN-02` …). **10장 "현재 단계"** 의 기능 ID만 구현 |
| `docs/project-rules.md` | 원칙·스택·저장소 구조·명령어·아키텍처/보안/테스트 규칙 (끝의 `@` 링크로 로드) |
| `docs/reference/poc.html` | 동작 기준 구현. 화면·생성 로직·생성 스크립트 원본 |
| `docs/design.md`, `docs/tasks.md`, `docs/adr/` | PH1 설계 산출물(스키마·core API·렌더러 대응표 / 작업 배정 / 결정 기록) |

**AgentForge 자체 개발 단계 ↔ 위 루틴**: PH1 설계 = 분석+시스템 설계(리드 단일 세션) → PH2 골격 = 공통 개발 → PH3 세로 한 줄(리드) → PH4 = dev-1..3 병렬 + review-1..3 → PH5 = 통합 검증. 순차 단계 에이전트(planner 등)는 이 저장소에서는 선택적으로만 쓴다.

**명령어**: PH2(pnpm 모노레포) 이전에는 빌드·테스트가 없다. 이후 `project-rules.md`의 명령어를 쓴다. 생성 스크립트(`scripts/`, `.claude/hooks/`)는 bash·jq·tmux가 필요하므로 WSL Ubuntu에서 실행한다(예: `bash scripts/check-forge.sh`).

**PoC(`poc.html`) 이식 지도**
- `const STATIC = {...}`: 정적 원본 26종(스크립트 9 + `agent-env.head` + `md/*` 템플릿 16) → `templates/static/`, `templates/md/`로 **그대로** 이관.
- `/*GEN-START*/ … /*GEN-END*/`: DOM 없이 실행 가능한 생성 로직. `PROVIDERS`(via: claude/openrouter/ollama/vllm/litellm), `SEQ`·`FINAL`(순차 에이전트), `CORE_SKILLS`, `MARKET`, `DEF()`(입력 스키마 원본), `gen*` 렌더러, `buildFiles()`(생성 파일 목록·`exec`·`ai` 플래그의 단일 출처), `checks()`(화면 경고 PRV-04).
- 그 아래는 화면(`p0`~`p5`)과 `exportZip`. jszip CDN·Google Fonts·localStorage 상태 저장은 제품 규칙(폐쇄망) 위반이므로 이식하지 않는다.
- golden 출력 생성: PoC GEN 구간을 Node `vm`으로 실행하면 된다(이 저장소의 `.claude/`·`scripts/`가 그렇게 만든 PH0 산출물).
<!-- AGENTFORGE:PROJECT:END -->

<!-- AGENTFORGE:AGENTS:BEGIN -->
| 에이전트 | 단계 | 모델 |
| --- | --- | --- |
| planner | 기획 | Claude opus |
| analyst | 분석 | Claude opus |
| architect | 시스템 설계 | Claude opus |
| common-dev | 공통 개발 | Claude sonnet |
| integrator | 통합 검증 | Claude opus |
<!-- AGENTFORGE:AGENTS:END -->

<!-- AGENTFORGE:DEVS:BEGIN -->
| 에이전트 | 도메인 | 담당 폴더 | 모델(개발 / 검증) |
| --- | --- | --- | --- |
| dev-1 / review-1 | core | packages/core/ templates/ | Claude sonnet / Claude opus |
| dev-2 / review-2 | exporter | packages/exporter/ packages/server/ tests/scripts/ | Claude sonnet / Claude opus |
| dev-3 / review-3 | web | packages/web/ | Claude sonnet / Claude opus |
<!-- AGENTFORGE:DEVS:END -->

<!-- AGENTFORGE:SKILLS:BEGIN -->
| 스킬 | 계층 | 사용 에이전트 |
| --- | --- | --- |
| conventions | 공통 | dev-* · review-* · common-dev |
| tdd | 공통 | dev-* · common-dev |
| detail-design | 역할 | dev-* |
| code-review | 역할 | review-* · integrator |
| forge-init | 생성 | 사용자가 /forge-init 으로 실행 |
| forge-agents | 생성 | 사용자가 /forge-agents 로 실행 |
| dev1-core | 개발자 전용 | dev-1 · review-1 |
| dev2-exporter | 개발자 전용 | dev-2 · review-2 |
| dev3-web | 개발자 전용 | dev-3 · review-3 |
<!-- AGENTFORGE:SKILLS:END -->

## Git 운영
- 원격: `https://github.com/dddmagicbbb/agentforge` (private, 기본 브랜치 `main`)
- **작업 전 pull**: `.claude/hooks/git-pull.sh`(`git pull --rebase --autostash`)를 SessionStart·UserPromptSubmit 훅으로 실행한다. pull 실패 경고가 보이면 충돌부터 해결한다.
- **커밋 후 자동 push**: `.githooks/post-commit`이 현재 브랜치를 `origin`으로 push 한다(settings.json의 `git push` 거부와 무관하게 git 훅에서 실행). 일시 중지는 `AGENTFORGE_NO_AUTOPUSH=1`.
- 새로 clone 한 PC에서는 `git config core.hooksPath .githooks`를 한 번 실행한다.

@docs/project-rules.md
