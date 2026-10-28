# 검토 dev-3 — PH4 1라운드 (화면 골격 + T-422, T-424)

- 대상: 8e60d0d(T-422 + 골격), e3633ad(T-424), 기준 0998785
- 검토자: review-3

## 1차 판정: 반려 (재검토 결과는 문서 끝 "재검토" 절 참조)

반려 사유 2건(R1, R2). 코드 품질·계약 준수·시험 통과는 양호하고, 고칠 양은 적다.

## 실행한 시험

| 명령 | 결과 |
|---|---|
| `pnpm install` | 성공(lockfile 최신) |
| `pnpm gen:templates` | 성공, templates.generated.ts 26개 |
| `pnpm --filter @agentforge/web test` | 시험 파일 1개, 16개 통과 / 0 실패 (2.20s) |
| `pnpm typecheck` | core·server·exporter·web 모두 통과 |
| `pnpm lint` | 통과(exit 0, 경고 없음) |
| `pnpm build` | 통과. web 번들 517.04 kB(gzip 161.42 kB), 500 kB 초과 경고 1건(반려 사유 아님) |

## 범위

`git diff --name-only 0998785...HEAD` 결과는 `packages/web/**`, `docs/design/detail/dev-3.md`, `pnpm-lock.yaml` 뿐이다. 범위 밖 변경 없음.
`pnpm-lock.yaml`은 web devDependency 6개(@testing-library/jest-dom·react·user-event, jsdom, vitest) 추가와, 그 결과 루트 importer의 vitest peer 해석 문자열에 `(jsdom@30.1.3)`이 붙은 것뿐이다. 다른 패키지의 의존성 버전 변경은 없다.

## 설계 검토

- 기능 ID RTN-02(T-422), SKL-01·SKL-02(T-424)를 1장·3장·6장에서 다룬다. T-422 완료 기준(흐름도, 제공자·모델 선택, 산출물·관문 표시)과 T-424(계층별 표시, 토글, 마켓 비활성 안내)를 모두 다룬다.
- 5장에 로딩/빈 값/오류/성공/비활성 상태가 모두 있다.
- 4장 계약(core `defaultDraft`·`validate`·`render`·`devReady`, exporter `toZip`)과 실제 import가 일치한다. 제공하는 API 없음.
- 7장 core 미공개 상수의 사본(`src/catalog.ts`) 판단은 타당하다. 값은 core와 일치한다(아래 점검 참조).

## 지적 사항

