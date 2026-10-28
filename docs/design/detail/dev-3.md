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

---

# 2라운드 (PH4) — T-421, T-423, T-425

## R2-0. 공통
- core `PROVIDERS`·`CORE_SKILLS`·`devSkill`은 아직 index에서 export되지 않아 `src/catalog.ts` 사본을 유지한다(dev-1 병합 후 다음 라운드에 제거).
- `use-preview.ts`: `validate` 오류와 core `checks` 결과를 `mergeIssues`로 합친다(코드+경로+params 동일 항목 제거, `NAME_INVALID`가 있으면 `PROJECT_NAME` 생략). `exportable = canExport(issues)`. 파일은 validate 성공 때만 렌더.
- `IssueList({issues, filter})`: `issue.<CODE>` 문구에 params 보간. 오류는 `role=alert`, 그 외 `status`. `atPath(...keys)`는 경로 첫 요소 필터.
- 문구는 `ko.json`의 `issue.*`. 작업별로 해당 코드 문구를 추가한다.

## R2-1. T-421 (REQ-01·02, DEV-01, RTN-01) 1단계
- `StepRequirement`: 개발자 수 스테퍼(`resizeDevs`, 1~6, 경계에서 버튼 비활성, `output` 접근명 "개발자 수"), 반려 한도 select(2~5), `REQ_SHORT`는 요구사항 아래, 이름 오류는 이름 아래에 표시. ZIP은 `exportable`일 때만 활성(경고·정보는 막지 않음).
- 화면 상태: 요구사항 30자 미만=경고(진행 가능), 이름 규칙 위반=오류(ZIP 차단).
- 시험: `test/round2-req.test.tsx` — 스테퍼 값·미리보기 변화, 범위 경계, 반려 한도 옵션, REQ_SHORT 경고+ZIP 활성, 이름 오류 1회 표시+ZIP 차단.
- 비고: 도메인이 빈 개발자는 파일을 만들지 않으므로(core) 개발자 수를 늘리면 파일 수는 그대로이고 `forge.config.json`의 developers 값이 바뀐다.

## R2-2. T-423 (DEV-02) 3단계 개발자
- `src/steps/StepDevelopers.tsx`: `draft.devs`마다 `<tbody data-testid="dev-row">` 1개(입력 행 + 경고 행). 도메인 input, 담당 폴더 input(쉼표 구분 → `splitPaths` → 배열; 끝 `/` 정규화·검증은 core), `ModelPicker`(dev-N, review-N).
- 입력 원문은 행 안 state(`pathText`)에 보존해 잘못된 경로나 쉼표를 쳐도 입력을 막지 않는다. 오류는 core 가 돌려준다(PATH_PREFIX, PATH_DOT_SEGMENT, DEV_PARTIAL, DOMAIN).
- 행 경고: `forDev(i)` = 경로가 `devs.i` 아래이거나 PATH_OVERLAP 의 devA/devB 가 i+1. 겹침은 두 행 모두에 표시. REVIEW_WEAKER(warn)·DEV_DEFERRED(info, /forge-agents 위임 안내)는 ZIP을 막지 않고 오류만 막는다.
- ko 문구 추가: PATH_OVERLAP, DEV_DEFERRED, MODEL_MISSING, REVIEW_WEAKER, IMPORT_UNACKED, DOMAIN, MODEL_ID, PATH_PREFIX, PATH_DOT_SEGMENT, DEV_PARTIAL.
- 시험: `test/round2-dev.test.tsx` — 스테퍼 연동 행 수, 기본값 표시, 쉼표 분리+미리보기, 겹침 경고(두 행)+ZIP 차단/해제, 약한 검증 경고, 비움 안내, 잘못된 경로 오류+입력 유지, DEV_PARTIAL, MODEL_MISSING.

## R2-3. T-425 (PRV-01, PRV-04) 5단계 연결·실행
- `src/agents.ts`: `usedAgents(draft)`(core checks/render 순서, uiDesign=false 면 ux-designer 제외)와 `countByProvider`.
- `src/steps/StepConnection.tsx`: 사용 중인 제공자만 표에 표시(순서는 `PROVIDER_OPTIONS`), 에이전트 수, 연결 칸 — vLLM·Ollama 는 주소 input(`connections.vllmUrl`/`ollamaUrl`, 형식 오류는 core `HTTP_URL` 을 표 안에 표시하되 입력은 막지 않음), OpenRouter·LiteLLM(OpenAI·Gemini)·Claude 는 안내 문구만. **키 입력란 없음**(원칙 4).
- `src/components/TmuxPreview.tsx`: `0:watch`(반려 한도 표시) + 개발자별 `N:devN` 창(dev-N/review-N 창구, 제공자·모델 라벨). 창 수 = 개발자 수 + 1.
- 경고: core `checks` 결과 중 GATEWAY_REQUIRED, VLLM_TOOL_PARSER, OPENROUTER_FREE_LIMIT, MODEL_MISSING 만 이 화면에 표시.
- ko 문구 추가: OPENROUTER_FREE_LIMIT, GATEWAY_REQUIRED, VLLM_TOOL_PARSER, HTTP_URL (checks 전 코드의 문구는 R2-1~3 합쳐 완비).
- 시험: `test/round2-conn.test.tsx` 12건 — 사용 제공자만/에이전트 수, uiDesign 끔, vLLM·Ollama 주소 입력 표시/숨김, 주소 편집·오류, 안내만 있는 제공자, 키 입력란 없음, tmux 창 수(개발자 수+1)·상태 줄·반려 한도, 경고 4종.
