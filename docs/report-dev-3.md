# dev-3 보고 (PH6)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-621 | 완료 | `packages/web/src/locales/en.json`, `locales/ko.json`(lang.switch 추가), `i18n.ts`, `components/LangSwitch.tsx`, `App.tsx`, `app.css`, `test/i18n-parity.test.tsx`, `docs/design/detail/dev-3.md` | web 79개 통과(신규 6), typecheck·lint 통과 | 영어 문구는 사람 검수 필요. 정적 스크립트 출력은 PH6 범위 밖 |

- 번들: 메인 chunk 453.85 kB(gzip 143.64), 500kB 경고 없음.
- 판단: 영어 복수형은 키 집합 일치를 위해 `_one/_other` 키를 만들지 않고 "{{count}} files", "error(s)" 처럼 중립 표현을 썼다.
