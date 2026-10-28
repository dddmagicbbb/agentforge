#!/usr/bin/env bash
# scripts/setup.sh : 압축을 푼 뒤 한 번 실행한다. 도구 확인, 실행 권한, 키 파일, git 첫 커밋.
set -euo pipefail
cd "$(dirname "$0")/.."
miss=0
for t in git tmux jq claude; do
  command -v "$t" >/dev/null || { echo "필요 도구 없음: $t"; miss=1; }
done
if [ "$miss" -ne 0 ]; then
  echo "설치 후 다시 실행하세요. (WSL Ubuntu) sudo apt install -y git tmux jq && npm install -g @anthropic-ai/claude-code"
  exit 1
fi
find scripts .claude/hooks -name '*.sh' -exec sed -i 's/\r$//' {} + -exec chmod +x {} +
mkdir -p .agentforge/signals .agentforge/panes
if [ ! -f .agentforge/env.local ]; then
  cp .agentforge/env.local.example .agentforge/env.local && chmod 600 .agentforge/env.local
  echo "생성: .agentforge/env.local  (사용하는 제공자의 주소·키를 직접 입력하세요)"
fi
if [ ! -d .git ]; then
  git init -q -b main
  git add -A
  git commit -qm "[lead] AgentForge 환경 생성" || echo "첫 커밋 실패: git config user.name / user.email 설정 후 직접 커밋하세요"
fi
echo "준비 완료. 다음 순서:"
echo "  1) claude            # 처음 한 번 직접 로그인"
echo "  2) bash scripts/run-role.sh planner   → 세션에서 /forge-init"
