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

## PH6 2라운드: T-611·T-613

### P6R2-1. 파일
| 파일 | 책임 |
|---|---|
| `tests/scripts/check-models.bats` (신규) | design.md 8.3 `scripts/check-models.sh` 판정·대상·요약·호출 형태·비밀 |
| `tests/scripts/devcontainer-check.sh` (신규) | design.md 8.4 생성 devcontainer.json 의 구조 확인과 postCreateCommand 실동작 확인 |

### P6R2-2. 시험 데이터
- golden `ui-off-dev2-litellm`(project=batch-hub, agents 9개: litellm 경유 planner·dev-1·review-2, ollama dev-2, claude 나머지). check-models.sh 는 현재 정적 템플릿을 복사해 쓴다.
- 가짜 claude: `--agent <a>` 로 에이전트를 알아내 `$FAKE_DIR/<a>.out|rc|sleep` 대로 출력·종료·지연하고, 받은 인자와 표준입력 EOF 여부(`stdin-rc=1`)를 기록한다.
- 키 값은 시험 전용 문자열(`SECRET`)을 `env.local` 의 `LITELLM_MASTER_KEY` 로 넣는다.

### P6R2-3. 사례 표
| 계약 | 사례 |
|---|---|
| 8.3 통과 | 값 있음 + num_turns 3 → ✓, exit 0 |
| 8.3 경계 | num_turns=2 통과(`>=2` 변이 검출), num_turns=1 경고 |
| 8.3 경고 | 값 없음 / num_turns<2 → !, exit 0 |
| 8.3 실패 | is_error / claude exit 3 / JSON 깨짐 / agent-env 키 누락(claude 미호출) / AF_CHECK_TIMEOUT 초과 → ✗, exit 1 |
| 8.3 대상·요약 | 인자 지정 에이전트만, 인자 없으면 agents 전부, 혼합 요약 `통과 1 · 경고 1 · 실패 1` + exit 1 |
| 8.3 호출 형태 | `--agent <a>`·`--output-format json`·`--max-turns 3`·`-p`, 표준입력 /dev/null |
| 8.3 비밀 | litellm 에이전트로 통과·경고(값 없음)·경고(num_turns=1)·is_error·JSON 깨짐·claude exit≠0 각각 실행해 출력에 키 값·응답 원문이 없음 |
| 8.4 구조 | devcontainer: true 입력 → `.devcontainer/devcontainer.json` 의 name=slug·image·postCreateCommand·remoteEnv.AF_IN_CONTAINER=1·mode 644 |
| 8.4 docker | docker 가 있으면 이미지로 컨테이너를 띄워 postCreateCommand 후 tmux·jq·claude 버전 확인 |
| 8.4 이미지 안 | docker 없이 `AF_IN_DEVCONTAINER_IMAGE=1` 이면 현재 환경에서 같은 확인 |
| 8.4 건너뜀 | 둘 다 아니면 구조 확인만 하고 exit 0. `AF_DEVCONTAINER_REQUIRED=1` 이면 exit 1 |

### P6R2-4. 계약 변경
없음.

## PH6 3라운드: T-615

### P6R3-1. 담당 작업·기능 ID
T-615: I18N-01(화면 영어 전환·생성물 언어), DOC-03(기존 CLAUDE.md 병합). 선행: T-621(화면 en), T-605(생성물 영어), T-624(붙여넣기 UI).

### P6R3-2. 파일
| 파일 | 책임 |
|---|---|
| `tests/e2e/i18n-doc.spec.ts` (신규) | 시나리오 4건. 서로 독립(ZIP 을 이어 쓰지 않음) |
| `tests/e2e/playwright.config.ts` (수정) | `AF_E2E_PORT` 로 포트 변경(기본 4173, CI 동작 불변) |