| 판정 | 파일:줄 | 문제 | 고칠 방법 |
|---|---|---|---|
| 반려(R1) | packages/web/test/app.test.tsx:113-123 | 설계 6장 SKL-01 수용 기준 "미정 도메인 문구"를 검증하지 않는다. 시험 이름은 `고정 스킬은 비활성이고 도메인 미정은 안내 문구`인데, 기본 입력은 개발자 3명 모두 `devReady`라서 오히려 `도메인 미정` 문구가 **없음**만 확인한다. `StepSkills.tsx:49-54`의 미정 분기(`skills.devPending`)는 어떤 시험도 거치지 않는다. 3단계가 자리표시라 화면 조작으로 도메인을 비울 수 없으므로 App 마운트만으로는 검증이 불가하다. | `StepSkills`를 직접 마운트해 `defaultDraft()`에서 `devs[1].domain = ""`(또는 `devReady`가 false가 되는 값)로 바꾼 draft를 넘기고, `dev2-...` 코드가 없고 `도메인 미정 · /forge-agents가 생성`이 보이며 나머지 개발자는 `dev1-order`·`dev3-...`로 보이는지 확인한다. |
| 반려(R2) | docs/report-dev-3.md (없음) | 완료 보고서가 커밋되지 않았다. conventions 규칙(`docs/report-<에이전트>.md`, 표 `작업 ID / 결과 / 변경 파일 / 테스트 / 남은 문제`)과 상세 설계 2장 파일 목록에 있는 산출물이다. 설계 3·7장이 "report 기재"로 넘긴 core export 요청(`PROVIDERS`·`CORE_SKILLS`·`SEQ`/`FINAL`·`devSkill`)도 기록되지 않았다. | `docs/report-dev-3.md`를 T-422·T-424(및 골격) 행으로 작성하고, 남은 문제에 core export 요청과 `src/catalog.ts` 사본 제거 계획, 3·5·6단계 자리표시(T-423·T-425·T-426)를 적는다. |
| 권고 | packages/web/src/steps/StepRoutine.tsx:34 | PoC `p1()`은 통합 검증 행 번호를 `k + 1 > 5 ? 8 : k + 1`로 8번으로 표시한다(6·7은 병렬 단계). 화면은 6으로 표시해 PoC와 다르다. | `k === ROUTINE_IDS.length - 1 ? 8 : k + 1` 처럼 PoC 번호 규칙을 따른다. |
| 권고 | packages/web/src/steps/StepSkills.tsx:28 | PoC `p3()`은 고정 스킬 전부에 ` · 필수`를 붙이는데, 화면은 생성 계층(forge-init·forge-agents)에서 뺐다. 의도라면 설계에 적고, 아니면 PoC와 맞춘다. | `k.fixed ? ...` 로 조건을 PoC와 같게 하거나 설계 3장에 차이를 명시한다. |
| 권고 | git 이력 8e60d0d | 한 커밋에 골격(T-421 일부)과 T-422가 함께 들어 있다(규칙: 한 커밋 한 작업 ID). 이미 커밋된 것이라 이번에는 반려 사유로 보지 않는다. | 다음 라운드부터 T-421 골격 작업은 별도 커밋으로 나눈다. |
| 참고 | packages/web/src/steps/StepRequirement.tsx:33 | `export.failed`에 `e.message`를 그대로 끼워 넣는다. exporter 오류 문구가 i18n 밖 문자열로 노출될 수 있다. 현재 비밀 값 노출 경로는 없다. | 다음 라운드(T-426)에서 오류 코드 기반 메시지로 바꾸는 것을 검토한다. |

## 점검 결과(문제 없음)

- 하드코딩 UI 문자열: 화면 문구는 모두 `t()` 키이며, 사용 키(정적·동적 `routine.seq.<id>.*`, `skills.core.<id>.*`, `provider.<id>`, `steps.<k>`)가 `src/locales/ko.json`에 모두 있다. 리터럴은 `→`·`—` 기호, `dev-N` 식별자, ZIP 파일 이름뿐이다.
- `any` 사용 없음. 외부 URL·CDN 없음. `localStorage` 사용 없음, 키·비밀 값 입력란 없음(`App.tsx` 주석과 일치).
- 제공자 변경 시 모델 기본값: `catalog.ts:26-28` `defaultModel`이 claude→`sonnet`, 그 외 추천 첫 값이다. PoC(`models[claude ? 1 : 0]`)와 동일. `ModelPicker.tsx:23-26`에서 적용, 시험 `제공자 변경 시 모델이 추천 기본값으로 바뀐다`로 확인.
- uiDesign 끔 → ux-designer 행 select·input `disabled`, 흐름도 노드 `opt off`. PoC `p1()`·`flowHtml()`과 동일.
- 흐름도: 순차 5개 → 병렬 쌍(개발자 수) → integrator. PoC `flowHtml()`과 구조·문구 동일.
- `catalog.ts` 사본 값: 제공자 6종 순서·추천 모델이 `packages/core/src/providers/*.ts`와 일치. `CORE_SKILLS` id·계층·fixed가 `render/context.ts:30-37`과 일치. `devSkillName`이 core `devSkill`(`dev${n}-${domain}`)과 같고 1부터 번호를 매긴다.
- 마켓 영역은 안내문만 있고 `imported`를 건드리지 않는다.
- ZIP 생성: 오류 시 버튼 차단, 생성 중 `disabled` + "생성 중…", 실패 시 `export.failed`. 설계 5장과 일치.

