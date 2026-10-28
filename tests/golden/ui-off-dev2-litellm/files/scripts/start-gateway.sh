#!/usr/bin/env bash
# scripts/start-gateway.sh : OpenAI·Gemini 를 Anthropic 형식으로 중계하는 LiteLLM 게이트웨이 (pip install 'litellm[proxy]')
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
command -v litellm >/dev/null || { echo "litellm 이 없습니다: pip install 'litellm[proxy]'" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. "$root/.agentforge/env.local"
set +a
exec litellm --config "$root/.agentforge/litellm.yaml" --port 4000
