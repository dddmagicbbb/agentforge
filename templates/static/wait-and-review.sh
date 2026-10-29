#!/usr/bin/env bash
# scripts/wait-and-review.sh : 신호 파일을 감시해 설계 검토 → 구현 → 코드 검토 → 반려 루프를 중계한다.
set -uo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root" || exit 1
name="$(basename "$root")"
n="$(jq -r '.developers' .agentforge/forge.config.json)"
max="$(jq -r '.maxRejects // 3' .agentforge/forge.config.json)"
sig="$root/.agentforge/signals"; panes="$root/.agentforge/panes"

say() {  # say <에이전트> <메시지> : 해당 pane 에 문장을 입력하고 Enter
  local p; p="$(cat "$panes/$1")"
  tmux send-keys -t "$p" -l "$2"; sleep 0.5; tmux send-keys -t "$p" Enter
  echo "$(date +%H:%M:%S) → $1: $2"
}
take() {  # 신호 소비(이력 보존): 같은 초에 또 소비되면 .<초>.<n> 으로 덮어쓰기를 피한다
  [ -f "$sig/$1" ] || return 1
  local base n=0 dest; base="$sig/$1.$(date +%s)"; dest="$base"
  while [ -e "$dest" ]; do n=$((n + 1)); dest="$base.$n"; done
  mv "$sig/$1" "$dest"
}
count() { find "$sig" -maxdepth 1 -name "$1.*" | wc -l; }
block() {  # block <i> <종류> : 반려 한도 도달 → 자동 반복 중지, dev-N.blocked
  echo "!! dev-$1 $2 반려 ${max}회. 자동 반복을 멈춥니다. 사람이 판단하세요."
  tmux display-message -t "$name" "dev-$1 $2 반려 ${max}회: 사람 확인 필요" 2>/dev/null || true
  touch "$sig/dev-$1.blocked"
}

out_of_scope() {  # out_of_scope <i> : 담당 범위 밖 변경 파일 출력
  # dev-N 과 review-N 은 같은 worktree 를 쓰므로 짝 검토자 범위(review-N.paths: 검토 파일)도 허용한다
  local i="$1" wt f p hit
  wt="$(cd "$root/.." && pwd)/$name-dev$i"
  { git -C "$wt" diff --name-only develop...HEAD; git -C "$wt" status --porcelain --untracked-files=all | cut -c4-; } | sort -u |
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    hit=0
    while IFS= read -r p; do
      p="${p%%#*}"; p="${p//[[:space:]]/}"; [ -z "$p" ] && continue
      case "$f" in "$p"*) hit=1; break;; esac
    done < <(cat "$wt/.claude/devs/dev-$i.paths" "$wt/.claude/devs/review-$i.paths" 2>/dev/null)
    [ "$hit" -eq 0 ] && echo "$f"
  done
}

echo "감시 시작: 개발자 ${n}명, 반려 한도 ${max}회 (중지: Ctrl-c)"
while :; do
  passed=0
  for i in $(seq 1 "$n"); do
    if take "design-$i.done"; then
      say "review-$i" "설계 검토: docs/design/detail/dev-$i.md 를 검토하고 design-$i.pass 또는 design-$i.reject 신호를 만드세요."
    fi
    if take "design-$i.pass"; then
      say "dev-$i" "설계 승인. 테스트를 먼저 쓰고 구현하세요. 끝나면 커밋하고 dev-$i.done 신호를 만드세요."
    fi
    if take "design-$i.reject"; then
      # 설계 반려도 한도를 둔다(대조할 설계·계약이 없으면 반려가 끝없이 반복될 수 있음)
      if [ "$(count "design-$i.reject")" -ge "$max" ]; then
        block "$i" 설계
      else
        say "dev-$i" "설계 반려. docs/review/dev-$i.md 를 읽고 상세 설계를 고친 뒤 design-$i.done 신호를 다시 만드세요."
      fi
    fi
    if [ -f "$sig/dev-$i.done" ]; then
      bad="$(out_of_scope "$i")"
      take "dev-$i.done"
      if [ -n "$bad" ]; then
        say "dev-$i" "담당 범위 밖 변경이 있습니다: $(echo "$bad" | tr '\n' ' ') 되돌린 뒤 dev-$i.done 을 다시 만드세요."
      else
        say "review-$i" "코드 검토: 테스트를 실행하고 결과를 docs/review/dev-$i.md 에 쓰고 커밋한 뒤 review-$i.pass 또는 review-$i.reject 신호를 만드세요."
      fi
    fi
    if take "review-$i.reject"; then
      if [ "$(count "review-$i.reject")" -ge "$max" ]; then
        block "$i" 코드
      else
        say "dev-$i" "코드 반려. docs/review/dev-$i.md 의 지적 사항만 고치고 커밋한 뒤 dev-$i.done 을 다시 만드세요."
      fi
    fi
    [ -f "$sig/review-$i.pass" ] && { touch "$sig/review-$i.passed"; take "review-$i.pass"; echo "✓ dev-$i 통과"; }
    [ -f "$sig/review-$i.passed" ] && passed=$((passed + 1))
  done
  if [ "$passed" -eq "$n" ]; then echo "전원 통과. 다음: bash scripts/integrate.sh"; exit 0; fi
  sleep 10
done
