# dev-1 상세 설계 (PH4 1라운드: T-401, T-405)

## 1. 담당 작업·기능 ID
| 작업 | 기능 ID | 내용 |
| --- | --- | --- |
| T-401 | DEV-01, DEV-02 | `resizeDevs` + 개발자 수 변경 시 렌더 일관성(fast-check) |
| T-405 | PRV-02, PRV-04 | `checks`, `canExport`, litellm.yaml·start-gateway.sh 조건부 생성 확인 테스트 |

dev-N·review-N·paths·전용 스킬 렌더(ready 아닌 dev 생략)는 PH3에서 이미 구현되어 있어 속성 테스트로 검증만 한다.

## 2. 파일 목록
| 경로 | 책임 |
| --- | --- |
| `packages/core/src/checks.ts` (신규) | `checks`, `canExport` 구현. 검증 전 입력도 throw 없이 처리 |
| `packages/core/src/resize.ts` (신규) | `resizeDevs` 구현 |
| `packages/core/src/api.ts` | NOT_IMPLEMENTED 본문을 위 모듈 위임으로 교체(시그니처 불변) |
| `packages/core/test/resize.test.ts` (신규) | T-401 테스트(fast-check 포함) |
| `packages/core/test/checks.test.ts` (신규) | T-405 테스트 |
| `docs/design/detail/dev-1.md`, `docs/report-dev-1.md` | 문서 |

## 3. 주요 함수
- `resizeDevs(draft: ProjectInput, n: number): ProjectInput` : 불변(원본 미수정). `n`이 1~6 정수가 아니면 `AppError("DEV_COUNT_RANGE", {n, min:1, max:6})`. 늘리면 `{domain:"", paths:[], dev:{claude,sonnet}, review:{claude,sonnet}}` 추가, 줄이면 앞에서부터 n개 유지. `developerCount = n`.
- `checks(input: ProjectInput): Issue[]` : 절대 throw 하지 않는다(필드 누락·타입 오류는 방어적으로 건너뜀). PoC 순서: NAME_INVALID, REQ_SHORT, PATH_OVERLAP, DEV_DEFERRED, MODEL_MISSING, REVIEW_WEAKER, OPENROUTER_FREE_LIMIT, GATEWAY_REQUIRED, VLLM_TOOL_PARSER, IMPORT_UNACKED, UI_OFF. error·warn 이 없으면 ALL_OK 를 맨 앞에 둔다. 문장 없이 `params` 만.
  - 경로는 D4 정규화(끝 `/` 보정) 후 겹침 비교. 같은 dev 내부 겹침은 무시.
  - 에이전트 순회 순서는 render 의 `allAgents` 와 같다(순차 → dev/review 쌍 → integrator, ux-designer 는 uiDesign 일 때만).
- `canExport(issues)` : `level === "error"` 가 0건이면 true.

| code | level | params |
| --- | --- | --- |
| NAME_INVALID | error | name |
| REQ_SHORT | warn | length, min(30) |
| PATH_OVERLAP | error | devA, pathA, devB, pathB |
| DEV_DEFERRED | info | dev |
| MODEL_MISSING | error | agent |
| REVIEW_WEAKER | warn | dev |
| OPENROUTER_FREE_LIMIT | warn | count |
| GATEWAY_REQUIRED | info | - |
| VLLM_TOOL_PARSER | info | - |
| IMPORT_UNACKED | error | id |
| UI_OFF | info | - |
| ALL_OK | ok | - |

## 4. 사용하는 계약
제공: `resizeDevs`, `checks`, `canExport`(design.md 3장). 호출: `render`, `validate`, `defaultDraft`, `provider()`(via 판정), `AppError`. 스키마는 읽기만 한다.

## 5. 화면 상태
해당 없음(web 담당).

