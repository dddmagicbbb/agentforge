#!/usr/bin/env bash
# scripts/run-agents.sh : 개발자마다 tmux 창 1개(왼쪽 dev-i, 오른쪽 review-i) + 감시 창을 띄운다.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
name="$(basename "$root")"
n="$(jq -r '.developers' .agentforge/forge.config.json)"
sig="$root/.agentforge/signals"; panes="$root/.agentforge/panes"
mkdir -p "$sig" "$panes"

if tmux has-session -t "$name" 2>/dev/null; then
  echo "tmux 세션 '$name' 이 이미 있습니다. 붙기: tmux attach -t $name" >&2; exit 1
fi

# 한 pane 에서 실행할 명령을 만든다: 제공자 설정 → 범위 변수 → claude --agent
launch() {  # launch <에이전트> <작업폴더> [첫 프롬프트]
  local a="$1" dir="$2" prompt="${3:-}" cmd
  cmd="cd $(printf '%q' "$dir") && source $(printf '%q' "$root/scripts/agent-env.sh") $a"
  cmd+=" && export AF_AGENT=$a AF_SIGNALS=$(printf '%q' "$sig")"
  cmd+=" && claude --agent $a"
  [ -n "$prompt" ] && cmd+=" $(printf '%q' "$prompt")"
  printf '%s' "$cmd"
}

tmux new-session -d -s "$name" -n watch -c "$root"
for i in $(seq 1 "$n"); do
  wt="$(cd "$root/.." && pwd)/$name-dev$i"
  [ -d "$wt" ] || { echo "worktree 없음: $wt (create-worktrees.sh 먼저)" >&2; exit 1; }
  left="$(tmux new-window -d -P -F '#{pane_id}' -t "$name" -n "dev$i" -c "$wt")"
  right="$(tmux split-window -d -h -P -F '#{pane_id}' -t "$left" -c "$wt")"
  echo "$left"  > "$panes/dev-$i"
  echo "$right" > "$panes/review-$i"
  tmux send-keys -t "$left"  "$(launch "dev-$i" "$wt" "docs/tasks.md 의 dev-$i 작업을 시작하세요. 먼저 상세 설계만 작성하고 design-$i.done 신호를 만든 뒤 멈추세요.")" Enter
  tmux send-keys -t "$right" "$(launch "review-$i" "$wt")" Enter
done
tmux send-keys -t "$name:watch" "bash scripts/wait-and-review.sh" Enter
echo "실행됨. 붙기: tmux attach -t $name   (창 이동: Ctrl-b 숫자)"
