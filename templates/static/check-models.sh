#!/usr/bin/env bash
# scripts/check-models.sh [에이전트...] : 에이전트마다 실제 모델을 한 번 호출해 응답과 도구 호출(Read)을 점검한다.
# 토큰을 쓰므로 사용자가 직접 실행한다. 인자가 없으면 forge.config.json 의 agents 전부를 점검한다.
# 에이전트당 시간 제한은 AF_CHECK_TIMEOUT(기본 120초). timeout 명령이 없으면 제한 없이 실행한다.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1
cfg=.agentforge/forge.config.json
[ -f "$cfg" ] || { echo "$cfg 가 없습니다." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq 가 필요합니다." >&2; exit 1; }

limit="${AF_CHECK_TIMEOUT:-120}"
tcmd=()
if command -v timeout >/dev/null 2>&1; then tcmd=(timeout -k 5 "$limit"); fi
project="$(jq -r '.project' "$cfg")"
prompt="Read 도구로 .agentforge/forge.config.json 을 읽고 project 값만 한 단어로 답하세요."

# 한 에이전트를 점검하고 결과 한 줄을 출력한다. 종료 코드: 0 통과, 1 실패, 2 경고
# (서브셸에서 실행하므로 agent-env.sh 의 환경 변수가 다른 에이전트로 새지 않는다. 키·응답 원문은 출력하지 않는다.)
check_one() {
  local a="$1" out rc model result turns
  [ -n "$a" ] || { echo "✗ (빈 이름) 실패: 에이전트 이름 없음"; return 1; }
  # shellcheck disable=SC1091
  source scripts/agent-env.sh "$a" >/dev/null 2>&1 || { echo "✗ $a 실패: agent-env 설정 오류(주소·키 확인)"; return 1; }
  model="${ANTHROPIC_MODEL:-?}"
  out="$(${tcmd[@]+"${tcmd[@]}"} claude --agent "$a" -p "$prompt" --output-format json --max-turns 3 < /dev/null 2>/dev/null)"; rc=$?
  if { [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; } && [ "${#tcmd[@]}" -gt 0 ]; then echo "✗ $a 실패: 시간 초과"; return 1; fi
  if [ "$rc" -ne 0 ]; then echo "✗ $a 실패: 명령 실패"; return 1; fi
  if ! jq -e . <<<"$out" >/dev/null 2>&1; then echo "✗ $a 실패: JSON 해석 실패"; return 1; fi
  if [ "$(jq -r '.is_error // false' <<<"$out")" = "true" ]; then echo "✗ $a 실패: 모델이 오류를 반환"; return 1; fi
  result="$(jq -r '.result // ""' <<<"$out")"
  turns="$(jq -r '.num_turns // 0' <<<"$out")"
  if [[ "$result" != *"$project"* ]]; then echo "! $a 경고: 응답에 project 값이 없음"; return 2; fi
  if ! { [[ "$turns" =~ ^[0-9]+$ ]] && [ "$turns" -ge 2 ]; }; then echo "! $a 경고: 도구 호출을 확인하지 못함"; return 2; fi
  echo "✓ $a 통과 ($model)"
}

if [ "$#" -gt 0 ]; then agents=("$@"); else mapfile -t agents < <(jq -r '.agents | keys[]' "$cfg"); fi

pass=0; warn=0; fail=0
for a in "${agents[@]}"; do
  ( check_one "$a" ); rc=$?
  case "$rc" in 0) pass=$((pass + 1)) ;; 2) warn=$((warn + 1)) ;; *) fail=$((fail + 1)) ;; esac
done
echo "모델 점검: 통과 $pass · 경고 $warn · 실패 $fail"
[ "$fail" -eq 0 ]