## 6. 테스트 목록
| 기능 | 수용 기준 | 테스트 |
| --- | --- | --- |
| DEV-01 | 늘리면 빈 dev 추가, 줄이면 잘라냄, developerCount 동기 | resizeDevs 늘리기/줄이기/원본 불변 |
| DEV-01 | 범위 밖은 AppError | resizeDevs 0·7·소수·NaN |
| DEV-01/02 | 임의 변경 시 dev-N/review-N 파일, agent-env case, CLAUDE.md DEVS 행 수, forge.config developers 일관 | fast-check 속성(3→5→2 포함, uiDesign 토글 포함) |
| PRV-04 | 코드 12종과 level, 순서 | checks 코드별 케이스 |
| PRV-04 | ALL_OK 는 error·warn 없을 때 맨 앞 | checks ALL_OK |
| PRV-04 | 입력이 깨져도 throw 없음 | fast-check 임의 값 |
| PRV-04 | canExport | error 있으면 false, warn/info 만이면 true |
| PRV-02 | litellm.yaml·start-gateway.sh 는 openai/gemini 사용 시에만 | render 조건부 확인 |

## 7. 계약·공통 모듈에 필요한 변경
없음. (`schema/` 동결 준수. `Issue.path` 는 기존 필드를 그대로 채운다.)

---

## 2라운드: T-402, T-406 + core 공개 export 보강

### 1. 담당 작업·기능 ID
| 작업 | 기능 ID | 내용 |
|---|---|---|
| T-402 | SKL-01, SKL-02 | 생성 SKILL.md 형식·배정 시험, 토글 4조합 정합 |
| T-406 | RUN-03, VSC-01 | integrate.sh·tasks.json 렌더 시험, 대표 구성 6종 스냅샷 |
| (보강) | - | web 사본 제거용 공개 export |

### 2. 파일 목록 (모두 `packages/core/` 안, `templates/**` 불변, `schema/` 불변)
| 경로 | 책임 |
|---|---|
| `packages/core/src/index.ts` | `PROVIDERS`·`provider`·`ProviderDef`, `SEQ`·`FINAL`·`SeqStep`, `CORE_SKILLS`·`CoreSkill`, `devSkill`, `label`, `fmModel`, `IMPORT_TARGET_LABEL`, `seqI18nKey` export |
| `packages/core/src/render/context.ts` | `seqI18nKey()` 추가 |
| `packages/core/test/fixtures.ts` | 시험용 구성 빌더(공용) |
| `packages/core/test/skills.test.ts` | T-402 시험 |
| `packages/core/test/run-vscode.test.ts` | T-406 integrate.sh·tasks.json 시험 |
| `packages/core/test/snapshots.test.ts` + `__snapshots__/` | T-406 대표 구성 6종 스냅샷 |

### 3. 주요 함수
- `seqI18nKey(id: SeqAgentIdT, field: "out" | "gate"): string` -> `seq.<id>.<out|gate>`.
  화면의 단계별 산출물·관문 문장은 core에 두지 않는다(project-rules: 문장은 web). core는 키 규칙만 제공하고 web의 i18n 사전이 문장을 가진다.
  `SeqStep.step`(한국어 단계명)은 생성물(CLAUDE.md 표)에 들어가는 값이므로 core에 남는다.
- 그 외는 기존 심볼의 재export. 동작 변경 없음. 신규 오류 처리 없음.

### 4. 사용하는 계약
외부 API 없음. 공개 API(design.md 3장)에 export만 추가하고 기존 시그니처는 바꾸지 않는다.

### 5. 화면 상태
해당 없음(core).

