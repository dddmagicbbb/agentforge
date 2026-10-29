# AgentForge 설계 (PH1)

> 입력: `docs/prd.md`(v2), `docs/project-rules.md`(v2), `docs/reference/poc.html`(v6 상태, `/*GEN-START*/` 구간)
> 범위: P0 전체의 설계. P1 항목은 스키마 자리와 API 시그니처만 둔다.
> 상태: **G1 승인(2026-10-28)**. 이후 스키마 변경은 ADR + 리드 승인.

## 0. 결정 요약
| # | 결정 | 근거 / ADR |
| --- | --- | --- |
| 1 | core는 순수 함수 패키지. 템플릿은 빌드 시 TS 모듈로 내장(codegen) | I/O 금지, 브라우저·Node 공용 — ADR-0001 |
| 2 | 템플릿 문법은 PoC의 `{{KEY}}` 자리표시 + TS 렌더 함수. eta는 도입하지 않음 | `.agentforge/templates/*.md`가 `{{N}}`을 그대로 담아야 함 — ADR-0002 |
| 3 | 기준 출력(golden)은 PoC GEN 구간을 Node `vm`으로 실행해 만든다. 의도적 차이는 목록으로 관리 | 동작 기준 = PoC — ADR-0003 |
| 4 | 입력은 `ProjectDraft`(편집 중, 느슨) → `validate()` → `Project`(검증됨, branded). `render()`는 `Project`만 받는다 | 화면은 오류 상태를 그려야 하고, 렌더러는 오류 입력을 받지 않아야 함 |
| 5 | 담당 폴더는 정규화 시 끝에 `/`를 붙인다 | `src/order`가 `src/orders`와 접두어로 겹치는 PoC 결함(D4) |

## 1. 구조와 의존 방향
```
packages/web ──┐
packages/exporter ──► packages/core ◄── packages/server(P1)
packages/server ─┘        ▲
                 templates/ (빌드 시 codegen → core/src/templates.generated.ts)
catalog/ (제공자·추천 모델 JSON, core가 import)
```
- core: zod 스키마, 검증, 경고(`checks`), 렌더러, `shQuote`, `AppError`. **fs·네트워크·Date·Math.random 금지**.
- exporter: `RenderedFile[]` → ZIP(jszip, 브라우저·Node 공용) / GitHub 트리(P1). 내용 변환 금지(바이트 그대로).
- web: `ProjectDraft` 상태 소유(메모리 + localStorage, 비밀 값 없음), core 호출, exporter로 ZIP.
- server(P1): 마켓 색인·라이선스. MVP에는 없음.

### core 폴더
```
packages/core/src/
  schema/      project.ts, agent-model.ts, dev.ts, provider.ts, commands.ts, imported.ts, invariants.ts, index.ts
  validate.ts  draft → { project?, issues[] }
  checks.ts    화면 경고(PRV-04 등)
  render/      index.ts(render), claude-md.ts, readme.ts, agents.ts, dev-agents.ts, skills.ts, settings.ts,
               agent-env.ts, config.ts, env-example.ts, litellm.ts, vscode.ts, scaffold.ts
  providers/   claude.ts, openrouter.ts, ollama.ts, vllm.ts, litellm.ts   ← 제공자별 분기는 여기만
  util/        sh-quote.ts, md.ts(표 셀 이스케이프), yaml.ts(스칼라 인용), tpl.ts({{KEY}} 치환)
  errors.ts    AppError(code, params)
  templates.generated.ts   (codegen 산출물, 커밋하지 않음)
```
`scaffold.ts`는 project-rules 렌더러 목록에 없던 것으로, `.gitignore`, `.gitkeep`, `requirements.md`, `.agentforge/templates/*`, 정적 스크립트 복사를 맡는다.

## 2. 스키마

### 2.1 Project (zod, `z.infer`로만 타입 생성)
```ts
const ProviderId = z.enum(["claude", "openrouter", "ollama", "vllm", "openai", "gemini"]);
const SeqAgentId = z.enum(["planner", "analyst", "ux-designer", "architect", "common-dev", "integrator"]);

const AgentModel = z.object({ provider: ProviderId, model: ModelId });        // claude는 "" 허용 → sonnet
const Dev = z.object({
  domain: Domain.or(z.literal("")),      // ^[a-z0-9][a-z0-9-]{0,31}$
  paths: z.array(PathPrefix).max(10),    // 정규화 후 "dir/" 형태
  dev: AgentModel, review: AgentModel,
});
const ImportedSkill = z.object({         // MKT(P1) 결과. MVP는 항상 []
  id: SkillName, src: z.string().max(200), trust: z.enum(["official", "org", "community", "unverified"]),
  desc: z.string().max(300), flags: z.array(z.string().max(200)), target: z.enum(["all", "dev", "review"]),
  acknowledged: z.boolean(),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  name: ProjectName,                      // ^[a-z0-9][a-z0-9._-]{0,63}$  (REQ-02: 위반 시 진행 불가)
  language: z.enum(["ko", "en"]),
  requirement: z.string().max(20_000),    // 원문 그대로(REQ-01)
  uiDesign: z.boolean(),                  // RTN-01
  commands: z.object({ install: Command, test: Command, e2e: Command.or(z.literal("")) }),
  maxRejects: z.number().int().min(2).max(5),
  agents: z.record(SeqAgentId, AgentModel),   // 6종 모두 필수(ux-designer는 uiDesign=false면 무시)
  developerCount: z.number().int().min(1).max(6),
  devs: z.array(Dev).min(1).max(6),
  skills: z.object({ conventions: z.boolean(), tdd: z.boolean() }),   // detail-design·code-review·forge-*는 고정
  imported: z.array(ImportedSkill),
  connections: z.object({ vllmUrl: HttpUrl.or(z.literal("")), ollamaUrl: HttpUrl }),
  // ── P1 자리(PH2에서 스키마만 정의, 렌더러는 해당 단계에서) ──
  tmux: z.object({ layout: z.enum(["pair", "grid", "role"]), prefix: z.string(), mouse: z.boolean(), logs: z.boolean() }).optional(), // RUN-04
  devcontainer: z.boolean().optional(),   // VSC-02
  export: z.object({ github: GithubTarget.optional() }).optional(),   // EXP-02 (토큰은 스키마에 없음)
}).superRefine(invariants);
```

