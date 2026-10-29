# dev-3 보고 (PH6)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-621 | 완료 | `packages/web/src/locales/en.json`, `locales/ko.json`(lang.switch 추가), `i18n.ts`, `components/LangSwitch.tsx`, `App.tsx`, `app.css`, `test/i18n-parity.test.tsx`, `docs/design/detail/dev-3.md` | web 79개 통과(신규 6), typecheck·lint 통과 | 영어 문구는 사람 검수 필요. 정적 스크립트 출력은 PH6 범위 밖 |

- 번들: 메인 chunk 453.85 kB(gzip 143.64), 500kB 경고 없음.
- 판단: 영어 복수형은 키 집합 일치를 위해 `_one/_other` 키를 만들지 않고 "{{count}} files", "error(s)" 처럼 중립 표현을 썼다.

## PH6 2라운드

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-622 | 완료 | `components/TmuxSettings.tsx`, `components/TmuxPreview.tsx`, `steps/StepConnection.tsx`, `locales/*`, `app.css` | web 91개 통과 | core 의 tmux config 렌더에 의존(통합본 반영됨) |
| T-623 | 완료 | `steps/StepConnection.tsx`, `steps/StepGenerate.tsx`, `locales/*` | 위와 같음 | core `DEVCONTAINER_CLOSED_NET` 검사는 dev-1 구현 대기. 시험은 issue 객체 직접 주입 |

- review-3 권고 반영: `export.goto` 를 "Go to {{step}}" 로, i18n 동일 시험을 파일 목록·README 비교로, en 전환 시험을 `en.steps` 값 기대로 강화.
- 번들 461.53 kB(gzip 146.27), 500kB 경고 없음. typecheck·lint 통과.
- 판단: tmux 를 한 번 바꾸면 draft.tmux 가 생겨 config 에 tmux 객체가 들어간다. 되돌리는 "tmux 기본값으로" 버튼을 추가했다. Dev Container 를 끄면 false 가 아니라 undefined 로 둔다.

### 2라운드 반려 수정 (review-3)
- `issue-step.ts` `stepOfPath` 에 `tmux`·`devcontainer` -> 5단계(인덱스 4). 단계 바 오류 점·6단계 이동 버튼이 "연결·실행"을 가리킨다.
- 권고 반영: buildPreview 수준 시험(기본값 복귀 시 생성물 동일, tmux 지정 시 config 포함), prefix 오류 `aria-invalid`+`aria-describedby`(IssueList `id` 속성 추가), Dev Container 안내 `aria-describedby`.
- `DEVCONTAINER_CLOSED_NET` issue 키는 ko·en 모두 있음. 실제 render 시험으로 교체는 3라운드.
- web 96개 통과, typecheck·lint 통과, 번들 461.74 kB.

## PH6 3라운드

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-624 | 완료 | `use-preview.ts`, `App.tsx`, `steps/StepGenerate.tsx`, `issue-step.ts`, `locales/*`, `app.css`, `test/round7-doc.test.tsx` | web 106개 통과, typecheck·lint 통과 | 없음 |

- 6단계에 "기존 CLAUDE.md 붙여넣기(선택)". 빈 값이면 생성물 동일, 값이 있으면 CLAUDE.md 만 `mergeClaudeMd` 결과로 교체(미리보기·ZIP 동일). 마커 오류는 `CLAUDE_MD_MARKERS` 문구(구간 ID)로 표시하고 ZIP 차단. 붙여넣은 내용은 저장하지 않음. 코드블록 안 마커도 센다는 안내 포함.
- review-3 권고: aria-describedby 단언을 `tmux-prefix-error`+문구로 강화, `DEVCONTAINER_CLOSED_NET` 시험을 실제 `buildPreview(devcontainer: true)` 결과로 교체(기본 draft 에는 없음도 확인).
- 번들 468.92 kB(gzip 149.05), 500kB 경고 없음.

## PH7 1라운드

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-721 | 완료 | `src/market/market-api.ts`, `src/components/MarketPanel.tsx`, `src/steps/StepSkills.tsx`, `src/App.tsx`, `locales/*`, `app.css`, `test/round8-market.test.tsx`, `test/app.test.tsx`(마켓 비활성 시험 갱신) | web 126개 통과(신규 17), typecheck·lint 통과 | 아래 |