### 6. 테스트 목록
| 기능 ID | 수용 기준 | 테스트 이름 |
|---|---|---|
| SKL-01 | 모든 SKILL.md가 `---` 블록, name=폴더명, description 비지 않음 | `SKILL.md frontmatter 형식` |
| SKL-01 | forge-init·forge-agents만 disable-model-invocation: true | `생성 스킬 2종은 모델 호출 비활성` |
| SKL-01 | conventions·tdd 4조합에서 파일 유무와 dev/review/common-dev skills 목록 정합 | `토글 조합 x skills 목록` |
| SKL-01 | 고정 스킬 4종은 항상 생성 | `고정 스킬 4종` |
| SKL-02 | `devN-<domain>`은 dev-N·review-N에만 배정 | `devN 스킬 배정 범위` |
| SKL-02 | imported target all/dev/review 배정 | `imported target 배정` |
| 보강 | 공개 export 노출, seqI18nKey 규칙 | `공개 export` |
| RUN-03 | integrate.sh 755, 정적 원문과 동일 | `integrate.sh 렌더` |
| VSC-01 | tasks.json 유효 JSON, 6작업, 입력과 무관 | `tasks.json 렌더` |
| T-406 | 6종 구성 스냅샷(파일 목록·권한·sha256) | `구성 스냅샷` |

### 7. 계약·공통 모듈에 필요한 변경
없음. `schema/`·`templates/**` 변경 없음.

## 3라운드: T-403, T-404 (ADR-0004 구현)

### 1. 작업·기능 ID
- T-404: DEV-03, GEN-03 스크립트 부분 (setup·guard-paths·integrate·wait-and-review)
- T-403: GEN-01·02 (forge-agents 자리표시 정합, check-forge 7번째 항목)

### 2. 파일 목록
| 경로 | 책임 |
|---|---|
| templates/static/setup.sh | sed -i 제거, tr + mv 후 chmod |
| templates/static/guard-paths.sh | jq 부재 fail-closed(exit 2), bash 어휘 정규화, 파일 항목 완전 일치 |
| templates/static/integrate.sh | 충돌 시 merge --abort 후 reset --hard pre-integration |
| templates/static/wait-and-review.sh | take() 이력명 `.<초>[.<n>]` |
| templates/static/check-forge.sh | 7번째 항목: 미치환 자리표시 검사(forge-agents 스킬 제외) |
| templates/md/forge-agents.md | 자리표시 7종과 값의 출처 명시 |
| tests/golden/intended-diffs.json | templates 6건, diffs 6건(config "*") |
| packages/core/test/golden.test.ts | config "*" 지원 |
| packages/core/test/adr0004.test.ts | ADR 결정 반영 시험(신규) |

### 3. 주요 함수
- guard `normalize <경로>`: `/` 분할, 빈·`.` 무시, `..`는 직전 세그먼트 제거, 루트 위로는 `/`. 저장소 밖 경로는 차단.
- wait `take <신호>`: 없으면 return 1, 대상 `.<초>`가 있으면 `.<초>.<n>`. `count`는 `$1.*` 그대로.
- 고정 문구: `jq 가 없어 담당 범위를 검사할 수 없습니다. 설치 후 다시 실행하세요.`(exit 2), `담당 범위 밖 파일입니다: <rel> (<agent>). …`(exit 2), `develop 을 pre-integration 태그 상태로 되돌렸습니다.`, `✗ <파일> 에 채우지 않은 자리표시 <토큰>`

### 4. 사용하는 계약
없음(정적 템플릿·core 렌더 결과).

### 5. 화면 상태
해당 없음.

### 6. 테스트 목록
| 기능 ID | 수용 기준 | 테스트 이름 |
|---|---|---|
| DEV-03 | setup.sh에 sed -i 없음, tr+mv 후 chmod | `setup.sh: sed -i 없이 tr + mv…` |
| DEV-03 | guard에 realpath 없음, normalize 존재 | `guard-paths.sh: realpath 제거…` |
| DEV-03 | AF_AGENT 검사가 jq 검사보다 앞, jq 부재 exit 2 | `guard-paths.sh: AF_AGENT 검사가…` |
| DEV-03 | `/` 항목 접두어, 그 외 완전 일치, 차단 문구 유지 | `guard-paths.sh: 끝이 / 인 항목…` |
| RUN-03 | 충돌 시 reset --hard, 안내문 일치 | `integrate.sh: 충돌 시…` |
| RUN-02 | 이력명 순번, count 패턴 유지 | `wait-and-review.sh: 이력 이름…` |
| GEN-03 | 7번째 항목이 6번 뒤, forge-agents 제외 | `check-forge.sh: 7번째 항목…` |
| GEN-02 | forge-agents 자리표시 목록 = dev·review 템플릿 실제 집합 | `forge-agents 의 자리표시 목록…` |
| GEN-01 | disable-model-invocation 유지 | `forge-agents 스킬은…` |
| ADR-0004 | intended-diffs 밖 파일은 golden과 바이트 일치 | 기존 `golden: *` |

