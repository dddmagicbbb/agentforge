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
