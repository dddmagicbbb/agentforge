# 상세 설계 dev-3 (web) — PH4 1라운드

## 1. 담당 작업·기능 ID
- 화면 골격(T-421 일부: 6단계 내비게이션·레이아웃. 개발자 수 스테퍼는 다음 라운드)
- T-422 (RTN-02) 2단계 루틴·에이전트
- T-424 (SKL-01, SKL-02) 4단계 스킬
- 3·5·6단계는 자리표시(T-423·T-425·T-426은 다음 라운드)

## 2. 파일 목록 (모두 `packages/web/` 안)
| 경로 | 책임 |
|---|---|
| `src/App.tsx` | `ProjectInput` 상태 소유, 현재 단계 상태, 레이아웃 조립 |
| `src/catalog.ts` | 화면용 상수: 제공자 목록·추천 모델(core `PROVIDERS` 미공개 대체), 순차 단계, 내장 스킬, `defaultModel()`, `devSkillName()` |
| `src/use-preview.ts` | `usePreview(draft)`: validate+render 결과(issues, files) |
| `src/components/StepNav.tsx` | 상단 6단계 바, 이전/다음 버튼 |
| `src/components/PreviewPane.tsx` | 우측 파일 트리(AI·755 표시) + 선택 파일 내용 |
| `src/components/IssueList.tsx` | 검증 오류 목록(i18n) |
| `src/components/ModelPicker.tsx` | 제공자 select + 모델 input(datalist) |
| `src/components/FlowChart.tsx` | 흐름도(순차 → 병렬 쌍 → 통합 검증) |
| `src/steps/StepRequirement.tsx` | 1단계 입력(기존 이전) + ZIP 버튼 |
| `src/steps/StepRoutine.tsx` | 2단계 T-422 |
| `src/steps/StepSkills.tsx` | 4단계 T-424 |
| `src/steps/StepPlaceholder.tsx` | 3·5·6단계 자리표시 |
| `src/locales/ko.json`, `src/app.css` | 문자열·스타일 |
| `vitest.config.ts`, `test/*.test.tsx` | 시험 환경(jsdom)과 시험 |
| `docs/report-dev-3.md` | 보고 |

## 3. 주요 함수·컴포넌트
- `defaultModel(p: ProviderIdT): string` — claude면 `"sonnet"`, 그 외 추천 목록 첫 값.
- `devSkillName(d: DevT, n: number): string` — `dev${n}-${domain}` (core 렌더러와 동일 규칙). 준비 여부는 core `devReady`.
- `usePreview(draft: ProjectInput): { issues; files }` — `validate` 실패 시 `files=[]`. 불변식 위반은 validate가 선차단하므로 render 예외는 잡지 않는다.
- `StepNav({ step, onStep })` — 이전은 1단계에서, 다음은 6단계에서 비활성. 단계 바 항목은 클릭 이동.
- `ModelPicker({ id, value, disabled, onChange(next: AgentModelT) })` — 제공자 변경 시 `{provider, model: defaultModel(provider)}`. 모델 입력은 자유 입력(검증은 core `ModelId`).
- `StepRoutine({ draft, patch })` — 순차 6종 행. `uiDesign=false`이면 ux-designer 행은 `disabled`, 흐름도 노드도 `off`.
- `StepSkills({ draft, patch })` — 공통(conventions·tdd 토글), 역할(detail-design·code-review 고정), 개발자 전용(`devReady`면 `devN-domain`, 아니면 "도메인 미정"), 생성(forge-init·forge-agents 고정). 마켓은 비활성 안내문만(`imported`는 건드리지 않음).
- 입력 검증은 core `validate`에 위임. 화면은 오류를 보여주고 ZIP 버튼을 막는다.
- 오류 처리: `toZip` 실패 시 `export.failed` 메시지 표시.

## 4. 사용하는 계약
- core: `defaultDraft`, `validate`, `render`, `devReady`, 타입 `ProjectInput`, `RenderedFile`, `Issue`, `ProviderIdT`, `AgentModelT`, `DevT`, `SEQ_AGENT_IDS`. (`resizeDevs`·`checks`·`canExport`는 이번 라운드 미사용)
- exporter: `toZip(files, name)`.
- 제공하는 API 없음.

## 5. 화면 상태
| 상태 | 처리 |
|---|---|
| 로딩 | 계산이 동기(100ms 이내)라 스피너 없음. ZIP 생성 중에는 버튼 `disabled` + "생성 중…" |
| 빈 값 | 요구사항 빈 문자열 허용(스키마). 미리보기 파일이 없으면 "생성 파일 없음" 안내. 빈 파일은 "(빈 파일)" |
| 오류 | 검증 오류는 `IssueList`, 오류가 있으면 미리보기 비우고 ZIP 차단. ZIP 실패는 별도 메시지 |
| 성공 | 미리보기 N개 표시, ZIP 활성 |
| 비활성 | uiDesign 꺼짐 → ux-designer 행·흐름도 노드 흐림. 마켓 영역은 "P1 예정" 안내 |

## 6. 테스트 목록
| 기능 ID | 수용 기준 | 테스트 이름 |
|---|---|---|
| 골격 | 다음/이전/단계 바로 이동, 경계에서 버튼 비활성 | `단계 이동`, `경계 단계에서 이전·다음 비활성` |
| 골격 | 3·5·6단계는 자리표시 | `자리표시 단계는 안내 문구를 보인다` |
| RTN-02 | 제공자 변경 시 모델 기본값(claude→sonnet, 그 외 첫 추천) | `제공자 변경 시 모델이 추천 기본값으로 바뀐다` |
| RTN-02 | uiDesign 끄면 ux-designer 행 비활성 | `uiDesign을 끄면 ux-designer 행이 비활성이다` |
| RTN-02 | 흐름도에 병렬 쌍·통합 검증 | `흐름도가 개발자 수만큼 병렬 쌍을 보인다` |
| SKL-01 | 역할·생성 고정, 미정 도메인 문구 | `고정 스킬은 비활성이고 도메인 미정은 안내 문구` |
| SKL-02 | tdd 끄면 미리보기에서 `.claude/skills/tdd/SKILL.md` 사라짐 | `tdd 토글을 끄면 미리보기에서 tdd 스킬이 사라진다` |
| EXP-01(미리보기) | render 갱신 100ms 이내 | `render 갱신이 100ms 이내` |
| 단위 | `defaultModel` | `defaultModel: claude는 sonnet, 그 외 첫 추천` |

## 7. 계약·공통 모듈에 필요한 변경
- core index가 `PROVIDERS`·`CORE_SKILLS`·`SEQ`/`FINAL`·`devSkill`을 export하지 않는다. core를 고치지 않고 `src/catalog.ts`에 화면용 사본을 둔다. 추후 core export가 생기면 사본 제거를 요청(report 기재).
