# dev-2 상세 설계 (PH4 1라운드: T-411, T-412)

## 1. 담당 작업·기능 ID
| 작업 | 기능 ID | 내용 |
|---|---|---|
| T-411 | EXP-01(완성) | toZip 보강·시험: 루트 폴더명, 755/644, LF, ZIP ↔ `RenderedFile[]` 동등, 2초 이내 |
| T-412 | DEV-03 | bats `guard-paths` 6사례 |

## 2. 파일 목록
| 경로 | 책임 |
|---|---|
| `packages/exporter/test/zip.test.ts` | golden 3구성 전체로 ZIP ↔ RenderedFile[] 동등, 권한·LF·디렉터리 항목 없음·빈 파일·결정성·성능 시험 |
| `packages/exporter/src/zip.ts` | 시험이 결함을 드러낼 때만 최소 수정(현재 변경 예정 없음) |
| `tests/scripts/guard-paths.bats` | guard-paths.sh 6사례 |
| `tests/scripts/helpers.bash` | `skip_on_no_realpath_m` 도우미 추가 (D7: macOS BSD realpath 는 `-m` 없음) |

## 3. 주요 함수
- `toZip(files: readonly RenderedFile[], root: string): Promise<Uint8Array>` (기존). root 정규식 검증(`ZIP_ROOT_INVALID`), 중복(`ZIP_DUPLICATE_PATH`), 절대/`..` 경로(`ZIP_PATH_INVALID`)는 `AppError`. 항목 시각 고정, `createFolders:false` 로 디렉터리 항목 없음.
- bats 도우미 `skip_on_no_realpath_m`: `realpath -m /` 가 실패하면 skip.
- guard-paths.bats 내부 `run_guard <cwd> <file_path>`: PreToolUse JSON 을 jq 로 만들어 stdin 으로 guard-paths.sh 에 전달.

## 4. 사용하는 계약
- `@agentforge/core` 의 `render`, `validate`, `RenderedFile`, `AppError` (읽기만). 공통 모듈·API 계약 변경 없음.
- Claude Code PreToolUse 입력 JSON `{"cwd":..., "tool_input":{"file_path":...}}`. 종료 코드 0=허용, 2=차단.

## 5. 화면 상태
해당 없음.

## 6. 테스트 목록
| 기능 ID | 수용 기준 | 테스트 |
|---|---|---|
| EXP-01 | 구성별 ZIP 항목 = RenderedFile[] (목록·순서·내용·권한) | `zip ↔ RenderedFile[] 동등` (golden 3종 each) |
| EXP-01 | 루트 폴더명 = 프로젝트 이름, 디렉터리 항목 없음 | `모든 항목이 <프로젝트 이름>/ 아래, 디렉터리 항목 없이 파일만` |
| EXP-01 | 755/644 보존 | `755 파일(스크립트·훅)이 있고 나머지는 644` |
| EXP-01 | 텍스트 LF 유지 | `ZIP 안 모든 텍스트에 CR 이 없다` |
| EXP-01 | 빈 파일(.gitkeep) 보존 | `빈 파일(.gitkeep)이 크기 0 으로 보존된다` |
| EXP-01 | 결정적 바이트 / 2초 | `같은 입력이면 같은 바이트`, `2초 이내` |
| EXP-01 | 잘못된 입력 거부 | `잘못된 root·경로는 거부한다` |
| DEV-03 | ①범위 안 허용 exit 0 | `범위 안 파일은 허용` |
| DEV-03 | ②범위 밖 차단 exit 2, 안내 문구 | `범위 밖 파일은 차단` |
| DEV-03 | ③상대 경로는 cwd 기준 | `상대 경로는 cwd 기준으로 해석` |
| DEV-03 | ④`../` 우회 차단 | `../ 우회는 차단` |
| DEV-03 | ⑤AF_AGENT 없음 통과 | `AF_AGENT 가 없으면 통과` |
| DEV-03 | ⑥paths 파일 없음 차단 | `paths 파일이 없으면 차단` |

bats 는 jq·git 필요(없으면 skip), `realpath -m` 없으면 skip(D7, macOS). 로컬에는 bats 가 없어 CI 에서 실행.

