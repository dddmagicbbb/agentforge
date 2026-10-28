# review-2 검토: dev-2 PH4 1라운드 (T-411, T-412)

- 대상 브랜치: `worktree-agent-ae362c84b3963233f` (기준 `develop` 0998785)
- 커밋: 88cdee4(T-411), ff57be0(T-412), d2c4ba0(보고)

## 최종 판정: 통과

## 1. 설계 검토
| 항목 | 결과 |
|---|---|
| 기능 ID | EXP-01(T-411), DEV-03(T-412) 모두 1장·6장에 있음 |
| T-411 완료 기준(루트 폴더명, 755/644, LF, ZIP ↔ RenderedFile[] 동등, 2초) | 6장 테스트 목록에 하나씩 대응. 빈 파일·결정성·잘못된 입력 거부까지 추가됨 |
| T-412 완료 기준(허용, 차단 exit 2, 상대 경로, `../`, AF_AGENT 없음, paths 없음) | 6장 ①~⑥으로 1:1 대응 |
| ADR-0001(exporter 는 content·mode 불변) | `zip ↔ RenderedFile[] 동등` 시험이 바이트 내용과 `mode & 0o777` 을 RenderedFile 값과 직접 비교해 불변성을 검증함 |
| 계약 변경 | 없음(7장). core 는 읽기만 사용 |

## 2. 범위
`git diff --name-only develop...HEAD`:
`docs/design/detail/dev-2.md`, `docs/report-dev-2.md`, `packages/exporter/test/zip.test.ts`, `tests/scripts/guard-paths.bats`, `tests/scripts/helpers.bash` — 모두 dev-2 범위 안. 커밋마다 작업 ID 하나(보고 커밋만 두 ID를 함께 씀).

## 3. 시험 실행 결과 (직접 실행)
| 명령 | 결과 |
|---|---|
| `pnpm gen:templates` | 템플릿 26개 생성 |
| `pnpm --filter @agentforge/exporter test` | 파일 1개, 시험 20건 통과(golden 3구성 x 6 + 경계 2) |
| `pnpm typecheck` | core·exporter·server·web 모두 통과 |
| `pnpm lint` | 오류 0 |
| `bash tests/scripts/run.sh` | bash -n 20개 통과, shellcheck·bats 는 로컬에 없어 건너뜀 → "test:scripts 통과" |

## 4. bats 정적 검토 (`tests/scripts/guard-paths.bats`)
로컬에 bats·jq 가 없어 정적으로 검토했고, 보조로 Git Bash 에서 가짜 jq(node)와 경로 변환용 git shim 을 써서 6사례 입력을 `templates/static/guard-paths.sh` 에 그대로 넣어 봤다. 종료 코드와 stderr 문구가 모두 기대값과 같았다.

| 사례 | 줄 | 스크립트 동작 | 기대값 일치 |
|---|---|---|---|
| ① 허용 | 26-32 | `src/app.ts` 는 `src/` 접두어로 통과. `docs/dev1.md  # 끝 주석` 은 `%%#*`로 주석이 잘리고 `[[:space:]]`가 제거되어 `docs/dev1.md` 와 일치 → exit 0 | 일치 |
| ② 차단 | 34-40 | 20행 이후 루프에서 일치하는 항목이 없어 28행 문구를 stderr 로 출력, exit 2. bats `run` 은 stdout·stderr 를 `$output` 에 합치므로 38·39행 문자열 검사가 성립 | 일치 |
| ③ 상대 경로 | 42-50 | 15행: `cwd/file` 로 합쳐짐 → `src/app.ts`(0), `other/app.ts`(2) | 일치 |
| ④ `../` | 52-59 | 16행 `realpath -m` 로 `src/../other/x.ts` → `other/x.ts`. `src/` 접두어 오탐을 막는지 검증하는 좋은 사례 | 일치 |
| ⑤ AF_AGENT 없음 | 61-65 | 7행에서 즉시 exit 0 | 일치 |
| ⑥ paths 없음 | 67-72 | 20행 "담당 범위 파일이 없습니다" exit 2 | 일치 |

- 임시 저장소: `pwd -P` 로 물리 경로를 써서 `git rev-parse --show-toplevel`(실경로)와 `realpath -m` 결과의 접두어가 맞는다. `isolate_git` 으로 사용자 설정과 분리됨. 훅을 `bash "$GUARD"` 로 실행하므로 실행 비트에 의존하지 않음.
- skip 조건: CI ubuntu 는 `ci.yml:30` 에서 `bats jq` 를 설치하고 GNU coreutils 의 `realpath -m` 이 있으므로 `need_tools git jq`·`skip_on_no_realpath_m` 어느 것도 걸리지 않는다. macOS 만 D7 로 skip(설계 6장·보고에 기록됨).
- 실패 가능성이 높은 줄은 찾지 못함.

## 5. 지적 사항
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
|---|---|---|---|
| 권고(반려 아님) | `packages/exporter/test/zip.test.ts:12` | golden 폴더를 동적으로 읽어서, 폴더가 비거나 이름이 바뀌면 `describe.each` 가 0건이 되어도 통과한다. 완료 기준은 "3구성" | `expect(configs).toEqual(["default","g3-claude-only","ui-off-dev2-litellm"])` 같은 개수·이름 단언을 하나 추가 |
| 권고(반려 아님) | `tests/scripts/guard-paths.bats:61-65` | ⑤는 `AF_AGENT` 를 unset 한 경우만 본다. 스크립트(7행)는 빈 문자열도 같은 경로로 처리하지만 시험되지 않는다 | `AF_AGENT= run_guard ...` 사례를 한 줄 추가(선택) |
| 참고(범위 밖) | `templates/static/guard-paths.sh:9-11` | jq 가 없으면 `file` 이 빈 값이 되어 11행에서 exit 0 → 검사 없이 통과(fail-open). 모의 실행에서 실제로 확인됨 | dev-2 범위 밖. T-404 담당(dev-1)에게 jq 없음 시 exit 2 처리를 검토 요청 |
| 참고(범위 밖) | `templates/static/guard-paths.sh:25` | 끝에 `/` 없는 paths 항목(`docs/dev1.md`)은 `docs/dev1.md.bak` 도 접두어로 허용한다 | 범위 밖. 파일 항목은 정확히 일치, 폴더 항목은 `/` 접두어로 구분하도록 템플릿 담당이 검토 |

반려 사유(테스트 실패, 6장 테스트 누락, 범위 밖 변경, 계약 불일치, 수용 기준 미충족, 비밀 값)는 없다. bats 결과는 CI ubuntu 실행으로 최종 확인한다.
