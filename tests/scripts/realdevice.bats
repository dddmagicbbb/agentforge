#!/usr/bin/env bats
# PH5 실기 점검(T-501): 구성 3종 × (이 bats 를 실행한 환경) 1칸씩.
# 받은 ZIP → 권한 → setup.sh → check-forge.sh(문서 더미) → agent-env.sh(전 에이전트) → create-worktrees.sh
#   → run-agents.sh(가짜 claude) → 신호 1건 전달 까지 끊김 없이 이어지는지 확인한다.
# 실제 Claude Code 로그인·/forge-init 주기는 사람이 한다(docs/report-realdevice.md).
# 환경 4종: ubuntu·macOS(CI build-test), Dev Container(CI realdevice-devcontainer), WSL(사람: pnpm test:scripts)

load helpers

setup() {
  need_tools git tmux jq unzip node; need_build; need_bash4
  isolate_git; make_fake_bin; tmux_sandbox
}

teardown() {
  tmux_cleanup
}

# 구성 입력으로 ZIP 을 만들어 풀고 프로젝트 폴더로 이동: rd_unpack <구성>
rd_unpack() {
  cd "$BATS_TEST_TMPDIR" || return 1
  node "$REPO/tools/make-zip.mjs" "$REPO/tests/realdevice/$1.json" rd.zip >/dev/null
  unzip -q rd.zip
  P="$(jq -r .name "$REPO/tests/realdevice/$1.json")"
  N="$(jq -r .developerCount "$REPO/tests/realdevice/$1.json")"
  cd "$P" || return 1
}

# 실행 권한: .sh 는 모두 실행 가능, 그 밖의 파일은 실행 불가(EXP-01)
rd_modes() {
  local f bad=0
  while IFS= read -r f; do [ -x "$f" ] || { echo "실행 권한 없음: $f"; bad=1; }; done < <(find . -name '*.sh' -not -path './.git/*')
  while IFS= read -r f; do [ ! -x "$f" ] || { echo "실행 권한이 붙음: $f"; bad=1; }; done < <(find . -type f -not -name '*.sh' -not -path './.git/*')
  return "$bad"
}

# 기능 ID F-001..F-N 을 dev-1..N 에 하나씩 배정한 더미 PRD·tasks(기획·분석 단계 산출물 대신)
rd_docs() {
  local i
  { echo '# PRD'; for ((i = 1; i <= N; i++)); do printf -- '- F-%03d 기능 %d\n' "$i" "$i"; done; } > docs/prd.md
  { echo '# 작업'; for ((i = 1; i <= N; i++)); do printf '| T-%d01 | F-%03d | dev-%d |\n' "$i" "$i" "$i"; done; } > docs/tasks.md
}

# env.local 의 빈 키를 더미 값으로 채운다(사람이 직접 넣는 단계 대신, 값은 시험 전용)
rd_fill_env() {
  local k v
  : > .agentforge/env.local.tmp
  while IFS='=' read -r k v; do
    case "$k" in ''|\#*) continue ;; esac
    printf '%s=%s\n' "$k" "${v:-rd-dummy}" >> .agentforge/env.local.tmp
  done < .agentforge/env.local.example
  mv .agentforge/env.local.tmp .agentforge/env.local
}

# 에이전트 목록(.claude/agents/*.md) 전부에 대해 agent-env.sh 가 성공하고 ANTHROPIC_MODEL 을 정하는지
rd_agent_env() {
  local f a out bad=0
  for f in .claude/agents/*.md; do
    a="$(basename "$f" .md)"
    out="$(bash -c 'source scripts/agent-env.sh "$1" && echo "$ANTHROPIC_MODEL"' _ "$a" 2>&1)" || { echo "agent-env 실패: $a: $out"; bad=1; continue; }
    [ -n "$out" ] || { echo "모델 없음: $a"; bad=1; }
  done
  return "$bad"
}

rd_full_cycle() {  # rd_full_cycle <구성>
  rd_unpack "$1"
  rd_modes

  run bash scripts/setup.sh
  echo "$output"
  [ "$status" -eq 0 ]
  [ -d .git ]
  [ "$(stat -c %a .agentforge/env.local 2>/dev/null || stat -f %Lp .agentforge/env.local)" = "600" ]

  rd_docs
  run bash scripts/check-forge.sh
  echo "$output"
  [ "$status" -eq 0 ]
  [[ "$output" == *"검증 통과"* ]]

  rd_fill_env
  rd_agent_env

  git add -A && git commit -qm "[lead] 문서 더미"
  git branch develop
  run bash scripts/create-worktrees.sh
  [ "$status" -eq 0 ]
  local i
  for ((i = 1; i <= N; i++)); do [ -d "../$P-dev$i" ]; done
  [ ! -d "../$P-dev$((N + 1))" ]

  run bash scripts/run-agents.sh
  [ "$status" -eq 0 ]
  wait_for 30 "review-$N start --agent review-$N" "$FAKE_CLAUDE_LOG"
  for ((i = 1; i <= N; i++)); do grep -q "dev-$i start --agent dev-$i" "$FAKE_CLAUDE_LOG"; done

  touch .agentforge/signals/design-1.done
  wait_for 30 "review-1 got: 설계 검토: docs/design/detail/dev-1.md" "$FAKE_CLAUDE_LOG"
}

@test "구성 A Claude 단일(UI 켬·개발자 3): ZIP → setup → check-forge → worktree → 병렬 실행 → 신호 전달" {
  rd_full_cycle claude-only
  [ -f .claude/agents/ux-designer.md ]
  [ ! -f scripts/start-gateway.sh ]
}

@test "구성 B 제공자 혼용(vLLM·OpenRouter·LiteLLM): 같은 주기 + 게이트웨이 파일 포함" {
  rd_full_cycle mixed
  [ -x scripts/start-gateway.sh ]
  [ -f .agentforge/litellm.yaml ]
  # 비 Claude 에이전트는 frontmatter model 을 inherit 로 두고 agent-env 가 모델을 정한다
  grep -q '^model: inherit' .claude/agents/dev-1.md
}

@test "구성 C 개발자 1명·UI 끔: 같은 주기 + ux-designer·dev-2 없음" {
  rd_full_cycle dev1-ui-off
  [ ! -f .claude/agents/ux-designer.md ]
  [ ! -f .claude/agents/dev-2.md ]
  [ ! -e docs/design/ui ]
}
