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

---

# review-2 검토: dev-2 PH4 2라운드 (T-413, T-414)

- 대상 브랜치: `worktree-agent-a1972b1394e420d18`, 범위 `git diff develop...HEAD`
- 커밋: 01c09f3(T-413), 08e0bc2(T-414), 리드 병합 47f6e15
- 보고서 파일 미작성: 리드 결정으로 면제(판정 기준에서 제외)

## 최종 판정: 통과 (권고 4건)

## R2-1. 설계 검토
| 항목 | 결과 |
|---|---|
| 기능 ID | GEN-03(T-413), RUN-02·RUN-03(T-414) 모두 R2-1·R2-6에 있음 |
| T-413 완료 기준 6사례(통과, 겹침, 스킬 누락, paths 누락, 기능 ID 미배정, prd/tasks 없음) | `check-forge.bats` ①~⑥으로 1:1 대응 |
| T-414 완료 기준(범위 밖 변경 감지, 반려 한도 → `dev-N.blocked`, integrate 충돌 시 abort·`pre-integration` 태그) | `parallel-mock.bats` 6사례(대조군 1건 포함)로 모두 다룸 |
| 계약 | 변경 없음. 신호 파일 규약은 읽기만 사용 |
| 결함 기록 | D-A는 R2-7에 기록됨. D-B는 상세 설계에 없고 시험 주석(`parallel-mock.bats:79`)에만 있음 → 권고 3 |

## R2-2. 범위
`git diff --name-only develop...HEAD`로 나온 파일: `docs/design/detail/dev-2.md`, `tests/scripts/check-forge.bats`, `tests/scripts/g3-vertical-slice.bats`, `tests/scripts/helpers.bash`, `tests/scripts/parallel-mock.bats`. 모두 dev-2 범위 안이고, `templates/static/`은 바뀌지 않았다(diff 0건).

한 커밋 한 작업 ID 예외: T-413 커밋(01c09f3)의 `helpers.bash`에는 T-414에서만 쓰는 함수(`tmux_sandbox`, `unpack_project`, `bootstrap_project`, `wait_*`, `commit_in`)가 들어 있다. T-413이 쓰는 건 `need_bash4` 하나다. 공용 파일을 한 번에 정리한 것이고 기능 동작에는 영향이 없으므로 받아들인다. 다음부터는 T-414 커밋에 넣는 것이 규칙에 맞다(반려 사유 아님).

## R2-3. 시험 실행 결과 (직접 실행)
| 명령 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | 완료 |
| `pnpm gen:templates` | 템플릿 26개 |
| `pnpm --filter @agentforge/exporter test` | 1파일, 20건 통과 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0 |
| `bash tests/scripts/run.sh` | `bash -n` 20개 통과, shellcheck·bats는 로컬에 없어 건너뜀 → "test:scripts 통과" |
| bats (CI, 리드 제공) | PR #1 run 40644692559: ubuntu 31/31 통과, macOS는 check-forge 통과·setup 의존 사례는 D7 skip. 로컬에 `gh` 인증이 없어 직접 조회는 못 했다 |

## R2-4. 시험이 실제 결함을 잡는가 (정적 검토)
- check-forge ①~⑥: ①에서 기준선이 통과(exit 0, `✗` 없음)하는지 먼저 확인하고, 나머지 사례는 한 가지만 망가뜨린다. 그래서 각 사례의 exit 1이 해당 결함 때문이라는 게 분명하다. 기대 문구는 `check-forge.sh:32,30,45,65,68` 출력과 글자 그대로 맞는다. ⑤는 `F-001/F-002`가 오류로 나오지 않음까지 확인해서 과잉 검출도 잡는다. 공허한 단언은 없다.
- parallel-mock 범위 밖/대조군: 같은 루프 반복 안에서 `say dev-i`와 `say review-i`가 배타적으로 나뉘므로(`wait-and-review.sh:49-53`), 경고가 도착한 뒤의 `not_in_file "review-1 got:"`은 시점 문제 없이 의미가 있다. 대조군이 있어서 "항상 경고" 같은 오동작도 잡힌다.
- 반려 한도: `count`(`wait-and-review.sh:16,56`)가 3이 되는 시점에 반려 메시지는 2건에서 멈추고, `blocked`와 이력 3건, dev-2 영향 없음까지 확인한다. 각 신호를 다음 것보다 먼저 소비시키므로(`wait_gone`), 아직 소비되지 않은 파일에 `touch`해서 두 신호가 하나로 합쳐지는 일도 없다.
- 전원 통과 → integrate: 병합 커밋 2개, 두 파일 내용, integrator 실행 인자를 확인한다. 의미 있는 시험이다.
- 첫 병합 충돌: `develop == pre-integration`과 마지막 커밋 제목까지 확인한다. 안내문이 약속한 동작을 정확히 검증한다.
- 두 번째 병합 충돌(D-A): abort, exit 1, MERGE_HEAD 없음, integrator 미실행, dev2 내용 미유입(134행)은 의미 있는 단언이다. 하지만 131행 `merge-base --is-ancestor pre-integration develop`는 태그가 develop 위에 찍히고 병합은 앞으로만 진행되므로 항상 참이다(공허). D-A가 있든 고쳐지든 결과가 같아서, 이 시험만으로는 D-A가 기록되지도 고정되지도 않는다 → 권고 1.

