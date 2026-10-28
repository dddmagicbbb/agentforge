#!/usr/bin/env bats
# T-308 / RUN-01: scripts/setup.sh — 새 폴더, 두 번 실행, CRLF, 도구 누락

load helpers

setup() {
  isolate_git; make_fake_bin
  W="$BATS_TEST_TMPDIR/proj"; copy_golden g3-claude-only "$W"; cd "$W" || exit 1
}

@test "새 폴더: 실행 권한·env.local(600)·첫 커밋" {
  need_tools git tmux jq; skip_on_bsd_sed
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [ -x scripts/run-agents.sh ] && [ -x .claude/hooks/guard-paths.sh ]
  [ "$(stat -c %a .agentforge/env.local)" = "600" ]
  [ "$(git rev-list --count HEAD)" -eq 1 ]
  git ls-files --error-unmatch .agentforge/env.local 2>/dev/null && false || true
}

@test "두 번 실행해도 커밋·env.local 이 늘거나 바뀌지 않는다" {
  need_tools git tmux jq; skip_on_bsd_sed
  bash scripts/setup.sh
  echo "OPENROUTER_API_KEY=keep" >> .agentforge/env.local
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [ "$(git rev-list --count HEAD)" -eq 1 ]
  grep -q "OPENROUTER_API_KEY=keep" .agentforge/env.local
}

@test "CRLF 로 바뀐 스크립트를 LF 로 되돌린다" {
  need_tools git tmux jq; skip_on_bsd_sed
  sed -i 's/$/\r/' scripts/run-role.sh .claude/hooks/guard-paths.sh
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  ! grep -q $'\r' scripts/run-role.sh
  ! grep -q $'\r' .claude/hooks/guard-paths.sh
}

@test "필요 도구가 없으면 설치 안내 후 실패한다" {
  rm "$FAKE_BIN/claude"
  PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v "$FAKE_BIN" | while read -r d; do [ -x "$d/claude" ] || printf '%s:' "$d"; done)"
  run bash scripts/setup.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"필요 도구 없음: claude"* ]]
}
