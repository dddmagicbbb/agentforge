#!/usr/bin/env bash
# scripts/agent-env.sh <에이전트명> : source 해서 사용한다. 에이전트별 제공자·모델을 정한다.
# AgentForge가 forge.config.json 의 agents 설정으로 생성한다.
_af_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
[ -f "$_af_root/.agentforge/env.local" ] && . "$_af_root/.agentforge/env.local"

unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_MODEL CLAUDE_CODE_SUBAGENT_MODEL \
      ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL

_af_use() {  # _af_use <제공자> <모델>
  local p="$1" m="$2" url="" tok=""
  case "$p" in
    claude)     export ANTHROPIC_MODEL="$m"; return 0 ;;   # 사용자가 직접 로그인한 계정 사용
    openrouter) url="https://openrouter.ai/api";              tok="${OPENROUTER_API_KEY:-}" ;;
    ollama)     url="${OLLAMA_URL:-http://localhost:11434}";  tok="ollama" ;;
    vllm)       url="${VLLM_URL:-}";                          tok="${VLLM_TOKEN:-none}" ;;
    litellm)    url="${LITELLM_URL:-http://localhost:4000}";  tok="${LITELLM_MASTER_KEY:-}" ;;
    *) echo "알 수 없는 제공자: $p" >&2; return 1 ;;
  esac
  if [ -z "$url" ] || [ -z "$tok" ]; then
    echo "[$p] 주소 또는 키가 비었습니다. .agentforge/env.local 을 확인하세요." >&2; return 1
  fi
  export ANTHROPIC_BASE_URL="$url" ANTHROPIC_AUTH_TOKEN="$tok" ANTHROPIC_API_KEY="" \
         ANTHROPIC_MODEL="$m" CLAUDE_CODE_SUBAGENT_MODEL="$m" \
         ANTHROPIC_DEFAULT_OPUS_MODEL="$m" ANTHROPIC_DEFAULT_SONNET_MODEL="$m" \
         ANTHROPIC_DEFAULT_HAIKU_MODEL="$m"
}


case "${1:?에이전트명을 넣으세요}" in
  planner)       _af_use claude sonnet ;;
  analyst)       _af_use claude sonnet ;;
  architect)     _af_use claude sonnet ;;
  common-dev)    _af_use claude sonnet ;;
  dev-1)         _af_use claude sonnet ;;
  review-1)      _af_use claude opus ;;
  dev-2)         _af_use claude sonnet ;;
  review-2)      _af_use claude opus ;;
  integrator)    _af_use claude sonnet ;;
  *)             _af_use claude sonnet ;;
esac
