#!/usr/bin/env bash
# pnpm test:scripts : 생성 스크립트 검사(bash -n → shellcheck → bats).
# CI(CI=true)에서는 shellcheck·bats 가 없으면 실패, 로컬에서는 경고 후 건너뛴다.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
fail=0

need() {  # need <도구> : 없으면 CI 에서는 실패, 로컬에서는 건너뜀
  command -v "$1" >/dev/null && return 0
  if [ "${CI:-}" = "true" ]; then echo "✗ $1 없음(CI 필수)"; fail=1; else echo "! $1 없음 — 건너뜀(WSL: sudo apt install -y $1)"; fi
  return 1
}

echo "== bash -n"
for f in templates/static/*.sh templates/static/agent-env.head scripts/*.sh .claude/hooks/*.sh; do
  if bash -n "$f"; then echo "✓ $f"; else echo "✗ $f"; fail=1; fi
done

echo "== shellcheck (경고 이상 0건)"
if need shellcheck; then
  shellcheck -S warning -s bash templates/static/*.sh templates/static/agent-env.head tests/scripts/*.sh && echo "✓ templates/static" || fail=1
fi

echo "== bats"
if need bats; then
  bats tests/scripts || fail=1
fi

[ "$fail" -eq 0 ] && echo "test:scripts 통과" || { echo "test:scripts 실패"; exit 1; }
