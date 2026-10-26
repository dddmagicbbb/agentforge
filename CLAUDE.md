# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어
- 모든 질문·답변·보고서·커밋 요약·문서는 **한국어**로 작성한다. 코드 식별자와 표준 기술 용어는 영어 원문을 유지하고, 코드 주석은 한국어로 쓴다.

## 프로젝트 개요
AgentForge는 **Claude Code 멀티 에이전트 개발 환경 생성기**다. 사용자가 입력한 설정값으로 CLAUDE.md, `.claude/agents/*.md`, 스킬, tmux·VS Code 실행 스크립트 등을 **결정적으로 생성**해 ZIP/GitHub로 내보낸다. 앱 자체는 AI를 호출하지 않는다.

## 기준 문서 (우선순위 순)
| 문서 | 용도 |
| --- | --- |
| `docs/prd.md` | 요구사항 기준. 기능은 **기능 ID**(`ENV-01`, `TMX-02` 등)로 참조한다. 8장의 **"현재 단계"** 에 포함된 기능 ID만 구현한다. |
| `docs/project-rules.md` | 제품 원칙·기술 스택·저장소 구조·명령어·아키텍처/보안/코딩/테스트 규칙 (아래 `@` 링크로 자동 로드) |
| `docs/reference/poc.html` | **동작 기준 구현**. 생성 로직과 화면 흐름의 정답지. 출력 형식이 애매하면 PoC 출력을 따른다. |

단계 산출물(`docs/design.md`, `docs/tasks.md`, `docs/adr/`, `docs/report*.md`)은 PH1 이후 생성된다. 작업 시작 전 존재 여부를 확인하고 있으면 함께 읽는다.

## 현재 저장소 상태
- 소스 코드는 아직 없다(문서 3개만 존재). pnpm 모노레포·CI·테스트 틀은 **PH2** 산출물이다.
- 따라서 `project-rules.md`의 `pnpm` 명령어는 PH2 이후에만 유효하다. 그 전에 빌드·테스트를 실행하려 하지 말 것.
- PoC 확인: `docs/reference/poc.html`을 브라우저로 직접 연다(빌드 불필요).

## PoC(`poc.html`) 구조 — 이식 시 지도
단일 HTML 안의 IIFE 스크립트 하나로 구성된다.

- **기준 데이터**: `STACKS`(환경 프리셋: legacy/boot/ts/py/custom), `PROV_DEF`(제공자 6종, `type` = `claude` | `anthropic` | `gateway`), `ROLE_META`(역할별 도구·프롬프트), `LIB`(내장 스킬), `DEFAULT_ASSIGN`(역할×스킬), `MARKET`(마켓 예시·위험 flags)
- **상태**: `DEF()`가 전체 설정 객체 `S`의 형태 → PH1 zod 스키마 설계의 원본. `syncDevs()`가 `devCount`와 `devs[]` 길이를 맞춘다.
- **파생 규칙**: `assignments()`(역할→제공자·모델), `mixed()`(제공자 2개 이상 → 스크립트 모드 강제), `usesGateway()`(LiteLLM 필요 여부), `alias()`(게이트웨이 모델 별칭), `sq()`(셸 작은따옴표 이스케이프 → `shQuote`의 원형)
- **생성기**: `gen*` / `doc*` / `agentFile` / `skillFile` / `providerEnv` 함수 → core 렌더러로 이식 대상. `buildFiles()`가 **생성 파일 전체 목록과 조건**(`exec` 플래그 = 0o755)의 단일 출처이므로, 렌더러 대응표·golden 테스트는 여기서 출발한다.
- **화면**: `p0`~`p5`가 6단계 화면, `renderPreview`가 미리보기, `exportZip`이 jszip 내보내기.

PoC를 그대로 옮기면 안 되는 부분(제품 규칙 위반):
- jszip CDN·Google Fonts 로드 → 번들 포함 필요(폐쇄망).
- 전역 가변 상태 `S`와 `new Date()` 직접 호출 → core는 순수 함수, 날짜는 인자 주입.
- UI 문자열·생성물 문구 하드코딩 → i18n 키 사용.
- `MARKET` 데이터는 예시이며 실제 가져오기 로직이 아니다.

## Git 운영
- 원격: `https://github.com/dddmagicbbb/agentforge` (private, 기본 브랜치 `main`)
- **작업 전 pull**: `.claude/settings.json`의 `SessionStart`·`UserPromptSubmit` 훅이 `.claude/hooks/git-pull.sh`(`git pull --rebase --autostash`)를 실행한다. pull 실패 경고가 보이면 충돌부터 해결하고 작업한다.
- **커밋 후 자동 push**: `.githooks/post-commit`이 현재 브랜치를 `origin`으로 push 한다. 별도로 `git push`를 실행하지 않는다. 일시 중지는 `AGENTFORGE_NO_AUTOPUSH=1`.
- 새로 clone 한 PC에서는 한 번 `git config core.hooksPath .githooks`를 실행해야 자동 push가 동작한다.

@docs/project-rules.md
