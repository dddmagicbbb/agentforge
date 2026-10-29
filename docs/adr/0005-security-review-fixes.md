# ADR-0005 PH5 보안·실기 점검 조치(모델 ID, guard 대상 도구, 중계·통합 스크립트)

- 상태: 승인 (리드, 2026-10-29) — S-1·S-2 는 T-503 보안 점검, D-C·D-D·D-E 는 T-502 실제 Claude Code 주기에서 발견
- 관련: `docs/report-security.md` S-1·S-2, design.md 2.2 `ModelId`, ADR-0004(guard-paths)

## 맥락
| ID | 위치 | 결함 |
| --- | --- | --- |
| S-1 | `ModelId` 스키마(G2 동결) | 허용 문자만 제한하고 첫 글자는 제한하지 않았다. 모델 ID는 `litellm.yaml`(`model_name: <id>`)과 `agent-env.sh`(`_af_use <via> <id>`)에 인용 없이 들어간다. YAML에서 `@`는 예약 지시자라 `@x`는 파싱 실패를 일으키고, `:`로 시작하는 값은 해석이 모호하다. `-`로 시작하는 값은 셸 인자에서 옵션처럼 보인다. |
| S-2 | `settings.json` 렌더러, `guard-paths.sh` | hook matcher가 `Edit\|Write`이고 hook은 `tool_input.file_path`만 읽는다. `NotebookEdit`는 경로를 `notebook_path`로 넘긴다. matcher에 걸리면 빈 경로로 통과하고, 걸리지 않으면 검사 자체가 없다. 어느 쪽이든 `.ipynb`는 담당 범위 밖에서도 수정된다. |
| D-C | wait-and-review.sh `out_of_scope` | dev-N 과 review-N 은 같은 worktree 를 쓰는데 범위 검사가 dev-N.paths 만 본다. review-N 이 쓴 `docs/review/dev-N.md` 가 dev-N 의 범위 밖 변경으로 잡혀 코드 검토로 넘어가지 못하고, dev-N 이 검토 파일을 "되돌리는" 커밋까지 만들었다(실기 R-5). |
| D-D | integrate.sh | 테스트·E2E 명령을 `git checkout develop` 전에 읽는다. 메인 폴더는 setup 이후 main 에 있으므로, 공통 개발이 develop 에서 바꾼 명령(예: `true` → `npm test`)이 무시되어 통합 테스트가 사실상 생략됐다(실기 R-5, integrator 가 "검증 불가"로 판정). |
| D-E | wait-and-review.sh | 반려 한도가 코드 반려에만 적용된다. 설계 반려는 한도 없이 30초 간격으로 4회 반복됐다(실기 R-5, 에이전트가 스스로 멈춤을 요청). |

## 결정
1. S-1: 패턴을 `^(?:[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127})?$`로 바꾼다.
   - 첫 글자는 영문·숫자로 제한한다. 빈 값은 Claude 기본값(sonnet)으로 계속 허용하고, 길이 상한 128은 그대로다.
   - 렌더러는 바꾸지 않고 입력 단계에서 막는다. 따라서 golden 출력은 그대로다.
   - 오류 문장(ko `MODEL_ID`)에 첫 글자 규칙을 추가한다.
2. S-2: hook matcher를 `Edit|Write|MultiEdit|NotebookEdit`로 바꾸고, guard는 `file_path // notebook_path`를 읽는다.
   - 제어 문자 검사도 같은 필드에 적용한다.
   - `.claude/settings.json`·`guard-paths.sh`는 의도적 차이(`intended-diffs.json`, 전 구성)로 등록한다.
3. D-C: `out_of_scope` 는 dev-N.paths 와 review-N.paths 를 함께 허용한다.
4. D-D: integrate.sh 는 병합 뒤 develop 의 config 에서 테스트·E2E 명령을 읽는다.
5. D-E: 설계 반려도 `maxRejects` 에 도달하면 `dev-N.blocked` 를 만들고 자동 반복을 멈춘다(코드 반려와 같은 `block` 함수).
6. integrate.sh·wait-and-review.sh 는 의도적 차이 항목(ADR-0004)에 D-C·D-D·D-E 를 덧붙인다.

## 결과
- 실제 제공자 모델 ID(`gpt-5.5`, `qwen/qwen3-coder:free`, `gemini-2.5-pro`, `org/model@v2`)는 모두 통과한다. 호환성 영향은 없다.
- 시험:
  - `schema.test.ts` "모델 ID 는 영문·숫자로 시작해야 한다"
  - `render.test.ts` "guard hook 은 Edit·Write·MultiEdit·NotebookEdit 에 걸린다"
  - `guard-paths.bats` ⑯ NotebookEdit 차단·허용·제어 문자
  - `parallel-mock.bats` D-C·D-D·D-E (실기 현상을 그대로 재현해 수정 전 실패 확인)
- 스냅샷 6구성에서 바뀐 파일은 `settings.json`·`guard-paths.sh`·`integrate.sh`·`wait-and-review.sh` 4개뿐이다.
