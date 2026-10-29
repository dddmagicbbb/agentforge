#!/usr/bin/env bats
# T-612 / RUN-04 (design.md 8.2): tmux 배치(pair·grid·role)·접두키·마우스·로그
# g3-claude-only 입력(개발자 2명)에 tmux 설정을 jq 로 주입해 ZIP → setup → develop → create-worktrees → run-agents.
# 문구가 아니라 동작(창·pane·tmux 옵션·파일)을 단언한다. wait-and-review.sh 는 10초 간격 폴링이다.

load helpers

SESSION="g3-demo"

setup() {
  need_tools git tmux jq unzip node; need_build
  isolate_git; make_fake_bin; tmux_sandbox
}

teardown() {
  tmux_cleanup
}

# tmux 설정을 넣은 g3 프로젝트를 풀고 worktree 까지 만든다: prepare <layout|-> [prefix] [mouse] [logs]
#   layout 이 '-' 이면 tmux 키를 넣지 않는다(미지정 = 기본 구성)
prepare() {
  local layout="$1" prefix="${2:-C-b}" mouse="${3:-false}" logs="${4:-false}"
  mkdir -p "${BASE:-$BATS_TEST_TMPDIR}" && cd "${BASE:-$BATS_TEST_TMPDIR}" || return 1
  if [ "$layout" = "-" ]; then
    cp "$REPO/tests/golden/g3-claude-only/input.json" in.json
  else
    jq --arg l "$layout" --arg p "$prefix" --argjson m "$mouse" --argjson g "$logs" \
      '.tmux = {layout: $l, prefix: $p, mouse: $m, logs: $g}' \
      "$REPO/tests/golden/g3-claude-only/input.json" > in.json
  fi
  node "$REPO/tools/make-zip.mjs" in.json g3.zip
  unzip -q g3.zip
  cd g3-demo || return 1
  bootstrap_project
  P="$PWD"; SIG="$P/.agentforge/signals"; PANES="$P/.agentforge/panes"; LOG="$FAKE_CLAUDE_LOG"
}

# run-agents.sh 실행 후 에이전트 4개(dev-1·review-1·dev-2·review-2)가 모두 기동하기를 기다린다
start_all() {
  run bash scripts/run-agents.sh
  [ "$status" -eq 0 ]
  local a
  for a in dev-1 review-1 dev-2 review-2; do wait_for 20 "$a start --agent $a" "$LOG"; done
}

# 창 이름 목록(정렬): 예 "agents watch"
window_names() {
  tmux list-windows -t "$SESSION" -F '#{window_name}' | sort | tr '\n' ' ' | sed 's/ $//'
}

# 창의 pane 수
pane_count() {  # pane_count <창 이름>
  tmux list-panes -t "$SESSION:$1" | wc -l | tr -d ' '
}

# .agentforge/panes/<에이전트> 가 실제 pane id 이고 기대한 창에 속하는지: pane_in <에이전트> <창 이름>
pane_in() {
  local id; id="$(cat "$PANES/$1")"
  [[ "$id" =~ ^%[0-9]+$ ]] || { echo "pane id 형식 아님: $1 = '$id'"; return 1; }
  local w; w="$(tmux display-message -p -t "$id" '#{window_name}')" || { echo "없는 pane: $1 = $id"; return 1; }
  [ "$w" = "$2" ] || { echo "$1 의 창이 '$w' ($2 기대)"; return 1; }
}

# 창의 pane 순서가 주어진 에이전트 순서와 같은지(panes 파일의 id 와 list-panes 순서 대조): pane_order <창> <에이전트...>
pane_order() {
  local w="$1"; shift
  local want="" a; for a in "$@"; do want+="$(cat "$PANES/$a") "; done
  local got; got="$(tmux list-panes -t "$SESSION:$w" -F '#{pane_id}' | tr '
' ' ')"
  [ "$got" = "$want" ] || { echo "pane 순서 불일치($w): 실제 [$got] 기대 [$want]"; return 1; }
}

# 설계 완료 신호가 review-1 pane 으로만 전달되는지(panes 파일이 유효하다는 동작 증명)
design_signal_reaches_review_1() {
  touch "$SIG/design-1.done"
  wait_for 40 "review-1 got:" "$LOG"
  not_in_file "review-2 got:" "$LOG"
  not_in_file "dev-1 got:" "$LOG"
}

# ---------------------------------------------------------------- 기본(pair)

@test "8.2 pair(tmux 미지정): config 는 tmuxLayout pair 만, 창 watch·dev1·dev2 에 창당 2 pane" {
  prepare -
  [ "$(jq -r '.tmuxLayout' .agentforge/forge.config.json)" = "pair" ]
  [ "$(jq 'has("tmux")' .agentforge/forge.config.json)" = "false" ]
  start_all
  [ "$(window_names)" = "dev1 dev2 watch" ]
  [ "$(pane_count dev1)" -eq 2 ]
  [ "$(pane_count dev2)" -eq 2 ]
  pane_in dev-1 dev1
  pane_in review-1 dev1
  pane_in dev-2 dev2
  pane_in review-2 dev2
  design_signal_reaches_review_1
}

