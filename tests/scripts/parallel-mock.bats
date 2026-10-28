#!/usr/bin/env bats
# T-414 / RUN-02·RUN-03: 가짜 claude 로 하는 모의 병렬 실행
#   범위 밖 변경 감지, 반려 한도(dev-N.blocked), 통과 → integrate, integrate 충돌 시 abort·pre-integration 태그
# 준비 절차(ZIP → setup → develop → create-worktrees → tmux 시험 소켓)는 helpers.bash 의 공용 함수를 쓴다.
# wait-and-review.sh 는 10초 간격으로 신호를 폴링하므로 사례마다 대기 시간을 넉넉히(10초 단위) 잡는다.

load helpers

setup() {
  need_tools git tmux jq unzip node; skip_on_bsd_sed; need_build
  isolate_git; make_fake_bin; tmux_sandbox
  unpack_project; bootstrap_project
  P="$PWD"; SIG="$P/.agentforge/signals"; LOG="$FAKE_CLAUDE_LOG"
  WT1="$BATS_TEST_TMPDIR/g3-demo-dev1"; WT2="$BATS_TEST_TMPDIR/g3-demo-dev2"
}

teardown() {
  tmux_cleanup
}

# run-agents.sh 로 tmux 창·가짜 claude·감시 창을 띄운다
start_agents() {
  run bash scripts/run-agents.sh
  [ "$status" -eq 0 ]
  wait_for 20 "review-2 start --agent review-2" "$LOG"
}

# 두 개발자 모두 통과 신호를 내고 wait-and-review 가 끝나기(= integrate 안내 출력)를 기다린다
pass_all() {
  touch "$SIG/review-1.pass" "$SIG/review-2.pass"
  wait_pane 30 "scripts/integrate.sh" "g3-demo:watch"
  # (&& 로 이은 검사는 앞쪽이 실패해도 set -e 가 잡지 못하므로 한 줄에 하나씩 쓴다)
  [ -f "$SIG/review-1.passed" ]
  [ -f "$SIG/review-2.passed" ]
  [ ! -e "$SIG/review-1.pass" ]
  [ ! -e "$SIG/review-2.pass" ]
}

# integrate.sh 실행(마지막에 exec 되는 가짜 claude 가 표준입력 EOF 로 끝나도록 /dev/null 연결)
run_integrate() {
  run bash scripts/integrate.sh < /dev/null
}

# ---------------------------------------------------------------- RUN-02 범위 밖 변경

@test "범위 밖 변경: dev-1.done → dev-1 pane 에 경고, review-1 에는 검토 요청이 가지 않는다" {
  # 담당(src/alpha/) 파일과 담당 밖 파일을 모두 미커밋 상태로 만든다
  mkdir -p "$WT1/src/alpha" "$WT1/other"
  echo ok > "$WT1/src/alpha/ok.ts"; echo stray > "$WT1/other/stray.txt"
  start_agents

  touch "$SIG/dev-1.done"
  wait_for 30 "dev-1 got: 담당 범위 밖 변경이 있습니다: other/stray.txt" "$LOG"
  # 범위 안 파일은 경고에 나오지 않고, 검토 요청은 어느 review 에도 가지 않는다
  not_in_file "ok.ts" "$LOG"
  not_in_file "review-1 got:" "$LOG"
  not_in_file "review-2 got:" "$LOG"
  # 신호는 소비되어 이력으로 남는다
  [ ! -e "$SIG/dev-1.done" ]
  compgen -G "$SIG/dev-1.done.*" >/dev/null
}

@test "범위 안 변경만 있으면 review-1 에 코드 검토 요청이 간다(대조군)" {
  commit_in "$WT1" src/alpha/a.ts "export const a = 1;"
  start_agents

  touch "$SIG/dev-1.done"
  wait_for 30 "review-1 got: 코드 검토:" "$LOG"
  not_in_file "dev-1 got:" "$LOG"
}

# ---------------------------------------------------------------- RUN-03 반려 한도

