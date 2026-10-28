#!/usr/bin/env bats
# DEV-03: templates/static/guard-paths.sh (PreToolUse 훅) 9사례 (⑦~⑨ = ADR-0004)
# 입력은 Claude Code PreToolUse JSON({"cwd":..., "tool_input":{"file_path":...}})을 stdin 으로 준다.

load helpers

setup() {
  need_tools git jq
  isolate_git
  # 임시 저장소: dev-1 은 src/ 와 docs/dev1.md·docs/report-dev-1.md(파일 항목)만 담당
  # (macOS 의 /var → /private/var 심볼릭 링크 차이를 피하려고 물리 경로로 고정)
  R="$(cd "$BATS_TEST_TMPDIR" && pwd -P)/repo"
  mkdir -p "$R/.claude/devs" "$R/src" "$R/other"
  git -C "$R" init -q
  printf '%s\n' '# 주석 줄' 'src/' 'docs/dev1.md  # 끝 주석' 'docs/report-dev-1.md' >"$R/.claude/devs/dev-1.paths"
  GUARD="$REPO/templates/static/guard-paths.sh"
}

# run_guard <cwd> <file_path> : PreToolUse JSON 을 만들어 훅에 전달
run_guard() {
  local json
  json="$(jq -cn --arg cwd "$1" --arg f "$2" '{cwd: $cwd, tool_input: {file_path: $f}}')"
  run bash -c 'printf "%s" "$1" | bash "$2"' _ "$json" "$GUARD"
}

@test "범위 안 파일은 허용(exit 0)" {
  export AF_AGENT=dev-1
  run_guard "$R" "$R/src/app.ts"
  [ "$status" -eq 0 ]
  run_guard "$R" "$R/docs/dev1.md"
  [ "$status" -eq 0 ]
}

@test "범위 밖 파일은 차단(exit 2, 안내 문구)" {
  export AF_AGENT=dev-1
  run_guard "$R" "$R/other/x.ts"
  [ "$status" -eq 2 ]
  [[ "$output" == *"담당 범위 밖 파일입니다: other/x.ts (dev-1)"* ]]
  [[ "$output" == *"report"* ]]
}

@test "상대 경로는 cwd 기준으로 해석" {
  export AF_AGENT=dev-1
  # cwd=src 에서 app.ts → src/app.ts (허용)
  run_guard "$R/src" "app.ts"
  [ "$status" -eq 0 ]
  # cwd=other 에서 app.ts → other/app.ts (차단)
  run_guard "$R/other" "app.ts"
  [ "$status" -eq 2 ]
}

@test "../ 우회는 차단" {
  export AF_AGENT=dev-1
  run_guard "$R" "$R/src/../other/x.ts"
  [ "$status" -eq 2 ]
  run_guard "$R/src" "../other/x.ts"
  [ "$status" -eq 2 ]
  [[ "$output" == *"other/x.ts"* ]]
}

@test "AF_AGENT 가 없으면 통과" {
  unset AF_AGENT
  run_guard "$R" "$R/other/x.ts"
  [ "$status" -eq 0 ]
}

@test "paths 파일이 없으면 차단(exit 2)" {
  export AF_AGENT=dev-9
  run_guard "$R" "$R/src/app.ts"
  [ "$status" -eq 2 ]
  [[ "$output" == *"담당 범위 파일이 없습니다"* ]]
}

# ---------------------------------------------------------------- ADR-0004 (G1·G2·D7b)

