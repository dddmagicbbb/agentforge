#!/usr/bin/env bash
# scripts/sync-dev.sh <선행 i> <대상 j> : 검토를 통과한 dev-i 결과를 develop 에 먼저 병합하고 dev-j worktree 에 반영한다(ADR-0009).
# 사람(리드)이 메인 폴더(develop)에서 실행한다. develop 이 먼저 바뀌므로 dev-j 의 범위 검사(develop...HEAD)에 dev-i 파일이 섞이지 않는다.
set -uo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root" || exit 1
name="$(basename "$root")"
n="$(jq -r '.developers' .agentforge/forge.config.json)"
sig="$root/.agentforge/signals"; panes="$root/.agentforge/panes"
usage() { echo "사용: bash scripts/sync-dev.sh <선행 개발자 번호> <대상 개발자 번호>   예) bash scripts/sync-dev.sh 1 3" >&2; exit 2; }

[ "$#" -eq 2 ] || usage
i="$1"; j="$2"
[[ "$i" =~ ^[0-9]+$ && "$j" =~ ^[0-9]+$ ]] || usage
[ "$i" -ne "$j" ] && [ "$i" -ge 1 ] && [ "$j" -ge 1 ] && [ "$i" -le "$n" ] && [ "$j" -le "$n" ] || usage

[ -f "$sig/review-$i.passed" ] || { echo "dev-$i 가 아직 검토를 통과하지 않았습니다(review-$i.passed 없음). 통과한 결과만 반영합니다." >&2; exit 1; }
[ "$(git branch --show-current)" = develop ] || { echo "메인 폴더를 develop 으로 둔 뒤 실행하세요." >&2; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "메인 폴더(develop)에 커밋하지 않은 변경이 있습니다." >&2; exit 1; }
wt="$(cd "$root/.." && pwd)/$name-dev$j"
[ -d "$wt" ] || { echo "worktree 가 없습니다: $wt" >&2; exit 1; }
[ -z "$(git -C "$wt" status --porcelain --untracked-files=no)" ] || { echo "dev-$j worktree 에 커밋하지 않은 변경이 있습니다. dev-$j 가 커밋한 뒤 다시 실행하세요." >&2; exit 1; }

if ! git merge --no-ff "feature/dev$i" -m "[lead] sync: merge feature/dev$i into develop"; then
  git merge --abort; echo "feature/dev$i → develop 병합 충돌. 아무것도 바꾸지 않았습니다." >&2; exit 1
fi
if ! git -C "$wt" merge --no-edit develop; then
  git -C "$wt" merge --abort
  echo "develop → feature/dev$j 병합 충돌. develop 에는 dev-$i 가 반영된 채로 두었습니다. 충돌을 사람이 풀어 주세요." >&2; exit 1
fi

# dev-j pane 에 알린다(run-agents.sh 실행 중일 때)
if [ -f "$panes/dev-$j" ] && command -v tmux >/dev/null 2>&1; then
  p="$(cat "$panes/dev-$j")"
  msg="리드가 dev-$i 결과를 develop 과 feature/dev$j 에 반영했습니다. 테스트를 다시 실행하고 작업을 이어 가세요."
  if tmux send-keys -t "$p" -l "$msg" 2>/dev/null; then sleep 0.5; tmux send-keys -t "$p" Enter; fi
fi
echo "완료: feature/dev$i → develop → feature/dev$j"