### P6R3-3. 사용 계약
- design.md 8.1(`mergeClaudeMd` 규칙: 마커 밖 보존, PROJECT 보존, AGENTS·DEVS·SKILLS 교체, 마커 오류), 8.5(화면 en 전환·선택 미저장, 생성물 `language: "en"`).
- core: `render`, `validate`, `defaultDraft`, `mergeClaudeMd`(기대값 계산).
- T-624 접근명: 6단계 라벨 "기존 CLAUDE.md 붙여넣기(선택)", 오류 시 textarea `aria-invalid="true"` + `#doc-error`.
- 화면: 그룹 접근명 "화면 언어"/"Display language", 버튼 한국어/English, 영어 단계 제목·"Next"·"Download ZIP".

### P6R3-4. 테스트 목록
| 기능 ID | 사례 | 단언 |
|---|---|---|
| I18N-01 | (a) 화면 영어 전환 | 영어 전환 후 그룹 접근명·6단계 제목·Next·Download ZIP 이 영어, ZIP 의 파일 경로·내용 전체가 ko 기준 core 렌더와 같음, `page.reload()` 후 ko 로 복귀(저장 안 함) |
| I18N-01 | (b) language=en | 영어 요구사항 입력 후 ZIP 의 README·CLAUDE.md 에 한글 없음, core 렌더(language=en)와 동일 |
| DOC-03 | (c) 병합 | 붙여넣은 CLAUDE.md 의 마커 밖 텍스트·PROJECT 구간 보존, AGENTS 구간의 옛 내용(STALE-AGENTS) 제거, 결과가 `mergeClaudeMd(old, next)` 와 동일 |
| DOC-03 | (c) 마커 오류 | AGENTS BEGIN 만 있는 입력: textarea `aria-invalid="true"`, `#doc-error` 표시, ZIP 버튼(정상·차단 모두) disabled |

### P6R3-5. 계약 변경
없음. 로컬 실행 시 4173 점유 주의(오래된 preview 재사용 가능): `AF_E2E_PORT` 사용.

## PH7 1라운드: T-711 (MKT-01 마켓 색인 서버)

### P7R1-1. 담당 작업·기능 ID
T-711: MKT-01. 계약: design.md 9.4·9.6, ADR-0007.

### P7R1-2. 파일
| 파일 | 책임 |
|---|---|
| `packages/server/src/app.ts` | `createServer(opts)` Fastify 앱, 라우트 7종, 오류 변환(`{code, params}`) |
| `packages/server/src/schemas.ts` | zod: 소스 등록 입력, 쿼리 |
| `packages/server/src/store.ts` | dataDir 의 sources.json·index/<id>.json 읽기/쓰기, 기본 소스 복사 |
| `packages/server/src/indexer.ts` | 파일 목록(`RawFile`) → 스킬 인식·크기·binary 판정·색인 항목 |
| `packages/server/src/fetch-github.ts` | github REST 수집(ref→sha, trees, blobs), 토큰은 Authorization 에만 |
| `packages/server/src/fetch-git.ts` | `git clone --depth 1` execFile(인자 배열), 임시 폴더, 60초, file:// 제한 |
| `packages/server/src/index.ts` | 공개 export |
| `packages/server/test/*.test.ts` | 시험 |

### P7R1-3. 주요 시그니처
- `createServer({ dataDir, scan, fetch?, gitBin?, webDist?, env?, defaultSourcesFile? }): Promise<FastifyInstance>`
  - `scan: (files: {path, content}[]) => string[]` 은 필수 주입이다. 통합 때 core `scanSkillRisk` 를 기본값으로 연결한다(TODO).
  - 입력은 zod 로 검증하고, 실패는 `SOURCE_INVALID`. 알 수 없는 예외는 `INTERNAL`(내부 메시지 미노출).
