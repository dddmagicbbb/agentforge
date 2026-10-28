#!/usr/bin/env bats
# G3: 받은 ZIP → setup.sh → create-worktrees.sh → run-agents.sh → 신호 1건이 review pane 에 전달(가짜 claude)

load helpers

setup() {
  need_tools git tmux jq unzip node; skip_on_bsd_sed
  [ -f "$REPO/packages/core/dist/index.js" ] && [ -f "$REPO/packages/exporter/dist/index.js" ] || skip "pnpm build 먼저"
  isolate_git; make_fake_bin
  # tmux 서버를 시험 전용 소켓 폴더에 띄우고, pane 셸이 프로필로 PATH 를 덮지 않게 한다
  export TMUX_TMPDIR="$BATS_TEST_TMPDIR/tmux"; mkdir -p "$TMUX_TMPDIR"; unset TMUX
  tmux -f /dev/null new-session -d -s keep \; set -g default-command "bash --noprofile --norc"
  cd "$BATS_TEST_TMPDIR" || exit 1
}

teardown() {
  tmux kill-server 2>/dev/null || true
}

@test "ZIP → setup → worktree → run-agents → design-1.done 이 review-1 pane 에 도착" {
  node "$REPO/tools/make-zip.mjs" "$REPO/tests/golden/g3-claude-only/input.json" g3.zip
  unzip -q g3.zip
  cd g3-demo
  # EXP-01: ZIP 에서 풀자마자 실행 권한이 있어야 한다
  [ -x scripts/setup.sh ] && [ -x scripts/run-agents.sh ] && [ ! -x README.md ]

  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  git branch develop
  run bash scripts/create-worktrees.sh
  [ "$status" -eq 0 ]
  [ -d ../g3-demo-dev1 ] && [ -d ../g3-demo-dev2 ]

  run bash scripts/run-agents.sh
  [ "$status" -eq 0 ]
  wait_for 20 "review-2 start --agent review-2" "$FAKE_CLAUDE_LOG"
  grep -q "dev-1 start --agent dev-1 docs/tasks.md 의 dev-1 작업을 시작하세요" "$FAKE_CLAUDE_LOG"

  touch .agentforge/signals/design-1.done
  wait_for 30 "review-1 got: 설계 검토: docs/design/detail/dev-1.md" "$FAKE_CLAUDE_LOG"
  # 신호는 소비되어 이력으로 남고, 다른 pane 에는 전달되지 않는다
  [ ! -f .agentforge/signals/design-1.done ]
  ! grep -q "review-2 got:" "$FAKE_CLAUDE_LOG"
}