## 재검토 조건

R1 시험 추가, R2 보고서 커밋 후 `pnpm --filter @agentforge/web test`가 모두 통과하면 통과로 판정한다.

---

## 재검토 (커밋 71c6d8a)

### 최종 판정: 통과

### 실행한 시험
| 명령 | 결과 |
|---|---|
| `pnpm --filter @agentforge/web test` | 시험 파일 1개, 17개 통과 / 0 실패 (1.99s) |
| `pnpm typecheck` | 통과(exit 0) |
| `pnpm lint` | 통과(exit 0) |
| `pnpm build` | 통과(exit 0). web 번들 517.04 kB, 500 kB 초과 경고만 1건 |

범위: `git diff --name-only 0998785...HEAD`에서 `packages/web/**`, `docs/design/detail/dev-3.md`, `docs/review/dev-3.md`, `pnpm-lock.yaml` 밖의 변경은 없다.

### 지적 반영 확인
| 항목 | 결과 | 근거 |
|---|---|---|
| R1 도메인 미정 분기 시험 | 해소 | `test/app.test.tsx:115-124`는 `StepSkills`를 직접 마운트한다. `devs[1]`을 `domain: "", paths: []`로 바꾸면 core `devReady`(`schema/invariants.ts:13-15`, `domain !== "" && paths.length > 0`)가 false가 되어 `StepSkills.tsx` 미정 분기(`skills.devPending`)로 간다. 미정 문구 1건, `dev1-order`·`dev3-admin` 있음, `dev2-payment` 없음까지 확인한다. |
| R2 보고서 | 면제 | 리드 결정: 서브에이전트 모드에서는 보고를 최종 응답으로 받는다. |
| 권고: 통합 검증 행 번호 8 | 반영 | `StepRoutine.tsx:34` `id === FINAL_AGENT ? 8 : k + 1`, 시험 `산출물과 관문을 표시한다`에 `"8"` 확인 추가 |
| 권고: 고정 스킬 전부 ` · 필수` | 반영 | `StepSkills.tsx:28` `k.fixed ? ...`, 시험에서 고정 4종 label에 "필수"가 있는지 확인 |
| 권고: ZIP 실패 시 e.message 미노출 | 반영 | `StepRequirement.tsx:33-34`는 `AppError`이면 `e.code`, 그 외는 `"UNKNOWN"`만 `export.failed`의 파라미터로 넘긴다. 원문 메시지는 화면에 나오지 않는다. |

### 남은 지적(반려 사유 아님)
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
|---|---|---|---|
| 참고 | git 이력 71c6d8a | 커밋 이름은 T-424인데, T-422 범위인 `StepRoutine.tsx` 행 번호 수정이 함께 들어 있다(한 커밋 한 작업 ID). | 다음 라운드부터 작업 ID별로 커밋을 나눈다. |
| 참고 | StepRequirement.tsx:34 | 실패 문구가 "ZIP 생성에 실패했습니다: UNKNOWN"처럼 코드 그대로 보인다. | T-426에서 오류 코드별 i18n 키(`export.error.<code>`)로 바꾸는 것을 검토한다. |

---

# 2라운드 검토 — T-421, T-423, T-425 (커밋 276ba79, 53d5c43, 1e76ae5 / develop 병합 97639a2)

## 최종 판정: 통과

반려 사유는 없다. 아래 권고는 다음 라운드(T-426, catalog 정리)에 반영하면 된다.

## 실행한 시험
| 명령 | 결과 |
|---|---|
| `pnpm install` / `pnpm gen:templates` | 성공 / templates.generated.ts 26개 |
| `pnpm --filter @agentforge/web test` | 시험 파일 4개, **44개 통과 / 0 실패** |
| `pnpm typecheck` | 통과(exit 0) |
| `pnpm lint` | 통과(exit 0) |
| `pnpm build` | 통과(exit 0). web 번들 531.44 kB, 500 kB 초과 경고만 1건 |

