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
