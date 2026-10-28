#!/usr/bin/env bats
# T-305 / PRV-01: scripts/agent-env.sh 가 에이전트 이름별로 제공자 주소·모델을 정한다

load helpers

setup() {
  W="$BATS_TEST_TMPDIR/p"; copy_golden ui-off-dev2-litellm "$W"; cd "$W" || exit 1
}

envof() {  # envof <에이전트> : source 후 주요 변수 출력
  bash -c 'source scripts/agent-env.sh "$1" || exit $?; echo "URL=${ANTHROPIC_BASE_URL:-} TOK=${ANTHROPIC_AUTH_TOKEN:-} MODEL=${ANTHROPIC_MODEL:-} OPUS=${ANTHROPIC_DEFAULT_OPUS_MODEL:-} HAIKU=${ANTHROPIC_DEFAULT_HAIKU_MODEL:-}"' _ "$1"
}

@test "Claude 에이전트는 주소 없이 모델 별칭만 정한다" {
  run envof review-1
  [ "$status" -eq 0 ]
  [ "$output" = "URL= TOK= MODEL=opus OPUS= HAIKU=" ]
}

@test "LiteLLM 경유 에이전트: 게이트웨이 주소 + 별칭 3종을 같은 모델로" {
  printf 'LITELLM_MASTER_KEY=k-1\n' > .agentforge/env.local
  run envof dev-1
  [ "$status" -eq 0 ]
  [ "$output" = "URL=http://localhost:4000 TOK=k-1 MODEL=gemini-2.5-pro OPUS=gemini-2.5-pro HAIKU=gemini-2.5-pro" ]
}

@test "Ollama 에이전트: env.local 의 OLLAMA_URL 을 쓴다" {
  printf 'OLLAMA_URL=http://gpu-box:11434\n' > .agentforge/env.local
  run envof dev-2
  [ "$status" -eq 0 ]
  [ "$output" = "URL=http://gpu-box:11434 TOK=ollama MODEL=qwen3.5:9b OPUS=qwen3.5:9b HAIKU=qwen3.5:9b" ]
}

@test "키가 비면 오류로 끝나고 env.local 확인을 안내한다" {
  run envof planner
  [ "$status" -ne 0 ]
  [[ "$output" == *"env.local"* ]]
}

@test "목록에 없는 에이전트는 Claude sonnet" {
  run envof someone-else
  [ "$status" -eq 0 ]
  [ "$output" = "URL= TOK= MODEL=sonnet OPUS= HAIKU=" ]
}