## 범위
`git diff --name-only develop...HEAD` 15개 파일은 모두 `packages/web/**`와 `docs/design/detail/dev-3.md`이다. `pnpm-lock.yaml` 변경은 없다. 커밋 3개가 각각 한 작업 ID만 담는다(T-423·T-425가 `app.test.tsx` 자리표시 시험 대상만 바꾼 것은 해당 작업에 따른 변경).

## 설계 검토
- R2-1 T-421: REQ-01·02(이름·언어·요구사항·명령), DEV-01(개발자 수 1~6 스테퍼), RTN-01(UI 토글), 반려 한도(2~5)를 다룬다. 화면 상태(요구사항 짧음 = 경고·진행 가능, 이름 오류 = ZIP 차단)가 정의돼 있다.
- R2-2 T-423 DEV-02: 도메인·폴더·개발/검증 모델, 겹침·약한 검증 경고, 위임 안내, 오류 시 입력 원문 보존을 다룬다.
- R2-3 T-425 PRV-01·04: 사용 중인 제공자, 주소 입력(vLLM·Ollama), 안내만 하는 제공자, 키 입력란 없음, tmux 미리보기, 경고 4종을 다룬다.
- R2-0의 "core가 PROVIDERS 등을 export하지 않아 사본 유지"라는 전제는 develop 병합(core export 추가)으로 더 이상 맞지 않는다. 아래 권고 W1로 처리한다.

## 점검 결과
- **core 사용**
  - 스테퍼는 `resizeDevs(draft, n)`의 반환값 전체를 patch한다(`StepRequirement.tsx:59,61`). 버튼은 `1`·`MAX_DEVELOPERS` 경계에서 비활성이라 `DEV_COUNT_RANGE` 예외 경로에 들어가지 않는다.
  - `use-preview.ts:32-35`는 `validate`와 `checks`를 합친 뒤 `canExport`로 ZIP 활성 여부를 정한다. 경고·정보는 ZIP을 막지 않는다.
- **`mergeIssues`(use-preview.ts:15-29)**
  - `NAME_INVALID`(checks)와 `PROJECT_NAME`(validate)은 같은 위반이고 ko 문구도 같아, `NAME_INVALID`가 있을 때 `PROJECT_NAME`을 빼는 처리가 타당하다.
  - 64자 초과처럼 checks 정규식은 통과하고 validate만 막는 경우에는 `NAME_INVALID`가 없으므로 `PROJECT_NAME`이 남는다. 오류가 빠지는 경우는 없다.
  - `PATH_OVERLAP`·`MODEL_MISSING`·`IMPORT_UNACKED`는 validate(invariants)와 checks의 path·params가 같아 `keyOf`로 중복이 제거된다. 경로 끝 `/` 정규화도 양쪽이 같다(`patterns.ts:24`, `checks.ts:34`).
  - validate 오류가 있을 때 checks의 `ALL_OK`를 제거하는 처리도 맞다.
- **`issue.<CODE>` 12종(design.md 3장)**: 모두 ko.json에 있다.
  - PATH_OVERLAP·DEV_DEFERRED·MODEL_MISSING·REVIEW_WEAKER·OPENROUTER_FREE_LIMIT·GATEWAY_REQUIRED·VLLM_TOOL_PARSER·IMPORT_UNACKED·UI_OFF·ALL_OK는 PoC `checks()` 문장과 같고, 보간 변수가 core params(`devA/pathA/devB/pathB`, `dev`, `agent`, `count`, `id`)와 이름이 일치한다.
  - REQ_SHORT는 `{{length}}`·`{{min}}`을 추가해 PoC보다 정보가 많다.
  - NAME_INVALID는 PoC의 `지금 값으로는 "<slug>" 로 만듭니다` 부분을 뺐다(W3).