- 스킬 인식: path 아래 깊이 2 이내에서 SKILL.md 를 가진 폴더, 폴더명 SkillName, 파일 50개·200,000자·합계 512,000자 초과 `tooLarge`, UTF-8 디코드 실패 `binary`. 둘 다 `blocked` 로 상세 GET 은 `SKILL_BLOCKED`.
- 경로 조작: tree 항목·git 파일 경로가 `..`·절대·역슬래시이거나 `.git` 이면 무시. 스킬 파일 경로는 SkillFilePath 패턴이 아니면 해당 스킬을 건너뜀이 아니라 파일만 제외하지 않고 스킬을 건너뛴다(원문 보존 규칙).
- 오류 코드: `SOURCE_EXISTS` `SOURCE_INVALID` `SOURCE_FETCH_FAILED` `SOURCE_TIMEOUT` `SKILL_BLOCKED` `NOT_FOUND`(소스·스킬 없음).

### P7R1-4. 사용 계약
9.4 API 7종 그대로. core 는 `SkillName`·`GitBranch`·`HttpUrl` 패턴·`AppError` 코드 규약만 읽는다.

### P7R1-5. 테스트 목록
| 기능 | 사례 |
|---|---|
| MKT-01 | github 색인(ref·sha·path), GHES baseUrl, 토큰 헤더 + 값 미노출, 404/rate limit → SOURCE_FETCH_FAILED |
| MKT-01 | git file:// 색인(허용/미허용), 깊이 2, 잘못된 폴더명, tooLarge, binary 차단 |
| MKT-01 | 검색 q·trust, 등록 중복, 삭제 시 색인 삭제, 경로 조작 거부, 기본 소스 복사, health |

### P7R1-6. 계약 변경
없음. 단 core `scanSkillRisk` 미구현이라 `scan` 주입 필수(통합에서 기본값 연결).

### P7R1-7. 보강: 관리 API 보호와 서버 보안 (리드 요청 + review-2, design.md 9.7)
- 관리 API 보호: `POST/DELETE /api/market/sources`, `POST /api/market/refresh` 는 `AF_MARKET_ADMIN=1` 일 때만 동작하고, 아니면 본문 파싱 전에 403 `ADMIN_DISABLED`. 읽기 API 는 항상 허용. `GET /api/market/health` 는 `{ ok, version, admin }`.
- 추가 응답 코드(9.6 외): `ADMIN_DISABLED`(403), `HOST_DENIED`(403), `NOT_FOUND`(404), `INTERNAL`(500). 관리 POST 의 Content-Type 오류는 415 `SOURCE_INVALID`.
- `blocked` 값: `tooLarge`, `binary`, `badPath`. `badPath` 는 스킬 안 파일 경로가 SkillFilePath 패턴(공백·한글·깊이 6 이상 등)에 맞지 않을 때 일부만 가져오지 않고 스킬 전체를 차단한다(원문 보존 원칙). 앞 절의 "파일만 제외" 문구는 이 규칙으로 정정한다.
- 보강 규칙:
  1. `tokenEnv` 는 `AF_MARKET_TOKEN_` 접두 이름만. 토큰을 쓰는 소스의 `baseUrl`·`url` 은 https 만(등록 시 검증, 갱신 시 재검사).
  2. `repo` 가 `.`·`..` 이거나 `path` 세그먼트가 `.`·`..` 이면 거부(API 경로 이탈 방지).
  3. 관리 POST 는 Content-Type `application/json` 만(아니면 415). 본문 없는 `POST /refresh` 로 전체 갱신하던 CSRF 경로 차단.
  4. 모든 요청의 Host 허용 목록: `localhost`, `127.0.0.1`, `[::1]` + `AF_MARKET_HOSTS`(쉼표 목록). 아니면 403 `HOST_DENIED`.
  5. git 은 `git ls-tree -r -z HEAD` 로 일반 파일(100644·100755)만 수집(심볼릭 링크·서브모듈 제외, OS 무관). 파일 수 20,000 초과는 `SOURCE_FETCH_FAILED {reason: tooMany}`.
  6. 기동: `listenServer(app, { host = "127.0.0.1", port })`, `startFromEnv(env, scan)`(PORT·AF_MARKET_DATA·AF_WEB_DIST), CLI `src/main.ts`(core 의 `scanSkillRisk` 를 동적으로 찾아 연결, 없으면 종료).
  7. `workDir` 옵션: clone 임시 폴더 위치(시험은 전용 폴더로 정리 확인).