## R2-5. helpers.bash 공용화 후 g3 의미 유지
준비 절차(빌드 확인, tmux 소켓, ZIP 해제, setup, develop, create-worktrees)가 같은 순서로 공용 함수에 옮겨졌다. `[ -d dev1 ] && [ -d dev2 ]`는 두 줄로 나뉘어 오히려 강해졌다. 시험 단언은 바뀌지 않았으므로 의미는 유지된다. 다만 dev-2가 R2-3에서 스스로 지적한 bats 함정이 g3에 그대로 남아 있다 → 권고 2.

## R2-6. 지적 사항
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
|---|---|---|---|
| 권고 1 | `tests/scripts/parallel-mock.bats:129-131` | 두 번째 병합 충돌 사례의 `merge-base --is-ancestor` 단언은 항상 참이라 D-A를 잡지 못한다. 시험 이름의 "pre-integration 태그 유지"는 안내문("develop 은 pre-integration 태그 상태로 유지")과 다른 뜻으로 읽힌다 | 현재 동작을 고정하는 단언을 D-A 주석과 함께 추가: `[ "$(git rev-parse develop)" != "$(git rev-parse pre-integration)" ]  # D-A: dev1 병합이 남음(integrate.sh 수정 시 = 로 바꿀 것)` 그리고 `[ "$(git show develop:README.md)" = "dev1 version" ]`. 또는 올바른 기대값(`develop == pre-integration`)으로 쓴 별도 사례를 `skip "D-A"`로 둔다 |
| 권고 2 | `tests/scripts/g3-vertical-slice.bats:18,31` | 18행의 `&&` 연쇄는 마지막이 아닌 `[ ]`가 실패해도 bats(set -e)가 잡지 못한다(EXP-01 실행 권한 검사가 약해짐). 31행의 `! grep`도 실패로 처리되지 않는다. 원래 있던 코드지만, 이번에 고친 파일이고 해결용 도우미(`not_in_file`)도 이번에 추가됐다 | 18행을 `[ -x scripts/setup.sh ]` / `[ -x scripts/run-agents.sh ]` / `[ ! -x README.md ]` 세 줄로 나누고, 31행을 `not_in_file "review-2 got:" "$FAKE_CLAUDE_LOG"`로 바꾼다 |
| 권고 3 | `docs/design/detail/dev-2.md` R2-7, `tests/scripts/parallel-mock.bats:79` | D-B(`take`의 `date +%s` 이력 이름이 같은 초에 겹치면 덮어써져 `count`가 적게 셈)가 상세 설계에 없다. 79행 주석은 시각 충돌만 이유로 드는데, `wait_gone`이 실제로 막는 건 "소비되기 전에 다시 `touch`해서 신호 두 개가 하나로 합쳐지는 것"이기도 하다 | R2-7에 D-B를 D-A와 같은 형식으로 기록(영향: 10초 폴링이라 운영에서는 드물고, 시험에서는 `wait_gone`으로 피함). 79행 주석에 두 이유를 함께 적는다 |
| 참고 | 01c09f3 | `helpers.bash`의 T-414 전용 함수가 T-413 커밋에 들어감(한 커밋 한 작업 ID 예외) | 이번 건은 받아들임. 앞으로 공용 도우미는 처음 쓰는 작업 커밋에 넣는다 |
| 참고(범위 밖) | `templates/static/integrate.sh:19-22` | D-A: 2번째 이후 병합이 충돌하면 그 병합만 abort되고 앞선 병합은 develop에 남는다. 안내문과 맞지 않음 | 템플릿 담당이 실패 시 `git reset --hard pre-integration`(또는 문구 수정)을 ADR로 결정. 고친 뒤 권고 1의 단언을 뒤집는다 |

반려 사유(테스트 실패, 6장 테스트 누락, 범위 밖 변경, 계약 불일치, 수용 기준 미충족, 오류 처리 누락, 비밀 값)는 없다. 권고 1·2는 다음 라운드에서 반영하기를 권한다.