### 2.2 기본 패턴
| 타입 | 규칙 | 들어가는 곳 |
| --- | --- | --- |
| `ProjectName` | `^[a-z0-9][a-z0-9._-]{0,63}$` | 폴더·tmux 세션·README·config |
| `Domain` | `^[a-z0-9][a-z0-9-]{0,31}$` (한글 불가 → 스킬명 `devN-<domain>` 보장) | frontmatter description, 스킬 폴더명 |
| `PathPrefix` | `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*/?$`, `.`·`..` 세그먼트 금지, 절대 경로·`\` 금지. 정규화: 끝에 `/` | `.paths`, CLAUDE.md 표, description |
| `ModelId` | `^(?:[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127})?$` (ADR-0005) | agent-env case, litellm.yaml, frontmatter(claude만) |
| `Command` | 한 줄, 제어문자 금지, 1~200자 | forge.config.json(JSON), settings.json `Bash(<cmd>:*)` |
| `HttpUrl` | `http(s)://host[:port][/path]`, userinfo(`user:pw@`) 금지, 공백·`$`·`` ` ``·`'`·`"` 금지 | env.local.example(bash가 source) |

### 2.3 불변식 (`invariants`, 위반 = issue level error)
| ID | 내용 | 오류 코드 |
| --- | --- | --- |
| I1 | `developerCount === devs.length` | `DEV_COUNT_MISMATCH` |
| I2 | `developerCount ≤ tierLimit` (MVP: 6, LIC-01에서 주입) | `DEV_COUNT_OVER_TIER` |
| I3 | dev마다 `domain`과 `paths`는 둘 다 채우거나 둘 다 비움(부분 생성 금지) | `DEV_PARTIAL` |
| I4 | 서로 다른 dev의 경로 접두어가 겹치지 않음(정규화 후 `startsWith` 양방향) | `PATH_OVERLAP` |
| I5 | `provider !== "claude"`이면 `model` 필수 | `MODEL_MISSING` |
| I6 | `imported[].flags`가 비어 있지 않으면 `acknowledged === true` | `IMPORT_UNACKED` |
| I7 | `uiDesign === false`이면 렌더 결과에 ux-designer·`docs/design/ui/` 없음(렌더 속성 테스트) | — |

### 2.4 PoC 입력 → 스키마 대응 (G1: PoC 입력 항목 전부 수용)
| PoC `S` 필드 | 스키마 | 비고 |
| --- | --- | --- |
| `name` | `name` | PoC는 경고 후 slug 변환, 여기서는 오류(REQ-02) |
| `lang` | `language` | |
| `req` | `requirement` | |
| `devCount` | `developerCount` | |
| `ui` | `uiDesign` | |
| `cmd.install/test/e2e` | `commands.*` | |
| `maxRejects` | `maxRejects` | PoC 화면 선택지 2~5 |
| `agents[id].{p,m}` | `agents[id].{provider,model}` | |
| `devs[i].{domain,paths,dp,dm,rp,rm}` | `devs[i].{domain,paths[],dev,review}` | paths는 쉼표 문자열 → 배열 |
| `skills.{conventions,tdd}` | `skills.*` | |
| `imported[]`, `ack{}` | `imported[].acknowledged` | ack를 항목 안으로 합침 |
| `conn.{vllm,ollama}` | `connections.*` | |
| `gh.{owner,repo,visibility}` | `export.github` | P1 |
| `step`, `sel`, `v` | — | 화면 상태(web 소유), 스키마 제외 |

## 3. core API
```ts
// 입력
export function defaultDraft(): ProjectDraft;                      // PoC DEF()와 같은 기본값(예시 요구사항 포함)
export function resizeDevs(d: ProjectDraft, n: number): ProjectDraft; // PoC syncDevs (늘리면 claude/sonnet 빈 dev 추가)
export function validate(d: ProjectDraft): { project?: Project; issues: Issue[] };
// 화면 경고 (PRV-04 + PoC checks)
export function checks(p: Project | ProjectDraft): Issue[];         // Issue = { level: "error"|"warn"|"info"|"ok", code, params }
export function canExport(issues: Issue[]): boolean;               // error 0건
// 렌더
export function render(p: Project): RenderedFile[];
export type RenderedFile = { path: string; content: string; mode: 0o644 | 0o755; author: "template" | "ai-fill" };
// 유틸
export function shQuote(v: string): string;                        // 'a'\''b' 형식
export function mergeClaudeMd(oldMd: string, nextMd: string): string; // DOC-03(P1): 시그니처만, PROJECT 구간은 old 보존
```
- 출력 순서는 PoC `buildFiles()` 순서를 따른다(미리보기·golden 비교 안정성).
- 모든 텍스트는 LF, JSON은 2칸 들여쓰기 + 끝 개행. 날짜·난수 없음 → 같은 입력이면 바이트 단위로 같은 출력.
- `checks()` 코드: `NAME_INVALID`(error), `REQ_SHORT`(warn, 30자 미만), `PATH_OVERLAP`(error), `DEV_DEFERRED`(info), `MODEL_MISSING`(error), `REVIEW_WEAKER`(warn), `OPENROUTER_FREE_LIMIT`(warn), `GATEWAY_REQUIRED`(info), `VLLM_TOOL_PARSER`(info), `IMPORT_UNACKED`(error), `UI_OFF`(info), `ALL_OK`(ok). 문장은 web i18n이 만든다.