@test "반려 한도: review-1.reject 가 maxRejects(3)번 쌓이면 dev-1.blocked" {
  [ "$(jq -r '.maxRejects' .agentforge/forge.config.json)" -eq 3 ]
  start_agents

  # 1~2회: dev-1 에게 코드 반려 메시지가 가고 blocked 는 없다
  # (신호 이력 이름의 초 단위 시각이 겹치지 않도록, 소비된 뒤에 다음 신호를 낸다)
  touch "$SIG/review-1.reject"; wait_gone 25 "$SIG/review-1.reject"
  wait_count 10 "dev-1 got: 코드 반려" "$LOG" 1
  touch "$SIG/review-1.reject"; wait_gone 25 "$SIG/review-1.reject"
  wait_count 10 "dev-1 got: 코드 반려" "$LOG" 2
  [ ! -e "$SIG/dev-1.blocked" ]

  # 3회째: 자동 반복을 멈추고 blocked 신호를 만든다(반려 메시지는 더 가지 않는다)
  touch "$SIG/review-1.reject"; wait_gone 25 "$SIG/review-1.reject"
  wait_file 10 "$SIG/dev-1.blocked"
  [ "$(grep -c "dev-1 got: 코드 반려" "$LOG")" -eq 2 ]
  [ "$(find "$SIG" -maxdepth 1 -name 'review-1.reject.*' | wc -l)" -eq 3 ]
  # 다른 개발자는 영향이 없다
  [ ! -e "$SIG/dev-2.blocked" ]
  not_in_file "dev-2 got:" "$LOG"
}

# ---------------------------------------------------------------- 통과 → integrate

@test "전원 통과 → wait-and-review 종료 → integrate.sh 가 feature 브랜치를 병합하고 integrator 실행" {
  commit_in "$WT1" src/alpha/a.txt "alpha"
  commit_in "$WT2" src/beta/b.txt "beta"
  start_agents
  pass_all

  run_integrate
  [ "$status" -eq 0 ]
  [ "$(git branch --show-current)" = "develop" ]
  [ "$(git show develop:src/alpha/a.txt)" = "alpha" ]
  [ "$(git show develop:src/beta/b.txt)" = "beta" ]
  # 병합 커밋 2개(feature/dev1, feature/dev2), 병합 직전을 가리키는 태그
  [ "$(git rev-list --merges --count pre-integration..develop)" -eq 2 ]
  git merge-base --is-ancestor pre-integration develop
  [ -f docs/report/integration-test.log ]
  # 마지막에 integrator 에이전트가 실행된다(가짜 claude 가 인자를 기록)
  grep -q "start --agent integrator 통합 검증을 진행하세요" "$LOG"
}

@test "충돌(두 dev 가 같은 파일을 다르게 수정): 병합 abort, exit 1, pre-integration 태그 유지, integrator 미실행" {
  commit_in "$WT1" README.md "dev1 version"
  commit_in "$WT2" README.md "dev2 version"
  start_agents
  pass_all

  run_integrate
  [ "$status" -eq 1 ]
  [[ "$output" == *"feature/dev2 병합 충돌"* ]]
  # 병합 중간 상태가 남지 않는다
  [ ! -e "$(git rev-parse --git-path MERGE_HEAD)" ]
  [ -z "$(git status --porcelain)" ]
  # 태그가 있고 develop 은 태그에서 이어진 상태다
  git rev-parse -q --verify refs/tags/pre-integration >/dev/null
  git merge-base --is-ancestor pre-integration develop
  not_in_file "start --agent integrator" "$LOG"
  # 충돌 난 쪽의 내용은 develop 에 들어오지 않는다
  [ "$(git show develop:README.md)" != "dev2 version" ]
}

@test "첫 병합부터 충돌: develop 은 pre-integration 태그 그대로" {
  # develop 이 worktree 생성 뒤에 앞서가서 feature/dev1 과 같은 파일을 다르게 바꾼 상태
  git checkout -q develop
  printf '%s\n' "develop changed" > README.md
  git add -A
  git commit -qm "base change"
  commit_in "$WT1" README.md "dev1 version"
  commit_in "$WT2" src/beta/b.txt "beta"
  start_agents
  pass_all

  run_integrate
  [ "$status" -eq 1 ]
  [[ "$output" == *"feature/dev1 병합 충돌"* ]]
  [ ! -e "$(git rev-parse --git-path MERGE_HEAD)" ]
  [ -z "$(git status --porcelain)" ]
  [ "$(git rev-parse develop)" = "$(git rev-parse pre-integration)" ]
  [ "$(git log -1 --format=%s develop)" = "base change" ]
  not_in_file "start --agent integrator" "$LOG"
}
