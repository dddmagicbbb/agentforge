#!/usr/bin/env bats
# ADR-0009: signal.sh(자기 번호·역할 신호만), sync-dev.sh(통과한 dev-i → develop → feature/devj), wait 신호 안내
# 생성 ZIP(g3-claude-only, 개발자 2명: dev-1 src/alpha/, dev-2 src/beta/)을 풀어 실제 생성물로 시험한다.

load helpers

setup() {
  need_tools git jq unzip node; need_build
  isolate_git; make_fake_bin
  unpack_project; bootstrap_project
  P="$PWD"; SIG="$P/.agentforge/signals"; mkdir -p "$SIG"
  WT1="$BATS_TEST_TMPDIR/g3-demo-dev1"; WT2="$BATS_TEST_TMPDIR/g3-demo-dev2"
}

teardown() {
  tmux_cleanup
}

sig_as() {  # sig_as <에이전트> <신호> : 해당 에이전트 환경으로 worktree 에서 signal.sh 실행
  local wt="$WT1"; case "$1" in *-2) wt="$WT2" ;; esac
  run env AF_AGENT="$1" AF_SIGNALS="$SIG" bash -c 'cd "$1" && bash scripts/signal.sh "$2"' _ "$wt" "$2"
}

# ---------------------------------------------------------------- signal.sh

@test "signal.sh: dev-1 은 자기 설계·완료·대기 신호를 만든다" {
  for s in design-1.done dev-1.done dev-1.wait-2; do
    sig_as dev-1 "$s"
    [ "$status" -eq 0 ]
    [ -f "$SIG/$s" ]
  done
}

@test "signal.sh: review-1 은 자기 판정 신호만 만든다" {
  for s in design-1.pass design-1.reject review-1.pass review-1.reject; do
    sig_as review-1 "$s"
    [ "$status" -eq 0 ]
    [ -f "$SIG/$s" ]
  done
}

@test "signal.sh: 남의 번호·역할, 자기 자신 대기, 경로 조작은 거부(exit 2)하고 파일을 만들지 않는다" {
  for c in "dev-1 review-1.pass" "dev-1 design-2.done" "dev-1 dev-1.wait-1" "dev-1 ../dev-1.done" "dev-1 dev-1.done/x" \
           "review-1 dev-1.done" "review-1 review-2.pass" "review-2 design-1.pass" "dev-1 dev-1.passed" "dev-1 review-1.passed"; do
    read -r a s <<<"$c"
    sig_as "$a" "$s"
    [ "$status" -eq 2 ] || { echo "통과하면 안 됨: $c ($status) $output"; return 1; }
  done
  [ -z "$(ls -A "$SIG")" ]
}

@test "signal.sh: AF_AGENT·AF_SIGNALS 가 없거나 인자 수가 틀리면 exit 2" {
  run bash -c 'cd "$1" && env -u AF_AGENT -u AF_SIGNALS bash scripts/signal.sh dev-1.done' _ "$WT1"
  [ "$status" -eq 2 ]
  run env AF_AGENT=dev-1 AF_SIGNALS="$SIG" bash -c 'cd "$1" && bash scripts/signal.sh' _ "$WT1"
  [ "$status" -eq 2 ]
  run env AF_AGENT=dev-1 AF_SIGNALS="$SIG" bash -c 'cd "$1" && bash scripts/signal.sh dev-1.done extra' _ "$WT1"
  [ "$status" -eq 2 ]
  run env AF_AGENT=planner AF_SIGNALS="$SIG" bash -c 'cd "$1" && bash scripts/signal.sh dev-1.done' _ "$WT1"
  [ "$status" -eq 2 ]
  [ -z "$(ls -A "$SIG")" ]
}

# ---------------------------------------------------------------- sync-dev.sh

@test "sync-dev.sh: dev-1 이 통과 전이면 거부하고 아무것도 병합하지 않는다" {
  git checkout -q develop
  commit_in "$WT1" src/alpha/a.ts "export const a = 1;"
  before="$(git rev-parse develop)"
  run bash scripts/sync-dev.sh 1 2
  [ "$status" -eq 1 ]
  [ "$(git rev-parse develop)" = "$before" ]
}

@test "sync-dev.sh: 인자 오류(같은 번호·숫자 아님·범위 밖)는 exit 2" {
  git checkout -q develop
  for a in "1 1" "x 2" "1" "1 9"; do
    run bash scripts/sync-dev.sh $a
    [ "$status" -eq 2 ] || { echo "인자 '$a' → $status $output"; return 1; }
  done
}

@test "sync-dev.sh: dev-2 worktree 에 미커밋 변경이 있으면 develop 을 바꾸지 않는다" {
  git checkout -q develop
  commit_in "$WT1" src/alpha/a.ts "export const a = 1;"
  touch "$SIG/review-1.passed"
  mkdir -p "$WT2/src/beta"; echo wip > "$WT2/src/beta/wip.txt"; git -C "$WT2" add src/beta/wip.txt
  before="$(git rev-parse develop)"
  run bash scripts/sync-dev.sh 1 2
  [ "$status" -eq 1 ]
  [ "$(git rev-parse develop)" = "$before" ]
}

@test "sync-dev.sh: develop 과 feature/dev2 에 dev-1 결과가 반영되고 dev-2 범위 비교에 dev-1 파일이 섞이지 않는다" {
  git checkout -q develop
  commit_in "$WT1" src/alpha/a.ts "export const a = 1;"
  commit_in "$WT2" src/beta/b.ts "export const b = 2;"
  touch "$SIG/review-1.passed"
  run bash scripts/sync-dev.sh 1 2
  [ "$status" -eq 0 ]
  git cat-file -e develop:src/alpha/a.ts
  [ -f "$WT2/src/alpha/a.ts" ]
  run git -C "$WT2" diff --name-only develop...HEAD
  [ "$output" = "src/beta/b.ts" ]
  # integrate 의 재병합은 변경 없이 지나간다
  run git merge --no-ff feature/dev1 -m again
  [ "$status" -eq 0 ]
  [[ "$output" == *"Already up to date"* ]]
}

# ---------------------------------------------------------------- wait 신호 + 알림(tmux)

@test "wait-and-review: dev-2.wait-1 → 감시 창에 sync-dev 안내, sync-dev.sh 후 dev-2 pane 에 반영 알림" {
  need_tools tmux
  tmux_sandbox
  run bash scripts/run-agents.sh
  [ "$status" -eq 0 ]
  wait_for 20 "review-2 start --agent review-2" "$FAKE_CLAUDE_LOG"

  sig_as dev-2 dev-2.wait-1
  [ "$status" -eq 0 ]
  wait_pane 30 "sync-dev.sh 1 2" "g3-demo:watch"
  [ ! -e "$SIG/dev-2.wait-1" ]

  git checkout -q develop
  commit_in "$WT1" src/alpha/a.ts "export const a = 1;"
  touch "$SIG/review-1.passed"
  run bash scripts/sync-dev.sh 1 2
  [ "$status" -eq 0 ]
  wait_for 20 "dev-2 got: .*develop" "$FAKE_CLAUDE_LOG"
}
