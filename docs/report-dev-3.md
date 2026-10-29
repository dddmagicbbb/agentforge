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
