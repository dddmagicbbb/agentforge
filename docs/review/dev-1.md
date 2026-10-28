# review-1 검토: dev-1 PH4 1라운드 (T-401, T-405)

- 대상 커밋: 77841b1(T-401), 49247f3(T-405) / 기준 `develop` = 0998785
- 최종 판정: **통과** (설계 통과, 코드 통과)

## 1. 설계 검토 (`docs/design/detail/dev-1.md`)
- 기능 ID: DEV-01·DEV-02(T-401), PRV-02·PRV-04(T-405) 전부 1장·6장에 배정됨.
- design.md 3장 시그니처(`resizeDevs`, `checks`, `canExport`)와 일치. 스키마(`schema/`) 변경 없음(7장 "없음").
- checks 코드 12종·level이 design.md 3장 목록과 일치. 순서는 PoC `checks()`와 같음.
- 6장 테스트 목록이 tasks.md 완료 기준(fast-check 3→5→2 일관성, D4 경로 정규화, litellm 조건부, 12종, canExport)을 모두 덮음.

## 2. 범위
`git diff --name-only develop...HEAD`:
`docs/design/detail/dev-1.md`, `packages/core/src/{api,checks,resize}.ts`, `packages/core/test/{checks,resize,schema}.test.ts` — 전부 dev-1 범위. `packages/core/src/schema/` 변경 0건.
`schema.test.ts` 수정은 기존 "미구현 API는 throw" 테스트 대상을 `checks` → `mergeClaudeMd`(P1)로 옮긴 것으로 타당.

## 3. 시험 직접 실행
| 명령 | 결과 |
| --- | --- |
| `pnpm gen:templates` | 26개 생성 |
| `pnpm --filter @agentforge/core test` | 5 파일, 228 테스트 전부 통과 (exit 0) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm check:poc-static` | PoC 원본 26개와 일치 (exit 0) |

## 4. PoC 동등성 대조 (`poc.html` GEN 구간 `syncDevs`·`checks()`)
| 항목 | PoC | 구현 | 결과 |
| --- | --- | --- | --- |
| syncDevs | 부족분 claude/sonnet 빈 dev 추가, 길이 절단 | 동일 + 불변(structuredClone), 범위 밖 `DEV_COUNT_RANGE` | 일치 |
| NAME_INVALID | `^[a-z0-9][a-z0-9._-]*$` (trim 후), er | 동일, error | 일치 |
| REQ_SHORT | trim 길이 < 30, wa | 동일, warn | 일치 |
| PATH_OVERLAP | 다른 dev 간 startsWith 양방향, er | 동일 + D4 끝 `/` 정규화 | 일치(설계 D4 반영) |
| DEV_DEFERRED | `!devReady` (domain trim·paths), in | 동일, info | 일치 |
| MODEL_MISSING | allAgents 순서, p≠claude && m 공백, er | 동일 순서(seq→dev/review→integrator, ux는 ui일 때만) | 일치 |
| REVIEW_WEAKER | dp=claude && rp≠claude, wa | 동일, warn | 일치 |
| OPENROUTER_FREE_LIMIT | p=openrouter && `/:free$/`, 개수 | 동일, warn, params.count | 일치 |
| GATEWAY_REQUIRED / VLLM_TOOL_PARSER | usesVia litellm / vllm, in | 동일, info (미지 제공자는 via 없음 — PoC는 claude로 폴백, 결과 동일) | 일치 |
| IMPORT_UNACKED | flags.length && !ack, er | flags 비어 있지 않고 acknowledged≠true, error | 일치 |
| UI_OFF | `!S.ui`, in | `uiDesign === false`, info | 일치(아래 관찰 참조) |
| ALL_OK | er·wa 없으면 맨 앞 unshift | 동일 | 일치 |

- 견고성: `fc.anything()` 200회 + null/숫자 섞인 devs·agents·imported 사례에서 throw 없음 확인.
- 순수성: checks.ts·resize.ts에 I/O·`Date`·`Math.random`·`process` 사용 없음.

## 5. 지적 사항
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
| --- | --- | --- | --- |
| 권고 | packages/core/src/checks.ts:34 | PoC `pathsOf`는 각 경로를 trim 하지만 구현은 trim 없이 `/`만 붙인다. 검증 전 입력에 `" src/a"` 같은 앞뒤 공백이 있으면 PoC와 겹침 판정이 달라질 수 있다(validate의 PathPrefix가 공백을 error로 막으므로 내보내기 차단에는 영향 없음). | `filter` 전에 `p.trim()` 한 값으로 정규화하거나, web이 배열 변환 시 trim함을 계약으로 명시 |
| 권고 | packages/core/src/checks.ts:71,101 | PoC는 `!S.ui`(falsy)로 판정, 구현은 `=== false`. `uiDesign` 누락(undefined) 시 UI_OFF·ux-designer 제외가 PoC와 다르다. 스키마상 boolean 이라 현재 실영향 없음. | 의도라면 주석으로 근거 표기, 아니면 `p["uiDesign"] !== true`로 맞춤 |
| 권고 | docs/report-dev-1.md (없음) | project-rules.md 84행: 완료 시 `docs/report-<역할>.md` 작성. 이번 브랜치에 보고서가 없다. | T-401·T-405 행(작업 ID·결과·변경 파일·테스트·남은 문제)으로 작성 |

반려 사유(테스트 실패, 범위 밖 변경, 계약 불일치, 수용 기준 미충족, 오류 처리 누락, 비밀 값)에 해당하는 항목 없음.

## 최종 판정
- 설계 검토: **통과**
- 코드 검토(T-401, T-405): **통과**