- 비차단 반영: BOM 이 있는 SKILL.md 의 description 인식, `path` 가 스킬 폴더 자체이면 루트 SKILL.md 인식(id = path 마지막 폴더명).
- 시험: `hardening.test.ts`(위 1~6, 경계값 50개·200,000자·512,000자, badPath, INTERNAL 비노출, `cloneArgs` 의 `--` 구분자, `gitEnv` 의 GIT_ALLOW_PROTOCOL). 임시 폴더는 `test/setup.ts` 의 afterAll 에서 삭제한다.

## PH7 2라운드: T-712 (EXP-02 GitHub·GHES push)
- 파일: `packages/exporter/src/github.ts`(pushToGithub, 내부 planTree), `packages/exporter/test/github.test.ts`(가짜 GitHub API fetch), package.json(`@octokit/core` ^7, exports `./github` 진입점 추가), `src/index.ts`(재export, 기존 스텁 `pushToGitHub` 제거).
- 시그니처: `pushToGithub(files, target, token, { fetch?, language }): Promise<{ url, commitSha, prUrl? }>`. baseUrl 기본 `https://api.github.com`, `request.fetch` 주입.
- tree 계획: core `planGithubTree` 가 이 브랜치에 없어 내부 함수로 같은 규칙(.sh 100755, 그 외 100644, env.local 경로 EXPORT_SECRET_PATH)을 두고 통합 때 교체(TODO).
- create: GET /user → POST /user/repos 또는 /orgs/{owner}/repos(auto_init) → 기본 브랜치 → blobs → trees(base_tree 없음) → commits(parents []) → PATCH refs/heads/{default} force. pr: 저장소 조회 → ref → commit → tree → blobs → trees(base_tree) → commits(parents [sha]) → POST refs(422 GITHUB_BRANCH_EXISTS) → POST pulls.
- 오류: 401/403 GITHUB_AUTH(rate limit 헤더면 GITHUB_RATE_LIMIT), 404 GITHUB_NOT_FOUND, create 422 GITHUB_REPO_EXISTS, 네트워크 GITHUB_NETWORK, 그 외 GITHUB_FAILED. params 는 status 만. 본문·토큰 미포함.
- 시험: create 순서·부모 없음·force·mode·env.local 차단·org/user·visibility, pr 순서·base_tree·브랜치 존재, 오류 매핑, 토큰 미노출, GHES baseUrl, toZip 동등.
- 계약 변경 없음(core planGithubTree 는 dev-1 라운드, 통합 교체).

## PH7 3라운드: T-713 (MKT-01·02, EXP-02 E2E)
- 파일: `tests/e2e/market.spec.ts`, `tests/e2e/github.spec.ts`, `tests/e2e/helpers.ts`(빈 포트·임시 git 저장소·서버 기동 보조 추가). 서버·exporter 코드는 바꾸지 않는다.
- market: beforeAll 에서 임시 git 저장소(safe-skill, risky-skill)를 만들고 `node packages/server/dist/main.js` 를 spawn(PORT=빈 포트, AF_MARKET_DATA=임시, AF_WEB_DIST=packages/web/dist, AF_MARKET_ADMIN=1, AF_ALLOW_FILE_SOURCES=1). admin 꺼진 서버는 별도 기동. afterAll 에서 종료·삭제. 화면은 서버 출처(같은 출처)로 연다.
- github: 실제 GitHub 대신 `page.route("https://api.github.com/**")` 가 가짜 응답(CORS 헤더 포함). baseUrl 은 https 전용이므로 화면 경로만 쓴다.
- 시험: 마켓 전체 흐름(검색·미리보기·위험 확인 전 ZIP 차단·ZIP 원문·권한 644·sources.lock sha256·README 안내), admin 꺼짐 UI 숨김, push 성공 요청 순서·mode·토큰 지움·토큰 미노출, 401 GITHUB_AUTH, commit 500 GITHUB_PARTIAL.
- 계약 변경 없음.

