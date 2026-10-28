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