## 7. 계약·공통 모듈에 필요한 변경
없음. `templates/static/guard-paths.sh` 의 `realpath -m` GNU 전용 문제(D7)는 수정하지 않고 skip + report 기록.

---

# 2라운드 (PH4: T-413, T-414)

## R2-1. 담당 작업·기능 ID
| 작업 | 기능 ID | 내용 |
|---|---|---|
| T-413 | GEN-03 | bats `check-forge` 6사례 |
| T-414 | RUN-02, RUN-03 | 가짜 claude 모의 병렬: 범위 밖 변경 감지, 반려 한도 → `dev-N.blocked`, integrate 통과·충돌 |

## R2-2. 파일 목록
| 경로 | 책임 |
|---|---|
| `tests/scripts/helpers.bash` | 공용 함수 추가: `need_bash4`, `need_build`, `tmux_sandbox`, `tmux_cleanup`, `unpack_project`, `bootstrap_project`, `wait_file`, `wait_gone`, `wait_count`, `wait_pane`, `not_in_file`, `commit_in` |
| `tests/scripts/g3-vertical-slice.bats` | 준비 절차를 공용 함수로 교체(시험 내용은 동일) |
| `tests/scripts/check-forge.bats` | check-forge.sh 6사례 |
| `tests/scripts/parallel-mock.bats` | 모의 병렬 6사례 |

`templates/static/*` 은 수정하지 않는다. 결함은 report 와 skip 사유에 적는다.

## R2-3. 주요 함수 (helpers.bash)
- `unpack_project`: golden g3 입력으로 ZIP 생성 → 해제 → `g3-demo` 로 이동.
- `bootstrap_project`: `setup.sh` → `git branch develop` → `create-worktrees.sh`(`../g3-demo-dev1·2`).
- `tmux_sandbox`: 시험 전용 `TMUX_TMPDIR` 에 서버를 띄우고 `default-command "bash --noprofile --norc"`. `make_fake_bin` 뒤에 호출(서버가 PATH 를 물려받음).
- `wait_pane <초> <ASCII 패턴> <대상>`: tmux 가 UTF-8 로케일이 아닐 때 한글이 깨질 수 있어 ASCII 패턴만 쓴다. wait-and-review 종료 감지는 `scripts/integrate.sh`(안내 문구 속 ASCII)로 한다.
- `not_in_file`: bats(set -e)에서 `! grep` 은 실패로 처리되지 않으므로 명시 검사. `&&` 로 이은 `[ ]` 검사도 앞쪽 실패를 잡지 못하므로 새 코드는 한 줄에 하나씩 쓴다.
- 대기 시간: wait-and-review 폴링 10초 → 사례당 최대 40초(반려 한도 사례는 3회 순차 소비로 최대 약 35초).

## R2-4. 사용하는 계약
계약 변경 없음. 읽기만: `templates/static/check-forge.sh`, `wait-and-review.sh`, `integrate.sh`, `run-agents.sh`, `create-worktrees.sh`, golden `g3-claude-only`. 신호 파일 규약(`design-N.*`, `dev-N.done`, `review-N.pass|reject`, `dev-N.blocked`, `review-N.passed`).

## R2-5. 화면 상태
해당 없음.

