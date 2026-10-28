# 보안 점검 보고서 (PH5 T-503)

- 점검: 리드, 2026-10-29. 기준은 `docs/project-rules.md` 보안 규칙과 PRD 10.2 PH5 점검 항목이다.
- 대상: `develop` 9ebec05 이후 core 렌더러·스키마, `templates/static/*.sh`, exporter, web 빌드 결과(`packages/web/dist`).
- 결론: **조치 필요 2건(S-1·S-2)은 수정 완료(ADR-0005).** 수용 위험 3건(S-3~S-5)은 근거와 2차 방어를 기록했다. 그중 S-3은 실제 Claude Code 확인이 T-502로 남아 있다.

## 1. 점검 결과 요약
| 영역 | 점검 내용 | 결과 |
| --- | --- | --- |
| 셸 인자 이스케이프 | 사용자 입력이 셸·YAML·JSON에 들어가는 지점 전수 | 적합. S-1(YAML 예약 문자)은 수정 |
| 비밀 값 미저장 | 생성물·로그·브라우저 저장소·커밋 | 적합 |
| 외부 CDN 미사용 | web 소스·빌드 결과의 외부 로딩 | 적합 |
| hook 우회 | `../`, glob, 제어 문자, 도구 종류, Bash 리다이렉션 | S-2 수정. S-3은 수용하되 실기 확인 필요 |
| ZIP 경로 | 압축 항목 경로·루트 폴더명 | 적합 |

## 2. 입력 → 출력 지점(셸 인자 이스케이프)
| 입력 | 허용 패턴 | 들어가는 곳 | 처리 |
| --- | --- | --- | --- |
| 프로젝트 이름 | `^[a-z0-9][a-z0-9._-]{0,63}$` | ZIP 루트, tmux 세션명(`basename`), forge.config.json | 패턴만으로 안전(셸 메타문자 없음) |
| 도메인 | `^[a-z0-9][a-z0-9-]{0,31}$` | 스킬명 `devN-<domain>`, frontmatter | 패턴 |
| 모델 ID | `^(?:[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127})?$` (S-1) | agent-env.sh case, litellm.yaml, frontmatter | 패턴 + `shWord`(안전 단어 외 `shQuote`) |
| 담당 폴더 | 상대 접두어, `.`·`..` 세그먼트 금지 | `.claude/devs/*.paths`(데이터로만 읽힘) | 패턴. 실행되지 않음 |
| 주소(vLLM·Ollama) | `^https?://host(:port)?(/path)?$` | env.local.example(source 됨) | 패턴 + `shWord` |
| 설치·테스트·E2E 명령 | 한 줄, 제어 문자 금지, 200자 | forge.config.json → `bash -c`(create-worktrees·integrate), settings.json allow 규칙 | **의도된 실행.** 사용자가 직접 입력한 자기 프로젝트 명령이다. JSON은 `JSON.stringify`로 이스케이프한다 |
| 요구사항 원문 | 20,000자 | `.agentforge/requirements.md` | Markdown 데이터. 실행되지 않음 |

- 정적 스크립트 9종은 문자열 조립 없이 그대로 복사한다. 동적 셸은 `agent-env.sh` case 블록 하나뿐이다.
- 모든 구성에서 `bash -n`과 shellcheck 경고 0건이다(CI).
- 생성 스크립트 안의 변수는 모두 인용되어 있다. `run-agents.sh`는 pane 명령을 `printf %q`로 조립한다.

## 3. 발견 사항
### S-1 모델 ID가 YAML 예약 문자로 시작 가능 — 수정
- 영향: `@x` 같은 값이면 `litellm.yaml` 파싱이 실패하고 게이트웨이가 기동하지 않는다. `-x`는 셸 인자에서 옵션처럼 보인다. 셸 주입은 아니다(허용 문자에 메타문자 없음).
- 조치: 스키마 패턴에서 첫 글자를 영문·숫자로 제한했다(ADR-0005). 오류 문장도 갱신했다.
- 시험: `schema.test.ts` "모델 ID 는 영문·숫자로 시작해야 한다".

### S-2 guard hook이 NotebookEdit를 검사하지 않음 — 수정
- 영향: hook matcher는 `Edit|Write`이고 hook은 `file_path`만 읽는다. 반면 `NotebookEdit`는 경로를 `notebook_path`로 준다. 그래서 dev-N이 담당 범위 밖 `.ipynb`를 수정할 수 있었다.
- 조치: matcher를 `Edit|Write|MultiEdit|NotebookEdit`로 바꾸고, guard는 `file_path // notebook_path`를 읽게 했다(제어 문자 검사 포함). 의도적 차이로 등록했다.
- 시험: `render.test.ts` matcher 검사, `guard-paths.bats` ⑯(차단·허용·제어 문자).

