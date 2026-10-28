#!/usr/bin/env bats
# DEV-03: templates/static/guard-paths.sh (PreToolUse 훅) 6사례
# 입력은 Claude Code PreToolUse JSON({"cwd":..., "tool_input":{"file_path":...}})을 stdin 으로 준다.

load helpers

setup() {
  need_tools git jq; skip_on_no_realpath_m
  isolate_git
  # 임시 저장소: dev-1 은 src/ 와 docs/dev1.md 만 담당
  # (macOS 의 /var → /private/var 심볼릭 링크 차이를 피하려고 물리 경로로 고정)
  R="$(cd "$BATS_TEST_TMPDIR" && pwd -P)/repo"
  mkdir -p "$R/.claude/devs" "$R/src" "$R/other"
  git -C "$R" init -q
  printf '%s\n' '# 주석 줄' 'src/' 'docs/dev1.md  # 끝 주석' > "$R/.claude/devs/dev-1.paths"
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