## PH8 1라운드: T-812 (npx 앱), T-813 (Docker·폐쇄망 시험) — DPL-01
1. 작업: T-812 `packages/app`, T-813 `Dockerfile`·`.dockerignore`·`tests/scripts/airgap-check.sh`. T-811(/api/license)은 core `verifyLicense` 가 필요해 다음 라운드.
2. 파일
   - `packages/app/package.json`(npm 이름 `agentforge`, bin, `files: ["dist"]`, 실행 의존성 fastify·@fastify/static·zod, 워크스페이스 패키지는 devDependencies), `vite.config.ts`(ssr 번들, `@agentforge/*` 포함), `build.mjs`(vite 빌드 후 web dist·catalog 를 `dist/web`, `dist/catalog` 로 복사), `src/args.ts`, `src/run.ts`, `src/cli.ts`, `test/{args,run,pack}.test.ts`
   - `Dockerfile`, `.dockerignore`, `tests/scripts/airgap-check.sh`
3. 함수
   - `parseCliArgs(argv, env, home): CliCommand` — 우선순위 인자 > 환경 변수(PORT·HOST·AF_MARKET_DATA·AF_MARKET_ADMIN) > 기본값. 오류는 `CliError(code)`: `INVALID_ARGS`·`INVALID_PORT`(0~65535 정수)·`INVALID_HOST`(허용 문자 패턴)·`LICENSE_FILE`. 오류 메시지에 입력 값을 싣지 않는다.
   - `startApp(opts, extras?): Promise<{ address, close }>` — 부모 env 를 복사해 `AF_MARKET_ADMIN` 을 `--admin` 으로만 결정(없으면 삭제). `--license-file` 은 읽어서 `AF_LICENSE` 로 전달(T-811 연결 자리, TODO). `createServer`+`listenServer` 재사용, scan=core `scanSkillRisk`. listen 실패 시 앱을 닫고 던진다. `close` 는 멱등.
   - `cli.ts` — 시작 시 `AgentForge: http://host:port` 한 줄, SIGINT/SIGTERM 에서 `close()` 후 종료.
4. 계약: 서버 API(design 9.4·10.2)는 변경 없이 사용. 계약 변경 없음.
   - 참고: 루트 package.json 과 앱의 npm 이름이 모두 `agentforge` 라서 `pnpm --filter agentforge` 는 둘 다 선택한다. 앱은 `--filter ./packages/app` 으로 지정한다.
   - Docker: `pnpm --filter ./packages/app --prod deploy --legacy /out` 으로 번들+실행 의존성만 런타임에 복사. `ENTRYPOINT node dist/cli.js`, 환경 변수로 설정. 컨테이너는 `AF_MARKET_ADMIN=1` 로 관리 API 를 켠다.
6. 테스트
   | 기능 | 사례 → 테스트 |
   |---|---|
   | DPL-01 인자 | 기본값, 전체 인자, `--port=`, env 우선순위, help, 잘못된 포트·host·알 수 없는 옵션·값 누락 → `args.test.ts` |
   | DPL-01 기동 | `/`·health 200, `--admin` 없으면 403, 있으면 열림, 부모 env 의 admin 무시, 종료 후 포트 해제, close 멱등, 포트 충돌 거부, 라이선스 파일 env 전달·없음 오류 → `run.test.ts` |
   | DPL-01 패키지 | `npm pack --dry-run` 에 dist/cli.js·dist/web/index.html·assets·dist/catalog 포함, src·test 제외, 번들에 워크스페이스 import 없음, 실행 의존성 3개 → `pack.test.ts`(빌드 후에만 실행) |
   | DPL-01 Docker | `bash -n`·shellcheck, docker 없으면 건너뜀·REQUIRED 면 실패, (docker 있을 때) 폐쇄망 절차 → `airgap-check.sh` |
7. 공통 변경 필요: 없음. `.gitignore`(루트)는 건드리지 않고 `packages/app/.gitignore` 로 `dist/` 를 제외한다.