### S-3 Bash 경유 파일 쓰기(리다이렉션) — 수용, 실기 확인 필요
- 내용: guard hook은 파일 변경 도구에만 걸리고 Bash에는 걸리지 않는다. 허용 목록의 Bash 명령(`git commit:*`, `touch:*`, 사용자 테스트 명령)에 `>`가 붙으면 범위 밖 쓰기가 가능할 수 있다.
- 1차 방어: settings.json allow는 고정 목록뿐이다. 그 밖의 Bash는 사용자 승인 프롬프트가 뜬다. Claude Code가 접두어 규칙을 `&&`·`;`·`|`·리다이렉션까지 확장하지 않는지는 실제 Claude Code에서 확인한다(T-502 점검표 항목 R-6).
- 2차 방어: `wait-and-review.sh`의 `out_of_scope`가 `dev-N.done` 시점에 worktree 안의 커밋과 미커밋 변경(추적 안 됨 포함)을 범위와 대조한다. 범위 밖이면 리뷰로 넘기지 않는다(bats `parallel-mock` 시험).
- 남는 위험: worktree **밖**에 대한 Bash 쓰기는 2차 방어가 잡지 못한다. 실기 확인 결과 접두어 규칙이 리다이렉션을 허용하면 PH6에서 Bash용 PreToolUse 검사를 추가한다.

### S-4 신호 파일 위조 — 수용(위협 모델 밖)
- 내용: `Bash(touch:*)`가 허용되어 있다. dev-N과 review-N은 같은 worktree와 같은 OS 사용자로 실행된다. 따라서 dev-N이 `review-N.pass`를 만들 수 있다.
- 판단: 에이전트는 협조적 행위자로 가정한다(사람이 띄우고 지켜보는 세션). 같은 사용자 권한 안에서 서명 없이는 막을 수 없다.
- 최종 판정은 위조와 무관하게 동작한다: `integrate.sh`가 develop에 병합한 뒤 테스트를 다시 돌리고, integrator 검토와 사람의 병합 판단이 뒤따른다.
- 권고(PH6 검토): integrate 전에 `docs/review/dev-N.md`에 통과 판정이 있는지 확인한다.

### S-5 심볼릭 링크 경유 우회 — 수용(ADR-0004에 기록)
- guard는 어휘적 정규화만 하고 링크를 따라가지 않는다. 2차 방어는 S-3과 같다.

## 4. 비밀 값
| 항목 | 확인 | 결과 |
| --- | --- | --- |
| env.local.example | 키 이름과 주소 기본값만, 값은 빈칸 | 적합 |
| env.local | setup.sh가 `chmod 600`으로 만듦. 생성 `.gitignore`가 제외 | 적합. 실기 bats가 첫 커밋 미포함을 확인 |
| settings.json | `Read(.agentforge/env.local)` 거부, push·merge·checkout·switch·`rm -rf` 거부 | 적합(`render.test.ts`) |
| web | `localStorage`·`sessionStorage`·`indexedDB`·쿠키 사용 0건, 키 입력 화면 없음 | 적합 |
| 로그 | core·exporter·web 소스에 `console.*` 0건. 생성 스크립트는 키 값을 출력하지 않음(agent-env는 키 이름만 안내) | 적합 |
| 네트워크 | web 소스에 `fetch`·`XMLHttpRequest`·`WebSocket` 0건(앱은 AI·외부를 호출하지 않음) | 적합 |

## 5. 외부 CDN
- `packages/web/dist/index.html`은 `/assets/*.js`·`/assets/*.css`만 참조한다. CSS에는 `@import`·외부 `url()`이 없다.
- 번들 안의 외부 URL은 라이브러리 주석·오류 문장과 화면 표시용 문자열(`https://openrouter.ai/api`)뿐이고, 로딩되지 않는다.
- PoC의 jszip CDN·Google Fonts·localStorage는 이식하지 않았다.

## 6. 남은 일
- T-502 실기 확인 R-6: 허용된 Bash 접두어에 리다이렉션·명령 연결을 붙였을 때 승인 프롬프트가 뜨는지. 결과에 따라 S-3을 갱신한다.
- PH6 검토 후보: Bash PreToolUse 범위 검사(S-3), integrate 전 리뷰 판정 확인(S-4).
