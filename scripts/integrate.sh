#!/usr/bin/env bash
# scripts/integrate.sh : 통과한 feature/devN 을 develop 에 병합하고 테스트한 뒤 통합 검증 에이전트를 띄운다.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
cfg=.agentforge/forge.config.json
n="$(jq -r '.developers' "$cfg")"
sig="$root/.agentforge/signals"; log="$root/docs/report"; mkdir -p "$log"

for i in $(seq 1 "$n"); do
  [ -f "$sig/review-$i.passed" ] || { echo "dev-$i 가 아직 검증을 통과하지 않았습니다." >&2; exit 1; }
done
[ -z "$(git status --porcelain)" ] || { echo "메인 폴더에 커밋하지 않은 변경이 있습니다." >&2; exit 1; }

git checkout develop
git tag -f pre-integration
for i in $(seq 1 "$n"); do
  if ! git merge --no-ff "feature/dev$i" -m "[integrator] merge feature/dev$i"; then
    git merge --abort
    git reset --hard pre-integration
    echo "feature/dev$i 병합 충돌. develop 을 pre-integration 태그 상태로 되돌렸습니다." >&2
    exit 1
  fi
done

# 테스트 명령은 병합된 develop 기준으로 읽는다(공통 개발이 develop 에서 바꾼 명령 반영 — 메인 폴더가 main 이었을 수 있음)
test_cmd="$(jq -r '.commands.test // "npm test"' "$cfg")"
e2e_cmd="$(jq -r '.commands.e2e // empty' "$cfg")"
status=0
{ echo "## 단위 테스트: $test_cmd"; bash -c "$test_cmd"; } > "$log/integration-test.log" 2>&1 || status=1
if [ -n "$e2e_cmd" ]; then
  { echo "## E2E: $e2e_cmd"; bash -c "$e2e_cmd"; } >> "$log/integration-test.log" 2>&1 || status=1
fi
echo "테스트 결과: $([ $status -eq 0 ] && echo 통과 || echo 실패) (docs/report/integration-test.log)"

# shellcheck disable=SC1091
source "$root/scripts/agent-env.sh" integrator
exec claude --agent integrator "통합 검증을 진행하세요. docs/report/integration-test.log 를 분석해 docs/report/integration.md 를 작성하고, 실패가 있으면 원인 파일과 담당 개발자(dev-N)를 표로 정리하세요."
