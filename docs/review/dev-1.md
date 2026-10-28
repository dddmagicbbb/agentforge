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

---

# 2라운드: T-402, T-406 + core 공개 export 보강

검토 대상: `git diff develop...HEAD` (30648ad, bfbe402, 리드 병합 b2dfe1b)

## 1. 설계 검토
- 기능 ID: SKL-01·SKL-02(T-402), RUN-03·VSC-01(T-406) 모두 1·6장에 있음. 6장 테스트 이름과 실제 시험(describe/it)이 1:1로 대응함.
- 완료 기준(tasks.md 40·44행): 토글 4조합, 고정 스킬 4종, `devN-<domain>` dev-N·review-N 한정, frontmatter 형식, integrate.sh·tasks.json(6작업) 렌더, 대표 구성 6종 스냅샷 — 모두 시험으로 덮임.
- 대표 구성 6종이 project-rules 69행과 일치: 기본(UI 켬·개발자 3·vLLM+OpenRouter = `defaultDraft`) / UI 끔 / 1명 / 6명 / 정보 비움(dev-2 생략 확인, files=48) / LiteLLM(openai·gemini)+마켓 가져오기.
- 보강 export(3장): `seqI18nKey`로 산출물·관문 문장을 web에 두는 방침은 맞다. 다만 아래 5장 반려 1건(CORE_SKILLS.layer).

## 2. 범위
- 변경 파일 8개 모두 `packages/core/`·`docs/design/detail/dev-1.md` 안. `templates/**`·`schema/` diff 없음. `check:poc-static` 26개 일치.

## 3. 직접 실행 결과
| 명령 | 결과 |
| --- | --- |
| `pnpm install` | 최신(변경 없음) |
| `pnpm gen:templates` | 26개 |
| `pnpm --filter @agentforge/core test` | 8 파일, 268 통과, 실패 0 |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | 모두 exit 0 (web 청크 500kB 경고만) |
| `pnpm check:poc-static` | PoC 원본 26개와 일치 |

## 4. 점검
- 스냅샷 강도: 파일별 `모드·작성주체·sha256 앞 12자·경로` + 파일 수. 내용 diff는 golden에 맡기고 구성별 파일 구성·권한 회귀를 잡는 수준으로 적절(느슨하지도 과하지도 않음). "6종이 서로 다름", "LiteLLM 구성에만 litellm.yaml" 보조 단언도 의미 있음.
- tasks.json 시험이 명령 안의 `scripts/*.sh`가 실제 생성 파일인지 교차 확인 — 좋음.
- 새 export의 web 사본 대체 가능성:
  - `PROVIDERS`(id·models 순서) → web `PROVIDER_OPTIONS` 대체 가능. 표시명은 web이 `provider.<id>` 키로 이미 처리.
  - `SEQ`·`FINAL`·`seqI18nKey` → `ROUTINE_IDS`·`OPTIONAL_AGENT`(`optional`)·`FINAL_AGENT` 대체 가능.
  - `devSkill` → `devSkillName` 대체 가능.
  - `CORE_SKILLS` → **대체 불가**. web 사본은 `layer: "common"|"role"|"gen"`(i18n 키 `skills.layer.<layer>`)으로 묶는데 core는 `layer: "공통"|"역할"|"생성"`(한국어 문장), `to`도 한국어 문장이다. web이 이를 쓰면 화면에 i18n 아닌 문장이 나가고(project-rules 65행 위반), 안 쓰면 사본을 유지해야 한다.
- 문장 노출: `CORE_SKILLS.layer/to`, `IMPORT_TARGET_LABEL`, `label()`(`"모델 미입력"`, 제공자 한국어 표시명)은 원래 CLAUDE.md 생성물용 값인데 index.ts 주석이 "화면(web)이 … 쓰는 표시 데이터"로 공개해 화면 사용을 유도한다.