- **3단계 입력 원문 보존**: `DevRow`가 `pathText` state를 따로 들고, 배열은 `splitPaths`로만 갱신한다(`StepDevelopers.tsx:34-49`). 시험 `잘못된 경로는 오류를 보이지만 입력은 막지 않는다`와 `쉼표로 구분한 폴더…`(공백·쉼표 원문 유지)가 이를 확인한다.
- **5단계 키 입력란 없음**: 입력은 `vLLM 주소`·`Ollama 주소`뿐이고, password·key·token 입력란은 없다. 시험으로도 확인했다. `localStorage`·`any`·외부 리소스 로드는 없다(`conn.openrouter`·`conn.litellm`의 URL은 안내 문구일 뿐 요청을 보내지 않는다).
- **시험이 실제 분기를 거치는지**
  - 이름 오류 1회 표시 시험은 validate·checks 양쪽 오류를 만들어 `mergeIssues`의 제거 분기를 거친다.
  - 겹침·모델 누락 시험은 행 범위에서 `getByText`를 쓴다. 중복이 남으면 실패하므로 중복 제거를 실제로 검증한다.
  - 약한 검증·위임 안내·DEV_PARTIAL·HTTP_URL·게이트웨이 시험은 입력을 바꿔 해당 분기를 만들고, 다른 행에 경고가 없음(음성 단언)까지 확인한다.
  - 공허한 단언은 `요구사항이 충분히 길면 경고가 없다`(기본값만 확인) 1건 정도로, 판정에 영향이 없다.
  - TDD 순서 일부 미이행(dev-3이 스스로 밝힘)은 시험 품질로 판단했고, 문제 없다.

## 권고(반려 사유 아님)
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
|---|---|---|---|
| 권고 W1 | packages/web/src/catalog.ts 전체, docs/design/detail/dev-3.md R2-0 | core가 이제 `PROVIDERS`·`SEQ`·`FINAL`·`CORE_SKILLS`·`devSkill`·`seqI18nKey`를 export한다. 화면 사본이 남아 있어 값이 어긋날 위험이 있다. `agents.ts:14-20`의 순서 규칙도 core checks와 중복된다. | 다음 라운드에 사본을 core import로 바꾸고, 설계 R2-0 문구도 갱신한다. |
| 권고 W2 | packages/web/src/components/TmuxPreview.tsx:10 | `Claude ${a.model}` 리터럴과 번역 결과에 `.replace(/·LiteLLM| 로컬/, "")`를 적용하는 방식은 i18n 키 원칙에 어긋난다. en 번역에서는 축약이 깨진다. | `tmux.label.claude`(`Claude {{model}}`), `provider.short.<id>` 같은 키를 ko.json에 두고 `t()`로 만든다. |
| 권고 W3 | packages/web/src/locales/ko.json `issue.NAME_INVALID` | PoC 문장의 "지금 값으로는 "<slug>" 로 만듭니다"가 빠졌다. core params에는 `name`만 있어 지금은 재현할 수 없다. | 필요하면 core에 slug 파라미터 추가를 요청하거나(dev-1·리드), 생략을 설계에 적는다. |
| 권고 W4 | packages/web/src/steps/StepRequirement.tsx:72, StepRoutine.tsx | 순차 에이전트의 `MODEL_MISSING`(path `agents.*`)은 1·2단계에 표시되지 않고 5단계에만 나온다. 1단계 ZIP 버튼은 "오류 N건"으로 막히지만 원인 위치가 보이지 않는다. | T-426 생성 화면의 전체 검사 목록으로 해소되는지 확인하고, 아니면 2단계에 `IssueList filter={atPath("agents")}`를 붙인다. |
| 참고 | packages/web/test/round2-dev.test.tsx:89 | `getByText(/담당 폴더/, { selector: "li" })`는 PATH_PREFIX와 PATH_DOT_SEGMENT 중 어느 코드인지 구분하지 않는다. | 기대 코드의 문구(예: `/\. 또는 \.\. 경로 요소/`)로 좁힌다. |