### 7. 계약·공통 모듈에 필요한 변경
없음. forge-init.md는 GEN-01 기준 충족이라 변경하지 않음.

## PH4 5라운드 — T-404 보강(review-1 권고 1·2) + T-405 보강(W3)

### 1. 작업
- T-404 보강: `guard-paths.sh` 끝 개행 우회(권고 1), 제어 문자 경로 차단(권고 2).
- T-405 보강: `checks()` NAME_INVALID `params.slug` 추가(dev-3 W3).

### 2. 변경 파일
`templates/static/guard-paths.sh`, `packages/core/src/checks.ts`, `packages/core/test/{adr0004,checks}.test.ts`, 스냅샷(guard 해시 줄만), `tests/golden/intended-diffs.json`(guard 사유 문구만).

### 3. 설계
- normalize 분할: `<<< "$1"` 은 끝에 개행을 붙여 마지막 세그먼트가 `..\n`/`.\n`이 되어 정규화되지 않았다. `IFS=/ read -r -d '' -a segs < <(printf '%s' "$1")` 로 개행 없이 분할한다. 그 결과 `src/order/..` → `src`, 디렉터리 접두어 항목(`src/order/`) 자체를 가리키는 경로(`src/order`, `src/order/.`, `src/order/x/../..`)는 접두어 `src/order/` 와 일치하지 않아 범위 밖이다(범위는 그 아래 파일만).
- 제어 문자: file 값은 `$(...)` 명령 치환을 거치며 끝 개행이 사라져 `foo\n` 이 `foo` 와 같아진다(완전 일치 우회). 그래서 값 변환 전의 원시 JSON 에 대해 별도 `jq -e '(.tool_input.file_path // "") | explode | any(. < 32 or . == 127)'` 로 코드포인트를 검사한다(정규식·`[[:cntrl:]]` 로케일 의존 회피). 참이면 `경로에 제어 문자가 있어 수정을 막았습니다.` 후 exit 2. 검사는 JSON 해석 성공 후, `file` 비어 있음 판정(빈 값 통과) **앞**, 정규화 앞에서 한다. 개행만 있는 값(`"\n"`)은 `$(...)` 뒤 빈 값이 되어 빈 값 통과(exit 0)로 새므로 순서가 중요하다(원시 JSON 검사라 앞당길 수 있다). file_path 가 없는 입력은 `// ""` 로 빈 문자열이 되어 제어 문자 없음 → 기존대로 통과.
- 유지: `set -f`, 배열 분할, jq 부재·해석 실패 fail-closed, 기존 문구.
- slug: PoC `slug()` 와 동일(`trim → toLowerCase → [^a-z0-9._-]+ → "-" → 앞뒤 "-" 제거 → 빈 값이면 my-project`). `params: { name, slug }`.

### 6. 테스트
| 수용 기준 | 테스트 이름 |
|---|---|
| here-string 미사용, 제어 문자 분기·문구, 검사가 정규화 앞 | `guard-paths.sh: here-string 미사용…` |
| normalize 경계값(bash 있을 때만 실행) | `guard-paths.sh normalize(): 끝 .. · . …` |
| NAME_INVALID params.slug | `NAME_INVALID params.slug: …` |