## R2-6. 테스트 목록
| 기능 ID | 수용 기준 | 테스트 |
|---|---|---|
| GEN-03 | 통과 exit 0, `✗` 없음 | `① 통과` |
| GEN-03 | 범위 겹침 exit 1 | `② 개발자 사이 담당 범위 겹침` |
| GEN-03 | 없는 스킬 참조 exit 1 | `③ 에이전트가 참조한 스킬 없음` |
| GEN-03 | paths 없음 exit 1 | `④ .claude/devs/dev-N.paths 없음` |
| GEN-03 | PRD 기능 ID 미배정 exit 1 (D1: `F-[0-9]{3}` 만 인식) | `⑤ PRD 기능 ID 가 tasks 에 배정되지 않음` |
| GEN-03 | prd/tasks 없음 exit 1 | `⑥ docs/prd.md·tasks.md 없음` |
| RUN-02 | 범위 밖 변경 → dev pane 경고, review 로 안 감 | `범위 밖 변경: ...` |
| RUN-02 | 범위 안 변경 → review 에 코드 검토 요청(대조군) | `범위 안 변경만 있으면 ...` |
| RUN-03 | 반려 maxRejects(3) → `dev-1.blocked` | `반려 한도: ...` |
| RUN-02 | 전원 통과 → integrate 병합 + integrator 실행 | `전원 통과 → ... integrate.sh ...` |
| RUN-02 | 두 dev 충돌 → abort, exit 1, 태그 존재 | `충돌(두 dev 가 같은 파일을 다르게 수정) ...` |
| RUN-02 | 첫 병합 충돌 → develop = 태그 | `첫 병합부터 충돌 ...` |
| EXP-01 | g3 세로 한 줄 유지 | `g3-vertical-slice.bats` (준비만 공용 함수로 교체) |

## R2-7. 계약·공통 모듈에 필요한 변경
없음. 발견 결함(수정은 범위 밖, report 기록): `integrate.sh` 는 dev2 이후 병합이 충돌하면 `git merge --abort` 로 해당 병합만 되돌리므로 먼저 병합된 feature 가 develop 에 남는다. 안내문 "develop 은 pre-integration 태그 상태로 유지됩니다" 와 불일치. 시험은 "첫 병합 충돌" 사례에서만 develop = 태그를 단언하고, 두 번째 병합 충돌 사례는 "태그 존재 + 태그의 후손"까지만 단언한다.

## R3. PH4 3라운드 (ADR-0004 시험, T-412·T-413·T-414 보강)

### R3-1. 변경 요약
| 작업 | 파일 | 내용 |
|---|---|---|
| T-412 | `guard-paths.bats` | ⑦ jq 없음 exit 2 + `jq 가 없어 담당 범위를 검사할 수 없습니다. 설치 후 다시 실행하세요.`(⑦-2 AF_AGENT 없으면 통과), ⑧ 파일 항목 완전 일치(`docs/report-dev-1.md` 허용, `.bak`·하위 차단), ⑨ 루트 밖 차단(옛 템플릿에서도 exit 2 이므로 판별 시험이 아니라 **회귀 방지**; `/` 없이 접두어를 떼는 정규화 실수는 ⑨-2 로 잡는다), ⑩~⑫ glob 우회·깨진 JSON. `skip_on_no_realpath_m`·`skip_on_bsd_sed` 도우미 삭제 |
| T-412 | `setup.bats`·`g3-vertical-slice.bats`·`parallel-mock.bats` | `skip_on_bsd_sed` 제거. `stat -c`→`ls -l`, `sed -i`→awk+mv 로 시험 코드 이식. g3 의 `&&` 연쇄 분리, `! grep`→`not_in_file`(review-2 권고 2) |
| T-413 | `check-forge.bats` | ⑦ 미치환 `{{TOKEN}}` → `✗ <파일> 에 채우지 않은 자리표시 <토큰>` exit 1, forge-agents/SKILL.md·소문자 `{{x}}` 제외 |
| T-414 | `parallel-mock.bats` | D-A: 두 번째 병합 충돌 시 develop == pre-integration + `develop 을 pre-integration 태그 상태로 되돌렸습니다.`(review-2 권고 1 의 올바른 기대값). D-B 사례 |

### R3-2. D-B 기록 (review-2 권고 3)
wait-and-review.sh 의 이력 이름이 `date +%s` 라 같은 초에 두 번 소비되면 덮어써 반려 횟수가 과소 집계되었다. ADR-0004 결정 6 으로 `.<n>` 순번을 붙인다. 시험: (1) `take` 함수를 스크립트에서 추출해 같은 초에 3번 소비 → 파일 3개(결정적), (2) 통합 경로에서 reject 2회 → 이력 2건·blocked 없음. 폴링이 10초 간격이라 통합 시험만으로는 같은 초 충돌을 재현할 수 없어 (1)을 둔다.

