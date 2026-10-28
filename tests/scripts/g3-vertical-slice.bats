#!/usr/bin/env bats
# G3: 받은 ZIP → setup.sh → create-worktrees.sh → run-agents.sh → 신호 1건이 review pane 에 전달(가짜 claude)

load helpers

setup() {
  need_tools git tmux jq unzip node; need_build
  isolate_git; make_fake_bin; tmux_sandbox
}

teardown() {
  tmux_cleanup
}

@test "ZIP → setup → worktree → run-agents → design-1.done 이 review-1 pane 에 도착" {
  unpack_project
  # EXP-01: ZIP 에서 풀자마자 실행 권한이 있어야 한다
  # (&& 로 이은 검사는 앞쪽이 실패해도 set -e 가 잡지 못하므로 한 줄에 하나씩 쓴다)
  [ -x scripts/setup.sh ]
  [ -x scripts/run-agents.sh ]
  [ ! -x README.md ]

  bootstrap_project

  run bash scripts/run-agents.sh
  [ "$status" -eq 0 ]
  wait_for 20 "review-2 start --agent review-2" "$FAKE_CLAUDE_LOG"
  grep -q "dev-1 start --agent dev-1 docs/tasks.md 의 dev-1 작업을 시작하세요" "$FAKE_CLAUDE_LOG"

  touch .agentforge/signals/design-1.done
  wait_for 30 "review-1 got: 설계 검토: docs/design/detail/dev-1.md" "$FAKE_CLAUDE_LOG"
  # 신호는 소비되어 이력으로 남고, 다른 pane 에는 전달되지 않는다
  [ ! -f .agentforge/signals/design-1.done ]
  not_in_file "review-2 got:" "$FAKE_CLAUDE_LOG"
}