### 7. 계약·공통 모듈 변경
Issue.params 는 임의 키 허용이라 계약 변경 없음. bats 사례(제어 문자·끝 `..`)는 dev-2 에 요청.

---

# PH6 1라운드: T-601, T-602

## 1. 담당 작업·기능 ID
| 작업 | 기능 ID | 내용 |
| --- | --- | --- |
| T-601 | DOC-03 | `mergeClaudeMd(oldMd, nextMd)` 구현(design.md 8.1) |
| T-602 | RUN-04 | tmux 배치·접두키·마우스·로그(design.md 8.2) |

## 2. 파일 목록
| 경로 | 책임 |
| --- | --- |
| `packages/core/src/merge-claude-md.ts` (신규) | 마커 파싱·병합 순수 함수 |
| `packages/core/src/api.ts` | `mergeClaudeMd` 를 위 모듈에 위임 |
| `packages/core/src/render/config.ts` | `p.tmux` 지정 시 `tmuxLayout` 값 + `tmux` 객체 |
| `packages/core/src/render/scaffold.ts`, `render/index.ts` | `p.tmux?.logs` 일 때 `.gitignore` 에 `.agentforge/logs/` 추가 |
| `templates/static/run-agents.sh` | config 를 jq 로 읽어 pair/grid/role 배치 |
| `packages/core/test/merge-claude-md.test.ts`, `tmux.test.ts` (신규) | 시험 |

## 3. 주요 함수
- `mergeClaudeMd(oldMd, nextMd): string`: 구간 ID PROJECT·AGENTS·DEVS·SKILLS. 각 문서의 구간을 정규식 없이 `indexOf` 로 찾고, BEGIN·END 가 1:1 이 아니거나 END 가 BEGIN 앞이면 `AppError("CLAUDE_MD_MARKERS", {id})`(old·next 모두 검사). old 에 마커가 없으면 규칙 5(구간 4개를 끝에 붙임), 있으면 AGENTS·DEVS·SKILLS 는 next 내용으로 교체, PROJECT 는 보존, old 에 없는 구간은 끝에 붙임(끝 줄바꿈 1개로 맞춘 뒤 `\n` 구분). next 에 없는 구간은 old 그대로.
- 구간 안쪽 = BEGIN 마커 직후부터 END 마커 직전까지(줄바꿈 포함 그대로 교체).
- 멱등: 교체 결과가 next 구간과 같아지고 이미 존재하는 구간은 재추가하지 않으므로 성립.

## 4. 계약
`mergeClaudeMd`(api.ts 시그니처 불변), forge.config.json `tmuxLayout`/`tmux`, `.gitignore`. 스키마 변경 없음.

## 6. 테스트 목록
| 수용 기준 | 테스트 |
| --- | --- |
| 규칙 1~6, 오류 | `merge-claude-md.test.ts` 단위 + fast-check 4종(마커 밖 보존, PROJECT 보존, 멱등, next 반영) |
| tmux 미지정 불변, 지정 시 config 키 순서, logs 시 gitignore | `tmux.test.ts` |
| run-agents.sh 에 jq 읽기·세 배치·세션 범위 set·pipe-pane | `tmux.test.ts` 문자열 검사 + WSL bats |

## 7. 계약·공통 모듈 변경
없음. `tests/golden/intended-diffs.json` 갱신은 리드에게 요청(보고서).