---

# 4라운드 검토 — T-426 + W1·W2·W4 (커밋 b61f61d, dd6c85b, b10199b / develop 병합 def121e)

## 최종 판정: 통과

반려 사유는 없다. 아래 권고는 PH5 이전 정리 작업으로 처리하면 된다.

## 실행한 시험
| 명령 | 결과 |
|---|---|
| `pnpm install` / `pnpm gen:templates` | 성공 / templates.generated.ts 26개 |
| `pnpm --filter @agentforge/web test` | 시험 파일 6개, **68개 통과 / 0 실패** |
| `pnpm typecheck` | 통과(exit 0) |
| `pnpm lint` | 통과(exit 0) |
| `pnpm build` | 통과(exit 0). web 번들 534.18 kB, 500 kB 초과 경고만 1건 |

## 범위
`git diff --name-only develop...HEAD` 20개 파일은 모두 `packages/web/**`와 `docs/design/detail/dev-3.md`이다. `pnpm-lock.yaml` 변경은 없다.

## 지적 반영 확인
| 항목 | 결과 | 근거 |
|---|---|---|
| W1 catalog 사본 제거 | 해소 | `catalog.ts:1-21`은 core `PROVIDERS`·`provider`·`SEQ`·`FINAL`에서 파생값만 만든다. `agents.ts`는 `SEQ`·`FINAL`, `StepSkills`는 `CORE_SKILLS.group`·`devSkill`을 쓴다. `git grep`으로 web/src를 찾아보니 제공자 추천 모델·스킬 목록 사본은 없다. 남은 리터럴은 `defaultModel`의 `"sonnet"`(PoC 규칙), `OPTIONAL_AGENT` 대체값, `StepSkills` 토글 대상(`skills` 스키마 키), `StepConnection`의 제공자별 연결 칸 분기, ko.json의 i18n 키뿐이다. 생성물 문구(`label`·`layer`·`to`·`IMPORT_TARGET_LABEL`)는 화면에서 쓰지 않는다. |
| W2 tmux 하드코딩 | 해소 | `TmuxPreview.tsx:5-13`은 `tmux.paneModel`·`paneModel_claude`(i18next context)와 `provider.short.<id>` 키로 문구를 만든다. `` `Claude `` 리터럴과 `.replace()`는 없다. |
| W4 오류 원인 위치 | 해소 | `issue-step.ts` `stepOfPath`의 매핑: name·language·requirement·uiDesign·commands.*·maxRejects·developerCount·schemaVersion·`[]` → 1단계, agents.* → 2, devs.* → 3, skills·imported.* → 4, connections.* → 5. `ProjectObject`의 모든 최상위 키(`schema/project.ts:52-76`)가 편집 가능한 단계로 간다. 화면이 없는 `tmux`·`devcontainer`(P1)는 1단계로 가며 지금 화면에서는 생기지 않는다. 1단계·6단계 ZIP 옆 이동 버튼, 6단계 목록의 항목별 이동 버튼, 단계 바 오류 점(●, 접근명 "오류 있음")이 모두 있다. |

## T-426 (EXP-01) 점검
- **칩**: 파일 수, `mode===0o755` 수, `ai-fill` 수를 보인다(PoC `p5()`). 시험에서 core `render` 결과와 수치를 비교한다.
- **검사 목록**: `mergeIssues` 결과 전체를 아이콘(✓ ! ✕ i)과 `lv-*` 클래스로 보인다. 경고만 있으면 ZIP을 받을 수 있고, 오류가 있으면 "오류 N건" 문구와 함께 막힌다.
- **ZIP**: 파일명 `<name>-agentforge.zip`이 PoC와 같다. 실패하면 `export.error.<code>`가 있으면 그 문구, 없으면 `export.failed`를 쓰고 코드만 보인다.
- **받은 뒤 할 일**: 7단계 문구가 PoC와 같고, 4번은 `uiDesign`에 따라 `seqUi`·`seq`로 바뀐다.
- **GitHub 영역**: P1 안내 문구뿐이다. 소유자·저장소·토큰 입력란이 없다(원칙 4). PoC의 입력란 3종과 "호출 계획 보기"는 P1으로 미뤘다.
- i18n 키 누락, `any`, localStorage, 외부 리소스 사용은 없다.
- **시험이 실제 분기를 타는지**:
  - 오류 시험은 planner를 ollama로 바꾸고 모델을 비워 `agents.planner.model`의 `MODEL_MISSING`을 만든다. 2단계 이동, 단계 바 점, 1단계 이동 버튼까지 실제 분기를 거친다.
  - "오류 1건"을 단언하므로 validate·checks 중복 제거도 함께 검증된다.
  - `uiDesign` 토글 시험은 켬·끔 양쪽을 확인하고, 파일명 시험은 실제 anchor `download` 값을 확인한다.
- **TDD 순서·커밋 경계**: W1 커밋 b61f61d에 W2 시험(`round4-core.test.tsx:40-51`)까지 들어 있다. 그 시점 `TmuxPreview.tsx`에는 `` `Claude `` 리터럴이 남아 있으므로, b61f61d 단독으로는 이 시험이 실패한다(bisect 불가). HEAD에서는 모두 통과하므로 반려하지 않는다.

