#!/usr/bin/env bash
# scripts/run-agents.sh : 개발자별 dev-i·review-i 를 tmux 로 띄운다. 배치(pair·grid·role)·접두키·마우스·로그는 forge.config.json 이 정한다.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
name="$(basename "$root")"
cfg=.agentforge/forge.config.json
n="$(jq -r '.developers' "$cfg")"
layout="$(jq -r '.tmuxLayout // "pair"' "$cfg")"
prefix="$(jq -r '.tmux.prefix // "C-b"' "$cfg")"
mouse="$(jq -r '.tmux.mouse // false' "$cfg")"
logs="$(jq -r '.tmux.logs // false' "$cfg")"
sig="$root/.agentforge/signals"; panes="$root/.agentforge/panes"; logdir="$root/.agentforge/logs"
mkdir -p "$sig" "$panes"

case "$layout" in pair|grid|role) ;; *) echo "알 수 없는 tmuxLayout: $layout (pair·grid·role)" >&2; exit 1 ;; esac
case "$prefix" in C-[a-z]) ;; *) echo "tmux prefix 형식 오류: $prefix (예: C-b)" >&2; exit 1 ;; esac

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

wtof() { printf '%s' "$(cd "$root/.." && pwd)/$name-dev$1"; }  # 개발자 i 의 worktree 경로

# pane 하나를 등록한다: pane id 기록(wait-and-review.sh 가 읽음) → 로그 연결 → 에이전트 실행
setup_pane() {  # setup_pane <pane id> <에이전트> <worktree>
  local pane="$1" a="$2" wt="$3" prompt=""
  echo "$pane" > "$panes/$a"
  if [ "$logs" = true ]; then
    tmux pipe-pane -o -t "$pane" "cat >> $(printf '%q' "$logdir/$a.log")"
  fi
  case "$a" in dev-*) prompt="docs/tasks.md 의 $a 작업을 시작하세요. 먼저 상세 설계만 작성하고 design-${a#dev-}.done 신호를 만든 뒤 멈추세요." ;; esac
  tmux send-keys -t "$pane" "$(launch "$a" "$wt" "$prompt")" Enter
}

# grid·role: 창이 없으면 만들고, 있으면 pane 을 나눈 뒤 tiled 로 정렬한다
tiled_pane() {  # tiled_pane <창 이름> <에이전트> <worktree>
  local win="$1" a="$2" wt="$3" id wins
  wins="$(tmux list-windows -t "$name" -F '#{window_name}')"
  if grep -qx "$win" <<<"$wins"; then
    id="$(tmux split-window -d -P -F '#{pane_id}' -t "$name:$win" -c "$wt")"
    tmux select-layout -t "$name:$win" tiled
  else
    id="$(tmux new-window -d -P -F '#{pane_id}' -t "$name" -n "$win" -c "$wt")"
  fi
  setup_pane "$id" "$a" "$wt"
}

for i in $(seq 1 "$n"); do
  [ -d "$(wtof "$i")" ] || { echo "worktree 없음: $(wtof "$i") (create-worktrees.sh 먼저)" >&2; exit 1; }
done
[ "$logs" = true ] && mkdir -p "$logdir"

tmux new-session -d -s "$name" -n watch -c "$root"
# 접두키·마우스는 이 세션에만 적용한다(전역 설정은 바꾸지 않는다)
if [ "$prefix" != "C-b" ]; then tmux set -t "$name" prefix "$prefix"; fi
if [ "$mouse" = true ]; then tmux set -t "$name" mouse on; fi

case "$layout" in
  pair)
    for i in $(seq 1 "$n"); do
      wt="$(wtof "$i")"
      left="$(tmux new-window -d -P -F '#{pane_id}' -t "$name" -n "dev$i" -c "$wt")"
      right="$(tmux split-window -d -h -P -F '#{pane_id}' -t "$left" -c "$wt")"
      setup_pane "$left" "dev-$i" "$wt"
      setup_pane "$right" "review-$i" "$wt"
    done ;;
  grid)
    for i in $(seq 1 "$n"); do
      tiled_pane agents "dev-$i" "$(wtof "$i")"
      tiled_pane agents "review-$i" "$(wtof "$i")"
    done ;;
  role)
    for i in $(seq 1 "$n"); do tiled_pane dev "dev-$i" "$(wtof "$i")"; done
    for i in $(seq 1 "$n"); do tiled_pane review "review-$i" "$(wtof "$i")"; done ;;
esac
tmux send-keys -t "$name:watch" "bash scripts/wait-and-review.sh" Enter
echo "실행됨. 붙기: tmux attach -t $name   (창 이동: Ctrl-${prefix#C-} 숫자)"
