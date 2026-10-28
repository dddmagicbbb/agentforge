# PH4 3라운드 review-1: T-403, T-404 (ADR-0004)

- 대상: 통합 브랜치 `integration/ph4-r3` 67c93c6(detached) 중 dev-1 커밋 667cfdf(T-404), 14d5bb9(T-403). dev-2 bats(65f1a8d·7e9247b·ca9f256)와 리드 수정 67c93c6은 판정 대상에서 뺐다.
- 기준: `docs/adr/0004-static-script-fixes.md` 결정 1~8, `docs/tasks.md` T-403·T-404, project-rules 보안 규칙.

## 1. 직접 실행
| 명령 | 결과 |
| --- | --- |
| `pnpm install` / `pnpm gen:templates` | 정상 / 26개 |
| `pnpm --filter @agentforge/core test` | 9 파일, 279 통과, 실패 0 |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | 모두 exit 0 |
| `pnpm check:poc-static` | exit 0. 의도적 차이 6개(setup·guard-paths·integrate·wait-and-review·check-forge·forge-agents.md) 외 PoC 원본 일치 |
| `bash tests/scripts/run.sh` | bash -n 전부 통과. 로컬(Git Bash·WSL)에 shellcheck·bats·jq가 없어 이 둘은 건너뜀 → CI(PR #2, run 40720492418) ubuntu·macOS bats 39/39, skip 0을 근거로 삼음 |
| 추가: guard-paths.sh 직접 시험(WSL bash 5.3, 가짜 jq, 임시 git 저장소) | 아래 2장. **우회 재현됨** |

## 2. guard-paths.sh 보안 점검 (결정 2)
WSL에서 `paths = src/order/, docs/report-dev-1.md`, AF_AGENT=dev-1로 실행한 결과.

| 입력 file_path | 기대 | 결과 |
| --- | --- | --- |
| `src/order/a.ts` | 허용 | exit 0 |
| `src/orders/a.ts` | 차단 | exit 2 |
| `src/order/../../docs/x.md` | 차단 | exit 2 |
| `docs/report-dev-1.md` | 허용 | exit 0 |
| `docs/report-dev-1.md.bak` | 차단 | exit 2 |
| `/etc/passwd` | 차단 | exit 2 |
| `src/order/*/../../../docs/evil.md` | 차단 | **exit 0 (우회)** |
| `src/order/*/../../../../outside.txt` | 차단 | **exit 0 (저장소 밖까지 우회)** |

- 원인: `normalize()`의 `for seg in $1`(20행)은 따옴표 없는 확장이라 IFS 분할 뒤 **pathname expansion(glob)** 이 일어난다. `*` 세그먼트가 hook 프로세스 cwd(저장소 루트)의 항목 여러 개로 펼쳐져 세그먼트 수가 늘고, 뒤따르는 `..`가 그 가짜 세그먼트만 지운다. 예: `/repo/src/order/*/../../../docs/evil.md` → `/repo/src/order/README.md/docs/docs/evil.md`로 정규화돼 `src/order/` 접두어에 걸린다. 실제 쓰기 경로는 `/repo/docs/evil.md`다(Node `path.resolve` 기준). `src/order/*` 디렉터리는 범위 안이므로 에이전트가 먼저 만들 수도 있다. Git Bash와 WSL bash 모두 같은 결과였다.
- 그 밖의 항목은 결정과 일치한다.
  - `.`·`..`·중복 `/` 어휘 정규화, 루트 위 `..`는 `/`에서 멈춤.
  - 저장소 밖은 `inside=0`이 되어 paths 루프를 건너뛰고 차단.
  - jq 부재 fail-closed는 AF_AGENT 검사(7행) 뒤에만 적용.
  - 디렉터리 항목(`/` 끝)은 접두어 비교, 파일 항목은 완전 일치. `src/order/`는 `src/orders/`를 허용하지 않음.
  - 개행이 든 경로는 분할 기준이 `/`라 세그먼트 안에 남고, 정규화 결과가 실제 경로와 같은 방향이다(우회 없음).
- 심볼릭 링크를 따라가지 않는 것은 ADR이 택한 어휘 정규화의 한계다(이전 `realpath -m`은 링크를 해석했다). 반려 사유로 보지 않고 권고로 남긴다.

## 3. 그 밖의 점검
- setup.sh(결정 1): `tr → mv → chmod +x` 순서가 맞다(mv된 임시 파일은 umask 권한이라 chmod가 뒤에 와야 함). `sed -i` 제거됨.
- integrate.sh(결정 5): `merge --abort` 직후 `reset --hard pre-integration`, 안내문이 실제 동작과 일치. 루프 앞 `git status --porcelain` 검사가 있어 reset으로 잃을 작업 트리 변경이 없다.
- wait-and-review.sh(결정 6): `take()`는 없으면 `return 1`(기존 `[ -f ] && mv`와 같은 반환), 있으면 `.<초>`, 충돌하면 `.<초>.<n>`. `count()`의 `-name "$1.*"`가 순번 이름도 세므로 호환된다. `set -e`가 없어 53·69행의 단독 호출도 영향 없음.
- check-forge.sh(결정 4): 7항목이 6항목 뒤, 최종 판정 앞에 추가돼 기존 출력·순서를 보존한다. golden 3종에서 `{{TOKEN}}`이 남는 생성 파일은 forge-agents/SKILL.md 하나뿐이고, 이 파일은 제외 처리됐다(새 생성물이 7항목에 걸리지 않음). `.agentforge/templates/*.md`는 검사 대상 밖이다.
- forge-agents.md(결정 3): 나열한 자리표시 7종이 dev.tpl.md·review.tpl.md의 실제 집합(`N DOMAIN PATHS_INLINE MODEL SKILLS FEATURES UI_READ`)과 같다. `adr0004.test.ts`가 이를 집합 비교로 검증한다. 출처 설명(MODEL·SKILLS·UI_READ)이 ADR 문구와 일치한다.
- intended-diffs(결정 7):
  - `templates` 6건이 실제 변경 템플릿 6개와 일치한다.
  - core dist로 golden 3구성을 직접 비교했다. PoC와 다른 생성 파일은 구성마다 정확히 `guard-paths.sh, forge-agents/SKILL.md, check-forge.sh, integrate.sh, setup.sh, wait-and-review.sh` 6개로, `diffs`(`config: "*"`) 등록과 일치한다. 목록 밖 파일은 바이트가 같다.
  - `golden.test.ts`의 `config === "*"` 처리는 비교만 건너뛰고, 목록 밖 파일의 비교는 유지한다.
- 스냅샷: 14d5bb9의 `.snap` 변경 72줄은 위 6개 파일 × 6구성의 해시 줄뿐이다.

## 4. 지적 사항
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
| --- | --- | --- | --- |
| 반려 | templates/static/guard-paths.sh:20 | `for seg in $1`에서 glob 확장이 일어나 `*`·`?`·`[..]` 세그먼트가 cwd 항목으로 펼쳐진다. `src/order/*/../../../docs/evil.md`, `src/order/*/../../../../outside.txt`가 exit 0으로 통과한다(WSL 재현). 결정 2("`..` 우회 차단")와 보안 규칙(범위 강제) 위반 | 분할 시 glob을 끈다. 예: `IFS=/ read -r -a segs <<< "$1"` 후 `for seg in "${segs[@]}"`(read -a는 glob 확장 안 함, bash 3.2 호환). 또는 스크립트 앞에 `set -f`. bats에 `*`·`?`가 든 `..` 우회 사례(저장소 안·밖 각 1건)를 추가하고 intended-diffs reason 갱신 |
| 권고 | templates/static/guard-paths.sh:13-15 | stdin JSON이 깨져 jq가 실패하면 `file`이 비어 exit 0(fail-open). file_path가 빈 경우도 통과 | jq 종료 코드를 확인해 실패 시 exit 2. 빈 file_path 통과는 의도를 주석으로 남김 |
| 권고 | templates/static/guard-paths.sh:18-29 | 어휘 정규화라 범위 안 심볼릭 링크가 밖을 가리키면 못 막는다(이전 `realpath -m`은 링크 해석) | ADR-0004에 한계로 명시하거나, 존재하는 상위 디렉터리에 `cd -P`/`pwd -P`를 써서 물리 경로로 확인 |
| 권고 | templates/static/setup.sh:15 | `tr ... && mv`는 `&&` 왼쪽이라 `set -e`가 걸리지 않는다. tr이 실패하면 `.af-tmp`가 남고 CRLF가 그대로인 채 진행된다 | `tr ... > "$f.af-tmp" \|\| { echo ...; exit 1; }; mv ...` 로 실패 시 중단 |

## 최종 판정
- 코드 검토(T-403): **통과** — 자리표시 정합, check-forge 7항목, intended-diffs·snapshot 정확
- 코드 검토(T-404): **반려** — guard-paths.sh:20 glob 확장으로 범위 우회(저장소 밖 포함) 재현. 나머지 결정 1·5·6·7은 충족
- 전체: **반려** (반려 1건 수정 + bats 사례 추가 후 재검토)

---

# 재검토: T-404 (1a0c73b, 통합 d747860)

## 1. 직접 실행
| 명령 | 결과 |
| --- | --- |
| `pnpm install` / `pnpm gen:templates` | 정상 / 26개 |
| `pnpm --filter @agentforge/core test` | 9 파일, 282 통과, 실패 0 |
| `pnpm typecheck` / `lint` / `build` | 모두 exit 0 |
| `pnpm check:poc-static` | exit 0 (등록된 의도적 차이 6개 외 일치) |
| `bash tests/scripts/run.sh` | bash -n 전부 통과. 로컬에 shellcheck·bats가 없어 건너뜀 → CI run 40722628452 ubuntu bats 44/44(⑩·⑩-2·⑪·⑫·⑨-2 포함)를 근거로 함. macOS는 재실행 대기 |

- 1a0c73b의 `.snap` 변경 24줄 = guard-paths.sh·setup.sh 해시 × 6구성뿐. intended-diffs 목록 변동 없음(같은 6파일).

## 2. 우회 재현 (1차와 같은 방식: WSL bash 5.3, 임시 git 저장소, 가짜 jq, paths = `src/order/`, `docs/report-dev-1.md`)
| 입력 file_path | 기대 | 결과 |
| --- | --- | --- |
| `src/order/a.ts`, 절대 경로, `./src/order/a.ts`, `src//order/./a.ts` | 허용 | exit 0 |
| `src/order/a b.ts`, 탭 포함, `src/order/$(id)/x` | 허용(범위 안) | exit 0 |
| `<root>/../repo/src/order/a.ts` | 허용 | exit 0 |
| `src/orders/a.ts`, `src/order`(끝 `/` 없음) | 차단 | exit 2 |
| `src/order/../../docs/x.md`, `/etc/passwd`, `<root>/../repoX/...` | 차단 | exit 2 |
| `docs/report-dev-1.md` / `docs/report-dev-1.md.bak` | 허용 / 차단 | exit 0 / exit 2 |
| **`src/order/*/../../../docs/evil.md`** (1차 우회) | 차단 | **exit 2** |
| **`src/order/*/../../../../outside.txt`** (1차 우회) | 차단 | **exit 2** |
| `?`, `[a-z]*`, `.*`, `{a,b,c}`, `~` 세그먼트 + `..` | 차단 | exit 2 |
| `src/order/x⏎/../../../docs/y` (중간 개행) | 차단 | exit 2 |
| `src/order/a.ts⏎` (끝 개행) | 허용(범위 안) | exit 0 |
| `docs/report-dev-1.md⏎` (끝 개행) | 차단이 이상적 | exit 0 (아래 권고 2) |
| `src/order/..`, `src/order/x/../..` | 차단이 이상적 | exit 0 (아래 권고 1) |

- glob 우회는 `set -f`(6행)와 `read -a`(23행)로 이중으로 막혔다. 1차 반려 사유는 해소됐다.
- here-string 끝 개행: `read -r -d ''`는 NUL까지 읽으므로 `<<<`가 붙인 `\n`이 **마지막 세그먼트에 남는다**. `normalize /r/a/b/..`의 실제 출력 바이트가 `/r/a/b/..\n`이었다(od 확인).
  - 일반 경로: `$(normalize ...)`가 끝 개행을 지우므로 루트 비교·파일 완전 일치에 영향이 없다. 위 표의 허용·차단과 CI의 "범위 안 허용"·⑧이 이를 뒷받침한다.
  - 마지막 세그먼트가 `..`·`.`이면 `"..\n"`이 이름으로 취급돼 처리되지 않는다. 그래서 `src/order/..`(실제 `src/`)가 허용된다. 이런 경로는 항상 디렉터리를 가리켜 Write·Edit가 실패하므로(EISDIR) 파일을 쓰는 우회는 아니다. 그래서 반려가 아니라 권고로 둔다.
- 깨진 JSON: `file=… && cwd=… || exit 2`. jq 실패 시 차단(⑫, ubuntu CI 통과).
- setup.sh: `tr … || { echo; exit 1; }` 뒤에 `mv`(set -e 적용)를 두어 1차 권고 4가 반영됐다.

## 3. 남은 지적
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
| --- | --- | --- | --- |
| 권고 | templates/static/guard-paths.sh:23 | here-string 끝 개행이 마지막 세그먼트에 남아 끝 `..`·`.`이 정규화되지 않는다(`src/order/..` 허용). 대상이 디렉터리라 쓰기는 실패하므로 실영향은 없지만, 정규화 함수가 부정확하다 | `IFS=/ read -r -d '' -a segs < <(printf '%s' "$1")`로 개행을 붙이지 않거나, 루프 앞에서 `segs[${#segs[@]}-1]="${segs[${#segs[@]}-1]%$'\n'}"`. bats에 `src/order/..` 차단 사례 추가 |
| 권고 | templates/static/guard-paths.sh:15 | `$(jq -r …)`가 file_path 끝의 개행을 지워 `docs/report-dev-1.md⏎`(다른 파일)가 파일 항목 완전 일치로 허용된다. 1차부터 있던 동작이고 영향은 이름 끝에 개행만 붙은 파일 생성뿐이다 | `jq -r '…' ; printf x` 후 `${file%x}`처럼 센티널로 개행을 보존하거나, 제어 문자가 든 경로는 차단 |
| 권고 | (1차 유지) guard-paths.sh 정규화 | 심볼릭 링크를 해석하지 않는 한계 | ADR-0004에 한계로 명시 |

반려 사유(테스트 실패, 범위 밖 변경, 수용 기준 미충족, 우회 가능한 보안 결함)는 없다.

## 최종 판정 (재검토)
- 코드 검토(T-404): **통과** — glob 우회 차단을 직접 재현으로 확인. 남은 것은 권고 3건
- T-403: 1차 통과 유지
- 전체: **통과** (단 macOS CI 재실행 결과 확인을 리드에게 남김)

---

# PH4 5라운드: T-404 보강(권고 1·2), T-405 보강(W3 NAME_INVALID slug)

- 대상: `git diff develop...HEAD`(develop 050e515), 커밋 d30bf0e(T-404), 733924d(T-405).
- 범위: 변경 7파일(`templates/static/guard-paths.sh`, `packages/core/src/checks.ts`, core 시험 2개·스냅샷, `tests/golden/intended-diffs.json` 사유 문구, 상세 설계). 모두 dev-1 담당 안이다. 스냅샷 변경 12줄은 guard-paths.sh 해시 × 6구성뿐이다.

## 1. 직접 실행
| 명령 | 결과 |
| --- | --- |
| `pnpm install` / `pnpm gen:templates` | 정상 / 26개 |
| `pnpm --filter @agentforge/core test` | 9 파일, 285 통과, 실패 0 (normalize bash 실행 시험 포함, skip 없음) |
| `pnpm typecheck` / `lint` / `build` | 모두 exit 0 |
| `pnpm check:poc-static` | exit 0 |
| `bash tests/scripts/run.sh` | bash -n 전부 통과. 로컬(Git Bash·WSL)에 shellcheck·bats 없음 → 건너뜀 |

## 2. guard-paths.sh 재현
- 방식: WSL bash 5.3, 임시 git 저장소, paths = `src/order/`, `docs/report-dev-1.md`, AF_AGENT=dev-1. hook에는 `json.dumps`로 만든 실제 JSON을 stdin으로 넣었다.
- WSL에 **jq 실물이 없어** Python으로 만든 가짜 jq를 썼다. 이 가짜 jq는 JSON을 실제로 파싱하고, 세 필터(`file_path // empty`, `cwd // empty`, `-e … explode | any(. < 32 or . == 127)`)의 의미만 흉내 낸다. 따라서 제어 문자 분기는 **jq 실물의 `explode`·`-e` 종료 코드 동작까지 검증한 것은 아니다**. 실물 검증은 CI bats(dev-2에 사례 요청됨)에 남는다.

| 입력 file_path | 기대 | 결과 |
| --- | --- | --- |
| `src/order/a.ts`, 절대 경로, `./src/order/a.ts`, `src//order/./a.ts`, `a b.ts`, `$(id)/x` | 허용 | exit 0 |
| `docs/report-dev-1.md` | 허용 | exit 0 |
| `src/orders/a.ts`, `docs/report-dev-1.md.bak` | 차단 | exit 2 |
| **`src/order/..`** (권고 1) | 차단 | **exit 2** (rel=`src`) |
| **`src/order/x/../..`** (권고 1) | 차단 | **exit 2** (rel=`src`) |
| `src/order/.`, `src/order/` (디렉터리 자신) | 차단(설계상 범위는 그 아래 파일만) | exit 2 |
| **`docs/report-dev-1.md⏎`** (권고 2) | 차단 | **exit 2** (제어 문자 안내) |
| `src/order/a.ts⏎`, 탭, 중간 개행, DEL(0x7f) | 차단 | exit 2 (제어 문자 안내) |
| `src/order/*/../../../docs/evil.md`, `…/../../../../outside.txt` (3라운드 회귀) | 차단 | exit 2 |
| `/`, `/etc/passwd`, `<root>/../repoX/…` | 차단 | exit 2 |
| 깨진 JSON | 차단 | exit 2 |
| file_path 없음, `""` | 통과(Edit·Write 아님) | exit 0 |
| **`⏎`만, `⏎⏎`만** | 차단이 맞음 | **exit 0** (아래 권고 1) |

- `normalize()` 경계(WSL bash 5.3·Git Bash 5.3, `set -u; set -f`):
  - `read -r -d ''`는 NUL을 만나지 못해 **rc=1이지만 배열은 채워진다**(`/x/y` → 3개, 마지막 `y`, 끝 개행 없음).
  - `""`·`/`·`//` → `/`, `/r/a/b/..` → `/r/a`, `/r/a/b/.`·`/r/a/b/` → `/r/a/b`. set -u 오류 없음.
  - `normalize` 호출부는 `$(…)` 안이고 스크립트에 `set -e`가 없어, read의 rc=1이 흐름에 영향을 주지 않는다.
  - 참고: 빈 배열 `"${segs[@]}"`은 bash 3.2(macOS)의 set -u에서 unbound 오류가 난다. 그러나 `file`과 `root`는 이 시점에 비어 있을 수 없어(앞에서 `[ -z "$file" ]` 통과, root는 git 출력) 실제로는 발생하지 않는다. 혹시 나더라도 `file`이 비어 `inside=0`으로 차단되는 쪽이다.

## 3. T-405 slug
- PoC 222행 `slug()` = `(S.name || "my-project").trim().toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"") || "my-project"`.
- core: `name = str(p.name).trim()` 후 같은 치환과 `|| "my-project"`. 빈 값·공백만 있는 값 모두 `my-project`로 PoC와 결과가 같다. NAME_INVALID 판정식(PoC 446행)도 그대로다.
- `params: { name, slug }`. Issue.params는 임의 키를 허용하므로 계약 변경이 없다. 시험 6건(공백·대문자·특수문자·앞뒤 `-`·한글·빈 값)이 있다. 다만 web `issue.NAME_INVALID` 문구에 `{{slug}}`를 반영하는 일은 dev-3 몫으로 남아 있다.

## 4. 지적 사항
| 판정 | 파일:줄 | 문제 | 고칠 방법 |
| --- | --- | --- | --- |
| 권고 | templates/static/guard-paths.sh:18,21 | 제어 문자 검사(21행)가 `[ -z "$file" ] && exit 0`(18행) 뒤에 있다. file_path가 개행만으로 된 값(`"\n"`, `"\n\n"`)이면 `$(jq -r)`이 전부 지워 빈 값이 되고, 제어 문자 검사 전에 exit 0으로 통과한다. 결과는 cwd에 개행 이름 파일 하나를 만드는 정도이고 임의 경로를 겨눌 수는 없어 실영향은 미미하다. 그래도 이번 커밋의 의도(제어 문자 경로 차단)에 틈이 있다 | 제어 문자 검사를 18행 앞으로 옮기거나, 빈 값 판정을 `jq -e '.tool_input.file_path == null or .tool_input.file_path == ""'`처럼 원시 JSON 기준으로 바꾼다. 상세 설계 3장의 "file 비어 있음 판정 뒤" 문구도 함께 고친다 |
| 권고 | tests/scripts/guard-paths.bats (dev-2) | 제어 문자 분기와 끝 `..` 차단은 core 시험(문자열 단언 + normalize bash 실행)만 있다. jq 실물로 도는 행동 시험이 없다 | 상세 설계 7장대로 dev-2에 bats 사례(끝 개행 파일 항목, 탭, `src/order/..`, 개행만 있는 경로) 추가 요청. CI ubuntu·macOS 통과 확인 |

반려 사유(테스트 실패, 범위 밖 변경, 계약 불일치, 수용 기준 미충족, 실질적 우회)는 없다.

## 최종 판정 (5라운드)
- T-404 보강: **통과** — 권고 1·2 입력 3종 모두 차단 재현, 정상 경로 허용 유지, 3라운드 glob 차단 회귀 없음
- T-405 보강: **통과** — slug가 PoC와 같은 변환
- 남은 권고 2건(개행만 있는 경로, jq 실물 bats)