## 권고(반려 사유 아님)
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
|---|---|---|---|
| 권고 | git 이력 b61f61d | W1 커밋에 W2 시험이 섞여 해당 커밋에서 시험이 실패한다. 작업 ID 경계도 흐려진다. | 다음부터 시험은 그 시험이 검증하는 작업의 커밋에 넣고, 커밋마다 시험이 통과하게 한다. |
| 권고 | packages/web/test/round4-core.test.tsx:34-45 | 소스 파일을 정규식으로 검사하는 시험(`not.toMatch(/exaone-32b…/)`)은 변수 이름이 바뀌면 깨지고 우회도 쉽다. 같은 시험의 렌더 결과 비교(13-32행, 48-49행)만으로 충분하다. | 소스 문자열 검사는 lint 규칙(예: `no-restricted-syntax`)으로 옮기거나 삭제한다. |
| 권고 | packages/web/test/round4-gen.test.tsx:89 | `Object.assign(URL, …)`이 전역 `URL`을 직접 바꾸고 `vi.unstubAllGlobals()`/복원이 없다. 이후 시험에 영향이 남을 수 있다. | `vi.spyOn(URL, "createObjectURL")`으로 바꾸고 `afterEach`에서 `vi.restoreAllMocks()`를 호출한다. |
| 권고 | packages/web/src/steps/StepConnection.tsx:39-51 | 연결 칸을 제공자 id 리터럴로 분기한다. core `provider(id).via`(litellm 등)를 쓰면 제공자가 추가될 때 화면을 고칠 곳이 줄어든다. | `via === "litellm"` 등 core 속성으로 분기한다. |
| 참고 | packages/web/src/components/IssueList.tsx:31 | `OPENROUTER_FREE_LIMIT`(warn)처럼 path가 `[]`인 경고에는 이동 버튼이 없다. 원인이 5단계에 있는 경고라 안내가 조금 약하다. | 필요하면 코드별 기본 단계(예: OPENROUTER_FREE_LIMIT → 5단계) 매핑을 추가한다. |
| 참고 | docs/design/detail/dev-3.md 7장 | W3(NAME_INVALID slug)는 core 변경 요청으로 남아 있다. | 리드가 dev-1 작업으로 배정할지 결정한다. |
