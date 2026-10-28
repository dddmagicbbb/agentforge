#!/usr/bin/env bash
# scripts/run-role.sh <에이전트> [첫 프롬프트] : 순차 단계 에이전트를 현재 터미널에서 실행
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
# shellcheck disable=SC1091
source scripts/agent-env.sh "$1"
exec claude --agent "$1" ${2:+"$2"}
