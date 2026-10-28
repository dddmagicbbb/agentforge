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