### R3-3. 계약 변경
없음. `templates/` 수정 없음(dev-1 담당). 옛 템플릿에서는 ⑦·⑧·⑩·⑪·⑫·D-A·D-B(1)·setup/ macOS 사례가 실패하는 것이 정상.

## 5라운드: T-415 (EXP-01) E2E
- 파일: `tests/e2e/playwright.config.ts`(Chromium, vite preview 4173 고정, 직렬), `helpers.ts`(core render 기대값·jszip 풀기·셸 단계 skip 판정·격리 env), `export.spec.ts`, `tsconfig.json`. 루트 `test:e2e` 스크립트, typecheck 에 `tsc -p tests/e2e` 추가, devDependencies `@playwright/test`·`jszip`(리드 승인).
- 시험: ① 기본값 1→6단계·칩·`order-portal-agentforge.zip` / ② e2e-demo·개발자 2·UI 끔·폴더 겹침 차단→이동→수정→다운로드 / ③ ZIP 목록·루트·권한 = core render(모든 OS) / ④ 풀기→setup.sh→더미 prd·tasks→check-forge.sh→`-x` (Linux/macOS 에서만, 그 외 skip).
- 계약 변경: 없음.

## PH6 1라운드: T-612 (RUN-04 bats), T-614 (보안 S-4 bats)

계약 기준 TDD다. 구현(dev-1)이 반영되기 전에는 새 사례가 실패하는 것이 정상이다. 문구는 dev-1 이 정하므로 동작(exit code·파일·pane·tmux 옵션) 위주로 단언한다.

### P6-1. 파일
| 파일 | 책임 |
|---|---|
| `tests/scripts/run-agents.bats` (신규) | design.md 8.2: g3 입력에 `tmux` 를 jq 로 주입 → ZIP → setup → develop → create-worktrees → run-agents(가짜 claude) |
| `tests/scripts/parallel-mock.bats` (수정) | 8.6 S-4: 기존 통합 사례 준비에 검토 파일 커밋 추가(`add_reviews`), 검토 파일 누락·미커밋 사례 추가 |

### P6-2. 테스트 목록
| 계약 | 사례 |
|---|---|
| 8.2 pair(기본) | tmux 미지정: config 에 `tmuxLayout: pair` 만, 창 watch·dev1·dev2, 창당 2 pane, panes 파일 유효 |
| 8.2 grid | 창 watch·agents, agents 4 pane, panes 파일이 모두 agents 창의 pane, pane 순서 = dev-1, review-1, dev-2, review-2, design-1.done → review-1 전달 |
| 8.2 role | 창 watch·dev·review, dev·review 각 2 pane, 창 안 순서 dev-1·dev-2 / review-1·review-2, dev-i 는 dev 창·review-i 는 review 창, 신호 전달 |
| 8.2 prefix·mouse | 세션 범위(`show-options -t`)에 prefix C-a·mouse on, 전역(`-g`)은 C-b·off 유지, 안내 출력에 `C-a` 포함·`Ctrl-b` 없음 |
| 8.2 pair + prefix·mouse | 배치는 pair(dev1·dev2 창)이고 옵션만 세션 범위로 적용(배치·옵션 분기 독립) |
| 8.2 기본값 | tmux 지정이나 C-b·mouse false·logs false: 세션 옵션 없음, logs 폴더·gitignore 항목 없음 |
| 8.2 logs | logs=true: `.agentforge/logs/<에이전트>.log` 4개 생성, `.gitignore` 에 `.agentforge/logs/` |
| 8.2 logs + 경로 인용 | 상위 폴더에 한글·공백·작은따옴표(`프로 젝트 it's`), 시험 중 `LC_ALL=C` 로 tmux 서버를 재기동하고 run-agents 실행: 4개 로그 파일 모두 생성 |
| 8.6 S-4 누락 | dev-2 검토 파일 없음: integrate exit 1, develop 불변, integrator 미실행 |
| 8.6 S-4 미커밋 | 작업 트리에만 있고 커밋 안 됨: 위와 동일 |
| 8.6 S-4 요청 문구 | review-1 코드 검토 요청에 `docs/review/dev-1.md` 가 포함 |

### P6-3. 계약 변경
없음. `templates/` 수정 없음.