- 4단계 마켓: `/api/market/health` 로 서버 감지(실패 시 "서버를 실행하면 사용할 수 있습니다" 안내), 소스 목록·등록·삭제·전체 갱신(소스별 오류 코드 문구), 검색(q·trust), 미리보기(SKILL.md 는 `<pre>` 텍스트 노드, 파일 목록, 위험 5종 문구), 가져오기·대상 선택·제거·위험 확인 체크.
- 토큰 값 입력란 없음. tokenEnv 는 "서버 환경 변수 이름"이라는 설명 포함. 등록 본문은 허용 필드만 전송.
- 가져온 스킬 `flags` 는 서버 응답 그대로. 확인 전 ZIP 은 core `IMPORT_UNACKED` 로 막히고 항목 옆(`imported.<i>`)과 6단계 목록에 표시. 저장하지 않음(localStorage 사용 없음).
- 번들: MarketPanel+market-api 를 `React.lazy` 별도 청크(8.39 kB)로 분리. 메인 499.71 kB(gzip 158.47), 500 kB 경고 없음. develop 기준선이 이미 492.89 kB 라 여유 약 0.3 kB.
- i18n: `market.*`, `risk.*`(5종), `issue.IMPORT_NO_SKILL_MD·NAME_MISMATCH·DUP_PATH·TOO_LARGE`, `SKILL_FILE_PATH`, `SKILL_REF`, `GIT_BRANCH` ko·en 추가, 옛 `skills.market` 삭제.
- 가정(서버 응답 형태, dev-2 구현과 대조 필요): sources/search/refresh 응답은 배열 또는 `{sources|items|results: []}`; 소스 항목 필드 `id,kind,trust,owner,repo,url,sha,indexedAt,error`; refresh 항목 `{id, ok, error}`; 검색 `blocked` 는 문자열(tooLarge·binary)이거나 true.
- 남은 위험: core 의 새 issue 코드 문구는 키만 추가(발생 시 path 표시). 번들 여유가 작아 다음 라운드(T-722 GitHub 폼) 추가 시 경고 가능 -> 지연 로딩 필요.

### T-721 계약 보충 반영(design 9.7)
- health `{ok,version,admin}`: admin=false 면 등록·삭제·갱신 UI 숨기고 "관리자 모드에서만 소스를 바꿀 수 있습니다" 표시.
- sources `{sources}`(`lastIndexedAt`·`lastSha`·`lastError`), refresh `{results:[{id,ok,code,params}]}`(실패도 200), search `{skills}`(`blocked`: tooLarge|binary|badPath). `list()` 는 정확한 키 하나만 읽는다.
- 문구 추가: NOT_FOUND·INTERNAL·ADMIN_DISABLED, badPath. web 127개 통과, 메인 번들 499.89 kB(여유 0.1 kB — T-722 는 지연 로딩 필수).

### T-721 review-3 반려 수정
- 오류 문구에 항상 `code` 전달(비 JSON 500 -> "(UNKNOWN)", `{{code}}` 노출 없음). 서버 code·trust·flags 는 `/^[A-Za-z_]+$/`/허용 목록 검사 후 i18n 키에 사용.
- 가져오기: `patch` 가 함수형 갱신을 받도록 확장(App), 진행 중 id 버튼 비활성·ref 로 중복 요청 차단, 이미 있는 id 추가 금지.
- 라벨 `market.f.*` i18n, 확인 체크박스 이름에 스킬 id, 오류 `aria-invalid`·`aria-describedby`.
- R1: 확인 체크박스·표시는 서버 flags 가 비어도 해당 항목에 core `IMPORT_UNACKED` 가 있으면 보인다. 현재 브랜치에 `scanSkillRisk` 가 없어 위험 목록은 flags 기반(TODO: 통합 후 core 재계산 결과 사용).
- R2: 서버 응답 항목 런타임 검증 + `ErrorBoundary`. R6 설계 문서 정리. 시험 추가(비 JSON 500, 동시 가져오기, 해제 재차단, flags 빈 값, 깨진 항목, en 라벨).
- 번들: 줄였던 문구 원복. vite `rolldownOptions.output.codeSplitting` 으로 core·react 계열 분리. 청크(kB): index 57.61, vendor-core 174.68, vendor-react 268.43, src(exporter, 지연) 96.61, MarketPanel 9.66 — 500 kB 경고 없음. web 134개 통과.