exporter:
```ts
export async function toZip(files: RenderedFile[], root: string): Promise<Uint8Array>; // unixPermissions = mode, platform UNIX
export async function pushToGitHub(files: RenderedFile[], target: GithubTarget, token: string): Promise<PushResult>; // P1
```

## 4. 렌더러 대응표
조건 열의 `ready(i)` = dev i의 domain·paths가 채워짐. `via(x)` = 어떤 에이전트든 via x 제공자를 씀.

| 출력 경로 | 렌더러 | 원본 | 조건 | mode | author | PoC |
| --- | --- | --- | --- | --- | --- | --- |
| `CLAUDE.md` | claude-md | 동적 | 항상 | 644 | ai-fill | genClaude |
| `README.md` | readme | 동적 | 항상 | 644 | template | genReadme |
| `.gitignore` | scaffold | 고정 문자열 | 항상 | 644 | template | buildFiles |
| `.claude/settings.json` | settings | 동적 | 항상 | 644 | template | genSettings |
| `.claude/hooks/guard-paths.sh` | scaffold | static/guard-paths.sh | 항상 | 755 | template | STATIC |
| `.claude/agents/{planner,analyst,ux-designer,architect,common-dev}.md` | agents | md/<id>.md (`{{MODEL}}`) | ux-designer는 uiDesign | 644 | template | seqAgent |
| `.claude/agents/integrator.md` | agents | md/integrator.md | 항상 | 644 | template | seqAgent |
| `.claude/agents/dev-N.md`, `review-N.md` | dev-agents | md/dev.tpl.md, review.tpl.md | ready(N) | 644 | ai-fill | devAgent/reviewAgent |
| `.claude/devs/dev-N.paths`, `review-N.paths` | dev-agents | 동적 | ready(N) | 644 | ai-fill / template | buildFiles |
| `.claude/skills/devN-<domain>/SKILL.md` | skills | md/devskill.tpl.md | ready(N) | 644 | ai-fill | buildFiles |
| `.claude/skills/{conventions,tdd}/SKILL.md` | skills | md/<id>.md (`{{LANG}}`) | skills 토글 | 644 | template | CORE_SKILLS |
| `.claude/skills/{detail-design,code-review,forge-init,forge-agents}/SKILL.md` | skills | md/<id>.md | 항상 | 644 | template | CORE_SKILLS |
| `.claude/skills/<imported>/SKILL.md` | skills | 가져온 원문(P1) | imported | 644 | template | buildFiles |
| `.agentforge/forge.config.json` | config | 동적 | 항상 | 644 | template | genConfig |
| `.agentforge/requirements.md` | scaffold | 동적 | 항상 | 644 | template | buildFiles |
| `.agentforge/env.local.example` | env-example | 동적 | 항상 | 644 | template | genEnvExample |
| `.agentforge/templates/{prd,dev,review,dev-skill}.md` | scaffold | md/prd.tpl(치환) / 나머지 원문 | 항상 | 644 | template | buildFiles |
| `.agentforge/litellm.yaml` | litellm | 동적 | via(litellm) | 644 | template | genLitellm |
| `scripts/{setup,run-role,check-forge,create-worktrees,run-agents,wait-and-review,integrate}.sh` | scaffold | static/*.sh | 항상 | 755 | template | STATIC |
| `scripts/start-gateway.sh` | scaffold | static/start-gateway.sh | via(litellm) | 755 | template | STATIC |
| `scripts/agent-env.sh` | agent-env | static/agent-env.head + case 블록 | 항상 | 755 | template | genAgentEnv |
| `.vscode/tasks.json` | vscode | 동적(고정 6작업) | 항상 | 644 | template | genTasksJson |
| `docs/{design/detail,review,report,adr}/.gitkeep` (+ `docs/design/ui/`) | scaffold | 빈 파일 | ui는 uiDesign | 644 | template | buildFiles |

동적 값이 셸·YAML·JSON·Markdown에 들어가는 지점과 처리:
| 지점 | 값 | 처리 |
| --- | --- | --- |
| agent-env.sh `case` | 모델 ID | `ModelId` 패턴 + `shWord`(안전 단어 외 `shQuote`) — D5 |
| env.local.example | vLLM·Ollama URL | `HttpUrl` 패턴 + `shWord` (bash가 source — D6) |
| litellm.yaml | 모델 ID | YAML 큰따옴표 스칼라 |
| settings.json / forge.config.json | 명령 | `JSON.stringify` (+ `Command` 패턴) |
| CLAUDE.md 표 | 도메인·경로·모델 | 패턴으로 `|` 원천 차단, `md.cell()`로 한 번 더 이스케이프 |
| frontmatter description | 도메인·경로 | 패턴으로 YAML 특수문자 차단 |

## 5. 템플릿 목록 (`templates/`, PH2에서 PoC `STATIC`을 바이트 그대로 이관)
| 파일 | 줄 | 자리표시 |
| --- | --- | --- |
| static/setup.sh · guard-paths.sh · check-forge.sh · create-worktrees.sh · run-agents.sh · wait-and-review.sh · integrate.sh · run-role.sh · start-gateway.sh | 27·30·72·24·37·70·36·8·11 | 없음(그대로 복사) |
| static/agent-env.head | 30 | 없음(뒤에 case 블록 연결) |
| md/planner · analyst · ux-designer · architect · common-dev · integrator | 9~16 | `{{MODEL}}` |
| md/dev.tpl.md | 25 | `{{N}} {{DOMAIN}} {{PATHS_INLINE}} {{MODEL}} {{SKILLS}} {{FEATURES}} {{UI_READ}}` |
| md/review.tpl.md | 20 | `{{N}} {{MODEL}} {{SKILLS}} {{UI_READ}}` |
| md/devskill.tpl.md | 13 | `{{SKILL}} {{N}} {{DOMAIN}}` |
| md/prd.tpl.md | 29 | `{{NAME}} {{UI_NOTE}}` |
| md/conventions.md | 12 | `{{LANG}}` |
| md/tdd · detail-design · code-review · forge-init · forge-agents | 11~25 | 없음 (forge-agents 본문의 `{{N}}` 등은 **AI용 문자열이므로 치환하지 않음**) |

조건부 스킬 목록: PoC는 `"  - tdd\n"` 문자열 삭제로 처리한다. TS 렌더러는 `skills:` 목록을 배열로 만든 뒤 출력하되 결과 바이트는 PoC와 같게 맞춘다.

## 6. PoC 결함·차이 (golden 의도적 차이 목록의 초안)
| ID | 내용 | 영향 | 처리 단계 |
| --- | --- | --- | --- |
| D1 | `check-forge.sh` 6항목이 `F-[0-9]{3}`만 인식. `/forge-init`이 F-001 형식을 쓰므로 생성 프로젝트에는 문제없음 | 이 저장소(REQ-01 형식)에선 사실상 미검사 | 기록만 |
| D2 | `forge-agents.md`는 `{{PATHS}}`를 채우라 하나 템플릿은 `{{PATHS_INLINE}}`·`{{MODEL}}`·`{{SKILLS}}`·`{{UI_READ}}` 사용. check-forge가 미치환 `{{`를 검사하지 않음 | AI가 만든 dev-N.md에 자리표시가 남아도 통과 | PH4 GEN-02·03 (static 변경 = 리드 승인) |
| D3 | 한글 도메인 → `dslug` 빈 문자열 → 스킬명 `dev1-` | 스킬 name 불일치 | 스키마 `Domain` 패턴으로 차단(PH2) |
| D4 | 경로 접두어 비교가 `startsWith` → `src/order`가 `src/orders` 허용·겹침 판정 | guard 우회, 거짓 겹침 | 정규화 시 끝 `/` 부여(PH2·PH3) |
| D5 | agent-env.sh `_af_use <via> <model>` 미인용 | 모델 ID 주입 | `shQuote`(PH3 PRV-01) |
| D6 | env.local.example의 URL 미인용, bash가 source | 명령 주입 | `HttpUrl` + `shQuote`(PH3) |
| D7 | `setup.sh`의 `sed -i`(GNU 전용), `guard-paths.sh`의 `realpath -m`(GNU 전용) | **macOS에서 실패**(PRD 목표 위반) | PH3 bats에 macOS 사례 추가, 수정은 ADR + 리드 승인 |
| D8 | PoC는 이름 규칙 위반 시 경고 후 slug 변환 | REQ-02와 불일치 | 스키마 오류로 처리 |

D3~D6·D8은 입력 검증 강화와 `shWord`로 처리하므로 **PoC 기본 구성의 출력은 바뀌지 않는다**(golden 일치, 의도적 차이 0건 — ADR-0003).

## 7. 테스트 설계 연결
| 대상 | 방법 | 단계 |
| --- | --- | --- |
| golden | `tools/poc-golden.mjs <config.json>` → `tests/golden/<구성>/`. 구성: 기본, UI 끔·개발자 2명·LiteLLM(PH3) + 6종(project-rules) | PH3 |
| 스냅샷 | Vitest, 대표 구성 6종 | PH3~4 |
| 속성 | fast-check: devCount 3→5→2, uiDesign 토글 시 에이전트·agent-env case·CLAUDE.md 표·config 일관 | PH4 |
| 스크립트 | `pnpm test:scripts` = bash -n + shellcheck + bats + 모의 병렬(가짜 claude, tmux) | PH2 틀, PH3~4 사례 |
| E2E | Playwright: 6단계 → ZIP → 풀기 → setup.sh → check-forge.sh | PH4 |

## 8. PH6 설계 — 편집·다국어·배치 (ADR-0006)
PoC에 기준 구현이 없는 기능이라, 병렬 개발 전에 계약을 여기서 고정한다. 스키마는 G2에 이미 `tmux`·`devcontainer`·`language`가 있으므로 바꾸지 않는다.
공통 원칙: 선택값이 비어 있으면(`tmux`·`devcontainer` 미지정, `language: "ko"`) **생성물은 PH5와 바이트 단위로 같다**(golden·스냅샷 불변). 새 출력은 선택했을 때만 생긴다.

### 8.1 DOC-03 `mergeClaudeMd(oldMd, nextMd): string`
- 구간: `<!-- AGENTFORGE:<ID>:BEGIN -->` … `<!-- AGENTFORGE:<ID>:END -->`, ID = PROJECT·AGENTS·DEVS·SKILLS.
- 규칙:
  1. 결과의 뼈대는 **old**다. 마커 밖 텍스트(사용자 수정)는 한 글자도 바꾸지 않는다.
  2. AGENTS·DEVS·SKILLS 구간 안쪽은 next 내용으로 바꾼다.
  3. PROJECT 구간은 old 내용을 그대로 둔다(사용자·AI 소유).
  4. next에는 있고 old에 없는 구간은 old 끝에 next의 해당 구간(마커 포함)을 붙인다. 붙이기 전 끝 줄바꿈은 1개로 맞춘다.
  5. old에 마커가 하나도 없으면, 사용자 파일로 보고 위 4번 규칙대로 구간 4개를 끝에 붙인다.
  6. 이미 같은 결과면 그대로 반환한다(멱등: `merge(merge(o,n),n) === merge(o,n)`).
- 오류: 같은 ID의 BEGIN·END 짝이 맞지 않거나 중복이거나 순서가 뒤집히면 `AppError("CLAUDE_MD_MARKERS", { id })`.
- 시험(fast-check): 마커 밖 임의 텍스트 보존, PROJECT 보존, 멱등, next 구간 반영.

### 8.2 RUN-04 tmux 배치·접두키·마우스·로그
- config(`forge.config.json`):
  - `tmux` 미지정이면 지금처럼 `"tmuxLayout": "pair"`만 쓴다.
  - 지정하면 `"tmuxLayout": <layout>`과 `"tmux": { "prefix", "mouse", "logs" }`를 함께 쓴다(키 순서: tmuxLayout 바로 뒤).
- `run-agents.sh`가 config를 읽어 배치한다. 값이 없으면 기본값은 pair, `C-b`, mouse false, logs false.
  | layout | 창 구성 |
  | --- | --- |
  | pair | 지금과 같음: `watch` + 개발자마다 `dev<i>` 창(왼쪽 dev-i, 오른쪽 review-i) |
  | grid | `watch` + 한 창 `agents`에 dev-1, review-1, dev-2, … 순서로 pane을 만들고 `select-layout tiled` |
  | role | `watch` + 창 `dev`(dev-1..N) + 창 `review`(review-1..N), 각 `tiled` |
- 모든 배치에서 `.agentforge/panes/<에이전트>`에 pane id를 기록한다. 따라서 `wait-and-review.sh`는 바꾸지 않는다.
- `prefix`가 `C-b`가 아니면 `tmux set -t <세션> prefix <키>`를, `mouse`가 true면 `set -t <세션> mouse on`을 실행한다. 둘 다 세션 범위이고 전역은 바꾸지 않는다.
- `logs`가 true면 pane마다 `pipe-pane -o 'cat >> .agentforge/logs/<에이전트>.log'`를 걸고, `.gitignore`에 `.agentforge/logs/`를 추가한다(tmux 지정 시에만).
- 안내 문구의 "Ctrl-b"는 실제 접두키로 출력한다.

### 8.3 PRV-03 `scripts/check-models.sh`
- 정적 템플릿이며 항상 생성한다(mode 755). VS Code 작업 "AF: 모델 점검"을 7번째로 추가한다(VSC-01 확장).
- 사용법:
  - `bash scripts/check-models.sh [에이전트...]`: 인자가 없으면 config의 `agents` 키 전부를 점검한다.
  - 시간 제한은 에이전트당 `AF_CHECK_TIMEOUT`(기본 120초)이고, `timeout` 명령이 없으면 시간 제한 없이 실행한다.
- 동작: 에이전트마다 `source scripts/agent-env.sh <a>`를 한 뒤 다음을 실행한다.
  `claude --agent <a> -p "<프롬프트>" --output-format json --max-turns 3 < /dev/null`
  - 프롬프트: "Read 도구로 .agentforge/forge.config.json 을 읽고 project 값만 한 단어로 답하세요."
- 판정(JSON은 jq로 읽음):
  | 판정 | 조건 |
  | --- | --- |
  | 실패 | agent-env 실패, 명령 실패·시간 초과, JSON 해석 실패, `.is_error == true` |
  | 경고 | 응답은 있으나 `.result`에 project 값이 없거나 `.num_turns < 2`(도구 호출 미확인) |
  | 통과 | `.result`에 project 값이 있고 `.num_turns >= 2` |
- 출력: 에이전트마다 `✓ <a> 통과 (<model>)` / `! <a> 경고: <사유>` / `✗ <a> 실패: <사유>` 한 줄, 끝에 `모델 점검: 통과 N · 경고 N · 실패 N`.
- 종료 코드: 실패가 하나라도 있으면 1, 아니면 0(경고만 있으면 0).
- 키·응답 원문은 출력하지 않는다(사유는 고정 문구).

### 8.4 VSC-02 Dev Container
- `devcontainer: true`일 때만 `.devcontainer/devcontainer.json`을 생성한다(644).
  ```json
  {
    "name": "<slug>",
    "image": "mcr.microsoft.com/devcontainers/javascript-node:22",
    "postCreateCommand": "sudo apt-get update && sudo apt-get install -y tmux jq && npm install -g @anthropic-ai/claude-code",
    "remoteEnv": { "AF_IN_CONTAINER": "1" }
  }
  ```
- 컨테이너 이미지는 사용자 환경이 내려받는 것이고, 앱 자체는 외부를 호출하지 않는다(폐쇄망 원칙 유지). README에 폐쇄망이면 사내 레지스트리 이미지로 바꾸라는 안내를 추가한다(devcontainer일 때만).
- `env.local`은 컨테이너 안에서도 사용자가 직접 넣는다(마운트·복사 금지).

### 8.5 I18N-01 화면·생성물 언어
- 화면:
  - `locales/en.json`을 추가하고 상단에 ko/en 전환을 둔다.
  - 선택값은 저장하지 않는다(새로 열면 ko). 생성물 언어는 1단계의 `language` 입력이 따로 정한다.
- CI(web 시험):
  - ko·en 키 집합이 같아야 한다.
  - 같은 키의 `{{변수}}` 집합이 같아야 한다.
  - 값이 빈 문자열이면 안 된다.
- 생성물: `language: "en"`이면 사람이 읽는 생성물을 영어로 만든다.
  - 대상: `templates/md/*` 대신 `templates/md-en/*`(같은 파일명·같은 자리표시), CLAUDE.md 고정 규칙, README, PRD 양식, 에이전트·스킬 본문.
  - 정적 스크립트의 출력 문구는 PH6 범위 밖이다(한국어 유지, ADR-0006에 기록).
- `md-en`은 `check:poc-static` 대상이 아니다(PoC에 없음). `gen:templates`가 함께 내장한다.

### 8.6 보안 후속 (report-security S-3·S-4)
- S-3:
  - 생성 `settings.json`에 `"permissions": { "defaultMode": "default", … }`를 넣는다. dev·review pane이 auto mode 대신 기본 권한 모드로 시작해 Bash 쓰기가 승인을 거친다.
  - README에 이유를 한 줄 적는다.
- S-4:
  - `integrate.sh`가 병합 전에 `docs/review/dev-<i>.md`가 develop 기준 feature 브랜치에 있는지 확인한다(`git cat-file -e feature/dev<i>:docs/review/dev-<i>.md`).
  - 없으면 그 개발자는 병합하지 않고 실패한다(exit 1, 안내).
  - 통과 신호 위조만으로는 통합되지 않게 하는 확인이다.
  - 이를 위해 `wait-and-review.sh`가 review-N에게 보내는 코드 검토 요청 문구에 "결과를 docs/review/dev-N.md 에 쓰고 커밋한 뒤"를 넣는다.

### 8.7 새 issue·오류 코드
| 코드 | level | 조건 |
| --- | --- | --- |
| `CLAUDE_MD_MARKERS` | AppError | 8.1 마커 짝 오류 |
| `TMUX_PREFIX` | error(스키마) | 이미 존재 |
| `DEVCONTAINER_CLOSED_NET` | info | `devcontainer: true`: 이미지·패키지를 내려받는다는 안내 |

## 9. PH7 설계 — 마켓플레이스·GitHub 내보내기 (ADR-0007)
PoC에는 고정 목록(MARKET 5종)과 자리표시 SKILL.md만 있다. 원칙은 PH6과 같다. `imported: []`이고 `export`를 지정하지 않으면 생성물은 v0.2.0과 바이트 단위로 같다.

### 9.1 스키마 (리드 반영 완료)
- `ImportedSkill`에 `ref?`(출처 커밋, `^[0-9a-f]{7,40}$`, `SKILL_REF`)와 `files?`(최대 50개, `{path: SkillFilePath, content ≤ 200,000자}`)를 추가했다.
  - `SkillFilePath`는 스킬 폴더 기준 상대 경로다. 세그먼트는 `[A-Za-z0-9._-]`, 최대 깊이 5, `.`·`..` 금지(`SKILL_FILE_PATH`).
- `GithubTarget`에 `mode?`(create|pr, 기본 create), `baseUrl?`(GHES API, HttpUrl), `branch?`(`GitBranch`, 기본 `agentforge/setup`)를 추가했다. 토큰은 스키마에 두지 않는다.

### 9.2 위험 검사 (core, 순수 함수) — MKT-02
- `scanSkillRisk(files): RiskCode[]`는 결정적이고 정렬된 고유 코드 목록을 반환한다.

| 코드 | 조건 |
| --- | --- |
| `SCRIPTS` | `scripts/` 아래 파일이 있거나, 확장자 `.sh .bash .py .js .mjs .cjs .ts .ps1 .bat .cmd .exe`인 파일 |
| `BANG_COMMAND` | SKILL.md 본문의 동적 명령: 백틱 앞의 `!` 문법, 또는 줄 머리가 `!`인 명령 |
| `BROAD_TOOLS` | frontmatter `allowed-tools`에 `Bash(*)`·`Bash` 단독·`*`가 있음 |
| `BYPASS_PERMISSIONS` | `permissionMode: bypassPermissions` 또는 `dangerously-skip-permissions` 문자열 |
| `REMOTE_DOWNLOAD` | `curl`·`wget`·`Invoke-WebRequest`·`iwr` 다음에 `http(s)://`가 오는 줄, 또는 `sh`·`bash`로 넘기는 파이프 |

- 불변식 I6 변경:
  - `files`가 있으면 `flags`를 **입력값이 아니라 `scanSkillRisk(files)`로 다시 계산한 값**으로 판정한다. 입력의 flags 조작으로 확인을 건너뛸 수 없다.
  - 위험이 하나라도 있고 `acknowledged`가 false이면 `IMPORT_UNACKED`.
- 추가 불변식:
  - `files`가 있으면 `SKILL.md`가 반드시 있어야 한다(`IMPORT_NO_SKILL_MD`).
  - SKILL.md frontmatter의 `name`은 `id`와 같아야 한다(`IMPORT_NAME_MISMATCH`).
  - 파일 경로는 중복되면 안 된다(`IMPORT_DUP_PATH`).
  - 전체 크기는 512,000자 이하여야 한다(`IMPORT_TOO_LARGE`).
- 불변식은 schema 폴더(리드 승인 영역)지만, 이번에는 ADR-0007로 승인하고 dev-1이 구현한다.

### 9.3 렌더 (core) — MKT-02
- `files`가 있는 스킬은 `.claude/skills/<id>/<path>`로 원문을 그대로 넣는다(mode 644, 실행 권한 없음).
  - SKILL.md도 원문 그대로 넣는다(앱이 문구를 바꾸지 않는다).
  - `files`가 없으면 지금처럼 출처 안내만 넣는다.
- `.agentforge/sources.lock`(imported가 비어 있지 않을 때만, 644): JSON
  `{ "version": 1, "skills": [{ id, src, trust, ref|null, target, flags, files: [{ path, sha256 }] }] }`
  - `sha256`은 core 순수 구현(UTF-8 바이트)이다. 키 순서는 고정한다.
- 기존 CLAUDE.md SKILLS 표와 dev/review `skills:` 배정(SKL-02)은 그대로다.

### 9.4 마켓 색인 (server, 선택 배포) — MKT-01
- Fastify 앱 `createServer({ dataDir, fetch?, gitBin?, webDist? })`. 앱 본체(web)는 서버 없이도 동작하고, 서버가 있을 때만 마켓을 쓸 수 있다.
- 소스 종류:

| kind | 필드 | 가져오는 방법 |
| --- | --- | --- |
| `github` | `owner`, `repo`, `ref?`(기본 기본 브랜치), `path?`(기본 저장소 루트), `baseUrl?`(GHES API) | REST: commits(ref→sha), git/trees?recursive=1, blobs |
| `git` | `url`(https:// 또는 테스트용 file://), `ref?`, `path?` | 시스템 `git clone --depth 1 --branch` → 임시 폴더, 끝나면 삭제 |

- 공통 필드: `id`(SkillName 패턴), `trust`(official·org·community·unverified, 등록 시 지정, 기본 unverified), `tokenEnv?`(비공개 저장소 토큰을 담은 **서버 환경 변수 이름**. API로 토큰 값을 받지 않는다).
- 스킬 인식:
  - `path` 아래 깊이 2 이내에서 `SKILL.md`를 가진 폴더를 스킬로 본다.
  - 폴더명이 SkillName 패턴이 아니면 건너뛴다.
  - 파일은 50개 이하, 파일당 200,000자, 합계 512,000자 이하이고, 넘으면 `tooLarge` 표시 후 가져오기를 막는다.
  - 텍스트가 아닌(UTF-8 디코드 실패) 파일이 있으면 `binary` 표시 후 가져오기를 막는다.
- 저장: `dataDir/sources.json`(등록 목록), `dataDir/index/<sourceId>.json`(색인: sha, 스킬별 name·description·files·flags = core `scanSkillRisk`).
- 기본 소스: `catalog/market-sources.json`(공식 `anthropics/skills`, trust official). 서버가 처음 시작할 때 dataDir에 없으면 복사한다.
- API(JSON, 같은 출처, 오류는 `{ code, params }`):

| 메서드·경로 | 내용 |
| --- | --- |
| `GET /api/market/health` | `{ ok: true, version }` — web 이 서버 존재를 감지 |
| `GET /api/market/sources` | 등록 목록(+마지막 색인 시각·sha·오류 코드) |
| `POST /api/market/sources` | 등록(zod 검증; id 중복 `SOURCE_EXISTS`) |
| `DELETE /api/market/sources/:id` | 삭제(색인도 삭제) |
| `POST /api/market/refresh` | `{ id? }` 색인 갱신(없으면 전체). 소스별 결과·오류 코드 |
| `GET /api/market/search?q=&trust=` | 이름·설명 부분 일치(대소문자 무시), 목록 항목 = `{ sourceId, id, description, trust, src, ref, flags, fileCount, blocked? }` |
| `GET /api/market/skills/:sourceId/:skillId` | 가져오기용 전체: `{ id, src, trust, ref, description, flags, files: [{path, content}] }` — 이 응답을 그대로 `ImportedSkill`로 바꿀 수 있어야 한다 |

- 보안:
  - 등록 URL·owner·repo·ref·path는 zod 패턴으로 검증한다. `git`은 `https://` 또는 `file://`만 허용하고, `file://`은 `AF_ALLOW_FILE_SOURCES=1`일 때만 허용한다.
  - git 명령은 인자 배열로 실행한다(셸 금지). 시간 제한은 60초다.
  - 토큰은 로그·응답·색인에 쓰지 않는다.
- `webDist`가 있으면 `/`에서 web 정적 파일을 제공한다(E2E·설치형 대비).

### 9.5 GitHub·GHES 내보내기 (exporter) — EXP-02
- `planGithubTree(files: RenderedFile[]): { path, mode: "100755"|"100644", content }[]` (core 순수 함수)
  - `.sh`는 100755, 나머지는 100644다.
  - `env.local` 경로가 있으면 `AppError("EXPORT_SECRET_PATH")`.
  - ZIP과 같은 `RenderedFile[]`에서 만들고, 경로 집합·내용이 ZIP 항목과 같음을 시험으로 보장한다.
- `pushToGithub(files, target, token, { fetch?, language })`(exporter, `@octokit/core`, web에서 지연 로딩)
  - **create**:
    1. 저장소를 만든다(owner가 인증 사용자면 `POST /user/repos`, 아니면 `POST /orgs/:owner/repos`, `auto_init: true`, visibility).
    2. blob과 tree를 만든다(`base_tree` 없음).
    3. 부모 없는 commit을 만든다.
    4. `PATCH refs/heads/<default>` `force: true`로 바꾼다.
    - 결과 이력은 **커밋 1건**이다.
  - **pr**:
    1. 기본 브랜치 sha를 읽는다.
    2. tree를 만든다(`base_tree` = 기본 브랜치 tree. 생성 파일만 덮어쓰고 다른 파일은 유지).
    3. commit을 만든다(부모 1).
    4. `refs/heads/<branch>`를 만든다(있으면 `GITHUB_BRANCH_EXISTS`).
    5. PR을 만든다.
  - 커밋 메시지: `AgentForge 환경 생성` / `Generate AgentForge environment`(language). 작성자는 토큰 사용자다.
  - 반환: `{ url, commitSha, prUrl? }`
  - 오류는 `AppError` 코드로만 낸다. 응답 본문·토큰은 메시지에 넣지 않는다.

| 코드 | 원인 |
| --- | --- |
| `GITHUB_AUTH` | 401·403 |
| `GITHUB_NOT_FOUND` | 404 |
| `GITHUB_REPO_EXISTS` | 422 |
| `GITHUB_BRANCH_EXISTS` | pr 모드에서 브랜치가 이미 있음 |
| `GITHUB_RATE_LIMIT` | 요청 한도 초과 |
| `GITHUB_NETWORK` | 네트워크 오류 |
| `GITHUB_FAILED` | 그 밖의 실패 |

- 토큰:
  - 화면 입력(password)으로 받아 한 번만 쓰고 메모리에서 지운다.
  - 저장소·URL·로그·오류에 남기지 않는다.
  - 브라우저에서 GHES CORS가 막히는 경우의 서버 중계는 이번 단계 범위 밖이다(P2, ADR-0007).

### 9.6 새 issue·오류 코드
- 스키마·불변식(error): `SKILL_FILE_PATH` `SKILL_REF` `GIT_BRANCH` `IMPORT_NO_SKILL_MD` `IMPORT_NAME_MISMATCH` `IMPORT_DUP_PATH` `IMPORT_TOO_LARGE`
- 위험 코드 5종(9.2): 화면에서 사람이 읽는 문구로 표시
- AppError: `EXPORT_SECRET_PATH`, `GITHUB_*`
- 서버: `SOURCE_EXISTS` `SOURCE_INVALID` `SOURCE_FETCH_FAILED` `SOURCE_TIMEOUT` `SKILL_BLOCKED`

### 9.7 PH7 1라운드 보충 계약 (리드 확정)
- **응답 형태**(서버 구현 기준으로 확정):
  - `GET /api/market/health` → `{ ok: true, version, admin: boolean }`
  - `GET /api/market/sources` → `{ sources: SourceRecord[] }`. SourceRecord는 등록 필드에 상태 `lastIndexedAt?`(ISO), `lastSha?`, `lastError?`(오류 코드)를 더한 것이다.
  - `POST /api/market/refresh` → `{ results: [{ id, ok: true, sha, skillCount } | { id, ok: false, code, params }] }`. 갱신 실패도 HTTP 200이다.
  - `GET /api/market/search` → `{ skills: [{ sourceId, id, description, trust, src, ref, flags, fileCount, blocked? }] }`. `blocked`는 `"tooLarge" | "binary" | "badPath"`(badPath = 스킬 안 파일 경로가 SkillFilePath 위반, 스킬 전체 차단).
  - 오류는 `{ code, params }`이고, 추가 코드는 `NOT_FOUND`·`INTERNAL`·`ADMIN_DISABLED`다.
- **관리 API 보호(SSRF 대책)**:
  - 등록·삭제·갱신(`POST/DELETE /api/market/sources`, `POST /api/market/refresh`)은 서버 환경 변수 `AF_MARKET_ADMIN=1`일 때만 허용한다. 아니면 403 `ADMIN_DISABLED`.
  - 읽기(health·sources·search·skills)는 항상 허용한다.
  - 서버 기본 바인드 주소는 `127.0.0.1`이다.
  - 화면은 `health.admin`이 false이면 소스 관리 버튼을 숨기고 "관리자 모드에서만 소스를 바꿀 수 있습니다"를 보인다.
- **위험 판정 연결**: `createServer`의 `scan` 기본값은 core `scanSkillRisk`다(통합 시 연결, 주입은 시험용으로 유지).