### PH6 보강(review-1 반려 대응)
- 구간 겹침: old·next 모두 구간을 start 로 정렬해 앞 구간 stop > 뒤 구간 start 이면(엇갈림·포함) `CLAUDE_MD_MARKERS {id: 뒤 구간 ID}`.
- 마커 개수는 코드블록 안의 마커도 센다(마크다운 문맥을 해석하지 않음). CLAUDE.md 본문에 마커 문자열을 예시로 쓰면 오류가 날 수 있다.
- 끝 줄바꿈 정리는 `/(\r?\n)+$/`(CRLF 포함).
- run-agents.sh: pipe-pane 명령은 tmux 가 /bin/sh 로 실행하므로 `printf %q` 대신 POSIX 작은따옴표 인용(`sq`). grid·role 은 창의 마지막 pane 을 나눠 dev-1, review-1, dev-2… 순서를 유지.
- T-606: 8.6 S-3·S-4 (settings defaultMode, README 한 줄, integrate.sh 사전 검토 파일 확인, 검토 요청 문구).

---

# PH6 3라운드: T-605 (I18N-01 생성물 영어)

- 파일: `templates/md-en/*`(16종, md 와 같은 파일명·자리표시), `render/text.ts`(언어별 문구 표), `render/tpl-source.ts`(`mdTpl(name, lang)`), `render/{claude-md,readme,agents,dev-agents,skills,scaffold,index,env-example,litellm,vscode,context}.ts`(language 분기).
- 규칙: `language: "ko"` 는 PH5 출력과 바이트 같음(golden·스냅샷 불변). `en` 이면 CLAUDE.md 고정 규칙·표, README, PRD 양식, 에이전트·스킬 본문, env.local.example·litellm.yaml 주석, `.paths` 주석, VS Code 작업 이름을 영어로. 정적 스크립트(`scripts/*`, hook)와 requirements.md(사용자 원문)는 그대로.
- 정적 스크립트가 보내는 한국어 메시지("설계 승인", "반려", "설계 검토", "코드 검토")는 영어 본문에서 의미("design-approved message", "rejection message", "design/code review request")로 가리킨다(본문에 한글을 남기지 않기 위함).
- 시험: `test/i18n-en.test.ts` — 파일별 자리표시 집합 동일, en 렌더 한글 없음(스크립트·requirements 제외), check-forge 계약(스킬 참조·자리표시), 마커·200줄, en 스냅샷 4구성.
- `tools/gen-templates.mjs` 는 templates/** 전체를 내장하므로 변경 없음.

---

# PH7 1라운드: T-701 (MKT-02 위험 검사·불변식·가져온 스킬 렌더)

- 파일: `packages/core/src/market/risk.ts`(신규: `scanSkillRisk`, `RiskCode`, `parseSkillMd`), `schema/invariants.ts`(I6 재계산 + 4종 추가), `checks.ts`(files 기준 IMPORT_UNACKED), `render/skills.ts`(`importedSkillFiles`), `render/index.ts`, `src/index.ts`(공개 export), `test/market-risk.test.ts`.
- 판정: design.md 9.2 표. 코드블록 안 `curl https://` 도 보수적으로 REMOTE_DOWNLOAD. `Bash(git:*)` 등 범위를 좁힌 항목은 BROAD_TOOLS 아님. BANG_COMMAND·BROAD_TOOLS 는 SKILL.md 만, 나머지는 모든 파일.
- 불변식: files 가 있으면 flags 를 재계산(입력 flags 무시). IMPORT_NO_SKILL_MD / NAME_MISMATCH / DUP_PATH / TOO_LARGE(합계 512,000자). checks 는 files 가 올바른 형태면 같은 재계산, 아니면 입력 flags.
- 렌더: files 있으면 `.claude/skills/<id>/<path>` 원문(644, template), SKILL.md 먼저·나머지 사전순. 없으면 기존 안내. sources.lock 은 T-702.
- 시험: `market-risk.test.ts`(판정표 18, 정렬·고유, 불변식 9, 렌더 3), 기존 golden·스냅샷 불변.
- 계약 변경: 없음(ADR-0007 승인 범위의 invariants 수정).

---

# PH7 2라운드: T-702·T-703 (MKT-02·EXP-02 core)

- 파일: `src/util/sha256.ts`(순수 SHA-256, UTF-8 바이트), `src/render/sources-lock.ts`(`renderSourcesLock`), `src/render/index.ts`(imported 가 있을 때만 `.agentforge/sources.lock` 추가, 644, template), `src/export-plan.ts`(`planGithubTree`), `src/checks.ts`(`IMPORT_RISK`), `render/text.ts`·`readme.ts`(가져온 스킬 안내 한 줄), `src/index.ts`(export), `test/ph7-round2.test.ts`.
- sources.lock: `{version:1, skills:[{id,src,trust,ref|null,target,flags,files:[{path,sha256}]}]}`, 키 순서 고정, 2칸 들여쓰기 + 끝 줄바꿈. flags 는 files 가 있으면 `scanSkillRisk` 재계산, 없으면 입력값. files 없으면 `files: []`. files 순서는 렌더와 같이 SKILL.md 먼저·나머지 사전순.
- `planGithubTree(files)`: mode 0o755 는 100755, 나머지 100644(생성 .sh 는 모두 0o755, 가져온 스킬 안의 .sh 는 644 로 넣었으므로 100644), 입력 순서 유지. 경로가 `env.local` 로 끝나면(`env.local.example` 은 제외) `AppError("EXPORT_SECRET_PATH", {path})`.
- checks: 가져온 스킬 항목별 위험 코드가 있으면 `info IMPORT_RISK {id, codes(쉼표 연결)}`(files 올바르면 재계산, 아니면 입력 flags). 불변식 4종은 validate 가 보고하므로 중복하지 않는다. 비정상 입력에서도 throw 하지 않는다.
- README: imported 가 비어 있지 않을 때만 안내 한 줄(ko·en) — sources.lock 위치, 실행 권한 없이 넣었으니 필요하면 직접 chmod.
- 시험: sha256 벡터 4종(+멀티바이트), lock 내용·순서·flags 재계산, imported 없으면 lock 없음, planGithubTree 모드·순서·env.local 차단, render 결과와 mode 대응, IMPORT_RISK, README 조건부, 비정상 입력 비-throw.
- 계약 변경: 없음.

---

# PH8 T-801 (LIC-01 라이선스 검증·등급 강제, core)

1. 작업: T-801 (design 10.1, ADR-0008)
2. 파일: `packages/core/src/license.ts`(verifyLicense·tierLimits·LICENSE_PUBLIC_KEYS), `checks.ts`(opts.license, LICENSE_LIMIT·LICENSE_INVALID), `index.ts`(export), `test/license.test.ts`, `package.json`(@noble/curves ^2.4.0, MIT)
3. 함수
   - `verifyLicense(key, { today, publicKeys? }): LicenseResult` — 순수. 공백 전부 제거 → 2,000자·조각 3개·`AF1` 접두·base64url·UTF-8 JSON·payload zod 실패는 LICENSE_FORMAT → kid 미등록 UNKNOWN_KID → ed25519.verify 실패(공개 키 오류·서명 길이 오류 포함) SIGNATURE → `expires < today` EXPIRED. today 형식 오류·문자열 아닌 입력은 FORMAT. throw 하지 않는다.
   - `tierLimits(tier|null)` — null·free 2, pro·team 6.
   - `checks(input, { license? })` — developerCount > 상한이면 error LICENSE_LIMIT {tier,max}; 실패 license 는 info LICENSE_INVALID {code} + Free 상한.
4. 계약: design 10.1. 기존 `validate(tierLimit)` 불변.
5. 화면: 없음.
6. 테스트: `test/license.test.ts` (정상 3등급·null expires·만료 경계·공백·Uint8Array 키·위조·서명 비트·타 키·kid·형식 17종·today 오류·fast-check 무예외·운영 키 hex·tierLimits·LICENSE_LIMIT 2/3·6/7·LICENSE_INVALID). 기존 `checks.test.ts` 는 Pro 라이선스로 실행(기본 초안 3명 → Free 상한 회피, 의도 유지).
7. 계약 변경: 없음.
