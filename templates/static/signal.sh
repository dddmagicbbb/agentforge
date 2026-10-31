#!/usr/bin/env bash
# scripts/signal.sh <신호> : 병렬 실행 중 에이전트가 완료·판정·대기를 알린다(ADR-0009).
# 변수 없는 고정 명령이라 settings.json 허용 목록(Bash(bash scripts/signal.sh:*))으로 승인 없이 실행된다.
# 자기 번호·역할의 신호만 만든다(AF_AGENT 기준).
#   dev-N   : design-N.done, dev-N.done, dev-N.wait-M (dev-M 결과 대기, M≠N)
#   review-N: design-N.pass|reject, review-N.pass|reject
set -euo pipefail
usage() { echo "사용: bash scripts/signal.sh <신호>   예) bash scripts/signal.sh design-1.done" >&2; exit 2; }
[ "$#" -eq 1 ] || usage
s="$1"; a="${AF_AGENT:-}"; dir="${AF_SIGNALS:-}"
if [ -z "$a" ] || [ -z "$dir" ]; then
  echo "AF_AGENT·AF_SIGNALS 가 없습니다. run-agents.sh 가 띄운 세션에서만 신호를 만들 수 있습니다." >&2; exit 2
fi
n="${a#*-}"
[[ "$n" =~ ^[0-9]+$ ]] || { echo "신호를 만들 수 없는 에이전트입니다: $a" >&2; exit 2; }
case "$a" in
  dev-*) re="^(design-$n\.done|dev-$n\.done|dev-$n\.wait-[0-9]+)$" ;;
  review-*) re="^(design-$n\.(pass|reject)|review-$n\.(pass|reject))$" ;;
  *) echo "신호를 만들 수 없는 에이전트입니다: $a" >&2; exit 2 ;;
esac
[[ "$s" =~ $re ]] || { echo "$a 는 '$s' 신호를 만들 수 없습니다." >&2; exit 2; }
[ "$s" != "dev-$n.wait-$n" ] || { echo "자기 자신을 기다릴 수 없습니다: $s" >&2; exit 2; }
[ -d "$dir" ] || { echo "신호 폴더가 없습니다: $dir" >&2; exit 2; }
touch "$dir/$s"
echo "신호: $s"
