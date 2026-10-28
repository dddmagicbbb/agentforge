#!/usr/bin/env bats
# T-308 / RUN-01: scripts/setup.sh — 새 폴더, 두 번 실행, CRLF, 도구 누락

load helpers

setup() {
  isolate_git; make_fake_bin
  W="$BATS_TEST_TMPDIR/proj"; copy_golden g3-claude-only "$W"; cd "$W" || exit 1
}

@test "새 폴더: 실행 권한·env.local(600)·첫 커밋" {
  need_tools git tmux jq
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [ -x scripts/run-agents.sh ]
  [ -x .claude/hooks/guard-paths.sh ]
  # 권한 문자열로 확인(stat -c 는 GNU 전용이라 ls -l 사용): 소유자만 읽기·쓰기 = 600
  [ "$(ls -l .agentforge/env.local | cut -c1-10)" = "-rw-------" ]
  [ "$(git rev-list --count HEAD)" -eq 1 ]
  # env.local 은 커밋 대상이 아니다
  if git ls-files --error-unmatch .agentforge/env.local >/dev/null 2>&1; then echo "env.local 이 추적됨"; return 1; fi
}

@test "두 번 실행해도 커밋·env.local 이 늘거나 바뀌지 않는다" {
  need_tools git tmux jq
  bash scripts/setup.sh
  echo "OPENROUTER_API_KEY=keep" >> .agentforge/env.local
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [ "$(git rev-list --count HEAD)" -eq 1 ]
  grep -q "OPENROUTER_API_KEY=keep" .agentforge/env.local
}

@test "CRLF 로 바뀐 스크립트를 LF 로 되돌린다" {
  need_tools git tmux jq
  # 줄마다 CR 을 붙인다(sed -i 는 GNU/BSD 문법이 달라 awk + mv 로 이식성 확보)
  local f
  for f in scripts/run-role.sh .claude/hooks/guard-paths.sh; do
    awk '{ printf "%s\r\n", $0 }' "$f" > "$f.tmp"
    mv "$f.tmp" "$f"
  done
  grep -q $'\r' scripts/run-role.sh
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  not_in_file $'\r' scripts/run-role.sh
  not_in_file $'\r' .claude/hooks/guard-paths.sh
  # CR 제거 뒤에도 실행 권한이 있어야 한다(tr + mv 는 권한을 잃으므로 chmod +x 확인)
  [ -x scripts/run-role.sh ]
  [ -x .claude/hooks/guard-paths.sh ]
}

@test "필요 도구가 없으면 설치 안내 후 실패한다" {
  rm "$FAKE_BIN/claude"
  PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v "$FAKE_BIN" | while read -r d; do [ -x "$d/claude" ] || printf '%s:' "$d"; done)"
  run bash scripts/setup.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"필요 도구 없음: claude"* ]]
}
