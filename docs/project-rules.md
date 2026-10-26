# AgentForge 프로젝트 규칙

> CLAUDE.md 끝에 `@docs/project-rules.md` 한 줄로 연결해 모든 에이전트가 읽게 한다.
> 요구사항 기준 문서: `docs/prd.md` (기능 ID로 참조). 동작 기준 구현: `docs/reference/poc.html`.

## 제품 원칙 (모든 판단의 기준)
1. **AI를 호출하지 않는다.** 앱은 설정값을 받아 파일을 결정적으로 생성할 뿐이다. LLM API 호출 코드, API 키 입력 화면을 만들지 않는다.
2. **사용자의 개발 내용에 관여하지 않는다.** PRD는 빈 양식, CLAUDE.md는 "병렬 개발 기본 기준(고정) + 자동 등록 구간(에이전트·개발자·스킬)"만 만든다.
3. **사용자 PC에서 명령을 실행하지 않는다.** 실행은 생성물(run-agents.sh, VS Code tasks)이 사용자 환경에서 한다.
4. **인증 정보를 다루지 않는다.** Claude 로그인, 각 제공자 API 키는 사용자가 생성된 `.agentforge/env.local`에 직접 넣는다. GitHub 토큰은 푸시 요청 한 번에만 쓰고 저장하지 않는다.

## 기술 스택
- TypeScript(strict), Node 22 LTS, pnpm workspaces 모노레포
- core: zod, eta(템플릿) — 순수 함수만
- exporter: jszip(브라우저·Node 공용), Octokit(GitHub·GHES)
- server(선택 배포): Fastify — 마켓플레이스 색인 캐시, GHES·GitLab 중계, 라이선스 검증
- web: React + Vite, TanStack Query, Tailwind, i18next(ko 원본, en 번역)
- 테스트: Vitest(단위·스냅샷), fast-check(속성), bats(생성된 셸 스크립트), shellcheck, Playwright(E2E)

## 저장소 구조와 담당
| 경로 | 내용 | 담당 |
| --- | --- | --- |
| `packages/core/src/schema/` | zod 스키마(Project, Role, Provider, Dev, Skill, TmuxConfig) | 공통(리드 승인 필요) |
| `packages/core/src/render/` | 파일 렌더러(claude-md, prd, agents, skills, scripts, tmux, vscode, devcontainer, litellm) | dev1 |
| `templates/` | eta 템플릿, 내장 스킬 본문 | dev1 |
| `packages/exporter/` | ZIP 생성, GitHub·GHES 푸시 | dev2 |
| `packages/server/` | 마켓플레이스 색인, 라이선스 | dev2 |
| `packages/web/` | 6단계 화면, 미리보기, i18n | dev3 |
| `catalog/` | 제공자·모델 추천, 마켓플레이스 소스 목록(오프라인 기본값) | 공통 |

## 명령어
- 설치 `pnpm install` / 개발 서버 `pnpm dev` / 빌드 `pnpm build`
- 테스트 `pnpm test` / 패키지별 `pnpm --filter @agentforge/core test`
- 스냅샷 갱신(의도한 템플릿 변경만) `pnpm --filter @agentforge/core test -u`
- 생성 스크립트 검사 `pnpm test:scripts` (bash -n + shellcheck + bats)
- 타입·린트 `pnpm typecheck && pnpm lint`