## 5. 지적 사항
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
| --- | --- | --- | --- |
| 반려 | packages/core/src/render/context.ts:33,39-46 | `CORE_SKILLS`에 언어 중립 계층 식별자가 없어(`layer`가 한국어 "공통/역할/생성") web `catalog.ts` 의 CORE_SKILLS 사본을 지울 수 없다. 보강의 목적(설계 2라운드 1장 "web 사본 제거용 공개 export") 미충족이며, 그대로 쓰면 화면에 core 문장이 노출된다. | `CoreSkill`에 `group: "common" \| "role" \| "gen"` 필드를 추가(또는 `layer`를 키로 바꾸고 한국어 표기는 `claude-md.ts:23` 에서 매핑)하고, 생성물 golden이 바뀌지 않음을 확인. `core 공개 export` 시험에 `group` 단언 추가 |
| 권고 | packages/core/src/index.ts:4,11-12 | `label`·`IMPORT_TARGET_LABEL`·`CORE_SKILLS.to`는 생성물(CLAUDE.md) 전용 한국어 값인데 주석이 화면 표시용으로 안내한다. web은 이미 `t("provider.<id>")`로 label을 만든다. | 주석을 "생성물 표기와 같은 값 — 화면 표시는 i18n 키 사용"으로 고치거나 `label`·`IMPORT_TARGET_LABEL` export를 빼고 설계 3장에 근거 기록 |
| 권고 | packages/core/test/snapshots.test.ts:16-19,25 | `withDevCount`가 1라운드에서 구현된 `resizeDevs`(api.ts:98)와 역할이 겹친다. 직접 만든 dev가 실제 화면 경로(resizeDevs)와 달라 6명 스냅샷이 실제 사용 경로를 대표하지 못한다. | `resizeDevs(d, 6)` 후 비어 있는 dev 의 domain·paths 만 채우는 방식으로 교체(스냅샷 갱신) |
| 권고 | packages/core/test/snapshots.test.ts:26 | "개발자 정보 비움"이 dev-2 하나만 비운다. project-rules의 `/forge-agents` 위임 의도(전원 비움)를 함께 대표하려면 전원 비움 사례가 더 적합. | 전원 비움 구성으로 바꾸거나 별도 단언(에이전트 dev-*.md 0개, DEV_DEFERRED) 추가 |
| 권고 | docs/report-dev-1.md (없음) | 1라운드에 이어 완료 보고서가 여전히 없다(project-rules 84행). | T-402·T-406 행 포함해 작성 |

## 최종 판정 (2라운드)
- 설계 검토: **통과** (기능 ID·테스트 목록 완비)
- 코드 검토(T-402, T-406 + export 보강): **반려** — 시험 268건 전부 통과, 범위 준수. 반려 사유 1건: `CORE_SKILLS` 공개 export가 web 사본 제거 목적을 충족하지 못함(context.ts:33,39-46). 해당 1건 수정 후 재검토. T-402·T-406 시험 자체는 수용 기준 충족.

---

# 2라운드 재검토: T-402, T-406 (1818283, 513d49f)

## 1. 반려 항목 확인
| 항목 | 결과 |
| --- | --- |
| `CORE_SKILLS.group` (context.ts:33-50) | `common`·`role`·`gen` 이 web `skills.layer.<group>`(locales/ko.json:121-127)·`catalog.ts` 사본 값과 일치. web 사본 제거 가능. `skills.test.ts`에 id→group 전수 단언 추가 |
| golden 바이트 | `golden.test.ts` 통과(`layer`·`to` 값 불변, `claude-md.ts` 미변경). `tests/golden/` diff 없음 |
| `check:poc-static` | PoC 원본 26개와 일치 |

## 2. 권고 반영 확인
- index.ts:4-6, context.ts: `label`·`IMPORT_TARGET_LABEL`·`layer`·`to`를 "CLAUDE.md 생성물 문구 — 화면 표시 금지"로 정정. 반영됨.
- snapshots.test.ts: 1명·6명이 `resizeDevs` 기반(새 빈 슬롯만 도메인 채움), 정보 비움이 전원 비움으로 바뀜. dev-N/review-N/devN- 파일 0개, dev 에이전트 수 1·6 단언 추가. 반영됨.
- 보고서 파일: 리드 결정으로 면제 — 기준에서 제외.

## 3. 스냅샷 갱신 범위
- `git show 513d49f --stat`: `.snap`·`snapshots.test.ts` 2파일뿐.
- `.snap` 변경 hunk는 `개발자 1명`·`개발자 6명`·`개발자 정보 비움` 3종에만 있음(기본·UI 끔·LiteLLM 불변). 의도한 범위로 한정됨.

## 4. 직접 실행
| 명령 | 결과 |
| --- | --- |
| `pnpm gen:templates` | 26개 |
| `pnpm --filter @agentforge/core test` | 8 파일, 270 통과, 실패 0 (+2: 전원 비움·dev 수 단언) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | 모두 exit 0 |
| `pnpm check:poc-static` | exit 0, 26개 일치 |

## 5. 범위
`git diff --name-only develop...HEAD`: `packages/core/**`, `docs/design/detail/dev-1.md`, `docs/review/dev-1.md`(review-1 본인) 뿐. `templates/**`·`schema/` 불변.

## 6. 남은 지적
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
| --- | --- | --- | --- |
| - | - | 없음 | - |

## 최종 판정 (2라운드 재검토)
- 코드 검토(T-402, T-406 + export 보강): **통과**
