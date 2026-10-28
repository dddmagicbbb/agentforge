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