## 아키텍처 규칙
- core는 I/O 금지. `render(project): RenderedFile[]` (path, content, mode)만 반환한다. 같은 입력이면 같은 출력(날짜는 인자로 주입).
- 타입은 zod 스키마에서 `z.infer`로만 만든다. web·exporter·server가 같은 타입을 import한다.
- ZIP과 GitHub 푸시는 같은 `RenderedFile[]`을 쓴다. 두 결과의 내용이 같은지 테스트로 보장한다.
- 실행 권한: `.sh`는 mode 0o755(ZIP 외부 속성, Git tree mode 100755). 줄바꿈 LF 고정.
- 역할 실행 환경은 생성되는 `scripts/agent-env.sh` 한 곳에서 결정한다(ANTHROPIC_BASE_URL·모델 고정). 렌더러에서 제공자별 분기는 `providers/<id>.ts`에만 둔다.
- 제공자가 2개 이상 섞이면 실행 모드는 스크립트 모드로 강제한다(Agent Teams는 리드 설정을 물려받음).
- 개발자 수(1~상한)는 가변이다. 개발자 3명을 하드코딩하지 않는다. `developerCount === devs.length`는 zod superRefine으로 검증한다.
- CLAUDE.md 자동 등록 구간은 `<!-- AGENTFORGE:AGENTS|DEVS|SKILLS:BEGIN/END -->` 마커로 감싼다. 재생성 시 마커 안만 교체하는 `mergeClaudeMd(old, new)`를 둔다.

## 보안 규칙 (위반 시 반려)
- 사용자 입력(이름, 경로, 모델 ID, 주소)은 zod 허용 패턴으로 검증한 뒤 템플릿에 넣는다. 셸 스크립트에 들어가는 값은 반드시 작은따옴표 이스케이프 함수(`shQuote`)를 거친다.
- 비밀 값은 생성물·로그·localStorage·서버 DB 어디에도 쓰지 않는다. env.local.example에는 키 이름만 쓴다.
- 마켓플레이스에서 가져온 스킬·에이전트는 위험 패턴(scripts/, `!` 명령, `allowed-tools: Bash(*)`, `permissionMode: bypassPermissions`, 원격 다운로드)을 검사하고, 위험 항목은 사용자 확인 없이는 포함하지 않는다.
- 외부 CDN을 쓰지 않는다(폐쇄망 설치형). 폰트·라이브러리는 번들에 포함한다.

## 코딩 규칙
- `any` 금지, ESM만 사용. 파일 kebab-case, 컴포넌트 PascalCase.
- UI 문자열은 i18n 키만 사용. ko·en 누락이나 변수 불일치는 CI 실패.
- 오류는 `AppError(code, params)`로 던지고 문장은 web에서 만든다.

## 테스트 기준
- core: 대표 구성 6종 스냅샷(단일 제공자 / 제공자 혼용+LiteLLM / 개발자 1명 / 6명 / 개발별 검증 끔 / 마켓 가져오기 포함), tmux 배치 3종 × 각각.
- 생성 셸 스크립트: 모든 구성에서 `bash -n`, shellcheck 경고 0, bats로 setup.sh(새 폴더, 기존 파일, 두 번 실행, CRLF) 검증.
- 개발자 수 변경(3→5→2) 시 역할·스크립트·CLAUDE.md 표가 일관되게 바뀌는지 fast-check로 검증.
- E2E: 6단계 진행 → ZIP 다운로드 → 임시 폴더에 풀기 → setup.sh → 파일 목록·권한 확인.

## 작업 방식
- **단계별 개발**: `docs/prd.md` 8장의 "현재 단계"를 먼저 확인하고, 그 단계에 포함된 기능 ID만 구현한다. 다른 단계 기능이 필요해 보이면 구현하지 말고 report에 적는다. 단계 전환은 사람만 한다.
- 시작 전 `docs/tasks.md`에서 내 작업 ID와 담당 폴더를 확인한다. 한 세션에 작업 ID 1~2개만 처리한다.
- 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 커밋 `[역할] 작업ID 요약`. 완료 시 `docs/report-<역할>.md` 작성 후 완료 신호 파일 생성.
- 설계 결정 변경은 `docs/adr/NNNN-제목.md`에 기록한다.
- 제품명·UI에 "Claude", "Anthropic"을 제품명처럼 쓰지 않는다(호환성 설명만 허용). GPL 계열 의존성 금지.