# ---------------------------------------------------------------- grid / role

@test "8.2 grid: config 에 tmuxLayout·tmux 기록, 창 watch·agents, agents 에 pane 4개, 신호는 review-1 로" {
  prepare grid
  [ "$(jq -r '.tmuxLayout' .agentforge/forge.config.json)" = "grid" ]
  [ "$(jq -r '.tmux.prefix' .agentforge/forge.config.json)" = "C-b" ]
  start_all
  [ "$(window_names)" = "agents watch" ]
  [ "$(pane_count agents)" -eq 4 ]
  local a; for a in dev-1 review-1 dev-2 review-2; do pane_in "$a" agents; done
  # 서로 다른 pane 4개
  [ "$(cat "$PANES"/dev-1 "$PANES"/review-1 "$PANES"/dev-2 "$PANES"/review-2 | sort -u | wc -l | tr -d ' ')" -eq 4 ]
  pane_order agents dev-1 review-1 dev-2 review-2
  design_signal_reaches_review_1
}

@test "8.2 role: 창 watch·dev·review, 각 2 pane, dev-i 는 dev 창·review-i 는 review 창, 신호는 review-1 로" {
  prepare role
  [ "$(jq -r '.tmuxLayout' .agentforge/forge.config.json)" = "role" ]
  start_all
  [ "$(window_names)" = "dev review watch" ]
  [ "$(pane_count dev)" -eq 2 ]
  [ "$(pane_count review)" -eq 2 ]
  pane_in dev-1 dev
  pane_in dev-2 dev
  pane_in review-1 review
  pane_in review-2 review
  pane_order dev dev-1 dev-2
  pane_order review review-1 review-2
  design_signal_reaches_review_1
}

# ---------------------------------------------------------------- 접두키·마우스(세션 범위)

@test "8.2 prefix·mouse: 세션 범위에만 적용되고 전역 옵션은 바뀌지 않는다" {
  prepare grid C-a true false
  start_all
  [ "$(tmux show-options -t "$SESSION" prefix)" = "prefix C-a" ]
  [ "$(tmux show-options -t "$SESSION" mouse)" = "mouse on" ]
  # 전역(-g)은 기본값 그대로
  [ "$(tmux show-options -g prefix)" = "prefix C-b" ]
  [ "$(tmux show-options -g mouse)" = "mouse off" ]
  # 안내 문구에 실제 접두키가 쓰이고 기본 접두키 표기는 남지 않는다
  [[ "$output" != *"Ctrl-b"* ]]
  [[ "$output" == *"C-a"* ]]
}

@test "8.2 기본값(C-b·mouse false·logs false): 세션 옵션을 건드리지 않고 로그 관련 산출물이 없다" {
  prepare role C-b false false
  start_all
  [ "$(window_names)" = "dev review watch" ]
  [ -z "$(tmux show-options -t "$SESSION" prefix)" ]
  [ -z "$(tmux show-options -t "$SESSION" mouse)" ]
  [ ! -e .agentforge/logs ]
  not_in_file ".agentforge/logs/" .gitignore
}

# ---------------------------------------------------------------- 로그

@test "8.2 logs=true: pane 마다 .agentforge/logs/<에이전트>.log 가 생기고 .gitignore 에 폴더가 있다" {
  prepare grid C-b false true
  start_all
  local a; for a in dev-1 review-1 dev-2 review-2; do wait_file 20 ".agentforge/logs/$a.log"; done
  grep -qx ".agentforge/logs/" .gitignore
  # 로그 폴더는 git 추적 대상에서 제외된다
  git check-ignore -q .agentforge/logs/dev-1.log
}

@test "8.2 pair + prefix·mouse: 배치는 pair 그대로이고 옵션은 세션 범위에만 적용된다(배치·옵션 분기 독립)" {
  prepare pair C-a true false
  [ "$(jq -r '.tmuxLayout' .agentforge/forge.config.json)" = "pair" ]
  start_all
  [ "$(window_names)" = "dev1 dev2 watch" ]
  [ "$(pane_count dev1)" -eq 2 ]
  [ "$(pane_count dev2)" -eq 2 ]
  pane_in dev-1 dev1
  pane_in review-1 dev1
  pane_in dev-2 dev2
  pane_in review-2 dev2
  [ "$(tmux show-options -t "$SESSION" prefix)" = "prefix C-a" ]
  [ "$(tmux show-options -t "$SESSION" mouse)" = "mouse on" ]
  [ "$(tmux show-options -g prefix)" = "prefix C-b" ]
  [ "$(tmux show-options -g mouse)" = "mouse off" ]
  design_signal_reaches_review_1
}

@test "8.2 logs=true + 상위 폴더에 한글·공백, LC_ALL=C: 모든 에이전트의 로그 파일이 생긴다(경로 인용)" {
  BASE="$BATS_TEST_TMPDIR/프로 젝트"
  prepare grid C-b false true
  export LC_ALL=C
  start_all
  local a; for a in dev-1 review-1 dev-2 review-2; do wait_file 20 "$P/.agentforge/logs/$a.log"; done
  grep -qx ".agentforge/logs/" .gitignore
}
