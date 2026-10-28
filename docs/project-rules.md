# AgentForge 프로젝트 규칙 (v2)

> CLAUDE.md 끝에 `@docs/project-rules.md` 한 줄로 연결해 모든 에이전트가 읽게 한다.
> 요구사항 기준 문서: `docs/prd.md` (기능 ID로 참조). 동작 기준 구현: `docs/reference/poc.html` (화면·생성 로직·생성 스크립트 원본).

## 제품 원칙 (모든 판단의 기준)
1. **앱은 AI를 호출하지 않는다.** LLM API 호출 코드, API 키 입력 화면을 만들지 않는다(BYOK-01은 P2, 별도 승인 전 구현 금지). 내용 생성은 생성물에 동봉한 스킬(`/forge-init`, `/forge-agents`)이 사용자의 Claude Code에서 한다.
2. **구조는 템플릿, 내용은 AI, 판정은 스크립트.** 에이전트 frontmatter·작업 순서·스크립트·hook은 결정적으로 렌더링한다. AI가 채우는 곳은 PRD, CLAUDE.md PROJECT 구간, 개발자 전용 스킬 본문, tasks.md 기반 보완뿐이다. 통과/실패는 `check-forge.sh`·`wait-and-review.sh`가 판정한다.
3. **사용자 PC에서 명령을 실행하지 않는다.** 실행은 생성물(scripts/*.sh, VS Code tasks)이 사용자 환경에서 한다.
4. **인증 정보를 다루지 않는다.** Claude 로그인과 제공자 키는 사용자가 생성된 `.agentforge/env.local`에 직접 넣는다. 구독 OAuth는 어떤 형태로도 쓰지 않는다. GitHub 토큰은 푸시 요청 한 번에만 쓰고 저장하지 않는다.

## 생성 루틴 (사용자 프로젝트에 만들어지는 것)
기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증
- 병렬 실행은 독립 세션(tmux pane마다 `claude --agent <이름>`) + git worktree + 신호 파일 방식만 지원한다. Agent Teams 모드는 만들지 않는다.

## 기술 스택
- TypeScript(strict), Node 22 LTS, pnpm workspaces 모노레포
- core: zod — 순수 함수만. 템플릿은 `{{KEY}}` 자리표시 + TS 렌더 함수(ADR-0002)
- exporter: jszip(브라우저·Node 공용), Octokit(GitHub·GHES)
- server(선택 배포): Fastify — 마켓플레이스 색인 캐시, GHES·GitLab 중계, 라이선스 검증
- web: React + Vite, TanStack Query, Tailwind, i18next(ko 원본, en 번역)
- 테스트: Vitest(단위·스냅샷), fast-check(속성), bats(생성된 셸 스크립트), shellcheck, Playwright(E2E)

## 저장소 구조와 담당
| 경로 | 내용 | 담당 |
| --- | --- | --- |
| `packages/core/src/schema/` | zod 스키마(Project, Requirement, Routine, SeqAgent, Dev, Skill, Provider, Commands) | 공통(리드 승인 필요) |
| `packages/core/src/render/` | 렌더러(claude-md, readme, agents, dev-agents, skills, settings, agent-env, config, env-example, litellm, vscode) | dev1 |
| `templates/static/` | PoC에서 검증된 정적 스크립트 원본(setup, run-role, check-forge, create-worktrees, run-agents, wait-and-review, integrate, start-gateway, guard-paths) | dev1(변경 시 리드 승인) |
| `templates/md/` | 에이전트·스킬·PRD 템플릿(`{{N}}` `{{DOMAIN}}` `{{MODEL}}` 등 자리표시) | dev1 |
| `packages/exporter/` | ZIP 생성, GitHub·GHES 푸시 | dev2 |
| `tests/scripts/` | bats·모의 실행(가짜 claude, tmux 중계, guard·check-forge 사례) | dev2 |
| `packages/server/` | 마켓플레이스 색인, 라이선스 | dev2 |
| `packages/web/` | 6단계 화면(요구사항·루틴·개발자·스킬·연결·생성), 미리보기, i18n | dev3 |
| `catalog/` | 제공자·추천 모델, 마켓플레이스 소스 목록(오프라인 기본값) | 공통 |

## 명령어
- 설치 `pnpm install` / 개발 서버 `pnpm dev` / 빌드 `pnpm build`
- 테스트 `pnpm test` / 패키지별 `pnpm --filter @agentforge/core test`
- 스냅샷 갱신(의도한 템플릿 변경만) `pnpm --filter @agentforge/core test -u`
- 생성 스크립트 검사 `pnpm test:scripts` (bash -n + shellcheck + bats + 모의 병렬 실행)
- 타입·린트 `pnpm typecheck && pnpm lint`

## 아키텍처 규칙
- core는 I/O 금지. `render(project): RenderedFile[]` (path, content, mode, author: "template" | "ai-fill")만 반환한다. 같은 입력이면 같은 출력.
- 타입은 zod 스키마에서 `z.infer`로만 만든다. web·exporter·server가 같은 타입을 import한다.
- `templates/static/`의 스크립트는 그대로 복사한다(문자열 조립 금지). 수정하면 bash -n·shellcheck·bats·모의 실행을 모두 다시 통과해야 한다.
- 동적 스크립트는 `scripts/agent-env.sh`의 에이전트 이름별 `case` 블록 하나뿐이다. 제공자별 분기는 `providers/<id>.ts`에만 둔다. 비 Claude 제공자는 `ANTHROPIC_DEFAULT_OPUS/SONNET/HAIKU_MODEL`을 같은 모델로 매핑하고 에이전트 frontmatter `model`은 `inherit`.
- UI/UX 설계 토글(RTN-01)이 꺼지면 ux-designer 정의, `docs/design/ui/`, README·CLAUDE.md 루틴 문구에서 일관되게 빠져야 한다.
- 개발자 정보가 비어 있으면 dev-N·review-N·paths·전용 스킬을 만들지 않는다(`/forge-agents`에 위임). 일부만 생성하지 않는다.
- ZIP과 GitHub 푸시는 같은 `RenderedFile[]`을 쓴다. 두 결과의 내용이 같은지 테스트로 보장한다.
- 실행 권한: `.sh`는 mode 0o755(ZIP 외부 속성, Git tree mode 100755). 줄바꿈 LF 고정.
- 개발자 수(1~상한)는 가변이다. `developerCount === devs.length`는 zod superRefine으로 검증한다.
- CLAUDE.md 자동 구간은 `<!-- AGENTFORGE:PROJECT|AGENTS|DEVS|SKILLS:BEGIN/END -->` 마커로 감싼다. 재생성 시 마커 안만 교체하는 `mergeClaudeMd(old, new)`를 둔다(PROJECT 구간은 사용자·AI 소유이므로 재생성 시 보존).

## 보안 규칙 (위반 시 반려)
- 사용자 입력(이름, 경로, 도메인, 모델 ID, 주소, 명령)은 zod 허용 패턴으로 검증한 뒤 템플릿에 넣는다. 셸 스크립트에 들어가는 값은 반드시 `shQuote`를 거친다. 담당 폴더는 저장소 루트 기준 상대 접두어만 허용(절대 경로·`..` 금지).
- 생성되는 settings.json은 env.local 읽기 거부, push·merge·checkout·rm -rf 거부를 항상 포함한다.
- 비밀 값은 생성물·로그·localStorage·서버 DB 어디에도 쓰지 않는다. env.local.example에는 키 이름만 쓴다.
- 마켓플레이스에서 가져온 스킬·에이전트는 위험 패턴(scripts/, `!` 명령, `allowed-tools: Bash(*)`, `permissionMode: bypassPermissions`, 원격 다운로드)을 검사하고, 위험 항목은 사용자 확인 없이는 포함하지 않는다.
- 외부 CDN을 쓰지 않는다(폐쇄망 설치형). 폰트·라이브러리는 번들에 포함한다.

## 코딩 규칙
- `any` 금지, ESM만 사용. 파일 kebab-case, 컴포넌트 PascalCase.
- UI 문자열은 i18n 키만 사용. ko·en 누락이나 변수 불일치는 CI 실패.
- 오류는 `AppError(code, params)`로 던지고 문장은 web에서 만든다.

## 테스트 기준
- core 스냅샷 대표 구성 6종: 기본(UI 켬·개발자 3·vLLM+OpenRouter) / UI 끔 / 개발자 1명 / 6명 / 개발자 정보 비움(`/forge-agents` 위임) / LiteLLM+마켓 가져오기.
- 생성 셸 스크립트: 모든 구성에서 `bash -n`, shellcheck 경고 0.
- bats:
  - setup.sh: 새 폴더, 두 번 실행, CRLF, 도구 누락
  - guard-paths.sh: 범위 안 허용, 범위 밖 차단(exit 2), 상대 경로, `../` 우회, AF_AGENT 없음, paths 파일 없음
  - check-forge.sh: 통과, 범위 겹침, 스킬 참조 누락, paths 누락, 기능 ID 미배정, prd/tasks 없음
  - agent-env.sh: 에이전트별 BASE_URL·MODEL, 키 누락 시 오류
- 모의 병렬 실행: 가짜 `claude`로 create-worktrees → run-agents → 신호 파일 → 해당 pane 메시지 도착, 범위 밖 변경 감지, 반려 한도 도달 시 `dev-N.blocked`.
- 개발자 수 변경(3→5→2), UI 토글 변경 시 에이전트·스크립트·CLAUDE.md 표가 일관되게 바뀌는지 fast-check로 검증.
- E2E: 6단계 진행 → ZIP 다운로드 → 임시 폴더에 풀기 → setup.sh → check-forge.sh(문서 더미 포함) → 파일 목록·권한 확인.

## 작업 방식
- **단계별 개발**: `docs/prd.md` 10장의 "현재 단계"를 먼저 확인하고, 그 단계에 포함된 기능 ID만 구현한다. 다른 단계 기능이 필요해 보이면 구현하지 말고 report에 적는다. 단계 전환은 사람만 한다.
- 시작 전 `docs/tasks.md`에서 내 작업 ID와 담당 폴더를 확인한다. 한 세션에 작업 ID 1~2개만 처리한다.
- 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 커밋 `[역할] 작업ID 요약`. 완료 시 `docs/report-<역할>.md` 작성 후 완료 신호 파일 생성.
- 설계 결정 변경은 `docs/adr/NNNN-제목.md`에 기록한다.
- 제품명·UI에 "Claude", "Anthropic"을 제품명처럼 쓰지 않는다(호환성 설명만 허용). GPL 계열 의존성 금지.
