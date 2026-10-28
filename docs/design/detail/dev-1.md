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
