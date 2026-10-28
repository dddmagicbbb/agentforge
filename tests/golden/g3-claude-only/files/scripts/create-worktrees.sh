#!/usr/bin/env bash
# scripts/create-worktrees.sh : 개발자 수만큼 worktree 를 develop 기준으로 만든다.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
name="$(basename "$root")"
cfg=.agentforge/forge.config.json
n="$(jq -r '.developers' "$cfg")"
install="$(jq -r '.commands.install // empty' "$cfg")"

git rev-parse --verify -q develop >/dev/null || { echo "develop 브랜치가 없습니다. 공통 개발을 먼저 끝내세요." >&2; exit 1; }
mkdir -p .agentforge/signals .agentforge/panes

for i in $(seq 1 "$n"); do
  wt="$(cd "$root/.." && pwd)/$name-dev$i"
  if [ -d "$wt" ]; then echo "이미 있음: $wt"; continue; fi
  if git rev-parse --verify -q "feature/dev$i" >/dev/null; then
    git worktree add "$wt" "feature/dev$i"
  else
    git worktree add -b "feature/dev$i" "$wt" develop
  fi
  if [ -n "$install" ]; then (cd "$wt" && bash -c "$install"); fi
done
git worktree list
