# ADR-0005 PH5 보안 점검 조치(모델 ID 첫 글자, guard hook 대상 도구)

- 상태: 승인 (리드, 2026-10-29) — PH5 T-503 보안 점검에서 발견
- 관련: `docs/report-security.md` S-1·S-2, design.md 2.2 `ModelId`, ADR-0004(guard-paths)

## 맥락
| ID | 위치 | 결함 |
| --- | --- | --- |
| S-1 | `ModelId` 스키마(G2 동결) | 허용 문자만 제한하고 첫 글자는 제한하지 않았다. 모델 ID는 `litellm.yaml`(`model_name: <id>`)과 `agent-env.sh`(`_af_use <via> <id>`)에 인용 없이 들어간다. YAML에서 `@`는 예약 지시자라 `@x`는 파싱 실패를 일으키고, `:`로 시작하는 값은 해석이 모호하다. `-`로 시작하는 값은 셸 인자에서 옵션처럼 보인다. |
| S-2 | `settings.json` 렌더러, `guard-paths.sh` | hook matcher가 `Edit\|Write`이고 hook은 `tool_input.file_path`만 읽는다. `NotebookEdit`는 경로를 `notebook_path`로 넘긴다. matcher에 걸리면 빈 경로로 통과하고, 걸리지 않으면 검사 자체가 없다. 어느 쪽이든 `.ipynb`는 담당 범위 밖에서도 수정된다. |

## 결정
1. S-1: 패턴을 `^(?:[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127})?$`로 바꾼다.
   - 첫 글자는 영문·숫자로 제한한다. 빈 값은 Claude 기본값(sonnet)으로 계속 허용하고, 길이 상한 128은 그대로다.
   - 렌더러는 바꾸지 않고 입력 단계에서 막는다. 따라서 golden 출력은 그대로다.
   - 오류 문장(ko `MODEL_ID`)에 첫 글자 규칙을 추가한다.
2. S-2: hook matcher를 `Edit|Write|MultiEdit|NotebookEdit`로 바꾸고, guard는 `file_path // notebook_path`를 읽는다.
   - 제어 문자 검사도 같은 필드에 적용한다.
   - `.claude/settings.json`·`guard-paths.sh`는 의도적 차이(`intended-diffs.json`, 전 구성)로 등록한다.

## 결과
- 실제 제공자 모델 ID(`gpt-5.5`, `qwen/qwen3-coder:free`, `gemini-2.5-pro`, `org/model@v2`)는 모두 통과한다. 호환성 영향은 없다.
- 시험:
  - `schema.test.ts` "모델 ID 는 영문·숫자로 시작해야 한다"
  - `render.test.ts` "guard hook 은 Edit·Write·MultiEdit·NotebookEdit 에 걸린다"
  - `guard-paths.bats` ⑯ NotebookEdit 차단·허용·제어 문자
- 스냅샷 6구성에서 바뀐 파일은 `settings.json`·`guard-paths.sh` 2개뿐이다.