# jq 만 없는 PATH 를 만든다: 훅이 쓰는 도구(bash·git·coreutils)만 심볼릭 링크로 모아 둔다
make_nojq_path() {
  NOJQ="$BATS_TEST_TMPDIR/nojq"; mkdir -p "$NOJQ"
  local t src
  for t in bash git cat dirname basename sed tr awk grep mkdir rm head tail sort uname readlink realpath env; do
    src="$(command -v "$t" 2>/dev/null)" || continue
    case "$src" in /*) ln -sf "$src" "$NOJQ/$t";; esac
  done
  [ -z "$(PATH="$NOJQ" command -v jq)" ]   # jq 가 정말 없어야 시험이 의미가 있다
}

# run_guard_nojq <cwd> <file_path> : jq 없는 PATH 에서 훅 실행(JSON 은 jq 없이 직접 만든다)
run_guard_nojq() {
  local json
  json="$(printf '{"cwd":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2")"
  run env PATH="$NOJQ" bash -c 'printf "%s" "$1" | bash "$2"' _ "$json" "$GUARD"
}

@test "⑦ jq 가 없으면 차단(exit 2, 설치 안내) — fail-closed" {
  export AF_AGENT=dev-1
  make_nojq_path
  # 담당 범위 안 파일이어도 검사할 수 없으므로 막는다
  run_guard_nojq "$R" "$R/src/app.ts"
  [ "$status" -eq 2 ]
  [[ "$output" == *"jq 가 없어 담당 범위를 검사할 수 없습니다. 설치 후 다시 실행하세요."* ]]
  # 범위 밖 파일도 같다
  run_guard_nojq "$R" "$R/other/x.ts"
  [ "$status" -eq 2 ]
  [[ "$output" == *"jq 가 없어 담당 범위를 검사할 수 없습니다."* ]]
}

@test "⑦-2 jq 가 없어도 AF_AGENT 가 없으면(리드 세션) 통과" {
  unset AF_AGENT
  make_nojq_path
  run_guard_nojq "$R" "$R/other/x.ts"
  [ "$status" -eq 0 ]
}

@test "⑧ 파일 항목은 완전 일치만 허용(접두어 우회 차단)" {
  export AF_AGENT=dev-1
  run_guard "$R" "$R/docs/report-dev-1.md"
  [ "$status" -eq 0 ]
  run_guard "$R" "$R/docs/report-dev-1.md.bak"
  [ "$status" -eq 2 ]
  [[ "$output" == *"담당 범위 밖 파일입니다: docs/report-dev-1.md.bak (dev-1)"* ]]
  run_guard "$R" "$R/docs/report-dev-1.md/child"
  [ "$status" -eq 2 ]
  # 디렉터리 항목(끝 /)은 접두어 허용, 이름만 같은 형제 폴더는 차단
  run_guard "$R" "$R/src/deep/a.ts"
  [ "$status" -eq 0 ]
  mkdir -p "$R/src2"
  run_guard "$R" "$R/src2/a.ts"
  [ "$status" -eq 2 ]
}

@test "⑨ 저장소 루트 밖 경로는 차단(exit 2)" {
  export AF_AGENT=dev-1
  run_guard "$R" "$R/../../etc/x"
  [ "$status" -eq 2 ]
  run_guard "$R" "../../etc/x"
  [ "$status" -eq 2 ]
  run_guard "$R/src" "../../../etc/x"
  [ "$status" -eq 2 ]
  run_guard "$R" "/etc/x"
  [ "$status" -eq 2 ]
  # 루트와 접두어만 같은 형제 폴더(repo2)도 루트 밖이다
  run_guard "$R" "${R}2/src/a.ts"
  [ "$status" -eq 2 ]
}

# ⑨ 는 옛 훅에서도 exit 2 라 회귀 방지용이다. 아래는 루트 접두어를 `/` 없이 떼는 실수를 잡는다.
@test "⑨-2 루트 접두어를 / 없이 떼면 범위 안으로 오인되는 경로(repo 옆 'reposrc')는 차단" {
  export AF_AGENT=dev-1
  # "${R}src/a.ts" = repo 와 같은 부모의 'reposrc/a.ts' — `${file#"$root"}` 식 정규화면 'src/a.ts' 로 보여 통과해 버린다
  run_guard "$R" "${R}src/a.ts"
  [ "$status" -eq 2 ]
  run_guard "$R" "${R}/src/a.ts"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------- glob 우회·깨진 입력 (review-1 지적)

# run_guard_at_root <cwd> <file_path> : 훅 프로세스의 작업 폴더를 저장소 루트로 하여 실행
# (Claude Code 는 프로젝트 루트에서 hook 을 실행한다. 옛 normalize() 의 따옴표 없는 `for seg in $1` 은
#  프로세스 cwd 기준으로 `*`·`?` 를 펼치므로, 루트에 항목이 여럿 있어야 우회가 재현된다.)
run_guard_at_root() {
  local json
  json="$(jq -cn --arg cwd "$1" --arg f "$2" '{cwd: $cwd, tool_input: {file_path: $f}}')"
  run bash -c 'cd "$3" && printf "%s" "$1" | bash "$2"' _ "$json" "$GUARD" "$R"
}

# glob 이 실제로 펼쳐지도록 루트에 파일·폴더를 여럿 만든다
make_glob_fixture() {
  mkdir -p "$R/src/order/sub" "$R/docs"
  : > "$R/src/order/README.md"
  : > "$R/docs/a.md"
  : > "$R/docs/b.md"
  : > "$R/other/o.txt"
}

@test "⑩ glob(*·?) 로 범위 밖(저장소 안)에 닿는 경로는 차단(exit 2)" {
  export AF_AGENT=dev-1
  make_glob_fixture
  # 옛 구현: `*` 가 루트 항목(docs other src)으로 펼쳐져 `..` 개수가 어긋나 docs/evil.md 가 범위 안으로 오인되어 exit 0
  run_guard_at_root "$R" "src/order/*/../../../docs/evil.md"
  [ "$status" -eq 2 ]
  [[ "$output" == *"담당 범위 밖 파일입니다: docs/evil.md (dev-1)"* ]]
  # 절대 경로로 준 같은 우회
  run_guard_at_root "$R" "$R/src/order/*/../../../docs/evil.md"
  [ "$status" -eq 2 ]
  # `?` 도 같다(한 글자 이름 폴더가 있어야 펼쳐지므로 만든다)
  mkdir -p "$R/src/order/x"
  run_guard_at_root "$R" "src/order/?/../../../docs/evil.md"
  [ "$status" -eq 2 ]
}

@test "⑪ glob 으로 저장소 밖에 닿는 경로는 차단(exit 2)" {
  export AF_AGENT=dev-1
  make_glob_fixture
  run_guard_at_root "$R" "src/order/*/../../../../outside.txt"
  [ "$status" -eq 2 ]
  run_guard_at_root "$R" "$R/src/order/*/../../../../outside.txt"
  [ "$status" -eq 2 ]
}

@test "⑩-2 glob 문자가 든 범위 안 경로는 오탐 없이 허용" {
  export AF_AGENT=dev-1
  make_glob_fixture
  run_guard_at_root "$R" "src/order/*/a.ts"
  [ "$status" -eq 0 ]
}

@test "⑫ 깨진 JSON 입력은 차단(exit 2, 해석 실패 안내) — jq 는 있는 상태" {
  export AF_AGENT=dev-1
  run bash -c 'printf "%s" "{not json" | bash "$1"' _ "$GUARD"
  [ "$status" -eq 2 ]
  [[ "$output" == *"hook 입력을 해석하지 못해 수정을 막았습니다."* ]]
  # 잘린 JSON 도 같다
  run bash -c 'printf "%s" "{\"cwd\":" | bash "$1"' _ "$GUARD"
  [ "$status" -eq 2 ]
}
